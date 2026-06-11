import { test, expect, describe } from "bun:test";
import { Hono } from "hono";
import { enforceRateLimit, MemoryRateLimitStore } from "../src/ratelimit";
import type { SulukRateLimit } from "@suluk/core";

describe("MemoryRateLimitStore — fixed window (ported from saastarter rate-limit.ts)", () => {
  test("permits up to maxRequests, then limits; Retry-After is the full window (saastarter parity)", () => {
    const s = new MemoryRateLimitStore();
    const opts = { maxRequests: 2, windowMs: 60_000, now: 1_000 };
    expect(s.consume("k", opts)).toMatchObject({ limited: false, remaining: 1 });
    expect(s.consume("k", opts)).toMatchObject({ limited: false, remaining: 0 });
    const third = s.consume("k", opts);
    expect(third.limited).toBe(true);
    expect(third.retryAfterMs).toBe(60_000); // rate-limit.ts:35
  });

  test("the window resets once now passes resetAt", () => {
    const s = new MemoryRateLimitStore();
    s.consume("k", { maxRequests: 1, windowMs: 1_000, now: 0 });
    expect(s.consume("k", { maxRequests: 1, windowMs: 1_000, now: 500 }).limited).toBe(true);  // same window
    expect(s.consume("k", { maxRequests: 1, windowMs: 1_000, now: 2_000 }).limited).toBe(false); // window rolled
  });

  test("distinct keys hold independent counters", () => {
    const s = new MemoryRateLimitStore();
    const opts = { maxRequests: 1, windowMs: 1_000, now: 0 };
    expect(s.consume("a", opts).limited).toBe(false);
    expect(s.consume("b", opts).limited).toBe(false); // b is not affected by a
    expect(s.consume("a", opts).limited).toBe(true);
  });
});

describe("enforceRateLimit middleware — facet-driven, 429 + Retry-After", () => {
  const BUDGET: SulukRateLimit = { windowMs: 60_000, maxRequests: 2, key: "ip" };

  // a controllable clock + an operation router, mirroring enforce.test.ts's harness style.
  function makeApp(facets: Record<string, SulukRateLimit | undefined>, opts?: { now?: () => number }) {
    const byPath: Record<string, string> = {
      "/limited": "limited", "/other": "other", "/free": "free",
    };
    const app = new Hono();
    app.use("*", enforceRateLimit({
      operationOf: (c) => byPath[new URL(c.req.url).pathname],
      rateLimitOf: (op) => facets[op],
      store: new MemoryRateLimitStore(),
      now: opts?.now,
    }));
    app.get("/limited", (c) => c.text("ok"));
    app.get("/other", (c) => c.text("ok"));
    app.get("/free", (c) => c.text("ok"));
    app.get("/static.css", (c) => c.text("body{}")); // non-contract path
    return app;
  }
  const ip = { "x-forwarded-for": "1.2.3.4" };

  test("an op WITHOUT a facet is unmetered (never 429)", async () => {
    const app = makeApp({ free: undefined });
    for (let i = 0; i < 10; i++) expect((await app.request("/free", { headers: ip })).status).toBe(200);
  });

  test("a metered op returns 429 + Retry-After once the budget is exceeded", async () => {
    let t = 1000;
    const app = makeApp({ limited: BUDGET }, { now: () => t });
    expect((await app.request("/limited", { headers: ip })).status).toBe(200);
    expect((await app.request("/limited", { headers: ip })).status).toBe(200);
    const r = await app.request("/limited", { headers: ip });
    expect(r.status).toBe(429);
    expect(r.headers.get("content-type")).toContain("application/problem+json");
    expect(r.headers.get("retry-after")).toBe("60");
    const body = await r.json();
    expect(body).toMatchObject({ status: 429, title: "Too many requests", error: "rate_limited" });
  });

  test("advancing the clock past the window lets the caller through again", async () => {
    let t = 1000;
    const app = makeApp({ limited: BUDGET }, { now: () => t });
    await app.request("/limited", { headers: ip });
    await app.request("/limited", { headers: ip });
    expect((await app.request("/limited", { headers: ip })).status).toBe(429);
    t += 60_001; // roll the window
    expect((await app.request("/limited", { headers: ip })).status).toBe(200);
  });

  test("budgets are PER-OPERATION (a different op does not drain this op's counter)", async () => {
    const app = makeApp({ limited: BUDGET, other: BUDGET });
    await app.request("/limited", { headers: ip });
    await app.request("/limited", { headers: ip });
    expect((await app.request("/limited", { headers: ip })).status).toBe(429);
    expect((await app.request("/other", { headers: ip })).status).toBe(200); // independent budget
  });

  test("budgets are per-IP (a different client is unaffected)", async () => {
    const app = makeApp({ limited: BUDGET });
    await app.request("/limited", { headers: ip });
    await app.request("/limited", { headers: ip });
    expect((await app.request("/limited", { headers: ip })).status).toBe(429);
    expect((await app.request("/limited", { headers: { "x-forwarded-for": "9.9.9.9" } })).status).toBe(200);
  });

  test("a non-contract path passes straight through", async () => {
    const app = makeApp({ limited: BUDGET });
    expect((await app.request("/static.css")).status).toBe(200);
  });
});
