/**
 * Pre-generated ("saved") narrations.
 *
 * Layout, per story:
 *   data/narrations/<storyId>/sources.json          pinned source passages (npm run story:export)
 *   data/narrations/<storyId>/<lang>-<audience>.md  narration; cites passages inline as [[passage-id]]
 *   data/narrations/<storyId>/<lang>-<audience>.check.json   optional faithfulness review
 *   public/audio/<storyId>/<lang>-<audience>/manifest.json   optional pre-generated audio
 *
 * This module is pure (no filesystem access) so it can be shared by the site,
 * the scripts and the tests; lib/savedStore.ts does the file I/O.
 */
import crypto from "node:crypto";
import type { Audience, FidelityIssue, FidelityResult, NarrationEvent, SourceRef } from "./claude";
import type { Lang } from "./i18n";

export interface SourcePassage {
  id: string;
  label: string;
  text: string;
}

export interface SourcesFile {
  storyId: string;
  passages: SourcePassage[];
}

export interface CheckFile {
  status: "checked" | "indeterminate";
  issues?: FidelityIssue[];
  reason?: string;
  checkedAt?: string;
  /** sha256 of the narration file this review applies to (filled by `story:check --stamp`). */
  narrationSha256?: string;
}

export interface AudioManifest {
  narrationSha256: string;
  chunks: { file: string; text: string }[];
}

/** Everything the reader needs to show one saved narration; JSON-serializable. */
export interface SavedVersion {
  events: NarrationEvent[];
  text: string;
  fidelity?: FidelityResult;
  audio?: string[];
}

export const AUDIENCES: Audience[] = ["child", "adult"];

export const narrationFileName = (lang: Lang, audience: Audience) => `${lang}-${audience}.md`;
export const checkFileName = (lang: Lang, audience: Audience) => `${lang}-${audience}.check.json`;

export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

const MARKER_RE = /\[\[([^\[\]]*)\]\]/g;
const ID_RE = /^(mahabharata|ramayana):[a-z]+:\d+:\d+$/;

export interface ParsedNarration {
  events: NarrationEvent[];
  /** The narration with citation markers removed. */
  text: string;
  sources: SourceRef[];
  citations: number;
  uncitedParagraphs: number;
  errors: string[];
}

/**
 * Parse a narration file: paragraphs separated by blank lines, citations as
 * [[passage-id]] markers after the text they support. Sources are numbered in
 * order of first citation, as the live reader does.
 */
export function parseNarration(md: string, passages: SourcePassage[]): ParsedNarration {
  const byId = new Map(passages.map((p) => [p.id, p]));
  const sources: SourceRef[] = [];
  const indexOf = new Map<string, number>();
  const events: NarrationEvent[] = [];
  const errors: string[] = [];
  let citations = 0;
  let uncitedParagraphs = 0;
  const texts: string[] = [];

  const paragraphs = md
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

  paragraphs.forEach((para, pi) => {
    if (pi > 0) events.push({ type: "text", text: "\n\n" });
    let last = 0;
    let cited = false;
    let plain = "";
    for (const m of para.matchAll(MARKER_RE)) {
      const before = para.slice(last, m.index).replace(/\s+$/, "");
      if (before) {
        events.push({ type: "text", text: before });
        plain += before;
      }
      last = m.index! + m[0].length;
      const id = m[1].trim();
      if (!ID_RE.test(id)) {
        errors.push(`paragraph ${pi + 1}: malformed citation [[${m[1]}]]`);
        continue;
      }
      const passage = byId.get(id);
      if (!passage) {
        errors.push(`paragraph ${pi + 1}: cites ${id}, which is not one of this story's source passages`);
        continue;
      }
      if (!indexOf.has(id)) {
        indexOf.set(id, sources.length);
        sources.push({ index: sources.length, id, label: passage.label, text: passage.text });
      }
      events.push({ type: "cite", index: indexOf.get(id)! });
      citations++;
      cited = true;
    }
    const rest = para.slice(last);
    if (rest.trim()) {
      events.push({ type: "text", text: rest });
      plain += rest;
    }
    if (/\[\[|\]\]/.test(plain)) errors.push(`paragraph ${pi + 1}: unbalanced [[ ]] citation brackets`);
    if (!cited) uncitedParagraphs++;
    texts.push(plain.replace(/\s+/g, " ").trim());
  });

  return {
    events: [{ type: "sources", sources }, ...events, { type: "done", stopReason: "end_turn" }],
    text: texts.join("\n\n"),
    sources,
    citations,
    uncitedParagraphs,
    errors,
  };
}

const KANNADA = /[ಀ-೿]/g;
const LETTER = /\p{L}/gu;

/** Length expectations in words (whitespace-separated), from the narration prompt. */
export const LENGTH_WORDS: Record<Audience, [number, number]> = { child: [250, 900], adult: [450, 1700] };

export interface NarrationReport {
  errors: string[];
  warnings: string[];
}

/** Validate a narration file against its story's passages and the language/audience rules. */
export function checkNarration(md: string, passages: SourcePassage[], lang: Lang, audience: Audience): NarrationReport {
  const parsed = parseNarration(md, passages);
  const errors = [...parsed.errors];
  const warnings: string[] = [];

  if (!parsed.text) errors.push("narration is empty");
  if (parsed.citations === 0) errors.push("narration cites no source passages");

  const letters = parsed.text.match(LETTER)?.length ?? 0;
  const kannada = parsed.text.match(KANNADA)?.length ?? 0;
  const ratio = letters ? kannada / letters : 0;
  if (lang === "kn" && ratio < 0.8) errors.push(`expected Kannada script, but only ${Math.round(ratio * 100)}% of letters are Kannada`);
  if (lang === "en" && ratio > 0.02) errors.push("English narration contains Kannada script");

  md.split("\n").forEach((line, i) => {
    if (/^\s*(#{1,6}\s|[-*+]\s|>\s|\d+\.\s)/.test(line) || /\*\*|__/.test(line)) {
      errors.push(`line ${i + 1}: markdown formatting is not allowed (plain paragraphs only)`);
    }
  });

  const words = parsed.text.split(/\s+/).filter(Boolean).length;
  const [min, max] = LENGTH_WORDS[audience];
  if (words < min || words > max) warnings.push(`${words} words; expected about ${min}–${max} for ${audience}`);
  if (parsed.uncitedParagraphs) warnings.push(`${parsed.uncitedParagraphs} paragraph(s) have no citation`);

  return { errors, warnings };
}

/** Validate a faithfulness review file; returns the result to show, or null if unusable. */
export function readCheck(
  check: CheckFile,
  narrationMd: string,
  narrationText: string,
): { result: FidelityResult | null; errors: string[]; stale: boolean } {
  const errors: string[] = [];
  if (check.status === "indeterminate") {
    return { result: { status: "indeterminate", reason: check.reason ?? "not verified" }, errors, stale: false };
  }
  if (check.status !== "checked" || !Array.isArray(check.issues)) {
    return { result: null, errors: ["check file must have status \"checked\" with an issues array"], stale: false };
  }
  for (const iss of check.issues) {
    if (typeof iss?.sentence !== "string" || typeof iss?.reason !== "string") {
      errors.push("each issue needs a sentence and a reason");
    } else if (!narrationText.includes(iss.sentence.trim())) {
      errors.push(`flagged sentence not found in narration: "${iss.sentence.slice(0, 60)}…"`);
    }
  }
  const stale = !!check.narrationSha256 && check.narrationSha256 !== sha256(narrationMd);
  if (stale) errors.push("check is stale: the narration changed after it was reviewed");
  if (errors.length) return { result: null, errors, stale };
  return { result: { status: "checked", issues: check.issues }, errors, stale };
}
