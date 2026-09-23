import { describe, expect, it } from "vitest";
import { ndjsonResponse, readNdjson } from "@/lib/ndjson";

describe("ndjson", () => {
  it("round-trips events and reports thrown errors as a final event", async () => {
    type Ev = { n?: number; text?: string; error?: string };
    async function* events(): AsyncGenerator<Ev> {
      yield { n: 1, text: "ಕಥೆ\nline" };
      yield { n: 2 };
      throw new Error("boom");
    }
    const res = ndjsonResponse<Ev>(events(), (e) => ({ error: (e as Error).message }));
    const out = [];
    for await (const ev of readNdjson(res)) out.push(ev);
    expect(out).toEqual([{ n: 1, text: "ಕಥೆ\nline" }, { n: 2 }, { error: "boom" }]);
  });
});
