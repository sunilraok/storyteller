import en from "./en.json";
import kn from "./kn.json";

/** To add a language: add a JSON file with the same keys and register it here and in LANGUAGES. */
export const MESSAGES = { en, kn } as const;
export type Lang = keyof typeof MESSAGES;
export type MessageKey = keyof typeof en;

export const LANGUAGES: Record<Lang, { label: string; englishName: string; bcp47: string }> = {
  kn: { label: "ಕನ್ನಡ", englishName: "Kannada", bcp47: "kn-IN" },
  en: { label: "English", englishName: "English", bcp47: "en-IN" },
};

export const DEFAULT_LANG: Lang = "kn";

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && v in MESSAGES;
}

export function t(lang: Lang, key: MessageKey): string {
  return MESSAGES[lang][key] ?? MESSAGES.en[key];
}
