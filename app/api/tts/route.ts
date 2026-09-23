import { isLang } from "@/lib/i18n";
import { synthesizeCached, TtsNotConfiguredError } from "@/lib/tts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { text, lang, voice } = (await req.json().catch(() => ({}))) as {
    text?: string;
    lang?: string;
    voice?: string;
  };
  if (!text?.trim() || text.length > 1000 || !isLang(lang)) {
    return Response.json({ error: "Provide text (≤1000 chars) and a supported lang" }, { status: 400 });
  }
  try {
    const { audio, contentType } = await synthesizeCached(text.trim(), lang, voice);
    return new Response(new Uint8Array(audio), {
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch (e) {
    if (e instanceof TtsNotConfiguredError) return Response.json({ error: e.message }, { status: 501 });
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
