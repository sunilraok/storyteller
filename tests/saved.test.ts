import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyEvent, initialNarration, toParagraphs } from "@/components/narration";
import { liveMode } from "@/lib/mode";
import { checkNarration, parseNarration, readCheck, sha256, type SourcePassage } from "@/lib/saved";
import { loadSavedVersion } from "@/lib/savedStore";

const passages: SourcePassage[] = [
  { id: "mahabharata:adi:17:1", label: "Ganguli, Ādi Parva §17", text: "The gods churned the ocean with Mandara." },
  { id: "mahabharata:adi:18:1", label: "Ganguli, Ādi Parva §18", text: "The Amrita arose; Rahu was beheaded." },
];
const KN = "ದೇವತೆಗಳು ಮಂದರ ಪರ್ವತದಿಂದ ಸಮುದ್ರವನ್ನು ಕಡೆದರು. [[mahabharata:adi:17:1]]\n\nಆಗ ಅಮೃತವು ಮೇಲೆ ಬಂದಿತು. [[mahabharata:adi:18:1]] ರಾಹುವಿನ ತಲೆ ಕತ್ತರಿಸಲಾಯಿತು. [[mahabharata:adi:18:1]]";

describe("parseNarration", () => {
  it("turns [[id]] markers into citations numbered by first use", () => {
    const p = parseNarration(KN, passages);
    expect(p.errors).toEqual([]);
    expect(p.citations).toBe(3);
    expect(p.sources.map((s) => s.id)).toEqual(["mahabharata:adi:17:1", "mahabharata:adi:18:1"]);
    expect(p.text).toBe("ದೇವತೆಗಳು ಮಂದರ ಪರ್ವತದಿಂದ ಸಮುದ್ರವನ್ನು ಕಡೆದರು.\n\nಆಗ ಅಮೃತವು ಮೇಲೆ ಬಂದಿತು. ರಾಹುವಿನ ತಲೆ ಕತ್ತರಿಸಲಾಯಿತು.");

    const state = p.events.reduce(applyEvent, initialNarration());
    const paras = toParagraphs(state.segments);
    expect(paras).toHaveLength(2);
    expect(paras[1].filter((s) => s.kind === "cite")).toHaveLength(2);
    expect([...state.footnotes]).toEqual([[0, 1], [1, 2]]);
    expect(state.done).toBe(true);
  });

  it("reports unknown and malformed citations", () => {
    const p = parseNarration("Text. [[mahabharata:vana:1:1]] More. [[not an id]]", passages);
    expect(p.errors.join("\n")).toMatch(/not one of this story's source passages/);
    expect(p.errors.join("\n")).toMatch(/malformed citation/);
  });
});

describe("checkNarration", () => {
  it("accepts a cited Kannada narration (length is only a warning)", () => {
    const r = checkNarration(KN, passages, "kn", "child");
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toMatch(/words; expected/);
  });

  it("rejects the wrong script, markdown and uncited text", () => {
    expect(checkNarration("The gods churned the ocean. [[mahabharata:adi:17:1]]", passages, "kn", "child").errors.join()).toMatch(
      /expected Kannada script/,
    );
    expect(checkNarration(KN, passages, "en", "child").errors.join()).toMatch(/contains Kannada script/);
    expect(checkNarration("# Title\n\n" + KN, passages, "kn", "child").errors.join()).toMatch(/markdown/);
    expect(checkNarration("ದೇವತೆಗಳು ಸಮುದ್ರವನ್ನು ಕಡೆದರು.", passages, "kn", "child").errors.join()).toMatch(/cites no source/);
  });
});

describe("readCheck", () => {
  const text = parseNarration(KN, passages).text;
  it("accepts a stamped review whose flagged sentences exist", () => {
    const r = readCheck(
      { status: "checked", issues: [{ sentence: "ಆಗ ಅಮೃತವು ಮೇಲೆ ಬಂದಿತು.", reason: "x" }], narrationSha256: sha256(KN) },
      KN,
      text,
    );
    expect(r.result).toEqual({ status: "checked", issues: [{ sentence: "ಆಗ ಅಮೃತವು ಮೇಲೆ ಬಂದಿತು.", reason: "x" }] });
  });

  it("rejects stale reviews and sentences not in the narration", () => {
    expect(readCheck({ status: "checked", issues: [], narrationSha256: "old" }, KN, text)).toMatchObject({ result: null, stale: true });
    expect(readCheck({ status: "checked", issues: [{ sentence: "invented", reason: "x" }] }, KN, text).result).toBeNull();
  });
});

describe("loadSavedVersion", () => {
  let root: string;
  let dirs: { narrations: string; audio: string };
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "saved-"));
    dirs = { narrations: path.join(root, "narrations"), audio: path.join(root, "audio") };
    fs.mkdirSync(path.join(dirs.narrations, "churning"), { recursive: true });
    fs.writeFileSync(path.join(dirs.narrations, "churning", "sources.json"), JSON.stringify({ storyId: "churning", passages }));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const write = (name: string, body: string) => fs.writeFileSync(path.join(dirs.narrations, "churning", name), body);
  const writeAudio = (hash: string) => {
    const d = path.join(dirs.audio, "churning", "kn-child");
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, "manifest.json"), JSON.stringify({ narrationSha256: hash, chunks: [{ file: "001.mp3", text: "x" }] }));
  };

  it("returns null when the narration is missing or its citations are broken", () => {
    expect(loadSavedVersion("churning", "kn", "child", dirs)).toBeNull();
    write("kn-child.md", "ಪಠ್ಯ. [[mahabharata:vana:1:1]]");
    expect(loadSavedVersion("churning", "kn", "child", dirs)).toBeNull();
  });

  it("loads text, a current review and audio that matches the narration", () => {
    write("kn-child.md", KN);
    write("kn-child.check.json", JSON.stringify({ status: "checked", issues: [], narrationSha256: sha256(KN) }));
    writeAudio(sha256(KN));
    const v = loadSavedVersion("churning", "kn", "child", dirs)!;
    expect(v.text).toContain("ಅಮೃತವು");
    expect(v.fidelity).toEqual({ status: "checked", issues: [] });
    expect(v.audio).toEqual(["/audio/churning/kn-child/001.mp3"]);
  });

  it("drops stale reviews and audio made for an older narration", () => {
    write("kn-child.md", KN);
    write("kn-child.check.json", JSON.stringify({ status: "checked", issues: [], narrationSha256: "old" }));
    writeAudio("old");
    const v = loadSavedVersion("churning", "kn", "child", dirs)!;
    expect(v.fidelity).toBeUndefined();
    expect(v.audio).toBeUndefined();
  });
});

describe("liveMode", () => {
  it("is off unless LIVE_NARRATION=1", () => {
    expect(liveMode({})).toBe(false);
    expect(liveMode({ LIVE_NARRATION: "true" })).toBe(false);
    expect(liveMode({ LIVE_NARRATION: "1" })).toBe(true);
  });
});
