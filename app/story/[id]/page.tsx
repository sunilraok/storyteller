import Link from "next/link";
import { ArrowLeftIcon } from "@/components/Icons";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components/Header";
import { Narrator } from "@/components/Narrator";
import { SavedNarrator } from "@/components/SavedNarrator";
import { liveMode } from "@/lib/mode";
import { loadSavedStory } from "@/lib/savedStore";
import { getBook, SOURCES } from "@/lib/corpus/sources";
import { t } from "@/lib/i18n";
import { langFrom } from "@/lib/params";
import { getStory } from "@/lib/stories";

export default async function StoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const lang = await langFrom(searchParams);
  const story = getStory(id);
  if (!story) notFound();
  const { work, book, from, to } = story.source;
  const bookDef = getBook(work, book);
  const unit = lang === "kn" ? SOURCES[work].chapterLabelKn : SOURCES[work].chapterLabel;

  return (
    <>
      <Header lang={lang} path={`/story/${id}`} />
      <main lang={lang} className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-10">
        <Link
          href={`/?lang=${lang}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent"
        >
          <ArrowLeftIcon />
          {t(lang, "back")}
        </Link>
        <h1 className="mt-4 font-serif text-3xl font-semibold leading-tight sm:text-4xl">{story.title[lang]}</h1>
        <p className="mt-2 text-sm text-muted">
          {lang === "kn" ? SOURCES[work].titleKn : SOURCES[work].title} · {lang === "kn" ? bookDef?.nameKn : bookDef?.name}{" "}
          · {unit} {from === to ? from : `${from}–${to}`}
        </p>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted">{story.summary[lang]}</p>
        {liveMode() ? (
          <Narrator key={lang} lang={lang} request={{ storyId: story.id }} />
        ) : (
          <SavedNarrator key={lang} lang={lang} versions={loadSavedStory(story.id, lang)} />
        )}
      </main>
      <Footer lang={lang} />
    </>
  );
}
