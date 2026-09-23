"use client";

import { useEffect, useRef, useState } from "react";
import type { Audience, FidelityIssue, NarrationEvent } from "@/lib/claude";
import { t, type Lang } from "@/lib/i18n";
import { readNdjson } from "@/lib/ndjson";
import { AudioPlayer } from "./AudioPlayer";
import { applyEvent, initialNarration, plainText, toParagraphs, type NarrationState } from "./narration";

type NarrationRequest = { storyId: string } | { question: string };
type Status = "idle" | "loading" | "streaming" | "done";

export function Narrator({
  lang,
  request,
  autoStart = false,
}: {
  lang: Lang;
  request: NarrationRequest;
  autoStart?: boolean;
}) {
  const [audience, setAudience] = useState<Audience>("child");
  const [state, setState] = useState<NarrationState>(initialNarration);
  const [status, setStatus] = useState<Status>(autoStart ? "loading" : "idle");
  const [openSource, setOpenSource] = useState<number | null>(null);
  const [fidelity, setFidelity] = useState<{ status: "idle" | "checking" | "done"; issues: FidelityIssue[] }>({
    status: "idle",
    issues: [],
  });
  const abortRef = useRef<AbortController | null>(null);

  async function run(aud: Audience) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, lang, audience: aud }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        const message = error === "noPassages" ? t(lang, "noPassages") : (error ?? `HTTP ${res.status}`);
        setState((s) => ({ ...s, done: true, error: message }));
        return;
      }
      setStatus("streaming");
      for await (const ev of readNdjson<NarrationEvent>(res)) setState((s) => applyEvent(s, ev));
    } catch (e) {
      if ((e as Error).name !== "AbortError") setState((s) => ({ ...s, done: true, error: (e as Error).message }));
    } finally {
      if (abortRef.current === ctrl) setStatus("done");
    }
  }

  function tell() {
    setState(initialNarration());
    setFidelity({ status: "idle", issues: [] });
    setOpenSource(null);
    setStatus("loading");
    void run(audience);
  }

  useEffect(() => {
    if (autoStart) void run(audience);
    return () => abortRef.current?.abort();
    // Run once on mount; later runs are started by the buttons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify() {
    setFidelity({ status: "checking", issues: [] });
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passageIds: state.sources.map((s) => s.id), narration: plainText(state.segments) }),
      });
      const json = (await res.json()) as { issues?: FidelityIssue[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setFidelity({ status: "done", issues: json.issues ?? [] });
    } catch (e) {
      setFidelity({ status: "done", issues: [{ sentence: "", reason: (e as Error).message }] });
    }
  }

  const paragraphs = toParagraphs(state.segments);
  const text = plainText(state.segments);
  const busy = status === "loading" || status === "streaming";
  const flagged = fidelity.issues.map((i) => i.sentence.trim()).filter(Boolean);

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <fieldset className="flex items-center gap-2 text-sm">
          <legend className="sr-only">{t(lang, "audience")}</legend>
          <span className="text-muted">{t(lang, "audience")}:</span>
          {(["child", "adult"] as const).map((a) => (
            <label
              key={a}
              className={`cursor-pointer rounded-full border px-3 py-1 ${
                audience === a ? "border-accent bg-accent-soft" : "border-border"
              }`}
            >
              <input
                type="radio"
                name="audience"
                value={a}
                checked={audience === a}
                onChange={() => setAudience(a)}
                className="sr-only"
              />
              {t(lang, a === "child" ? "audienceChild" : "audienceAdult")}
            </label>
          ))}
        </fieldset>
        {(!autoStart || status === "done") && (
          <button
            onClick={tell}
            disabled={busy}
            className="rounded-full bg-accent px-5 py-2 font-semibold text-surface disabled:opacity-60"
          >
            {status === "idle" ? t(lang, "tell") : t(lang, "retell")}
          </button>
        )}
      </div>

      {status === "loading" && <p className="mt-6 animate-pulse text-muted">{t(lang, "loading")}</p>}
      {state.error && (
        <p role="alert" className="mt-6 rounded-lg border border-accent bg-accent-soft p-3 text-sm">
          {t(lang, "error")}: {state.error}
        </p>
      )}

      {paragraphs.length > 0 && (
        <article
          lang={lang}
          aria-live="polite"
          className="narration mt-6 rounded-2xl border border-border bg-surface p-5 font-serif text-lg leading-relaxed sm:p-6"
        >
          {paragraphs.map((para, i) => (
            <p key={i}>
              {para.map((seg, j) =>
                seg.kind === "text" ? (
                  <Highlighted key={j} text={seg.text} flagged={flagged} />
                ) : (
                  <sup key={j}>
                    <button
                      onClick={() => setOpenSource(seg.index)}
                      title={state.sources[seg.index]?.label}
                      className="ml-0.5 font-sans text-xs text-accent hover:underline"
                    >
                      [{state.footnotes.get(seg.index)}]
                    </button>
                  </sup>
                ),
              )}
            </p>
          ))}
        </article>
      )}

      {state.done && text && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <AudioPlayer text={text} lang={lang} />
          <button
            onClick={verify}
            disabled={fidelity.status === "checking"}
            className="rounded-full border border-border px-4 py-1.5 text-sm hover:border-accent disabled:opacity-60"
          >
            {t(lang, "checkFidelity")}
          </button>
        </div>
      )}

      {fidelity.status === "checking" && <p className="mt-3 animate-pulse text-sm text-muted">{t(lang, "checking")}</p>}
      {fidelity.status === "done" &&
        (fidelity.issues.length === 0 ? (
          <p className="mt-3 text-sm">✓ {t(lang, "allSupported")}</p>
        ) : (
          <div className="mt-3 rounded-lg border border-border bg-highlight/40 p-3 text-sm">
            <p className="font-semibold">{t(lang, "unsupported")}:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {fidelity.issues.map((iss, i) => (
                <li key={i}>
                  {iss.sentence && <q lang={lang}>{iss.sentence}</q>} <span className="text-muted">— {iss.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

      {state.sources.length > 0 && (
        <aside className="mt-8">
          <h2 className="mb-2 font-serif text-xl font-semibold">{t(lang, "sources")}</h2>
          <ol className="space-y-2 text-sm">
            {[...state.sources]
              .sort((a, b) => (state.footnotes.get(a.index) ?? 1e9) - (state.footnotes.get(b.index) ?? 1e9))
              .map((s) => (
                <li key={s.id} className="rounded-lg border border-border bg-surface">
                  <button
                    onClick={() => setOpenSource(openSource === s.index ? null : s.index)}
                    aria-expanded={openSource === s.index}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                  >
                    <span>
                      {state.footnotes.has(s.index) && (
                        <span className="mr-2 text-accent">[{state.footnotes.get(s.index)}]</span>
                      )}
                      {s.label}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {openSource === s.index ? t(lang, "hideSource") : t(lang, "showSource")}
                    </span>
                  </button>
                  {openSource === s.index && (
                    <blockquote
                      lang="en"
                      className="whitespace-pre-line border-t border-border px-3 py-3 font-serif leading-relaxed"
                    >
                      {s.text}
                    </blockquote>
                  )}
                </li>
              ))}
          </ol>
        </aside>
      )}
    </section>
  );
}

/** Render text, marking sentences the fidelity check flagged. */
function Highlighted({ text, flagged }: { text: string; flagged: string[] }) {
  const parts: React.ReactNode[] = [];
  let rest = text;
  for (const sentence of flagged) {
    const at = rest.indexOf(sentence);
    if (at < 0) continue;
    parts.push(
      rest.slice(0, at),
      <mark key={parts.length} className="rounded bg-highlight px-0.5 text-foreground">
        {sentence}
      </mark>,
    );
    rest = rest.slice(at + sentence.length);
  }
  parts.push(rest);
  return <>{parts}</>;
}
