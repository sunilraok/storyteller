import Link from "next/link";
import { LANGUAGES, t, type Lang } from "@/lib/i18n";

export function Header({ lang, path }: { lang: Lang; path: string }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href={`/?lang=${lang}`} className="font-serif text-2xl font-semibold text-accent">
          {t(lang, "appName")}
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href={`/?lang=${lang}`} className="hover:text-accent">
            {t(lang, "stories")}
          </Link>
          <Link href={`/ask?lang=${lang}`} className="hover:text-accent">
            {t(lang, "ask")}
          </Link>
          <span className="flex overflow-hidden rounded-full border border-border" aria-label={t(lang, "language")}>
            {(Object.keys(LANGUAGES) as Lang[]).map((l) => (
              <Link
                key={l}
                href={`${path}?lang=${l}`}
                aria-current={l === lang ? "true" : undefined}
                className={`px-3 py-1 ${l === lang ? "bg-accent text-surface" : "hover:bg-accent-soft"}`}
              >
                {LANGUAGES[l].label}
              </Link>
            ))}
          </span>
        </nav>
      </div>
    </header>
  );
}

export function Footer({ lang }: { lang: Lang }) {
  return (
    <footer className="mt-auto border-t border-border px-4 py-6 text-center text-xs text-muted">
      {t(lang, "corpusNote")}
    </footer>
  );
}
