/**
 * Abuse controls for the paid endpoints: per-user daily quotas, per-user
 * concurrency limits and global daily budgets.
 *
 * Counters live in Upstash Redis when UPSTASH_REDIS_REST_URL/TOKEN are set, so
 * limits hold across serverless instances. Without Redis an in-memory store is
 * used, which is only acceptable for local development; in production the
 * endpoints refuse to run unless ALLOW_IN_MEMORY_LIMITS=1 is set explicitly.
 */

export type LimitKind = "narrate" | "verify" | "tts";

export interface CounterStore {
  /** Atomically add `by` (may be negative) and ensure the key expires within `ttlSeconds`. */
  incr(key: string, by: number, ttlSeconds: number): Promise<number>;
}

export class MemoryStore implements CounterStore {
  private data = new Map<string, { value: number; expires: number }>();
  async incr(key: string, by: number, ttlSeconds: number) {
    const now = Date.now();
    const cur = this.data.get(key);
    const entry = cur && cur.expires > now ? cur : { value: 0, expires: now + ttlSeconds * 1000 };
    entry.value += by;
    this.data.set(key, entry);
    return entry.value;
  }
}

export class UpstashStore implements CounterStore {
  constructor(
    private url: string,
    private token: string,
  ) {}
  async incr(key: string, by: number, ttlSeconds: number) {
    const res = await fetch(`${this.url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCRBY", key, String(by)],
        ["EXPIRE", key, String(ttlSeconds), "NX"],
      ]),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Rate-limit store error: HTTP ${res.status}`);
    const [first] = (await res.json()) as { result?: number; error?: string }[];
    if (first?.error || typeof first?.result !== "number") throw new Error(`Rate-limit store error: ${first?.error}`);
    return first.result;
  }
}

export interface Policy {
  /** Units a user may consume per UTC day (requests, or characters for TTS). */
  perUserDaily: number;
  /** Units all users together may consume per UTC day. */
  globalDaily: number;
  /** Requests a user may have in flight at once. */
  concurrent: number;
}

const num = (v: string | undefined, fallback: number) => (v && Number.isFinite(Number(v)) ? Number(v) : fallback);

export function policies(env: Record<string, string | undefined> = process.env): Record<LimitKind, Policy> {
  return {
    narrate: {
      perUserDaily: num(env.LIMIT_NARRATIONS_PER_USER_DAY, 20),
      globalDaily: num(env.LIMIT_NARRATIONS_GLOBAL_DAY, 500),
      concurrent: num(env.LIMIT_NARRATIONS_CONCURRENT, 1),
    },
    verify: {
      perUserDaily: num(env.LIMIT_VERIFY_PER_USER_DAY, 20),
      globalDaily: num(env.LIMIT_VERIFY_GLOBAL_DAY, 500),
      concurrent: num(env.LIMIT_VERIFY_CONCURRENT, 1),
    },
    tts: {
      perUserDaily: num(env.LIMIT_TTS_CHARS_PER_USER_DAY, 40_000),
      globalDaily: num(env.LIMIT_TTS_CHARS_GLOBAL_DAY, 1_000_000),
      concurrent: num(env.LIMIT_TTS_CONCURRENT, 3),
    },
  };
}

export type Reservation =
  | { ok: true; release: () => Promise<void> }
  | { ok: false; status: 429 | 503; error: string; retryAfter?: number };

const DAY_TTL = 2 * 24 * 3600;
/** Safety expiry for in-flight counters, in case a release is lost (crash, timeout). */
const INFLIGHT_TTL = 10 * 60;

const secondsUntilUtcMidnight = (now: Date) =>
  Math.ceil((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime()) / 1000);

/**
 * Reserve `units` of `kind` for `userId`: takes a concurrency slot and charges the
 * user's and the global daily quota. Everything is rolled back if any limit is hit.
 * Call `release()` when the request finishes to free the concurrency slot.
 */
export async function reserve(
  store: CounterStore,
  userId: string,
  kind: LimitKind,
  units: number,
  policy: Policy = policies()[kind],
  now = new Date(),
): Promise<Reservation> {
  const day = now.toISOString().slice(0, 10);
  const inflightKey = `lim:inflight:${kind}:${userId}`;
  const userKey = `lim:day:${day}:${kind}:${userId}`;
  const globalKey = `lim:day:${day}:${kind}:*`;
  const undo: (() => Promise<unknown>)[] = [];
  const rollback = () => Promise.all(undo.map((u) => u()));

  const inflight = await store.incr(inflightKey, 1, INFLIGHT_TTL);
  undo.push(() => store.incr(inflightKey, -1, INFLIGHT_TTL));
  if (inflight > policy.concurrent) {
    await rollback();
    return { ok: false, status: 429, error: "Too many requests in progress; wait for the current one to finish." };
  }

  const used = await store.incr(userKey, units, DAY_TTL);
  undo.push(() => store.incr(userKey, -units, DAY_TTL));
  if (used > policy.perUserDaily) {
    await rollback();
    return { ok: false, status: 429, error: "Daily limit reached.", retryAfter: secondsUntilUtcMidnight(now) };
  }

  const total = await store.incr(globalKey, units, DAY_TTL);
  undo.push(() => store.incr(globalKey, -units, DAY_TTL));
  if (total > policy.globalDaily) {
    await rollback();
    return {
      ok: false,
      status: 429,
      error: "The service's daily budget is used up.",
      retryAfter: secondsUntilUtcMidnight(now),
    };
  }

  let released = false;
  return {
    ok: true,
    release: async () => {
      if (released) return;
      released = true;
      await store.incr(inflightKey, -1, INFLIGHT_TTL);
    },
  };
}

/** Pick a store from the environment, or null when production has no shared store configured. */
export function createLimitStore(env: Record<string, string | undefined>): CounterStore | null {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return new UpstashStore(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
  }
  if (env.NODE_ENV !== "production" || env.ALLOW_IN_MEMORY_LIMITS === "1") return new MemoryStore();
  return null;
}

let store: CounterStore | null | undefined;
/** The process-wide store (memoized so in-memory counters persist between requests). */
export function limitStore(): CounterStore | null {
  if (store === undefined) store = createLimitStore(process.env);
  return store;
}
