"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGES, t, type Lang } from "@/lib/i18n";
import { splitForSpeech } from "@/lib/text";

/**
 * Plays a narration chunk by chunk through /api/tts, fetching the next chunk while
 * the current one plays. Falls back to the browser's speechSynthesis when no TTS
 * provider is configured on the server.
 */
export function AudioPlayer({ text, lang }: { text: string; lang: Lang }) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => () => stopRef.current(), []);

  async function play() {
    setError(null);
    setPlaying(true);
    const chunks = splitForSpeech(text);
    const audio = new Audio();
    const urls: string[] = [];
    let stopped = false;
    stopRef.current = () => {
      stopped = true;
      audio.pause();
      window.speechSynthesis?.cancel();
      urls.forEach((u) => URL.revokeObjectURL(u));
      setPlaying(false);
    };

    const fetchChunk = async (chunk: string): Promise<string | "fallback"> => {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunk, lang }),
      });
      if (res.status === 501) return "fallback";
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(error ?? `HTTP ${res.status}`);
      }
      const url = URL.createObjectURL(await res.blob());
      urls.push(url);
      return url;
    };

    try {
      let next = fetchChunk(chunks[0]);
      for (let i = 0; i < chunks.length && !stopped; i++) {
        const url = await next;
        if (url === "fallback") {
          await speakWithBrowser(chunks.slice(i), lang, () => stopped);
          break;
        }
        if (i + 1 < chunks.length) next = fetchChunk(chunks[i + 1]);
        audio.src = url;
        await audio.play();
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onpause = () => resolve();
          audio.onerror = () => reject(new Error("playback failed"));
        });
      }
    } catch (e) {
      if (!stopped) setError((e as Error).message);
    } finally {
      stopRef.current();
    }
  }

  return (
    <span className="flex items-center gap-2">
      <button
        onClick={() => (playing ? stopRef.current() : play())}
        className="rounded-full border border-accent px-4 py-1.5 text-sm text-accent hover:bg-accent-soft"
      >
        {playing ? `■ ${t(lang, "stop")}` : `▶ ${t(lang, "listen")}`}
      </button>
      {error && (
        <span className="text-xs text-muted" title={error}>
          {t(lang, "audioError")}
        </span>
      )}
    </span>
  );
}

function speakWithBrowser(chunks: string[], lang: Lang, isStopped: () => boolean): Promise<void> {
  const synth = window.speechSynthesis;
  if (!synth) return Promise.reject(new Error("No TTS provider configured and no browser speech synthesis"));
  const code = LANGUAGES[lang].bcp47;
  const voices = synth.getVoices();
  const voice = voices.find((v) => v.lang === code) ?? voices.find((v) => v.lang.startsWith(lang));
  if (!voice && lang !== "en") {
    return Promise.reject(new Error(`No ${LANGUAGES[lang].englishName} voice in this browser; set SARVAM_API_KEY`));
  }
  return chunks.reduce<Promise<void>>(
    (p, chunk) =>
      p.then(
        () =>
          new Promise<void>((resolve) => {
            if (isStopped()) return resolve();
            const u = new SpeechSynthesisUtterance(chunk);
            u.lang = code;
            if (voice) u.voice = voice;
            u.onend = () => resolve();
            u.onerror = () => resolve();
            synth.speak(u);
          }),
      ),
    Promise.resolve(),
  );
}
