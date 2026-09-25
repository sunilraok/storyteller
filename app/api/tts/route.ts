import { isLang } from "@/lib/i18n";
import { guard } from "@/lib/guard";
import { LIVE_DISABLED, liveMode } from "@/lib/mode";
import { synthesizeCached, TtsNotConfiguredError } from "@/lib/tts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Paid endpoints are off unless live narration is explicitly enabled.
  if (!liveMode()) return Response.json(LIVE_DISABLED, { status: 404 });
  const { text, lang, voice } = (await req.json().catch(() => ({}))) as {
    text?: string;
    lang?: string;
    voice?: string;
  };
  if (!text?.trim() || text.length > 1000 || !isLang(lang)) {
    return Response.json({ error: "Provide text (≤1000 chars) and a supported lang" }, { status: 400 });
  }
  const g = await guard("tts", text.trim().length);
  if (g instanceof Response) return g;
  try {
    const { audio, contentType } = await synthesizeCached(text.trim(), lang, voice);
    return new Response(new Uint8Array(audio), {
      headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=86400" },
    });
  } catch (e) {
    if (e instanceof TtsNotConfiguredError) return Response.json({ error: e.message }, { status: 501 });
    return Response.json({ error: (e as Error).message }, { status: 502 });
  } finally {
    await g.release();
  }
}
