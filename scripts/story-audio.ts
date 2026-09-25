/**
 * Pre-generate narration audio with the configured TTS provider (Sarvam or Google)
 * into public/audio/<story>/<lang>-<audience>/, so the site plays files instead of
 * calling a paid TTS API per visitor. Skips narrations whose audio is up to date.
 *
 *   SARVAM_API_KEY=... npm run story:audio
 *   npm run story:audio -- ekalavya --force
 */
import fs from "node:fs";
import path from "node:path";
import { LANGUAGES, type Lang } from "../lib/i18n";
import { AUDIENCES, narrationFileName, parseNarration, sha256, type AudioManifest } from "../lib/saved";
import { audioDir, NARRATIONS_DIR, readSources } from "../lib/savedStore";
import { STORIES } from "../lib/stories";
import { splitForSpeech } from "../lib/text";
import { getTtsProvider } from "../lib/tts";

const EXT: Record<string, string> = { "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg" };

async function main() {
  const provider = getTtsProvider();
  if (!provider) {
    console.error("No TTS provider configured: set SARVAM_API_KEY (or GOOGLE_TTS_API_KEY) in .env.local.");
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const ids = args.filter((a) => !a.startsWith("--"));
  const stories = ids.length ? STORIES.filter((s) => ids.includes(s.id)) : STORIES;

  for (const story of stories) {
    const sources = readSources(story.id);
    if (!sources) continue;
    for (const lang of Object.keys(LANGUAGES) as Lang[]) {
      for (const audience of AUDIENCES) {
        const file = path.join(NARRATIONS_DIR, story.id, narrationFileName(lang, audience));
        if (!fs.existsSync(file)) continue;
        const md = fs.readFileSync(file, "utf8");
        const hash = sha256(md);
        const dir = audioDir(story.id, lang, audience);
        const manifestPath = path.join(dir, "manifest.json");
        const existing = fs.existsSync(manifestPath)
          ? (JSON.parse(fs.readFileSync(manifestPath, "utf8")) as AudioManifest)
          : null;
        const name = `${story.id} ${lang}-${audience}`;
        if (existing?.narrationSha256 === hash && !force) {
          console.log(`· ${name}: up to date`);
          continue;
        }
        const parsed = parseNarration(md, sources.passages);
        if (parsed.errors.length) {
          console.log(`✗ ${name}: fix narration errors first (npm run story:check)`);
          continue;
        }
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir, { recursive: true });
        const chunks: AudioManifest["chunks"] = [];
        for (const [i, text] of splitForSpeech(parsed.text).entries()) {
          const { audio, contentType } = await provider.synthesize(text, lang);
          const out = `${String(i + 1).padStart(3, "0")}.${EXT[contentType] ?? "bin"}`;
          fs.writeFileSync(path.join(dir, out), audio);
          chunks.push({ file: out, text });
        }
        const manifest: AudioManifest = { narrationSha256: hash, chunks };
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
        console.log(`✓ ${name}: ${chunks.length} audio chunks`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
