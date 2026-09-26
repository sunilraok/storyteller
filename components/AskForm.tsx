"use client";

import { useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import { Narrator } from "./Narrator";

export function AskForm({ lang }: { lang: Lang }) {
  const [draft, setDraft] = useState("");
  const [asked, setAsked] = useState<{ q: string; n: number } | null>(null);

  return (
    <>
      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) setAsked((a) => ({ q: draft.trim(), n: (a?.n ?? 0) + 1 }));
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t(lang, "askPlaceholder")}
          aria-label={t(lang, "ask")}
          maxLength={500}
          lang={lang}
          className="h-10 flex-1 rounded-full border border-border bg-surface px-4 outline-none focus:border-accent"
        />
        <button type="submit" className="control h-10 bg-accent px-5 font-semibold text-surface">
          {t(lang, "askButton")}
        </button>
      </form>
      {asked && <Narrator key={asked.n} lang={lang} request={{ question: asked.q }} autoStart />}
    </>
  );
}
