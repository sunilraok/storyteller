import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import type { Passage } from "./parse";
import { getBook, SOURCES, type WorkId } from "./sources";

export const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "corpus.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS passages (
  id TEXT PRIMARY KEY,
  work TEXT NOT NULL,
  book TEXT NOT NULL,
  section INTEGER NOT NULL,
  part INTEGER NOT NULL,
  sub_parva TEXT,
  text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS passages_loc ON passages(work, book, section, part);
CREATE VIRTUAL TABLE IF NOT EXISTS passages_fts USING fts5(
  text, content='passages', content_rowid='rowid', tokenize='porter unicode61 remove_diacritics 2'
);
`;

export function openDb(file = DEFAULT_DB_PATH, opts: { readonly?: boolean } = {}) {
  if (opts.readonly && !fs.existsSync(file)) {
    throw new CorpusMissingError(file);
  }
  const db = new Database(file, { readonly: !!opts.readonly, fileMustExist: !!opts.readonly });
  if (!opts.readonly) db.exec(SCHEMA);
  return db;
}

export class CorpusMissingError extends Error {
  constructor(file: string) {
    super(`Corpus database not found at ${file}. Run \`npm run corpus:fetch && npm run corpus:ingest\`.`);
  }
}

export function writePassages(db: Database.Database, passages: Passage[]) {
  const insert = db.prepare(
    `INSERT OR REPLACE INTO passages (id, work, book, section, part, sub_parva, text)
     VALUES (@id, @work, @book, @section, @part, @subParva, @text)`,
  );
  db.transaction((rows: Passage[]) => {
    for (const p of rows) insert.run({ ...p, subParva: p.subParva ?? null });
  })(passages);
  db.exec(`INSERT INTO passages_fts(passages_fts) VALUES('rebuild')`);
}

interface Row {
  id: string;
  work: WorkId;
  book: string;
  section: number;
  part: number;
  sub_parva: string | null;
  text: string;
}

const toPassage = (r: Row): Passage => ({
  id: r.id,
  work: r.work,
  book: r.book,
  section: r.section,
  part: r.part,
  subParva: r.sub_parva ?? undefined,
  text: r.text,
});

export function getSections(
  db: Database.Database,
  work: WorkId,
  book: string,
  from: number,
  to: number,
): Passage[] {
  const rows = db
    .prepare(
      `SELECT * FROM passages WHERE work = ? AND book = ? AND section BETWEEN ? AND ?
       ORDER BY section, part`,
    )
    .all(work, book, from, to) as Row[];
  return rows.map(toPassage);
}

export function getPassage(db: Database.Database, id: string): Passage | undefined {
  const row = db.prepare(`SELECT * FROM passages WHERE id = ?`).get(id) as Row | undefined;
  return row && toPassage(row);
}

/** Turn free text into a safe FTS5 OR-query of quoted terms. */
export function toFtsQuery(input: string): string {
  const terms = input
    .toLowerCase()
    .split(/[^\p{L}\p{N}-]+/u)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
  return [...new Set(terms)].map((t) => `"${t.replace(/"/g, "")}"`).join(" OR ");
}

const STOPWORDS = new Set(
  "the a an and or of to in on at for with by from is was were be been who whom what when where why how did does do his her their its this that these those tell me about story".split(
    " ",
  ),
);

export function search(
  db: Database.Database,
  query: string,
  opts: { limit?: number; work?: WorkId } = {},
): Passage[] {
  const fts = toFtsQuery(query);
  if (!fts) return [];
  const rows = db
    .prepare(
      `SELECT p.* FROM passages_fts f JOIN passages p ON p.rowid = f.rowid
       WHERE passages_fts MATCH ? ${opts.work ? "AND p.work = ?" : ""}
       ORDER BY bm25(passages_fts) LIMIT ?`,
    )
    .all(...(opts.work ? [fts, opts.work, opts.limit ?? 8] : [fts, opts.limit ?? 8])) as Row[];
  return rows.map(toPassage);
}

export function stats(db: Database.Database) {
  return db
    .prepare(
      `SELECT work, book, COUNT(DISTINCT section) AS sections, COUNT(*) AS passages,
              MIN(section) AS first, MAX(section) AS last
       FROM passages GROUP BY work, book`,
    )
    .all() as { work: WorkId; book: string; sections: number; passages: number; first: number; last: number }[];
}

/** Human-readable citation label, e.g. "Ganguli, Ādi Parva §134". */
export function citationLabel(p: Pick<Passage, "work" | "book" | "section">): string {
  const src = SOURCES[p.work];
  const book = getBook(p.work, p.book)?.name ?? p.book;
  const surname = src.translator.split(" ").at(-1);
  return p.work === "ramayana"
    ? `${surname}, ${book}, ${src.chapterLabel} ${p.section}`
    : `${surname}, ${book} §${p.section}`;
}

let shared: Database.Database | null = null;
/** Read-only connection reused across requests in the Next.js server. */
export function corpus(): Database.Database {
  if (!shared) shared = openDb(process.env.CORPUS_DB_PATH ?? DEFAULT_DB_PATH, { readonly: true });
  return shared;
}
