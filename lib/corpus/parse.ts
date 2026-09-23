import { SOURCES, type BookDef, type WorkId } from "./sources";

export interface Section {
  work: WorkId;
  book: string; // BookDef.slug
  section: number;
  subParva?: string;
  text: string;
}

export interface Passage {
  id: string;
  work: WorkId;
  book: string;
  section: number;
  part: number;
  subParva?: string;
  text: string;
}

export interface ParseReport {
  sections: Section[];
  warnings: string[];
}

/** Uppercase, strip diacritics and punctuation, collapse whitespace. */
export function normalizeHeading(line: string): string {
  return line
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

export function romanToInt(roman: string): number | null {
  const s = roman.toUpperCase();
  if (!/^[IVXLCDM]+$/.test(s)) return null;
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = ROMAN[s[i]];
    const next = ROMAN[s[i + 1]] ?? 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

const SECTION_RE = /^(?:SECTION|SARGA|CHAPTER)\s+([IVXLCDM]+|\d+)\s*\.?$/i;
const SUB_PARVA_RE = /^\(([^()]+ Parva)(?: continued)?\)\.?$/i;

/** Strip the Project Gutenberg licence header and footer, if present. */
export function stripGutenbergBoilerplate(raw: string): string {
  const text = raw.replace(/\r\n?/g, "\n");
  const start = text.search(/^\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG.*$/m);
  const end = text.search(/^\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG.*$/m);
  const from = start >= 0 ? text.indexOf("\n", start) + 1 : 0;
  return text.slice(from, end >= 0 ? end : undefined);
}

function matchBook(books: BookDef[], line: string): BookDef | undefined {
  const norm = normalizeHeading(line);
  if (!norm || norm.length > 60) return undefined;
  return books.find((b) => b.heading.test(norm));
}

function cleanBody(lines: string[]): string {
  return lines
    .join("\n")
    .replace(/\[Footnote[^\]]*\]/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Split one Gutenberg volume into sections.
 *
 * `initialBook` lets a volume continue a book begun in the previous volume.
 * Text before the first recognised book heading is ignored (title pages, prefaces).
 */
export function parseVolume(
  work: WorkId,
  raw: string,
  initialBook?: string,
): ParseReport & { lastBook?: string } {
  const { books } = SOURCES[work];
  const lines = stripGutenbergBoilerplate(raw).split("\n");
  const sections: Section[] = [];
  const warnings: string[] = [];

  let book = initialBook;
  let subParva: string | undefined;
  let current: { section: number; subParva?: string; lines: string[] } | null = null;
  const seen = new Set<string>();

  const flush = () => {
    if (!current || !book) return;
    const text = cleanBody(current.lines);
    const key = `${book}:${current.section}`;
    if (text.length < 40) {
      // Table-of-contents entries and empty headings.
    } else if (seen.has(key)) {
      // A repeated section number inside one book usually means a missed book heading.
      warnings.push(`duplicate ${work} ${book} §${current.section}; appended to earlier text`);
      const prev = sections.find((s) => s.book === book && s.section === current!.section);
      if (prev) prev.text += "\n\n" + text;
    } else {
      seen.add(key);
      sections.push({ work, book, section: current.section, subParva: current.subParva, text });
    }
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const bookMatch = matchBook(books, trimmed);
    if (bookMatch) {
      flush();
      if (bookMatch.slug !== book) subParva = undefined;
      book = bookMatch.slug;
      continue;
    }
    const sec = SECTION_RE.exec(trimmed);
    if (sec) {
      flush();
      const n = /^\d+$/.test(sec[1]) ? Number(sec[1]) : romanToInt(sec[1]);
      if (n && book) current = { section: n, subParva, lines: [] };
      continue;
    }
    const sub = SUB_PARVA_RE.exec(trimmed);
    if (sub && current && current.lines.every((l) => !l.trim())) {
      subParva = sub[1];
      current.subParva = subParva;
      continue;
    }
    current?.lines.push(line);
  }
  flush();
  return { sections, warnings, lastBook: book };
}

export function parseWork(work: WorkId, volumes: string[]): ParseReport {
  const all: Section[] = [];
  const warnings: string[] = [];
  let book: string | undefined;
  for (const raw of volumes) {
    const r = parseVolume(work, raw, book);
    all.push(...r.sections);
    warnings.push(...r.warnings);
    book = r.lastBook;
  }
  return { sections: all, warnings };
}

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

/**
 * Split a section into passages of roughly `target` words on paragraph boundaries,
 * never exceeding `max` words unless a single paragraph is longer.
 */
export function chunkSection(s: Section, target = 450, max = 600): Passage[] {
  const paragraphs = s.text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf: string[] = [];
  let words = 0;
  for (const p of paragraphs) {
    const w = wordCount(p);
    if (buf.length && (words >= target || words + w > max)) {
      chunks.push(buf.join("\n\n"));
      buf = [];
      words = 0;
    }
    buf.push(p);
    words += w;
  }
  if (buf.length) chunks.push(buf.join("\n\n"));
  return chunks.map((text, i) => ({
    id: `${s.work}:${s.book}:${s.section}:${i + 1}`,
    work: s.work,
    book: s.book,
    section: s.section,
    part: i + 1,
    subParva: s.subParva,
    text,
  }));
}

/** Lowercase and strip diacritics, for loose text comparisons ("Hanumān" → "hanuman"). */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
