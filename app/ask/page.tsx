import { AskForm } from "@/components/AskForm";
import { Footer, Header } from "@/components/Header";
import { t } from "@/lib/i18n";
import { langFrom } from "@/lib/params";

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await langFrom(searchParams);
  return (
    <>
      <Header lang={lang} path="/ask" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="font-serif text-3xl font-semibold">{t(lang, "ask")}</h1>
        <AskForm key={lang} lang={lang} />
      </main>
      <Footer lang={lang} />
    </>
  );
}
