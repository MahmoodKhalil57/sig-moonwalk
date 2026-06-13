import { test, expect, describe } from "bun:test";
import type { OpenAPIv4Document } from "@suluk/core";
import { contextReport, suggestUnflatten } from "../src/index";

/** An agent with one resident route (with a schema), one cold-tail route, and a resident skill. */
function doc1(opts: { budget?: number } = {}): OpenAPIv4Document {
  return {
    openapi: "4.0.0-candidate",
    info: { title: "x", version: "0" },
    paths: {
      "v1/a": { requests: { opA: { method: "post", responses: { ok: { status: 200 } }, contentSchema: { type: "object", properties: { foo: { type: "string" }, bar: { type: "number" } } } } } },
      "v1/b": { requests: { opB: { method: "get", responses: { ok: { status: 200 } } } } },
    },
    "x-suluk-agents": {
      one: {
        description: "agent one",
        ...(opts.budget !== undefined ? { contextBudget: { tokens: opts.budget, basis: "estimate" } } : {}),
        skills: { guide: { model: ["anthropic/claude-opus-4"] } }, // resident skill (no tier)
        routes: {
          tool_a: { operationRef: "#/paths/v1~1a/requests/opA" },                    // resident
          tool_b: { operationRef: "#/paths/v1~1b/requests/opB", tier: "cold-tail" }, // cold-tail
        },
      },
    },
  } as OpenAPIv4Document;
}

describe("C027 context-budget analyzer", () => {
  test("cold-tail tools are NOT counted in the default load (the tiering's whole point)", () => {
    const load = contextReport(doc1()).loads[0];
    expect(load.tools.find((t) => t.name === "tool_b")!.tier).toBe("cold-tail");
    expect(load.tools.filter((t) => t.tier === "resident").map((t) => t.name)).toEqual(["tool_a"]);
    expect(load.coldTailTokens).toBeGreaterThan(0);
    expect(load.totalTokens).toBe(load.instructionsTokens + load.residentToolTokens + load.overheadTokens);
    // tool_b's cost is in coldTailTokens, not the resident surface
    expect(load.residentToolTokens).toBeLessThan(load.residentToolTokens + load.coldTailTokens);
  });

  test("instruction sizing: unmeasured without a snapshot, measured with one", () => {
    expect(contextReport(doc1()).findings.some((f) => f.code === "unmeasured-instructions")).toBe(true);
    const measured = contextReport(doc1(), { instructions: { "one/guide": "x".repeat(400) } });
    expect(measured.loads[0].instructionsTokens).toBe(100); // 400 chars / 4
    expect(measured.loads[0].instructionsMeasured).toBe(true);
    expect(measured.findings.some((f) => f.code === "unmeasured-instructions")).toBe(false);
  });

  test("over-window: a tiny model window flags context-over-window + an unflatten suggestion", () => {
    const r = contextReport(doc1(), { modelWindows: { "anthropic/claude-opus-4": 200 } });
    expect(r.loads[0].modelWindow).toBe(200);
    expect(r.findings.some((f) => f.code === "context-over-window")).toBe(true); // overhead alone > 200
    const sug = r.suggestions.find((s) => s.agent === "one")!;
    expect(sug).toBeDefined();
    expect(sug.moveToColdTail).toContain("tool_a");
  });

  test("over-budget + flat-agent-overloaded when the resident surface dwarfs a small budget", () => {
    const r = contextReport(doc1({ budget: 100 }));
    expect(r.findings.some((f) => f.code === "context-over-budget")).toBe(true);
    expect(r.findings.some((f) => f.code === "flat-agent-overloaded")).toBe(true);
  });

  test("comfortably under budget ⇒ no over-findings, no suggestion", () => {
    const r = contextReport(doc1({ budget: 100_000 }));
    expect(r.findings.some((f) => ["context-over-window", "context-over-budget", "flat-agent-overloaded"].includes(f.code))).toBe(false);
    expect(r.suggestions).toEqual([]);
  });

  test("empty layer (no skills, no routes) is flagged to fill — the 'layers first' flow", () => {
    const d = { openapi: "4.0.0-candidate", info: { title: "x", version: "0" }, paths: {}, "x-suluk-agents": { hollow: { description: "reserved layer" } } } as OpenAPIv4Document;
    expect(contextReport(d).findings.some((f) => f.code === "empty-layer")).toBe(true);
  });

  test("suggestUnflatten moves the biggest resident tools first and reports the saving", () => {
    const load = contextReport(doc1({ budget: 100 })).loads[0];
    const s = suggestUnflatten(load)!;
    expect(s.moveToColdTail.length).toBeGreaterThan(0);
    expect(s.wouldSaveTokens).toBeGreaterThan(0);
    expect(suggestUnflatten(load, 1_000_000)).toBeNull(); // not over a generous target
  });
});
