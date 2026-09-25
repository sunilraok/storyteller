/**
 * Validate saved narrations (data/narrations/<story>/<lang>-<audience>.md):
 * citations resolve to the story's passages, the text is in the right script,
 * plain paragraphs only, sensible length, and any faithfulness review matches
 * the current text. Exits non-zero on errors.
 *
 *   npm run story:check                  # all stories
 *   npm run story:check -- ekalavya      # one story
 *   npm run story:check -- --stamp       # record narration hashes in review files
 *   npm run story:check -- --allow-missing   # don't fail on narrations not written yet
 */
import fs from "node:fs";
import path from "node:path";
import { LANGUAGES, type Lang } from "../lib/i18n";
import {
  AUDIENCES,
  checkFileName,
  checkNarration,
  narrationFileName,
  parseNarration,
  readCheck,
  sha256,
  type AudioManifest,
  type CheckFile,
} from "../lib/saved";
import { audioDir, NARRATIONS_DIR, readSources } from "../lib/savedStore";
import { STORIES } from "../lib/stories";

const args = process.argv.slice(2);
const stamp = args.includes("--stamp");
const allowMissing = args.includes("--allow-missing");
const ids = args.filter((a) => !a.startsWith("--"));
const stories = ids.length ? STORIES.filter((s) => ids.includes(s.id)) : STORIES;

let errors = 0;
let missing = 0;
let ok = 0;

for (const story of stories) {
  const dir = path.join(NARRATIONS_DIR, story.id);
  const sources = readSources(story.id);
  if (!sources) {
    console.log(`✗ ${story.id}: no sources.json (run npm run story:export -- ${story.id})`);
    errors++;
    continue;
  }
  for (const lang of Object.keys(LANGUAGES) as Lang[]) {
    for (const audience of AUDIENCES) {
      const name = `${story.id}/${narrationFileName(lang, audience)}`;
      const file = path.join(dir, narrationFileName(lang, audience));
      if (!fs.existsSync(file)) {
        console.log(`· ${name}: not written yet`);
        missing++;
        continue;
      }
      const md = fs.readFileSync(file, "utf8");
      const report = checkNarration(md, sources.passages, lang, audience);
      const problems = [...report.errors];

      const checkPath = path.join(dir, checkFileName(lang, audience));
      let review = "no faithfulness review";
      if (fs.existsSync(checkPath)) {
        const check = JSON.parse(fs.readFileSync(checkPath, "utf8")) as CheckFile;
        if (stamp && !check.narrationSha256) {
          check.narrationSha256 = sha256(md);
          fs.writeFileSync(checkPath, JSON.stringify(check, null, 2) + "\n");
        }
        const { result, errors: checkErrors } = readCheck(check, md, parseNarration(md, sources.passages).text);
        problems.push(...checkErrors.map((e) => `review: ${e}`));
        if (result?.status === "checked") review = result.issues.length ? `${result.issues.length} flagged sentence(s)` : "review: all supported";
        else if (result) review = "review: could not verify";
        if (!check.narrationSha256) report.warnings.push("review not stamped (run with --stamp)");
      } else {
        report.warnings.push("no faithfulness review file");
      }

      const manifestPath = path.join(audioDir(story.id, lang, audience), "manifest.json");
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as AudioManifest;
        if (manifest.narrationSha256 !== sha256(md)) report.warnings.push("audio is out of date (run npm run story:audio)");
      }

      if (problems.length) {
        errors++;
        console.log(`✗ ${name}`);
        for (const p of problems) console.log(`    error: ${p}`);
      } else {
        ok++;
        console.log(`✓ ${name} (${review})`);
      }
      for (const w of report.warnings) console.log(`    warning: ${w}`);
    }
  }
}

console.log(`\n${ok} ok, ${errors} with errors, ${missing} not written yet`);
if (errors || (missing && !allowMissing)) process.exit(1);
