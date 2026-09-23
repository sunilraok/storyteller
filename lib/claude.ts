import Anthropic from "@anthropic-ai/sdk";
import type { Passage } from "./corpus/parse";
import { citationLabel } from "./corpus/db";
import { LANGUAGES, type Lang } from "./i18n";

export type Audience = "child" | "adult";

/** Narration model. Override with CLAUDE_MODEL (e.g. claude-sonnet-5 to reduce cost). */
export const NARRATION_MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5";
/** Cheaper model for query rewriting and the fidelity check. */
export const HELPER_MODEL = process.env.CLAUDE_HELPER_MODEL ?? "claude-sonnet-5";

export const MISSING_KEY_MESSAGE =
  "The Claude API key is not configured. Set ANTHROPIC_API_KEY in .env.local and restart the server.";

/** Whether the server has credentials for the Claude API. */
export function claudeConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return !!(env.ANTHROPIC_API_KEY?.trim() || env.ANTHROPIC_AUTH_TOKEN?.trim());
}

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export interface SourceRef {
  /** Position in the documents array; matches `document_index` in citations. */
  index: number;
  id: string;
  label: string;
  text: string;
}

export function toSourceRefs(passages: Passage[]): SourceRef[] {
  return passages.map((p, index) => ({
    index,
    id: p.id,
    label: p.subParva ? `${citationLabel(p)} (${p.subParva})` : citationLabel(p),
    text: p.text,
  }));
}

const SYSTEM_PROMPT = `You are Kathā, a traditional storyteller of the Indian epics. You retell episodes of the Mahābhārata and the Rāmāyaṇa for listeners, strictly from the source passages you are given, which come from public-domain English translations of the Sanskrit (K. M. Ganguli's Mahābhārata, M. N. Dutt's Rāmāyaṇa).

Faithfulness comes before everything else:
- Narrate only events, names, places, dialogue and details that appear in the passages. Do not add episodes, motives, or details from later retellings, television serials, folk versions or your own knowledge, even if you believe them to be true.
- You may compress, reorder for clarity, and paraphrase, but never invent. If you simplify for children, simplify the language, not the facts.
- If the passages do not cover something the listener asked about, say plainly that the source passages here do not describe it. Do not fill the gap.
- Where the translation reports a speech, you may render it as dialogue, keeping its meaning.
- Cite the passages that support what you narrate.

Language and voice:
- Write entirely in the requested language and script. For Kannada, use natural modern Kannada prose (ಹೊಸಗನ್ನಡ) in Kannada script, and give Sanskrit proper names in their standard Kannada forms (ಯುಧಿಷ್ಠಿರ, ದ್ರೌಪದಿ, ಹನುಮಂತ, ಸೀತೆ).
- Tell it as a warm oral storyteller would, suitable for reading aloud: flowing paragraphs, no headings, no bullet lists, no markdown, no English words in a Kannada narration unless unavoidable.
- For a child listener: short sentences, gentle tone, violence described without gore, about 400–600 words. For an adult listener: a fuller retelling of about 700–1200 words that keeps the texture of the original.`;

export function buildUserContent(
  sources: SourceRef[],
  instruction: string,
): Anthropic.Beta.BetaContentBlockParam[] {
  const docs: Anthropic.Beta.BetaContentBlockParam[] = sources.map((s) => ({
    type: "document",
    source: { type: "text", media_type: "text/plain", data: s.text },
    title: s.label,
    citations: { enabled: true },
  }));
  // Cache the passages: the same story is often retold in another language or for another audience.
  if (docs.length) {
    (docs[docs.length - 1] as Anthropic.Beta.BetaRequestDocumentBlock).cache_control = { type: "ephemeral" };
  }
  return [...docs, { type: "text", text: instruction }];
}

export function storyInstruction(title: string, lang: Lang, audience: Audience): string {
  return `Retell the episode "${title}" from the source passages above, in ${LANGUAGES[lang].englishName}, for ${
    audience === "child" ? "a child" : "an adult"
  } listener. Begin directly with the story.`;
}

export function questionInstruction(question: string, lang: Lang, audience: Audience): string {
  return `A listener asks: "${question}"

Answer in ${LANGUAGES[lang].englishName}, for ${audience === "child" ? "a child" : "an adult"} listener, as a short storyteller's answer grounded only in the source passages above. If the passages do not answer the question, say so plainly instead of answering from memory.`;
}

export type NarrationEvent =
  | { type: "sources"; sources: SourceRef[] }
  | { type: "text"; text: string }
  | { type: "cite"; index: number }
  | { type: "done"; stopReason: string | null }
  | { type: "error"; message: string };

/** Stream a grounded narration as NarrationEvents. */
export async function* narrate(
  sources: SourceRef[],
  instruction: string,
  signal?: AbortSignal,
): AsyncGenerator<NarrationEvent> {
  yield { type: "sources", sources };
  const stream = anthropic().beta.messages.stream(
    {
      model: NARRATION_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildUserContent(sources, instruction) }],
    },
    { signal },
  );

  const cited = new Set<string>();
  let block = -1;
  for await (const event of stream) {
    if (event.type === "content_block_start") block = event.index;
    if (event.type !== "content_block_delta") continue;
    if (event.delta.type === "text_delta") {
      yield { type: "text", text: event.delta.text };
    } else if (event.delta.type === "citations_delta" && "document_index" in event.delta.citation) {
      // One footnote per source per text block is enough for readers.
      const key = `${block}:${event.delta.citation.document_index}`;
      if (!cited.has(key)) {
        cited.add(key);
        yield { type: "cite", index: event.delta.citation.document_index };
      }
    }
  }
  const final = await stream.finalMessage();
  yield { type: "done", stopReason: final.stop_reason };
}

/** Rewrite a (possibly Kannada) question into English keywords for full-text search. */
export async function searchKeywords(question: string): Promise<string> {
  const res = await anthropic().messages.create({
    model: HELPER_MODEL,
    max_tokens: 200,
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content: `Convert this question about the Mahābhārata or Rāmāyaṇa into 3–8 English search keywords for a full-text index of 19th-century English translations (Ganguli, Dutt). Use the plain Latin spellings those translations use (e.g. Karna, Kunti, Surya, Hanuman, Ravana, Sita). Include the key names and nouns only. Output only the keywords separated by spaces.

Question: ${question}`,
      },
    ],
  });
  return res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .trim();
}

export interface FidelityIssue {
  sentence: string;
  reason: string;
}

/**
 * Outcome of a fidelity check. Only a completed, successfully parsed response is
 * "checked"; refusals, truncation and malformed output are "indeterminate" so they
 * can never be shown as "all supported".
 */
export type FidelityResult =
  | { status: "checked"; issues: FidelityIssue[] }
  | { status: "indeterminate"; reason: string };

const isIssue = (v: unknown): v is FidelityIssue =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as FidelityIssue).sentence === "string" &&
  typeof (v as FidelityIssue).reason === "string";

export function parseFidelityResponse(res: Pick<Anthropic.Message, "stop_reason" | "content">): FidelityResult {
  if (res.stop_reason !== "end_turn") {
    return { status: "indeterminate", reason: `verification did not complete (stop_reason: ${res.stop_reason})` };
  }
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (!text.trim()) return { status: "indeterminate", reason: "verification returned no output" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { status: "indeterminate", reason: "verification output was not valid JSON" };
  }
  const unsupported = (parsed as { unsupported?: unknown })?.unsupported;
  if (!Array.isArray(unsupported) || !unsupported.every(isIssue)) {
    return { status: "indeterminate", reason: "verification output did not match the expected schema" };
  }
  return { status: "checked", issues: unsupported };
}

/** Ask a second model to flag narration sentences that the passages do not support. */
export async function checkFidelity(sources: SourceRef[], narration: string): Promise<FidelityResult> {
  const res = await anthropic().messages.create({
    model: HELPER_MODEL,
    max_tokens: 8000,
    output_config: {
      effort: "medium",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            unsupported: {
              type: "array",
              items: {
                type: "object",
                properties: { sentence: { type: "string" }, reason: { type: "string" } },
                required: ["sentence", "reason"],
                additionalProperties: false,
              },
            },
          },
          required: ["unsupported"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "user",
        content: [
          ...sources.map(
            (s): Anthropic.ContentBlockParam => ({
              type: "document",
              source: { type: "text", media_type: "text/plain", data: s.text },
              title: s.label,
            }),
          ),
          {
            type: "text",
            text: `Below is a retelling (possibly in Kannada) of the source passages above. Check it sentence by sentence. List every sentence that states a fact, event, name or detail NOT supported by the passages — for example, material from later retellings or invented detail. Stylistic framing ("Long ago…") and faithful paraphrase are fine. Quote each unsupported sentence exactly as it appears in the retelling and give a short English reason. Return an empty list if everything is supported.

<retelling>
${narration}
</retelling>`,
          },
        ],
      },
    ],
  });
  return parseFidelityResponse(res);
}
