/**
 * Rate-limit middleware (saastarter-parity Phase 0) — the facet-driven counterpart of enforceAccess: for each
 * request it resolves the operation, reads its declared `x-suluk-ratelimit` budget, derives a key, consults a
 * SWAPPABLE store, and emits 429 + Retry-After (the shared RFC-9457 envelope) when the fixed window is exceeded.
 *
 * Ports saastarter's checkRateLimit fixed-window algorithm (src/lib/effect/rate-limit.ts:16-38) into a Hono
 * middleware. Three deliberate shapes:
 *   • The durable counter is a SWAPPABLE BINDING (the {@link RateLimitStore} interface) — `MemoryRateLimitStore`
 *     is a DEV default only; the production KV / Durable-Object store lives in @suluk/deploy (roadmap Open-Decision
 *     #4, KV vs DO). The package never hosts a production runtime (the L3 line).
 *   • ONE clock owner: the middleware computes `now` (cfg.now ?? Date.now) and passes it into `store.consume`, so
 *     the store stays a pure function of its inputs and tests inject a deterministic clock.
 *   • Default-UNLIMITED, opt-in (NOT enforceAccess's deny-by-default): an op without a budget is unmetered — the
 *     threat models differ (a missing access facet is a breach; a missing rate budget is just unmetered). An
 *     optional `defaultFacet` is the escape hatch for a blanket floor.
 *
 * DEVIATION from saastarter (receipted): saastarter callers prefix the key per-route (`payment-${ip}`); we key by
 * `${operation}:${scope}:${baseKey}` so per-operation budgets never collide — necessary because each op declares
 * its OWN window/max (a shared bare-IP counter with two different limits would be incoherent).
 */
import { PROBLEM_CONTENT_TYPE, toProblemDetails, retryAfterSeconds, type SulukRateLimit } from "@suluk/core";
import type { Context, MiddlewareHandler } from "hono";

export interface RateLimitConsumeOptions {
  maxRequests: number;
  windowMs: number;
  /** the current epoch-ms, supplied by the middleware (the single clock owner). */
  now: number;
}

export interface RateLimitResult {
  /** true ⇒ this request is OVER the budget and must be rejected. */
  limited: boolean;
  /** requests remaining in the window after this one (≥ 0). */
  remaining: number;
  /** ms until the window resets — drives Retry-After. 0 when not limited. */
  retryAfterMs: number;
}

/**
 * The swap point for a durable counter. `consume` atomically records one hit for `key` under the budget and
 * reports whether it's now over. A production impl (KV / Durable Object) MUST be atomic-per-key; the in-memory
 * default is per-instance and NOT durable, so it is dev-only.
 */
export interface RateLimitStore {
  consume(key: string, opts: RateLimitConsumeOptions): Promise<RateLimitResult> | RateLimitResult;
}

/**
 * DEV-ONLY fixed-window store — a single in-process Map, ported from saastarter rate-limit.ts:7-38. Per-instance
 * (does NOT coordinate across workers/isolates) so it must NOT back production; use a @suluk/deploy KV/DO binding
 * there. Retry-After is the FULL `windowMs` (saastarter parity, rate-limit.ts:35); the precise `resetAt - now` is a
 * documented alternative a durable store may choose instead.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly store = new Map<string, { count: number; resetAt: number }>();

  consume(key: string, { maxRequests, windowMs, now }: RateLimitConsumeOptions): RateLimitResult {
    const entry = this.store.get(key);
    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      return { limited: false, remaining: Math.max(0, maxRequests - 1), retryAfterMs: 0 };
    }
    entry.count++;
    const limited = entry.count > maxRequests;
    return {
      limited,
      remaining: Math.max(0, maxRequests - entry.count),
      retryAfterMs: limited ? windowMs : 0, // saastarter parity (rate-limit.ts:35); precise alt: entry.resetAt - now
    };
  }
}

export interface EnforceRateLimitConfig {
  /** Resolve the contract operation for a request (undefined ⇒ a non-contract path, passed through). */
  operationOf: (c: Context) => string | undefined;
  /** The declared rate budget for an operation (e.g. read off the document's `x-suluk-ratelimit`). */
  rateLimitOf: (operation: string) => SulukRateLimit | undefined;
  /** The durable counter (default: a per-instance {@link MemoryRateLimitStore} — DEV ONLY). */
  store?: RateLimitStore;
  /** Derive the caller key from a request + facet (default: client IP from x-forwarded-for / x-real-ip). */
  keyOf?: (c: Context, facet: SulukRateLimit) => string;
  /** The clock (default: `Date.now`) — the single source of `now`. */
  now?: () => number;
  /** A blanket budget applied to operations that declare none (escape hatch; default: unmetered). */
  defaultFacet?: SulukRateLimit;
}

/** Default key: the client IP. `"global"` shares one bucket; `"principal"`/`"api-key"` fall back to IP until the
 * Principal model lands (roadmap Open-Decision #5) — a consumer that has a principal supplies its own `keyOf`. */
function defaultKeyOf(c: Context, facet: SulukRateLimit): string {
  if (facet.key === "global") return "global";
  const fwd = c.req.header("x-forwarded-for");
  const first = fwd ? fwd.split(",")[0]?.trim() : undefined;
  return first || c.req.header("x-real-ip") || "unknown";
}

/** A 429 response in the shared RFC-9457 envelope + a Retry-After header (agrees with the B1 error model). */
function denyRateLimited(c: Context, retryAfterMs: number): Response {
  return c.json(toProblemDetails({ tag: "RateLimitedError" }), 429, {
    "content-type": PROBLEM_CONTENT_TYPE,
    "retry-after": String(retryAfterSeconds({ windowMs: retryAfterMs })),
  });
}

/**
 * The facet-driven rate-limit gate. Apply once (typically after identity, alongside enforceAccess): every operation
 * that DECLARES an `x-suluk-ratelimit` budget is metered; the rest pass untouched. On overflow → 429 + Retry-After.
 */
export function enforceRateLimit(cfg: EnforceRateLimitConfig): MiddlewareHandler {
  const store = cfg.store ?? new MemoryRateLimitStore();
  const clock = cfg.now ?? (() => Date.now());
  const keyOf = cfg.keyOf ?? defaultKeyOf;
  return async (c, next) => {
    const op = cfg.operationOf(c);
    if (!op) return next(); // not a contract operation
    const facet = cfg.rateLimitOf(op) ?? cfg.defaultFacet;
    if (!facet) return next(); // unmetered (opt-in)
    const base = keyOf(c, facet);
    const key = `${op}:${facet.scope ?? ""}:${base}`;
    const res = await store.consume(key, { maxRequests: facet.maxRequests, windowMs: facet.windowMs, now: clock() });
    if (res.limited) return denyRateLimited(c, res.retryAfterMs);
    c.header("x-ratelimit-remaining", String(Math.max(0, res.remaining)));
    return next();
  };
}
