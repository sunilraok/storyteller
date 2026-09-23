import Anthropic from "@anthropic-ai/sdk";
import { corpus, CorpusMissingError, getSections, search } from "@/lib/corpus/db";
import {
  claudeConfigured,
  MISSING_KEY_MESSAGE,
  narrate,
  questionInstruction,
  searchKeywords,
  storyInstruction,
  toSourceRefs,
  type Audience,
  type NarrationEvent,
} from "@/lib/claude";
import { isLang } from "@/lib/i18n";
import { ndjsonResponse } from "@/lib/ndjson";
import { guard } from "@/lib/guard";
import { getStory } from "@/lib/stories";

export const runtime = "nodejs";

/** Cap on passages per request, to bound cost for long pinned ranges. */
const MAX_PASSAGES = 40;

interface Body {
  storyId?: string;
  question?: string;
  lang?: string;
  audience?: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const lang = isLang(body.lang) ? body.lang : "kn";
  const audience: Audience = body.audience === "adult" ? "adult" : "child";
  const story = body.storyId ? getStory(body.storyId) : undefined;
  const question = body.question?.trim().slice(0, 500);
  if (body.storyId && !story) return Response.json({ error: "Unknown story" }, { status: 404 });
  if (!story && !question) return Response.json({ error: "Provide storyId or question" }, { status: 400 });

  if (!claudeConfigured()) return Response.json({ error: MISSING_KEY_MESSAGE }, { status: 503 });

  const g = await guard("narrate");
  if (g instanceof Response) return g;
  let handedOff = false;

  try {
    const db = corpus();
    let passages;
    let instruction: string;

    if (story) {
      const { work, book, from, to } = story.source;
      passages = getSections(db, work, book, from, to).slice(0, MAX_PASSAGES);
      instruction = storyInstruction(story.title.en, lang, audience);
    } else {
      const keywords = await searchKeywords(question!);
      passages = search(db, keywords || question!, { limit: 8 });
      instruction = questionInstruction(question!, lang, audience);
    }

    if (!passages.length) return Response.json({ error: "noPassages" }, { status: 404 });

    handedOff = true;
    return ndjsonResponse<NarrationEvent>(
      releasing(narrate(toSourceRefs(passages), instruction, req.signal), g.release),
      (e) => ({ type: "error", message: errorMessage(e) }),
    );
  } catch (e) {
    const status = e instanceof CorpusMissingError ? 503 : e instanceof Anthropic.APIError ? 502 : 500;
    return Response.json({ error: errorMessage(e) }, { status });
  } finally {
    if (!handedOff) await g.release();
  }
}

/** Free the caller's concurrency slot once the stream finishes, fails or is cancelled. */
async function* releasing<T>(events: AsyncGenerator<T>, release: () => Promise<void>): AsyncGenerator<T> {
  try {
    yield* events;
  } finally {
    await release();
  }
}

function errorMessage(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "The Claude API key (ANTHROPIC_API_KEY) was rejected; check that it is correct.";
  if (e instanceof Error && /Could not resolve authentication method/.test(e.message)) return MISSING_KEY_MESSAGE;
  if (e instanceof Anthropic.RateLimitError) return "Rate limited by the Claude API; please try again shortly.";
  if (e instanceof Anthropic.APIError) return `Claude API error (${e.status}): ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}
