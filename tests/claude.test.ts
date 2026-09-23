import { describe, expect, it, vi } from "vitest";

const streamCalls: unknown[] = [];
vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    beta = {
      messages: {
        stream: (params: unknown) => {
          streamCalls.push(params);
          const events = [
            { type: "content_block_start", index: 0 },
            { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ಒಮ್ಮೆ " } },
            { type: "content_block_delta", index: 0, delta: { type: "citations_delta", citation: { type: "char_location", document_index: 1 } } },
            { type: "content_block_delta", index: 0, delta: { type: "citations_delta", citation: { type: "char_location", document_index: 1 } } },
            { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ದೇವತೆಗಳು…" } },
          ];
          return {
            async *[Symbol.asyncIterator]() {
              yield* events;
            },
            finalMessage: async () => ({ stop_reason: "end_turn" }),
          };
        },
      },
    };
  }
  return { default: Anthropic };
});

const { buildUserContent, narrate, storyInstruction, toSourceRefs } = await import("@/lib/claude");

const passages = [
  { id: "mahabharata:adi:17:1", work: "mahabharata" as const, book: "adi", section: 17, part: 1, subParva: "Astika Parva", text: "A" },
  { id: "mahabharata:adi:18:1", work: "mahabharata" as const, book: "adi", section: 18, part: 1, text: "B" },
];

describe("prompt assembly", () => {
  it("labels sources and passes them as citable, cached documents", () => {
    const refs = toSourceRefs(passages);
    expect(refs.map((r) => r.label)).toEqual(["Ganguli, Ādi Parva §17 (Astika Parva)", "Ganguli, Ādi Parva §18"]);
    const content = buildUserContent(refs, "Tell it");
    expect(content).toHaveLength(3);
    expect(content[0]).toMatchObject({ type: "document", title: refs[0].label, citations: { enabled: true } });
    expect(content[0]).not.toHaveProperty("cache_control");
    expect(content[1]).toMatchObject({ cache_control: { type: "ephemeral" } });
    expect(content[2]).toEqual({ type: "text", text: "Tell it" });
  });

  it("names the target language and audience", () => {
    expect(storyInstruction("Ekalavya", "kn", "child")).toMatch(/in Kannada, for a child listener/);
  });
});

describe("narrate", () => {
  it("streams sources, text and de-duplicated citations", async () => {
    const events = [];
    for await (const ev of narrate(toSourceRefs(passages), "Tell it")) events.push(ev);
    expect(events.map((e) => e.type)).toEqual(["sources", "text", "cite", "text", "done"]);
    expect(events[2]).toEqual({ type: "cite", index: 1 });
    expect(streamCalls[0]).toMatchObject({ fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] });
  });
});
