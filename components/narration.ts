import type { NarrationEvent, SourceRef } from "@/lib/claude";

export type Segment = { kind: "text"; text: string } | { kind: "cite"; index: number };

export interface NarrationState {
  sources: SourceRef[];
  segments: Segment[];
  /** Source index → footnote number, in order of first citation. */
  footnotes: Map<number, number>;
  done: boolean;
  error?: string;
}

export const initialNarration = (): NarrationState => ({
  sources: [],
  segments: [],
  footnotes: new Map(),
  done: false,
});

export function applyEvent(state: NarrationState, ev: NarrationEvent): NarrationState {
  switch (ev.type) {
    case "sources":
      return { ...state, sources: ev.sources };
    case "text": {
      const last = state.segments.at(-1);
      const segments =
        last?.kind === "text"
          ? [...state.segments.slice(0, -1), { kind: "text" as const, text: last.text + ev.text }]
          : [...state.segments, { kind: "text" as const, text: ev.text }];
      return { ...state, segments };
    }
    case "cite": {
      const footnotes = new Map(state.footnotes);
      if (!footnotes.has(ev.index)) footnotes.set(ev.index, footnotes.size + 1);
      return { ...state, footnotes, segments: [...state.segments, { kind: "cite", index: ev.index }] };
    }
    case "done":
      return { ...state, done: true };
    case "error":
      return { ...state, done: true, error: ev.message };
  }
}

/** Group segments into paragraphs, splitting text on blank lines. */
export function toParagraphs(segments: Segment[]): Segment[][] {
  const paras: Segment[][] = [[]];
  for (const seg of segments) {
    if (seg.kind === "cite") {
      paras[paras.length - 1].push(seg);
      continue;
    }
    seg.text.split(/\n\s*\n/).forEach((piece, i) => {
      if (i > 0) paras.push([]);
      if (piece) paras[paras.length - 1].push({ kind: "text", text: piece });
    });
  }
  return paras.filter((p) => p.some((s) => s.kind === "text" && s.text.trim()));
}

export const plainText = (segments: Segment[]) =>
  segments
    .filter((s): s is Extract<Segment, { kind: "text" }> => s.kind === "text")
    .map((s) => s.text)
    .join("")
    .trim();
