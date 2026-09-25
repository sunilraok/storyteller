/**
 * Download the public-domain source texts from Project Gutenberg into corpus/raw/.
 *
 *   npm run corpus:fetch
 *
 * Set GUTENBERG_MIRROR (e.g. https://aleph.gutenberg.org) to use a mirror.
 * If downloads are blocked, fetch the plain-text files by hand and save them as
 * corpus/raw/<work>-<ebook id>.txt, then run `npm run corpus:ingest`.
 */
import fs from "node:fs";
import path from "node:path";
import { gutenbergUrls, SOURCES } from "../lib/corpus/sources";

const RAW_DIR = path.join(process.cwd(), "corpus", "raw");

async function download(id: number): Promise<string> {
  const errors: string[] = [];
  for (const url of gutenbergUrls(id)) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "storyteller-corpus-fetch/1.0" } });
      if (res.ok) {
        const text = await res.text();
        if (text.length > 10_000) return text;
        errors.push(`${url}: response too short`);
      } else {
        errors.push(`${url}: HTTP ${res.status}`);
      }
    } catch (e) {
      errors.push(`${url}: ${(e as Error).message}`);
    }
  }
  throw new Error(`Could not download ebook #${id}:\n  ${errors.join("\n  ")}`);
}

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  let failed = 0;
  for (const src of Object.values(SOURCES)) {
    for (const id of src.gutenbergIds) {
      const file = path.join(RAW_DIR, `${src.work}-${id}.txt`);
      if (fs.existsSync(file) && !process.argv.includes("--force")) {
        console.log(`✓ ${path.relative(process.cwd(), file)} (exists)`);
        continue;
      }
      try {
        const text = await download(id);
        fs.writeFileSync(file, text);
        console.log(`✓ ${path.relative(process.cwd(), file)} (${(text.length / 1e6).toFixed(1)} MB)`);
      } catch (e) {
        failed++;
        console.error(`✗ ${(e as Error).message}`);
      }
    }
  }
  if (failed) process.exit(1);
}

main();
