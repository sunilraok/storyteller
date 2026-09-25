import fs from "node:fs";
import path from "node:path";
import type { Audience } from "./claude";
import type { Lang } from "./i18n";
import {
  AUDIENCES,
  checkFileName,
  narrationFileName,
  parseNarration,
  readCheck,
  sha256,
  type AudioManifest,
  type CheckFile,
  type SavedVersion,
  type SourcesFile,
} from "./saved";

export const NARRATIONS_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "narrations");
export const AUDIO_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "audio");

const readJson = <T>(file: string): T | null => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
};

export function readSources(storyId: string, dir = NARRATIONS_DIR): SourcesFile | null {
  return readJson<SourcesFile>(path.join(/*turbopackIgnore: true*/ dir, storyId, "sources.json"));
}

export function audioDir(storyId: string, lang: Lang, audience: Audience, dir = AUDIO_DIR) {
  return path.join(/*turbopackIgnore: true*/ dir, storyId, `${lang}-${audience}`);
}

/** Load one saved narration for the reader, or null if it has not been generated. */
export function loadSavedVersion(
  storyId: string,
  lang: Lang,
  audience: Audience,
  dirs = { narrations: NARRATIONS_DIR, audio: AUDIO_DIR },
): SavedVersion | null {
  const sources = readSources(storyId, dirs.narrations);
  const file = path.join(/*turbopackIgnore: true*/ dirs.narrations, storyId, narrationFileName(lang, audience));
  if (!sources || !fs.existsSync(file)) return null;
  const md = fs.readFileSync(file, "utf8");
  const parsed = parseNarration(md, sources.passages);
  // Never show a narration whose citations do not resolve; story:check reports why.
  if (parsed.errors.length || !parsed.citations) return null;

  const version: SavedVersion = { events: parsed.events, text: parsed.text };

  const check = readJson<CheckFile>(path.join(/*turbopackIgnore: true*/ dirs.narrations, storyId, checkFileName(lang, audience)));
  if (check) {
    const { result } = readCheck(check, md, parsed.text);
    if (result) version.fidelity = result;
  }

  const manifest = readJson<AudioManifest>(path.join(audioDir(storyId, lang, audience, dirs.audio), "manifest.json"));
  if (manifest?.narrationSha256 === sha256(md) && manifest.chunks.length) {
    version.audio = manifest.chunks.map((c) => `/audio/${storyId}/${lang}-${audience}/${c.file}`);
  }
  return version;
}

export function loadSavedStory(storyId: string, lang: Lang): Partial<Record<Audience, SavedVersion>> {
  const out: Partial<Record<Audience, SavedVersion>> = {};
  for (const a of AUDIENCES) {
    const v = loadSavedVersion(storyId, lang, a);
    if (v) out[a] = v;
  }
  return out;
}
