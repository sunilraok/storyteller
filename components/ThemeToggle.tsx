"use client";

import { useSyncExternalStore } from "react";
import { t, type Lang, type MessageKey } from "@/lib/i18n";
import { nextTheme, parseTheme, THEME_STORAGE_KEY, type ThemePref } from "@/lib/theme";

// The saved preference lives in localStorage and on <html data-theme>; this store
// lets React read it without a hydration mismatch (the server always renders "system").
const listeners = new Set<() => void>();

function read(): ThemePref {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return parseTheme(document.documentElement.getAttribute("data-theme"));
  }
}

function write(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
  try {
    if (pref === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Storage unavailable (private mode): the choice lasts for this page only.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const ICON: Record<ThemePref, string> = { system: "◐", light: "☀", dark: "☾" };
const LABEL: Record<ThemePref, MessageKey> = { system: "themeSystem", light: "themeLight", dark: "themeDark" };

export function ThemeToggle({ lang }: { lang: Lang }) {
  const pref = useSyncExternalStore(subscribe, read, () => "system" as const);
  const label = `${t(lang, "theme")}: ${t(lang, LABEL[pref])}`;
  return (
    <button
      type="button"
      onClick={() => write(nextTheme(pref))}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-base leading-none hover:border-accent hover:text-accent"
    >
      <span aria-hidden="true">{ICON[pref]}</span>
    </button>
  );
}
