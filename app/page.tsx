import Link from "next/link";
import { Footer, Header } from "@/components/Header";
import { SOURCES, type WorkId } from "@/lib/corpus/sources";
import { t } from "@/lib/i18n";
import { langFrom } from "@/lib/params";
import { STORIES } from "@/lib/stories";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await langFrom(searchParams);
  const works = Object.keys(SOURCES) as WorkId[];

  return (
    <>
      <Header lang={lang} path="/" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <p className="mb-8 font-serif text-lg text-muted">{t(lang, "tagline")}</p>
        {works.map((work) => (
          <section key={work} className="mb-10">
            <h2 className="mb-1 font-serif text-2xl font-semibold">
              {lang === "kn" ? SOURCES[work].titleKn : SOURCES[work].title}
            </h2>
            <p className="mb-4 text-sm text-muted">
              {SOURCES[work].translator} ({SOURCES[work].years})
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {STORIES.filter((s) => s.source.work === work).map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/story/${s.id}?lang=${lang}`}
                    className="block h-full rounded-xl border border-border bg-surface p-4 transition hover:border-accent hover:shadow-sm"
                  >
                    <span className="block font-serif text-lg font-semibold">{s.title[lang]}</span>
                    <span className="mt-1 block text-sm text-muted">{s.summary[lang]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      <Footer lang={lang} />
    </>
  );
}
