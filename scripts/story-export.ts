/**
 * Export each story's pinned source passages to data/narrations/<story>/sources.json,
 * so narrations can be written against them and the site can show them without
 * the corpus database.
 *
 *   npm run story:export                 # all stories
 *   npm run story:export -- ekalavya     # one story
 *   npm run story:export -- --print ekalavya   # also print the passages
 */
import fs from "node:fs";
import path from "node:path";
import { citationLabel, getSections, openDb, DEFAULT_DB_PATH } from "../lib/corpus/db";
import { NARRATIONS_DIR } from "../lib/savedStore";
import type { SourcesFile } from "../lib/saved";
import { STORIES } from "../lib/stories";

const MAX_PASSAGES = 40; // same cap as live narration

const args = process.argv.slice(2);
const print = args.includes("--print");
const ids = args.filter((a) => !a.startsWith("--"));
const stories = ids.length ? STORIES.filter((s) => ids.includes(s.id)) : STORIES;
const unknown = ids.filter((id) => !STORIES.some((s) => s.id === id));
if (unknown.length) {
  console.error(`Unknown story id(s): ${unknown.join(", ")}. Known: ${STORIES.map((s) => s.id).join(", ")}`);
  process.exit(1);
}

const db = openDb(process.env.CORPUS_DB_PATH ?? DEFAULT_DB_PATH, { readonly: true });
for (const story of stories) {
  const { work, book, from, to } = story.source;
  const passages = getSections(db, work, book, from, to)
    .slice(0, MAX_PASSAGES)
    .map((p) => ({
      id: p.id,
      label: p.subParva ? `${citationLabel(p)} (${p.subParva})` : citationLabel(p),
      text: p.text,
    }));
  if (!passages.length) {
    console.error(`✗ ${story.id}: no passages for ${work}/${book} §${from}–${to}; run npm run corpus:ingest`);
    process.exitCode = 1;
    continue;
  }
  const out: SourcesFile = { storyId: story.id, passages };
  const dir = path.join(NARRATIONS_DIR, story.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "sources.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`✓ ${story.id}: ${passages.length} passages → ${path.relative(process.cwd(), dir)}/sources.json`);
  if (print) {
    console.log(`\n# ${story.title.en} — ${story.summary.en}\n`);
    for (const p of passages) console.log(`[[${p.id}]] ${p.label}\n${p.text}\n`);
  }
}
