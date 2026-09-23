import fs from "node:fs";
import path from "node:path";
import { getSections, openDb, stats, writePassages } from "./db";
import { chunkSection, fold, parseWork } from "./parse";
import { SOURCES, type SourceDef } from "./sources";
import type { Story } from "../stories";

export interface BuildOptions {
  rawDir: string;
  dbPath: string;
  stories: Story[];
  sources?: SourceDef[];
  log?: (line: string) => void;
}

export interface BuildResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Build the corpus into `<dbPath>.tmp` and atomically replace `dbPath` only if
 * every check passes: all volumes present, every book parsed, a plausible number
 * of sections per work, and every story pin containing its expected terms.
 * On any failure the temporary file is removed and the existing corpus is kept.
 */
export function buildCorpus({ rawDir, dbPath, stories, sources = Object.values(SOURCES), log = () => {} }: BuildOptions): BuildResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tmp = `${dbPath}.tmp`;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.rmSync(tmp, { force: true });
  const db = openDb(tmp);

  try {
    for (const src of sources) {
      const files = src.gutenbergIds.map((id) => path.join(rawDir, `${src.work}-${id}.txt`));
      const missing = files.filter((f) => !fs.existsSync(f));
      if (missing.length) {
        errors.push(`${src.work}: missing ${missing.map((f) => path.basename(f)).join(", ")} (run npm run corpus:fetch)`);
        continue;
      }

      const parsed = parseWork(src.work, files.map((f) => fs.readFileSync(f, "utf8")));
      warnings.push(...parsed.warnings);
      const passages = parsed.sections.flatMap((s) => chunkSection(s));
      writePassages(db, passages);
      log(`${src.title} (${src.translator}): ${parsed.sections.length} sections → ${passages.length} passages`);

      if (parsed.sections.length < src.minSections) {
        errors.push(`${src.work}: only ${parsed.sections.length} sections parsed (expected at least ${src.minSections})`);
      }
      const books = new Set(parsed.sections.map((s) => s.book));
      const absent = src.books.filter((b) => !b.notInEdition && !books.has(b.slug)).map((b) => b.slug);
      if (absent.length) errors.push(`${src.work}: no sections found for ${absent.join(", ")}`);
    }

    log("\nBooks indexed:");
    for (const s of stats(db)) {
      log(`  ${s.work.padEnd(12)} ${s.book.padEnd(16)} §${s.first}–${s.last}  (${s.sections} sections, ${s.passages} passages)`);
    }

    log("\nChecking story pins:");
    const works = new Set(sources.map((s) => s.work));
    for (const story of stories) {
      const { work, book, from, to, expect } = story.source;
      if (!works.has(work)) continue;
      const text = fold(getSections(db, work, book, from, to).map((p) => p.text).join(" "));
      const ok = text.length > 0 && expect.every((e) => text.includes(fold(e)));
      log(`  ${ok ? "✓" : "✗"} ${story.id}: ${work}/${book} §${from}–${to}`);
      if (!ok) errors.push(`story ${story.id}: ${work}/${book} §${from}–${to} does not contain ${expect.join(", ")}`);
    }
  } catch (e) {
    errors.push((e as Error).message);
  } finally {
    db.close();
  }

  if (errors.length) {
    fs.rmSync(tmp, { force: true });
    return { ok: false, errors, warnings };
  }
  fs.renameSync(tmp, dbPath);
  return { ok: true, errors, warnings };
}
