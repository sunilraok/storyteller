import { auth } from "@/auth";
import { limitStore, reserve, type LimitKind } from "./limits";

export interface Caller {
  id: string;
  email?: string | null;
}

/**
 * The signed-in user, or null. AUTH_DEV_BYPASS=1 signs everyone in as a local
 * developer, but only outside production builds.
 */
export async function currentCaller(): Promise<Caller | null> {
  if (process.env.AUTH_DEV_BYPASS === "1" && process.env.NODE_ENV !== "production") {
    return { id: "dev", email: "dev@localhost" };
  }
  const session = await auth();
  const user = session?.user;
  const id = user?.id ?? user?.email;
  return id ? { id, email: user?.email } : null;
}

/**
 * Require a signed-in caller and reserve `units` of `kind` against their limits.
 * Returns an error Response to send as-is, or a release function to call when done.
 */
export async function guard(kind: LimitKind, units = 1): Promise<Response | { caller: Caller; release: () => Promise<void> }> {
  const caller = await currentCaller();
  if (!caller) return Response.json({ error: "signInRequired" }, { status: 401 });

  const store = limitStore();
  if (!store) {
    return Response.json(
      { error: "Usage limits are not configured (set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN)." },
      { status: 503 },
    );
  }
  const r = await reserve(store, caller.id, kind, units);
  if (!r.ok) {
    return Response.json(
      { error: "quotaExceeded", detail: r.error },
      { status: r.status, headers: r.retryAfter ? { "Retry-After": String(r.retryAfter) } : undefined },
    );
  }
  return { caller, release: r.release };
}
