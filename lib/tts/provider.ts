import type { Lang } from "../i18n";

export interface SynthesizedAudio {
  audio: Buffer;
  contentType: string;
}

export interface TtsProvider {
  name: string;
  /** Synthesize one short chunk of text (callers split long narrations first). */
  synthesize(text: string, lang: Lang, voice?: string): Promise<SynthesizedAudio>;
}

export class TtsNotConfiguredError extends Error {
  constructor() {
    super("No TTS provider configured. Set SARVAM_API_KEY or GOOGLE_TTS_API_KEY.");
  }
}

/** Guess the audio MIME type from magic bytes. */
export function sniffAudioType(buf: Buffer): string {
  if (buf.subarray(0, 4).toString("ascii") === "RIFF") return "audio/wav";
  if (buf.subarray(0, 4).toString("ascii") === "OggS") return "audio/ogg";
  if (buf.subarray(0, 3).toString("ascii") === "ID3" || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) {
    return "audio/mpeg";
  }
  return "application/octet-stream";
}
