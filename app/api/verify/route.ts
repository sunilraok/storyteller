import { corpus, getPassage } from "@/lib/corpus/db";
import { checkFidelity, claudeConfigured, MISSING_KEY_MESSAGE, toSourceRefs, type FidelityResult } from "@/lib/claude";
import type { Passage } from "@/lib/corpus/parse";
import { guard } from "@/lib/guard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { passageIds, narration } = (await req.json().catch(() => ({}))) as {
    passageIds?: string[];
    narration?: string;
  };
  if (!Array.isArray(passageIds) || !passageIds.length || !narration?.trim() || narration.length > 30_000) {
    return Response.json({ error: "Provide passageIds and narration" }, { status: 400 });
  }
  if (passageIds.length > 40) {
    return Response.json({ error: "Too many passages" }, { status: 400 });
  }

  if (!claudeConfigured()) return Response.json({ error: MISSING_KEY_MESSAGE }, { status: 503 });

  const g = await guard("verify");
  if (g instanceof Response) return g;
  try {
    const db = corpus();
    const passages = passageIds.map((id) => getPassage(db, id));
    // Verifying against a partial set of sources could wrongly flag or pass sentences.
    if (passages.some((p) => !p)) {
      return Response.json({ error: "Unknown passage id" }, { status: 400 });
    }
    const result: FidelityResult = await checkFidelity(toSourceRefs(passages as Passage[]), narration);
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    await g.release();
  }
}
