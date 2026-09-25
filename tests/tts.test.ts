import { describe, expect, it } from "vitest";
import { splitForSpeech } from "@/lib/text";
import { cacheKey, getTtsProvider } from "@/lib/tts";
import { sniffAudioType } from "@/lib/tts/provider";

describe("splitForSpeech", () => {
  it("splits on paragraphs and sentence ends, including the danda", () => {
    const text = "ಒಂದಾನೊಂದು ಕಾಲದಲ್ಲಿ. ದೇವತೆಗಳು ಬಂದರು!\n\nಮುಂದೆ ಏನಾಯಿತು? ಕಥೆ ಮುಗಿಯಿತು।";
    expect(splitForSpeech(text, 25)).toEqual([
      "ಒಂದಾನೊಂದು ಕಾಲದಲ್ಲಿ.",
      "ದೇವತೆಗಳು ಬಂದರು!",
      "ಮುಂದೆ ಏನಾಯಿತು?",
      "ಕಥೆ ಮುಗಿಯಿತು।",
    ]);
  });

  it("packs short sentences together and hard-wraps very long ones", () => {
    expect(splitForSpeech("A. B. C.", 100)).toEqual(["A. B. C."]);
    const long = Array.from({ length: 50 }, () => "word").join(" ");
    const chunks = splitForSpeech(long, 60);
    expect(chunks.every((c) => c.length <= 60)).toBe(true);
    expect(chunks.join(" ")).toBe(long);
  });
});

describe("tts provider selection", () => {
  it("prefers Sarvam, honours TTS_PROVIDER, and returns null without keys", () => {
    expect(getTtsProvider({ SARVAM_API_KEY: "s", GOOGLE_TTS_API_KEY: "g" })?.name).toBe("sarvam");
    expect(getTtsProvider({ SARVAM_API_KEY: "s", GOOGLE_TTS_API_KEY: "g", TTS_PROVIDER: "google" })?.name).toBe("google");
    expect(getTtsProvider({})).toBeNull();
  });

  it("keys the cache on provider, language, voice and text", () => {
    expect(cacheKey("sarvam", "kn", undefined, "a")).not.toBe(cacheKey("sarvam", "en", undefined, "a"));
    expect(cacheKey("sarvam", "kn", undefined, "a")).toBe(cacheKey("sarvam", "kn", undefined, "a"));
  });

  it("sniffs audio types", () => {
    expect(sniffAudioType(Buffer.from("RIFF0000WAVE"))).toBe("audio/wav");
    expect(sniffAudioType(Buffer.from("ID3\x03"))).toBe("audio/mpeg");
  });
});
