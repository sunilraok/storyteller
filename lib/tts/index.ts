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
    try {
      return { audio: await fs.readFile(path.join(/*turbopackIgnore: true*/ CACHE_DIR, `${key}.${ext}`)), contentType: type };
    } catch {
      // not cached in this format
    }
  }

  const result = await provider.synthesize(text, lang, voice);
  const ext = EXT[result.contentType];
  if (ext) {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(path.join(/*turbopackIgnore: true*/ CACHE_DIR, `${key}.${ext}`), result.audio).catch(() => {});
  }
  return result;
}
