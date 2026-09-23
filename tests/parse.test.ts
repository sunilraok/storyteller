import { describe, expect, it } from "vitest";
import { chunkSection, fold, normalizeHeading, parseVolume, parseWork, romanToInt } from "@/lib/corpus/parse";

// Synthetic text laid out like the Project Gutenberg editions (not real translation text).
const GANGULI_LIKE = `The Project Gutenberg eBook of The Mahabharata
*** START OF THE PROJECT GUTENBERG EBOOK THE MAHABHARATA ***

THE MAHABHARATA

BOOK 1

ADI PARVA

SECTION I

(Anukramanika Parva)

Om! Having bowed down to Narayana, the first sentence of section one is here.

A second paragraph of section one follows it.

SECTION II

Section two speaks of Mandara and the Amrita.

SABHA PARVA

SECTION I

The first section of the Sabha Parva, about the assembly hall.

*** END OF THE PROJECT GUTENBERG EBOOK THE MAHABHARATA ***
Licence text that must be ignored.`;

describe("helpers", () => {
  it("converts roman numerals", () => {
    expect(romanToInt("I")).toBe(1);
    expect(romanToInt("CXXXIV")).toBe(134);
    expect(romanToInt("CCXCVIII")).toBe(298);
    expect(romanToInt("abc")).toBeNull();
  });

  it("normalizes headings and folds diacritics", () => {
    expect(normalizeHeading("  Ādi  Parva. ")).toBe("ADI PARVA");
    expect(normalizeHeading("BĀLAKĀNDAM.")).toBe("BALAKANDAM");
    expect(fold("Hanumān")).toBe("hanuman");
  });
});

describe("parseVolume", () => {
  it("splits books and sections and drops Gutenberg boilerplate", () => {
    const { sections, warnings } = parseVolume("mahabharata", GANGULI_LIKE);
    expect(warnings).toEqual([]);
    expect(sections.map((s) => `${s.book}:${s.section}`)).toEqual(["adi:1", "adi:2", "sabha:1"]);
    expect(sections[0].subParva).toBe("Anukramanika Parva");
    expect(sections[0].text).toContain("second paragraph");
    expect(sections.at(-1)!.text).not.toContain("Licence");
  });

  it("recognises Ramayana kanda headings in their spelling variants", () => {
    const raw = `BALAKANDAM.\n\nSECTION I.\n\nNarada tells Valmiki the story of Rama, briefly and completely.\n\nSUNDARA KANDA\n\nSECTION I.\n\nHanuman stands on Mount Mahendra looking at the ocean.`;
    const { sections } = parseVolume("ramayana", raw);
    expect(sections.map((s) => `${s.book}:${s.section}`)).toEqual(["bala:1", "sundara:1"]);
  });

  it("carries the current book across volumes", () => {
    const vol2 = `SECTION III\n\nThe third section continues in the next volume of the Adi Parva text.`;
    const { sections } = parseWork("mahabharata", [GANGULI_LIKE.replace(/SABHA PARVA[\s\S]*?(?=\*\*\* END)/, ""), vol2]);
    expect(sections.map((s) => `${s.book}:${s.section}`)).toEqual(["adi:1", "adi:2", "adi:3"]);
  });

  it("ignores text before the first book heading", () => {
    const { sections } = parseVolume("mahabharata", `SECTION I\n\nPreface text that is long enough to count as a section.`);
    expect(sections).toEqual([]);
  });
});

describe("chunkSection", () => {
  const para = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

  it("keeps short sections whole", () => {
    const [p] = chunkSection({ work: "ramayana", book: "sundara", section: 1, text: para(100) });
    expect(p.id).toBe("ramayana:sundara:1:1");
  });

  it("splits long sections on paragraph boundaries", () => {
    const text = [para(350), para(350), para(350)].join("\n\n");
    const parts = chunkSection({ work: "mahabharata", book: "adi", section: 5, text }, 450, 600);
    expect(parts.map((p) => p.id)).toEqual(["mahabharata:adi:5:1", "mahabharata:adi:5:2", "mahabharata:adi:5:3"]);
    expect(parts.every((p) => p.text.split(" ").length <= 600)).toBe(true);
  });
});
