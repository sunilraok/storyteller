import raw from "@/data/stories.json";
import type { WorkId } from "./corpus/sources";
import type { Lang } from "./i18n";

export interface Story {
  id: string;
  title: Record<Lang, string>;
  summary: Record<Lang, string>;
  /** Pinned source range: sections `from`..`to` of one book. `expect` terms are checked at ingest time. */
  source: { work: WorkId; book: string; from: number; to: number; expect: string[] };
}

export const STORIES = raw as Story[];

export function getStory(id: string): Story | undefined {
  return STORIES.find((s) => s.id === id);
}
