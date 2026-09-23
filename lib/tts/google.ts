import { LANGUAGES, type Lang } from "../i18n";
import type { TtsProvider } from "./provider";

/** Google Cloud Text-to-Speech via API key. */
export function googleProvider(apiKey: string): TtsProvider {
  return {
    name: "google",
    async synthesize(text: string, lang: Lang, voice?: string) {
      const languageCode = LANGUAGES[lang].bcp47;
      const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode, ...(voice ? { name: voice } : {}) },
          audioConfig: { audioEncoding: "MP3", speakingRate: 0.95 },
        }),
      });
      if (!res.ok) throw new Error(`Google TTS failed: HTTP ${res.status} ${await res.text()}`);
      const json = (await res.json()) as { audioContent?: string };
      if (!json.audioContent) throw new Error("Google TTS returned no audio");
      return { audio: Buffer.from(json.audioContent, "base64"), contentType: "audio/mpeg" };
    },
  };
}
