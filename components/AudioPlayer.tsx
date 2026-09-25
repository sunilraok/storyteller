"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGES, t, type Lang } from "@/lib/i18n";
import { splitForSpeech } from "@/lib/text";

/**
 * Plays a narration chunk by chunk through /api/tts, fetching the next chunk while
 * the current one plays. Falls back to the browser's speechSynthesis when no TTS
 * provider is configured on the server.
 */
export function AudioPlayer({
  text,
  lang,
  urls,
  serverTts = true,
}: {
  text: string;
  lang: Lang;
  /** Pre-generated audio files to play in order, instead of synthesizing. */
  urls?: string[];
  /** Whether /api/tts may be used; otherwise fall back to the browser's voice. */
  serverTts?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Stops whichever playback run is current; each run installs its own. */
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => () => stopRef.current(), []);

  async function play() {
    stopRef.current();
    setError(null);
    setPlaying(true);

    const ctrl = new AbortController();
    const { signal } = ctrl;
    const audio = new Audio();
    const objectUrls: string[] = [];
    const stop = () => {
      if (signal.aborted) return;
      ctrl.abort();
      audio.pause();
      audio.removeAttribute("src");
      window.speechSynthesis?.cancel();
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
      // Only reset the button if no newer run has taken over.
      if (stopRef.current === stop) setPlaying(false);
    };
    stopRef.current = stop;

    const playUrl = async (url: string) => {
      audio.src = url;
      await audio.play();
      signal.throwIfAborted();
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("playback failed"));
        signal.addEventListener("abort", () => resolve(), { once: true });
      });
      signal.throwIfAborted();
    };

    const fetchChunk = async (chunk: string): Promise<string | "fallback"> => {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunk, lang }),
        signal,
      });
      if (res.status === 501) return "fallback";
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        const known = error === "signInRequired" || error === "quotaExceeded";
        throw new Error(known ? t(lang, error) : (error ?? `HTTP ${res.status}`));
      }
      const blob = await res.blob();
      signal.throwIfAborted();
      const url = URL.createObjectURL(blob);
      objectUrls.push(url);
      return url;
    };

    try {
      if (urls?.length) {
        for (const url of urls) {
          signal.throwIfAborted();
          await playUrl(url);
        }
        return;
      }
      const chunks = splitForSpeech(text);
      if (!serverTts) {
        await speakWithBrowser(chunks, lang, signal);
        return;
      }
      let next = fetchChunk(chunks[0]);
      for (let i = 0; i < chunks.length; i++) {
        const url = await next;
        signal.throwIfAborted();
        if (url === "fallback") {
          await speakWithBrowser(chunks.slice(i), lang, signal);
          break;
        }
        if (i + 1 < chunks.length) {
          next = fetchChunk(chunks[i + 1]);
          next.catch(() => {}); // surfaced when awaited on the next iteration
        }
        await playUrl(url);
      }
    } catch (e) {
      if (!signal.aborted) setError((e as Error).message);
    } finally {
      stop();
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
          {error === t(lang, "signInRequired") || error === t(lang, "quotaExceeded") ? error : t(lang, "audioError")}
        </span>
      )}
    </span>
  );
}

function speakWithBrowser(chunks: string[], lang: Lang, signal: AbortSignal): Promise<void> {
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
            if (signal.aborted) return resolve();
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
