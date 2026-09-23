import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildCorpus } from "@/lib/corpus/build";
import { SOURCES, type SourceDef } from "@/lib/corpus/sources";
import type { Story } from "@/lib/stories";

// A tiny two-book Ramayana-like source so the test controls every check.
const source: SourceDef = {
  ...SOURCES.ramayana,
  gutenbergIds: [1, 2],
  minSections: 2,
  books: SOURCES.ramayana.books.filter((b) => b.slug === "bala" || b.slug === "sundara"),
};
const VOL1 = "BALAKANDAM.\n\nSECTION I.\n\nNarada tells Valmiki the whole story of Rama in brief.\n";
const VOL2 = "SUNDARA KANDA\n\nSECTION I.\n\nHanuman stands on Mount Mahendra and looks at the ocean.\n";
const story = (expect: string[]): Story => ({
  id: "leap",
  title: { en: "Leap", kn: "ಲಂಘನ" },
  summary: { en: "", kn: "" },
  source: { work: "ramayana", book: "sundara", from: 1, to: 1, expect },
});

let dir: string;
let dbPath: string;
const write = (id: number, text: string) => fs.writeFileSync(path.join(dir, `ramayana-${id}.txt`), text);
const build = (stories = [story(["Mahendra"])]) => buildCorpus({ rawDir: dir, dbPath, stories, sources: [source] });

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "corpus-"));
  dbPath = path.join(dir, "corpus.db");
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("buildCorpus", () => {
  it("writes the corpus when every check passes", () => {
    write(1, VOL1);
    write(2, VOL2);
    expect(build()).toMatchObject({ ok: true, errors: [] });
    expect(fs.existsSync(dbPath)).toBe(true);
    expect(fs.existsSync(`${dbPath}.tmp`)).toBe(false);
  });

  it.each([
    ["a volume is missing", () => write(1, VOL1), undefined, /missing ramayana-2\.txt/],
    ["a book is absent", () => (write(1, VOL1), write(2, "")), undefined, /only 1 sections|no sections found for sundara/],
    ["a story pin does not match", () => (write(1, VOL1), write(2, VOL2)), [story(["Ravana"])], /does not contain Ravana/],
  ])("fails without replacing the existing corpus when %s", (_, setup, stories, message) => {
    fs.writeFileSync(dbPath, "previous corpus");
    setup();
    const result = build(stories);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(message);
    expect(fs.readFileSync(dbPath, "utf8")).toBe("previous corpus");
    expect(fs.existsSync(`${dbPath}.tmp`)).toBe(false);
  });
});
