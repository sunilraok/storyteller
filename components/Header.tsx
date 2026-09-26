import Link from "next/link";
import { signIn, signOut } from "@/auth";
import { currentCaller } from "@/lib/guard";
import { liveMode } from "@/lib/mode";
import { ThemeToggle } from "./ThemeToggle";
import { LANGUAGES, t, type Lang } from "@/lib/i18n";

export async function Header({ lang, path }: { lang: Lang; path: string }) {
  // Sign-in only matters when the paid live features are enabled.
  const live = liveMode();
  const caller = live ? await currentCaller() : null;
  const here = `${path}?lang=${lang}`;
  return (
    <header lang={lang} className="border-b border-border bg-surface">
      <div className="mx-auto flex min-h-16 max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link
          href={`/?lang=${lang}`}
          className="font-serif text-2xl font-semibold leading-none tracking-tight text-accent"
        >
          {t(lang, "appName")}
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3" aria-label={t(lang, "stories")}>
          <Link href={`/?lang=${lang}`} className="control px-3 font-medium text-foreground hover:text-accent">
            {t(lang, "stories")}
          </Link>
          {live && (
            <Link href={`/ask?lang=${lang}`} className="control px-3 font-medium text-foreground hover:text-accent">
              {t(lang, "ask")}
            </Link>
          )}
          <div className="segmented" role="group" aria-label={t(lang, "language")}>
            {(Object.keys(LANGUAGES) as Lang[]).map((l) => (
              <Link
                key={l}
                href={`${path}?lang=${l}`}
                lang={l}
                hrefLang={l}
                aria-current={l === lang ? "true" : undefined}
                className="segment font-medium"
              >
                {LANGUAGES[l].label}
              </Link>
            ))}
          </div>
          <ThemeToggle lang={lang} />
          {!live ? null : caller ? (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: here });
              }}
            >
              <button className="control px-3 text-muted hover:text-accent" title={caller.email ?? undefined}>
                {t(lang, "signOut")}
              </button>
            </form>
          ) : (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: here });
              }}
            >
              <button className="control border border-accent text-accent hover:bg-accent-soft">{t(lang, "signIn")}</button>
            </form>
          )}
        </nav>
      </div>
    </header>
  );
}

export function Footer({ lang }: { lang: Lang }) {
  return (
    <footer lang={lang} className="mt-auto border-t border-border px-4 py-6">
      <p className="mx-auto max-w-3xl text-center text-xs leading-relaxed text-muted">{t(lang, "corpusNote")}</p>
    </footer>
  );
}
