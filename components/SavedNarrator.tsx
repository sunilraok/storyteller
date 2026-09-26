"use client";

import { useMemo, useState } from "react";
import type { Audience } from "@/lib/claude";
import { t, type Lang } from "@/lib/i18n";
import type { SavedVersion } from "@/lib/saved";
import { AudioPlayer } from "./AudioPlayer";
import { applyEvent, initialNarration } from "./narration";
import { AudienceToggle, FidelityPanel, NarrationText, SourcesPanel } from "./NarrationView";

/** Shows a pre-generated narration: no model calls, audio from files or the browser's voice. */
export function SavedNarrator({ lang, versions }: { lang: Lang; versions: Partial<Record<Audience, SavedVersion>> }) {
  const [audience, setAudience] = useState<Audience>(versions.child || !versions.adult ? "child" : "adult");
  const [openSource, setOpenSource] = useState<number | null>(null);
  const version = versions[audience];
  const state = useMemo(
    () => (version ? version.events.reduce(applyEvent, initialNarration()) : initialNarration()),
    [version],
  );
  const fidelity = version?.fidelity ?? { status: "idle" as const };
  const flagged = fidelity.status === "checked" ? fidelity.issues.map((i) => i.sentence.trim()).filter(Boolean) : [];

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AudienceToggle
          lang={lang}
          audience={audience}
          onChange={(a) => {
            setAudience(a);
            setOpenSource(null);
          }}
        />
        {version && <AudioPlayer key={audience} text={version.text} lang={lang} urls={version.audio} serverTts={false} />}
      </div>
      {!version ? (
        <p role="status" className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          {t(lang, "notPrepared")}
        </p>
      ) : (
        <>
          <NarrationText lang={lang} state={state} flagged={flagged} onCite={setOpenSource} />
          {version.fidelity && <FidelityPanel lang={lang} fidelity={version.fidelity} label={t(lang, "fidelityRecorded")} />}
          <SourcesPanel lang={lang} state={state} open={openSource} onToggle={setOpenSource} />
        </>
      )}
    </section>
  );
}
