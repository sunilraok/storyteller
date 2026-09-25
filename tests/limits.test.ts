import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isAllowedEmail } from "@/lib/allowlist";
import { createLimitStore, MemoryStore, reserve, UpstashStore, type Policy } from "@/lib/limits";
import { evictCache } from "@/lib/tts";

const policy: Policy = { perUserDaily: 3, globalDaily: 5, concurrent: 1 };
const noon = new Date("2026-09-23T12:00:00Z");

describe("reserve", () => {
  it("limits concurrency per user and frees the slot on release", async () => {
    const store = new MemoryStore();
    const a = await reserve(store, "u1", "narrate", 1, policy, noon);
    expect(a.ok).toBe(true);
    const b = await reserve(store, "u1", "narrate", 1, policy, noon);
    expect(b).toMatchObject({ ok: false, status: 429 });
    expect((await reserve(store, "u2", "narrate", 1, policy, noon)).ok).toBe(true);
    if (a.ok) await a.release();
    expect((await reserve(store, "u1", "narrate", 1, policy, noon)).ok).toBe(true);
  });

  it("enforces the per-user daily quota and rolls back rejected charges", async () => {
    const store = new MemoryStore();
    const loose = { ...policy, concurrent: 10 };
    for (let i = 0; i < 3; i++) expect((await reserve(store, "u1", "tts", 1, loose, noon)).ok).toBe(true);
    const over = await reserve(store, "u1", "tts", 1, loose, noon);
    expect(over).toMatchObject({ ok: false, status: 429, retryAfter: 12 * 3600 });
    // The rejected request did not consume global budget: two more users can still use 2 units.
    expect((await reserve(store, "u2", "tts", 2, loose, noon)).ok).toBe(true);
    expect((await reserve(store, "u3", "tts", 1, loose, noon)).ok).toBe(false);
  });

  it("resets quotas on a new UTC day", async () => {
    const store = new MemoryStore();
    const loose = { ...policy, concurrent: 10 };
    expect((await reserve(store, "u1", "verify", 3, loose, noon)).ok).toBe(true);
    expect((await reserve(store, "u1", "verify", 1, loose, noon)).ok).toBe(false);
    expect((await reserve(store, "u1", "verify", 1, loose, new Date("2026-09-24T00:00:01Z"))).ok).toBe(true);
  });
});

describe("limit stores", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends INCRBY + EXPIRE NX to Upstash in one pipeline", async () => {
    const fetchMock = vi.fn(async () => Response.json([{ result: 7 }, { result: 1 }]));
    vi.stubGlobal("fetch", fetchMock);
    expect(await new UpstashStore("https://redis.example/", "tok").incr("k", 2, 60)).toBe(7);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://redis.example/pipeline");
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok" });
    expect(JSON.parse(init.body as string)).toEqual([
      ["INCRBY", "k", "2"],
      ["EXPIRE", "k", "60", "NX"],
    ]);
  });

  it("refuses to fall back to in-memory limits in production unless explicitly allowed", () => {
    expect(createLimitStore({ NODE_ENV: "production" })).toBeNull();
    expect(createLimitStore({ NODE_ENV: "production", ALLOW_IN_MEMORY_LIMITS: "1" })).toBeInstanceOf(MemoryStore);
    expect(createLimitStore({ NODE_ENV: "development" })).toBeInstanceOf(MemoryStore);
    expect(
      createLimitStore({ NODE_ENV: "production", UPSTASH_REDIS_REST_URL: "https://r", UPSTASH_REDIS_REST_TOKEN: "t" }),
    ).toBeInstanceOf(UpstashStore);
  });
});

describe("isAllowedEmail", () => {
  it("allows everyone when unset, else exact addresses and @domains", () => {
    expect(isAllowedEmail("a@x.com", undefined)).toBe(true);
    expect(isAllowedEmail("A@X.com", "a@x.com")).toBe(true);
    expect(isAllowedEmail("b@x.com", "a@x.com, @y.org")).toBe(false);
    expect(isAllowedEmail("b@y.org", "a@x.com, @y.org")).toBe(true);
  });
});

describe("evictCache", () => {
  it("removes least recently used files until under 90% of the cap", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tts-"));
    try {
      for (const [name, age] of [["old", 300], ["mid", 200], ["new", 100]] as const) {
        const f = path.join(dir, `${name}.mp3`);
        fs.writeFileSync(f, Buffer.alloc(100));
        const t = new Date(Date.now() - age * 1000);
        fs.utimesSync(f, t, t);
      }
      expect(await evictCache(dir, 1000)).toBe(0);
      expect(await evictCache(dir, 250)).toBe(1); // 300 bytes → 200, under 225
      expect(fs.readdirSync(dir).sort()).toEqual(["mid.mp3", "new.mp3"]);
      expect(await evictCache(dir, 150)).toBe(1); // 200 → 100, under 135
      expect(fs.readdirSync(dir)).toEqual(["new.mp3"]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
