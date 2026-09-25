import { DEFAULT_LANG, isLang, type Lang } from "./i18n";

export async function langFrom(searchParams: Promise<Record<string, string | string[] | undefined>>): Promise<Lang> {
  const { lang } = await searchParams;
  return isLang(lang) ? lang : DEFAULT_LANG;
}
