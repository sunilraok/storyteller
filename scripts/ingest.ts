/**
 * Parse corpus/raw/*.txt into passages and build data/corpus.db (SQLite + FTS5).
 *
 *   npm run corpus:ingest
 */
import fs from "node:fs";
import path from "node:path";
import { openDb, stats, writePassages, getSections, DEFAULT_DB_PATH } from "../lib/corpus/db";
import { chunkSection, fold, parseWork } from "../lib/corpus/parse";
import { SOURCES } from "../lib/corpus/sources";
import { STORIES } from "../lib/stories";

const RAW_DIR = path.join(process.cwd(), "corpus", "raw");

function main() {
  const tmp = DEFAULT_DB_PATH + ".tmp";
  fs.mkdirSync(path.dirname(DEFAULT_DB_PATH), { recursive: true });
  fs.rmSync(tmp, { force: true });
  const db = openDb(tmp);

  for (const src of Object.values(SOURCES)) {
    const volumes = src.gutenbergIds
      .map((id) => path.join(RAW_DIR, `${src.work}-${id}.txt`))
      .filter((f) => {
        if (fs.existsSync(f)) return true;
        console.warn(`! missing ${path.relative(process.cwd(), f)} — run npm run corpus:fetch`);
        return false;
      })
      .map((f) => fs.readFileSync(f, "utf8"));
    if (!volumes.length) continue;

    const { sections, warnings } = parseWork(src.work, volumes);
    const passages = sections.flatMap((s) => chunkSection(s));
    writePassages(db, passages);
    console.log(`${src.title} (${src.translator}): ${sections.length} sections → ${passages.length} passages`);
    for (const w of warnings.slice(0, 20)) console.warn(`  ! ${w}`);
    if (warnings.length > 20) console.warn(`  ! …and ${warnings.length - 20} more warnings`);
  }

  console.log("\nBooks indexed:");
  for (const s of stats(db)) {
    console.log(`  ${s.work.padEnd(12)} ${s.book.padEnd(16)} §${s.first}–${s.last}  (${s.sections} sections, ${s.passages} passages)`);
  }

  console.log("\nChecking story pins:");
  let bad = 0;
  for (const story of STORIES) {
    const { work, book, from, to, expect } = story.source;
    const text = fold(getSections(db, work, book, from, to).map((p) => p.text).join(" "));
    const ok = text.length > 0 && expect.every((e) => text.includes(fold(e)));
    if (!ok) bad++;
    console.log(`  ${ok ? "✓" : "✗"} ${story.id}: ${work}/${book} §${from}–${to}${ok ? "" : ` (expected: ${expect.join(", ")})`}`);
  }

  db.close();
  fs.renameSync(tmp, DEFAULT_DB_PATH);
  console.log(`\nWrote ${path.relative(process.cwd(), DEFAULT_DB_PATH)}`);
  if (bad) console.warn(`${bad} story pin(s) did not match; fix the ranges in data/stories.json.`);
}

main();
