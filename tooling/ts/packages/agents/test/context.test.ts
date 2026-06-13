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

  test("over-window: a tiny model window flags no-fitting-model + an unflatten suggestion", () => {
    const r = contextReport(doc1(), { modelWindows: { "anthropic/claude-opus-4": 200 } });
    expect(r.loads[0].modelWindow).toBe(200);
    expect(r.findings.some((f) => f.code === "no-fitting-model")).toBe(true); // overhead alone > 200
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

/** A parent with no own work delegating to one small leaf — the flatten cases. */
function layered(): OpenAPIv4Document {
  return {
    openapi: "4.0.0-candidate",
    info: { title: "x", version: "0" },
    paths: { "v1/s": { requests: { search: { method: "get", responses: { ok: { status: 200 } } } } } },
    "x-suluk-agents": {
      top: { description: "orchestrator with no own tools", maxDepth: 1, agents: { leaf: { ref: "#/x-suluk-agents/worker" } } },
      worker: { description: "a thin leaf", maxDepth: 0, skills: { go: { model: ["google/gemini-2.5-flash"] } }, routes: { search: { operationRef: "#/paths/v1~1s/requests/search" } }, agents: {} },
    },
  } as OpenAPIv4Document;
}

describe("C027 flatten (the dual of unflatten) — collapse a thin/redundant layer up", () => {
  test("a passthrough agent (no own work, one child) is flagged", () => {
    const r = contextReport(layered());
    expect(r.findings.some((f) => f.code === "passthrough-agent" && f.agent === "top")).toBe(true);
  });

  test("a thin leaf reached by one parent, merging within budget, is a flatten candidate", () => {
    const r = contextReport(layered());
    const flat = r.flatten.find((f) => f.parent === "top" && f.child === "worker");
    expect(flat).toBeDefined();
    expect(flat!.fitsTarget).toBe(true);
    expect(flat!.savedHopOverhead).toBeGreaterThan(0);
    expect(r.findings.some((f) => f.code === "flattenable-layer")).toBe(true);
  });

  test("NOT flattenable when merging would blow the parent's target (the layer earns its keep)", () => {
    const d = layered();
    // give the worker a big resident tool so inlining it would exceed a tight parent budget
    d.paths["v1/big"] = { requests: { bigOp: { method: "post", responses: { ok: { status: 200 } }, contentSchema: { type: "object", properties: Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`p${i}`, { type: "string", description: "a descriptive field" }])) } } } };
    d["x-suluk-agents"]!.worker.routes!.big = { operationRef: "#/paths/v1~1big/requests/bigOp" };
    d["x-suluk-agents"]!.top.contextBudget = { tokens: 500, basis: "estimate" }; // top (460) fits; merged (>600) does not
    const r = contextReport(d);
    expect(r.flatten.some((f) => f.parent === "top")).toBe(false);
  });
});

describe("C029 thinking — round-accretion folds into the load the analyzer checks", () => {
  test("a multi-round PEAK can exceed a window the single-shot base fits (the fixed blindspot)", () => {
    const d = doc1();
    d["x-suluk-agents"]!.one.thinking = { maxRounds: 6 };
    const r = contextReport(d, { modelWindows: { "anthropic/claude-opus-4": 600 } });
    const load = r.loads[0];
    expect(load.maxRounds).toBe(6);
    expect(load.peakTokens).toBeGreaterThan(load.totalTokens);
    expect(load.totalTokens).toBeLessThan(600);    // single-shot fits
    expect(load.peakTokens).toBeGreaterThan(600);  // the 6-round peak does not
    expect(load.minWindowRequired).toBe(load.peakTokens);
    expect(r.findings.some((f) => f.code === "no-fitting-model")).toBe(true);
    expect(r.findings.some((f) => f.code === "thinking-context-growth")).toBe(true);
  });

  test("an explicit thinking budget is used as the accretion", () => {
    const d = doc1();
    d["x-suluk-agents"]!.one.thinking = { maxRounds: 3, budget: { tokens: 5000, basis: "estimate" } };
    const load = contextReport(d).loads[0];
    expect(load.thinkingBudget).toBe(5000);
    expect(load.peakTokens).toBe(load.totalTokens + 5000);
  });

  test("no thinking ⇒ peak equals single-shot (backward-compatible)", () => {
    const load = contextReport(doc1()).loads[0];
    expect(load.peakTokens).toBe(load.totalTokens);
    expect(load.maxRounds).toBeUndefined();
  });
});

describe("C027 model fit — which declared models are expected to work", () => {
  test("each candidate model is checked for window fit; minWindowRequired is the load", () => {
    const load = contextReport(doc1()).loads[0];
    expect(load.minWindowRequired).toBe(load.totalTokens);
    const fit = load.modelFit.find((f) => f.model === "anthropic/claude-opus-4")!;
    expect(fit.window).toBe(200_000);
    expect(fit.fits).toBe(true);
    expect(fit.headroom).toBe(200_000 - load.totalTokens);
  });

  test("model-too-small names a declared model that cannot hold the agent", () => {
    const r = contextReport(doc1(), { modelWindows: { "anthropic/claude-opus-4": 100 } });
    expect(r.findings.some((f) => f.code === "no-fitting-model" && f.agent === "one")).toBe(true);
    expect(r.loads[0].modelFit[0].fits).toBe(false);
  });
});
