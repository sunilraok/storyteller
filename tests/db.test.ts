import { describe, expect, it } from "vitest";
import { citationLabel, getPassage, getSections, openDb, search, toFtsQuery, writePassages } from "@/lib/corpus/db";
import type { Passage } from "@/lib/corpus/parse";

const passages: Passage[] = [
  { id: "mahabharata:adi:17:1", work: "mahabharata", book: "adi", section: 17, part: 1, text: "The gods churned the ocean using Mandara as the churning staff." },
  { id: "mahabharata:adi:18:1", work: "mahabharata", book: "adi", section: 18, part: 1, text: "Then arose the Amrita, and Rahu was beheaded." },
  { id: "ramayana:sundara:1:1", work: "ramayana", book: "sundara", section: 1, part: 1, text: "Hanumān leapt from Mount Mahendra across the ocean." },
];

function db() {
  const d = openDb(":memory:");
  writePassages(d, passages);
  return d;
}

describe("corpus db", () => {
  it("builds safe FTS queries", () => {
    expect(toFtsQuery('Who was "Karna\'s" mother?')).toBe('"karna" OR "mother"');
    expect(toFtsQuery("the of")).toBe("");
  });

  it("returns pinned section ranges in order", () => {
    expect(getSections(db(), "mahabharata", "adi", 17, 18).map((p) => p.section)).toEqual([17, 18]);
  });

  it("searches with diacritic folding and work filter", () => {
    const d = db();
    expect(search(d, "hanuman ocean")[0].id).toBe("ramayana:sundara:1:1");
    expect(search(d, "ocean", { work: "mahabharata" }).map((p) => p.id)).toEqual(["mahabharata:adi:17:1"]);
    expect(getPassage(d, "mahabharata:adi:18:1")?.text).toContain("Rahu");
  });

  it("formats citation labels", () => {
    expect(citationLabel({ work: "mahabharata", book: "adi", section: 134 })).toBe("Ganguli, Ādi Parva §134");
    expect(citationLabel({ work: "ramayana", book: "sundara", section: 1 })).toBe("Dutt, Sundara Kāṇḍa, Sarga 1");
  });
});
