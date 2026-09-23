import Link from "next/link";
import { signIn, signOut } from "@/auth";
import { currentCaller } from "@/lib/guard";
import { LANGUAGES, t, type Lang } from "@/lib/i18n";

export async function Header({ lang, path }: { lang: Lang; path: string }) {
  const caller = await currentCaller();
  const here = `${path}?lang=${lang}`;
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
          {caller ? (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: here });
              }}
            >
              <button className="text-muted hover:text-accent" title={caller.email ?? undefined}>
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
              <button className="rounded-full border border-accent px-3 py-1 text-accent hover:bg-accent-soft">
                {t(lang, "signIn")}
              </button>
            </form>
          )}
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
