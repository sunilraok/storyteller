import { corpus, getPassage } from "@/lib/corpus/db";
import { checkFidelity, toSourceRefs } from "@/lib/claude";
import type { Passage } from "@/lib/corpus/parse";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { passageIds, narration } = (await req.json().catch(() => ({}))) as {
    passageIds?: string[];
    narration?: string;
  };
  if (!Array.isArray(passageIds) || !passageIds.length || !narration?.trim() || narration.length > 30_000) {
    return Response.json({ error: "Provide passageIds and narration" }, { status: 400 });
  }
  try {
    const db = corpus();
    const passages = passageIds
      .slice(0, 40)
      .map((id) => getPassage(db, id))
      .filter((p): p is Passage => !!p);
    const issues = await checkFidelity(toSourceRefs(passages), narration);
    return Response.json({ issues });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
