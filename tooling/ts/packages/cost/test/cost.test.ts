import { test, expect, describe } from "bun:test";
import { Hono } from "hono";
import * as z from "zod";
import { emitV4 } from "@suluk/hono";
import { validateDocument } from "@suluk/core";
import { downgrade, validate31 } from "@suluk/openapi-compat";
import {
  annotateCosts, costOf, costAudit, costTable, computeCost, COST_EXT,
  costMeter, recordUsage, MemoryCostSink, summarize, principalCost, formatMicroUsd,
  type CostModel,
} from "../src/index";

const ASK: CostModel = {
  components: [
    { source: "compute", basis: "per-call", microUsd: 50 },
    { source: "openai", basis: "per-1k-tokens", microUsd: 2000, description: "$0.002 / 1k tokens" },
  ],
  estimateMicroUsd: 1050,
};

describe("computeCost — fixed + metered, raw µ$", () => {
  test("per-call component always counts; per-1k-tokens scales with reported usage", () => {
    const r = computeCost(ASK, [{ source: "openai", units: 1500 }]);
    // compute: 50 ; openai: 2000/1000 * 1500 = 3000
    expect(r.totalMicroUsd).toBe(3050);
    expect(r.breakdown).toEqual([{ source: "compute", microUsd: 50 }, { source: "openai", microUsd: 3000 }]);
  });
  test("no usage → only the fixed components", () => {
    expect(computeCost(ASK).totalMicroUsd).toBe(50);
  });
  test("formatMicroUsd shows it as it is", () => {
    expect(formatMicroUsd(3050)).toBe("$0.00305");
  });
});

describe("cost as a contract facet — bubbles into v4, Scalar, and the audit", () => {
  const { document } = emitV4([
    { method: "post", path: "/ask", name: "ask", summary: "Ask the model", request: { json: z.object({ q: z.string() }) }, responses: [{ status: 200, description: "ok", schema: z.object({ answer: z.string() }) }] },
    { method: "get", path: "/ping", name: "ping", summary: "Ping", responses: [{ status: 200, description: "ok" }] },
  ], { info: { title: "AI", version: "1" } });
  const annotated = annotateCosts(document, { ask: ASK });

  test("x-suluk-cost lands on the operation and the doc still validates", () => {
    const req = (annotated.paths["ask"].requests.ask as unknown as Record<string, unknown>)[COST_EXT];
    expect(req).toEqual(ASK as unknown as Record<string, unknown>);
    expect(validateDocument(annotated).valid).toBe(true);
  });
  test("it survives the 3.1 downgrade — so Scalar/Swagger show it", () => {
    const down = downgrade(annotated).document as any;
    expect(validate31(down).valid).toBe(true);
    expect(down.paths["/ask"].post[COST_EXT]).toEqual(ASK);
  });
  test("costAudit flags operations with NO declared cost (not assumed zero)", () => {
    const findings = costAudit(annotated);
    expect(findings.map((f) => f.operation)).toContain("ping"); // ping declared no cost
    expect(findings.map((f) => f.operation)).not.toContain("ask");
  });
  test("costTable surfaces the declared costs for display", () => {
    const rows = costTable(annotated);
    expect(rows.find((r) => r.operation === "ask")!.sources.sort()).toEqual(["compute", "openai"]);
  });
});

describe("runtime meter — actual cost, traced from the frontend action down", () => {
  test("records what a request cost, attributed to principal + action + source", async () => {
    const sink = new MemoryCostSink();
    const app = new Hono<{ Variables: { operation: string; principal: string } }>();
    app.use("*", async (c, next) => { c.set("operation", "ask"); c.set("principal", "user_42"); await next(); });
    app.use("*", costMeter({
      sink, costs: { ask: ASK },
      operationOf: (c) => (c as { get(k: string): string }).get("operation"),
      principalOf: (c) => (c as { get(k: string): string }).get("principal"),
      now: () => 1000,
    }));
    app.post("/ask", (c) => { recordUsage(c, "openai", 2000); return c.json({ answer: "42" }); });

    await app.request("/ask", { method: "POST", headers: { "content-type": "application/json", "x-suluk-action": "ask-button" }, body: "{}" });
    const events = sink.events();
    expect(events.length).toBe(1);
    const e = events[0];
    expect(e.operation).toBe("ask");
    expect(e.principal).toBe("user_42");
    expect(e.action).toBe("ask-button");          // traced from the frontend button
    expect(e.totalMicroUsd).toBe(50 + 4000);       // compute 50 + openai 2000/1000*2000
    expect(e.at).toBe(1000);
  });
});

describe("ledger — the raw per-user picture you price on", () => {
  const events = [
    { at: 1, principal: "a", operation: "ask", action: "btn1", breakdown: [{ source: "openai", microUsd: 3000 }], totalMicroUsd: 3000 },
    { at: 2, principal: "a", operation: "ask", action: "btn2", breakdown: [{ source: "openai", microUsd: 1000 }], totalMicroUsd: 1000 },
    { at: 3, principal: "b", operation: "list", action: "btn1", breakdown: [{ source: "compute", microUsd: 50 }], totalMicroUsd: 50 },
  ];
  test("summarize aggregates by principal / operation / action / source", () => {
    const s = summarize(events);
    expect(s.total).toBe(4050);
    expect(s.byPrincipal).toEqual({ a: 4000, b: 50 });
    expect(s.bySource).toEqual({ openai: 4000, compute: 50 });
    expect(s.byAction.btn1).toBe(3050);
  });
  test("principalCost answers 'what did user a cost me?'", () => {
    expect(principalCost(events, "a").total).toBe(4000);
  });
});
