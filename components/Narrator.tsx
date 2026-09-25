"use client";

import { useEffect, useRef, useState } from "react";
import type { Audience, FidelityResult, NarrationEvent } from "@/lib/claude";
import { t, type Lang } from "@/lib/i18n";
import { readNdjson } from "@/lib/ndjson";
import { AudioPlayer } from "./AudioPlayer";
import { applyEvent, initialNarration, plainText, type NarrationState } from "./narration";
import { AudienceToggle, FidelityPanel, NarrationText, SourcesPanel, type FidelityState } from "./NarrationView";

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
  const [fidelity, setFidelity] = useState<FidelityState>({ status: "idle" });
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
        const message =
          error === "noPassages" || error === "signInRequired" || error === "quotaExceeded"
            ? t(lang, error)
            : (error ?? `HTTP ${res.status}`);
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
    setFidelity({ status: "idle" });
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
    setFidelity({ status: "checking" });
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passageIds: state.sources.map((s) => s.id), narration: plainText(state.segments) }),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<FidelityResult> & { error?: string };
      if (!res.ok) {
        const known = json.error === "signInRequired" || json.error === "quotaExceeded";
        throw new Error(known ? t(lang, json.error as "signInRequired" | "quotaExceeded") : (json.error ?? `HTTP ${res.status}`));
      }
      if (json.status === "checked" && Array.isArray(json.issues)) {
        setFidelity({ status: "checked", issues: json.issues });
      } else {
        setFidelity({
          status: "indeterminate",
          reason: json.status === "indeterminate" && json.reason ? json.reason : "unexpected response",
        });
      }
    } catch (e) {
      setFidelity({ status: "indeterminate", reason: (e as Error).message });
    }
  }

  const text = plainText(state.segments);
  const busy = status === "loading" || status === "streaming";
  const flagged = fidelity.status === "checked" ? fidelity.issues.map((i) => i.sentence.trim()).filter(Boolean) : [];

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <AudienceToggle lang={lang} audience={audience} onChange={setAudience} />
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
          {(["signInRequired", "quotaExceeded", "noPassages"] as const).some((k) => t(lang, k) === state.error)
            ? state.error
            : `${t(lang, "error")}: ${state.error}`}
        </p>
      )}

      <NarrationText lang={lang} state={state} flagged={flagged} onCite={setOpenSource} />

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

      <FidelityPanel lang={lang} fidelity={fidelity} />
      <SourcesPanel lang={lang} state={state} open={openSource} onToggle={setOpenSource} />
    </section>
  );
}
