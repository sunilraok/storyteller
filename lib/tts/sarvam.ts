import { LANGUAGES, type Lang } from "../i18n";
import { sniffAudioType, type TtsProvider } from "./provider";

/** Sarvam AI Bulbul text-to-speech (natural voices for Indian languages). */
export function sarvamProvider(apiKey: string): TtsProvider {
  return {
    name: "sarvam",
    async synthesize(text: string, lang: Lang, voice?: string) {
      const res = await fetch("https://api.sarvam.ai/text-to-speech", {
        method: "POST",
        headers: { "api-subscription-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          target_language_code: LANGUAGES[lang].bcp47,
          model: process.env.SARVAM_TTS_MODEL ?? "bulbul:v3",
          speaker: voice ?? process.env.SARVAM_TTS_SPEAKER ?? "kavya",
          pace: 0.95,
          output_audio_codec: "mp3",
        }),
      });
      if (!res.ok) throw new Error(`Sarvam TTS failed: HTTP ${res.status} ${await res.text()}`);
      const json = (await res.json()) as { audios?: string[] };
      if (!json.audios?.length) throw new Error("Sarvam TTS returned no audio");
      const audio = Buffer.concat(json.audios.map((a) => Buffer.from(a, "base64")));
      return { audio, contentType: sniffAudioType(audio) };
    },
  };
}
