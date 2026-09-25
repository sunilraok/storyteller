import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Lang } from "../i18n";
import { googleProvider } from "./google";
import { TtsNotConfiguredError, type SynthesizedAudio, type TtsProvider } from "./provider";
import { sarvamProvider } from "./sarvam";

export { TtsNotConfiguredError } from "./provider";

/** Pick a provider from TTS_PROVIDER, else the first one with an API key. */
export function getTtsProvider(env: Record<string, string | undefined> = process.env): TtsProvider | null {
  const wanted = env.TTS_PROVIDER;
  if ((!wanted || wanted === "sarvam") && env.SARVAM_API_KEY) return sarvamProvider(env.SARVAM_API_KEY);
  if ((!wanted || wanted === "google") && env.GOOGLE_TTS_API_KEY) return googleProvider(env.GOOGLE_TTS_API_KEY);
  return null;
}

const CACHE_DIR = process.env.TTS_CACHE_DIR ?? path.join(process.cwd(), ".cache", "tts");
const EXT: Record<string, string> = { "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg" };

export function cacheKey(provider: string, lang: Lang, voice: string | undefined, text: string): string {
  return crypto.createHash("sha256").update(JSON.stringify([provider, lang, voice ?? "", text])).digest("hex");
}

/** Synthesize with an on-disk cache keyed by provider, language, voice and text. */
export async function synthesizeCached(text: string, lang: Lang, voice?: string): Promise<SynthesizedAudio> {
  const provider = getTtsProvider();
  if (!provider) throw new TtsNotConfiguredError();
  const key = cacheKey(provider.name, lang, voice, text);

  for (const [type, ext] of Object.entries(EXT)) {
    const file = path.join(/*turbopackIgnore: true*/ CACHE_DIR, `${key}.${ext}`);
    try {
      const audio = await fs.readFile(file);
      const now = new Date();
      await fs.utimes(file, now, now).catch(() => {}); // mark as recently used
      return { audio, contentType: type };
    } catch {
      // not cached in this format
    }
  }

  const result = await provider.synthesize(text, lang, voice);
  const ext = EXT[result.contentType];
  if (ext) {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(path.join(/*turbopackIgnore: true*/ CACHE_DIR, `${key}.${ext}`), result.audio).catch(() => {});
    await evictCache(CACHE_DIR, cacheMaxBytes()).catch(() => {});
  }
  return result;
}

const cacheMaxBytes = () => Number(process.env.TTS_CACHE_MAX_MB ?? 200) * 1024 * 1024;

/**
 * Keep the cache directory under `maxBytes` by deleting the least recently used
 * files (by mtime, which cache hits refresh) until it is back under 90% of the cap.
 */
export async function evictCache(dir: string, maxBytes: number): Promise<number> {
  const names = await fs.readdir(/*turbopackIgnore: true*/ dir);
  const files = (
    await Promise.all(
      names.map(async (name) => {
        const file = path.join(/*turbopackIgnore: true*/ dir, name);
        const st = await fs.stat(file).catch(() => null);
        return st?.isFile() ? { file, size: st.size, mtime: st.mtimeMs } : null;
      }),
    )
  ).filter((f): f is { file: string; size: number; mtime: number } => !!f);

  let total = files.reduce((n, f) => n + f.size, 0);
  if (total <= maxBytes) return 0;
  let removed = 0;
  for (const f of files.sort((a, b) => a.mtime - b.mtime)) {
    if (total <= maxBytes * 0.9) break;
    await fs.rm(f.file, { force: true });
    total -= f.size;
    removed++;
  }
  return removed;
}
