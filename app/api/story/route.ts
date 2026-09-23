import Anthropic from "@anthropic-ai/sdk";
import { corpus, CorpusMissingError, getSections, search } from "@/lib/corpus/db";
import {
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

  try {
    const db = corpus();
    let passages;
    let instruction: string;

    if (body.storyId) {
      const story = getStory(body.storyId);
      if (!story) return Response.json({ error: "Unknown story" }, { status: 404 });
      const { work, book, from, to } = story.source;
      passages = getSections(db, work, book, from, to).slice(0, MAX_PASSAGES);
      instruction = storyInstruction(story.title.en, lang, audience);
    } else if (body.question?.trim()) {
      const question = body.question.trim().slice(0, 500);
      const keywords = await searchKeywords(question);
      passages = search(db, keywords || question, { limit: 8 });
      instruction = questionInstruction(question, lang, audience);
    } else {
      return Response.json({ error: "Provide storyId or question" }, { status: 400 });
    }

    if (!passages.length) return Response.json({ error: "noPassages" }, { status: 404 });

    return ndjsonResponse<NarrationEvent>(narrate(toSourceRefs(passages), instruction, req.signal), (e) => ({
      type: "error",
      message: errorMessage(e),
    }));
  } catch (e) {
    const status = e instanceof CorpusMissingError ? 503 : e instanceof Anthropic.APIError ? 502 : 500;
    return Response.json({ error: errorMessage(e) }, { status });
  }
}

function errorMessage(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "Anthropic API key is missing or invalid (ANTHROPIC_API_KEY).";
  if (e instanceof Anthropic.RateLimitError) return "Rate limited by the Claude API; please try again shortly.";
  if (e instanceof Anthropic.APIError) return `Claude API error (${e.status}): ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}
