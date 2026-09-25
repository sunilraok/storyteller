import { describe, expect, it } from "vitest";
import { applyEvent, initialNarration, plainText, toParagraphs } from "@/components/narration";
import type { NarrationEvent } from "@/lib/claude";

describe("narration state", () => {
  it("merges text, numbers footnotes by first citation, and splits paragraphs", () => {
    const events: NarrationEvent[] = [
      { type: "sources", sources: [] },
      { type: "text", text: "ಮೊದಲ ಸಾಲು." },
      { type: "cite", index: 2 },
      { type: "text", text: "\n\nಎರಡನೆಯ " },
      { type: "text", text: "ಸಾಲು." },
      { type: "cite", index: 0 },
      { type: "cite", index: 2 },
      { type: "done", stopReason: "end_turn" },
    ];
    const s = events.reduce(applyEvent, initialNarration());
    expect([...s.footnotes]).toEqual([[2, 1], [0, 2]]);
    expect(s.done).toBe(true);
    const paras = toParagraphs(s.segments);
    expect(paras).toHaveLength(2);
    expect(paras[1]).toEqual([
      { kind: "text", text: "ಎರಡನೆಯ ಸಾಲು." },
      { kind: "cite", index: 0 },
      { kind: "cite", index: 2 },
    ]);
    expect(plainText(s.segments)).toBe("ಮೊದಲ ಸಾಲು.\n\nಎರಡನೆಯ ಸಾಲು.");
  });
});
