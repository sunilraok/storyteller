/**
 * Parse corpus/raw/*.txt into passages and build data/corpus.db (SQLite + FTS5).
 *
 *   npm run corpus:ingest
 *
 * Exits non-zero, leaving any existing corpus untouched, if a volume is missing,
 * the parse looks incomplete, or a story pin does not match.
 */
import path from "node:path";
import { buildCorpus } from "../lib/corpus/build";
import { DEFAULT_DB_PATH } from "../lib/corpus/db";
import { STORIES } from "../lib/stories";

const result = buildCorpus({
  rawDir: path.join(process.cwd(), "corpus", "raw"),
  dbPath: DEFAULT_DB_PATH,
  stories: STORIES,
  log: (line) => console.log(line),
});

for (const w of result.warnings.slice(0, 20)) console.warn(`! ${w}`);
if (result.warnings.length > 20) console.warn(`! …and ${result.warnings.length - 20} more warnings`);

if (!result.ok) {
  console.error(`\nIngest failed; ${path.relative(process.cwd(), DEFAULT_DB_PATH)} was not replaced:`);
  for (const e of result.errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(`\nWrote ${path.relative(process.cwd(), DEFAULT_DB_PATH)}`);
