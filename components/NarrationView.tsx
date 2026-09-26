"use client";

import type { Audience, FidelityResult } from "@/lib/claude";
import { t, type Lang } from "@/lib/i18n";
import { CheckIcon } from "./Icons";
import { toParagraphs, type NarrationState } from "./narration";

export type FidelityState = { status: "idle" } | { status: "checking" } | FidelityResult;

export function AudienceToggle({
  lang,
  audience,
  onChange,
}: {
  lang: Lang;
  audience: Audience;
  onChange: (a: Audience) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-3">
      <legend className="sr-only">{t(lang, "audience")}</legend>
      <span aria-hidden="true" className="text-sm text-muted">
        {t(lang, "audience")}
      </span>
      <div className="segmented">
        {(["child", "adult"] as const).map((a) => (
          <label key={a} className="segment font-medium">
            <input
              type="radio"
              name="audience"
              value={a}
              checked={audience === a}
              onChange={() => onChange(a)}
              className="sr-only"
            />
            {t(lang, a === "child" ? "audienceChild" : "audienceAdult")}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The narration with numbered footnote buttons; sentences in `flagged` are highlighted. */
export function NarrationText({
  lang,
  state,
  flagged,
  onCite,
}: {
  lang: Lang;
  state: NarrationState;
  flagged: string[];
  onCite: (index: number) => void;
}) {
  const paragraphs = toParagraphs(state.segments);
  if (!paragraphs.length) return null;
  return (
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
                  onClick={() => onCite(seg.index)}
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
  );
}

export function FidelityPanel({ lang, fidelity, label }: { lang: Lang; fidelity: FidelityState; label?: string }) {
  const prefix = label ? <span className="font-medium text-foreground">{label}: </span> : null;
  if (fidelity.status === "checking") {
    return <p className="mt-4 animate-pulse text-sm text-muted">{t(lang, "checking")}</p>;
  }
  if (fidelity.status === "indeterminate") {
    return (
      <p role="status" className="mt-4 flex items-start gap-2 text-sm text-muted">
        <span aria-hidden="true" className="mt-px text-base leading-none">?</span>
        <span>
          {prefix}
          {t(lang, "fidelityUnknown")} ({fidelity.reason})
        </span>
      </p>
    );
  }
  if (fidelity.status !== "checked") return null;
  if (!fidelity.issues.length) {
    return (
      <p className="mt-4 flex items-start gap-2 text-sm text-muted">
        <CheckIcon className="mt-px shrink-0 text-accent" />
        <span>
          {prefix}
          {t(lang, "allSupported")}
        </span>
      </p>
    );
  }
  return (
    <div className="mt-4 rounded-xl border border-border bg-highlight/40 p-4 text-sm">
      <p className="font-semibold">
        {prefix}
        {t(lang, "unsupported")}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {fidelity.issues.map((iss, i) => (
          <li key={i}>
            {iss.sentence && <q lang={lang}>{iss.sentence}</q>} <span className="text-muted">— {iss.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SourcesPanel({
  lang,
  state,
  open,
  onToggle,
}: {
  lang: Lang;
  state: NarrationState;
  open: number | null;
  onToggle: (index: number | null) => void;
}) {
  if (!state.sources.length) return null;
  return (
    <aside className="mt-8">
      <h2 className="mb-3 font-serif text-xl font-semibold">{t(lang, "sources")}</h2>
      <ol className="space-y-2 text-sm">
        {[...state.sources]
          .sort((a, b) => (state.footnotes.get(a.index) ?? 1e9) - (state.footnotes.get(b.index) ?? 1e9))
          .map((s) => (
            <li key={s.id} className="overflow-hidden rounded-xl border border-border bg-surface">
              <button
                onClick={() => onToggle(open === s.index ? null : s.index)}
                aria-expanded={open === s.index}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left leading-snug hover:bg-accent-soft/40"
              >
                <span>
                  {state.footnotes.has(s.index) && <span className="mr-2 text-accent">[{state.footnotes.get(s.index)}]</span>}
                  {s.label}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {open === s.index ? t(lang, "hideSource") : t(lang, "showSource")}
                </span>
              </button>
              {open === s.index && (
                <blockquote lang="en" className="whitespace-pre-line border-t border-border px-4 py-3 font-serif leading-relaxed">
                  {s.text}
                </blockquote>
              )}
            </li>
          ))}
      </ol>
    </aside>
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
