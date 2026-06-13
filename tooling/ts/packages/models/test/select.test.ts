import { test, expect, describe } from "bun:test";
import { selectModel, deriveRequirements, SEED_CATALOG } from "../src/index";

describe("@suluk/models selectModel — filter then rank", () => {
  test("tool-reliable profile requires tool-calling and ranks agentic-tool-use highest", () => {
    const r = selectModel({}, { profile: "tool-reliable" }, SEED_CATALOG);
    expect(r.ranked.length).toBeGreaterThan(0);
    const top = r.ranked[0];
    expect(top.why.passedFilters).toContain("tool-calling");
    expect(["frontier", "strong"]).toContain(top.why.tierByAxis.intelligence.tier);
    expect(top.why.decidingPreference).toContain("intelligence");
  });

  test("cheap-fast picks a cheap, fast model (never the premium ones)", () => {
    const r = selectModel({}, { profile: "cheap-fast" }, SEED_CATALOG);
    expect(["openai/gpt-4o-mini", "google/gemini-2.5-flash", "deepseek/deepseek-v3", "meta-llama/llama-4-maverick"]).toContain(r.ranked[0].id);
    expect(["anthropic/claude-opus-4", "openai/gpt-5"]).not.toContain(r.ranked[0].id);
  });

  test("the analyzer's minWindowRequired is a HARD min-context gate (fail-closed)", () => {
    const r = selectModel({ minWindowRequired: 500000 }, { profile: "balanced" }, SEED_CATALOG);
    const ids = r.ranked.map((x) => x.id).sort();
    expect(ids).toEqual(["google/gemini-2.5-flash", "google/gemini-2.5-pro", "meta-llama/llama-4-maverick"]);
  });

  test("C028 modelAllowlist is the TERMINAL MEET — a model outside it is excluded on any grounds", () => {
    const r = selectModel({ policy: { modelAllowlist: ["google/gemini-2.5-flash"] } }, { profile: "max-reasoning" }, SEED_CATALOG);
    expect(r.candidateCount).toBe(1);
    expect(r.ranked[0].id).toBe("google/gemini-2.5-flash"); // even though max-reasoning would prefer a frontier reasoner
  });

  test("governance filters FAIL-CLOSED (unknown/disallowed retention excluded)", () => {
    const r = selectModel({ policy: { allowedRetention: ["zero", "ephemeral"] } }, { profile: "balanced" }, SEED_CATALOG);
    const ids = r.ranked.map((x) => x.id).sort();
    expect(ids).toEqual(["anthropic/claude-opus-4", "anthropic/claude-sonnet-4-6", "meta-llama/llama-4-maverick"]);
  });

  test("vision profile requires image input (text-only models excluded)", () => {
    const r = selectModel({}, { profile: "vision" }, SEED_CATALOG);
    expect(r.ranked.map((x) => x.id)).not.toContain("deepseek/deepseek-v3");
  });

  test("FAIL LOUD when requirements empty the set — names the unsatisfiable filter", () => {
    const r = selectModel({ minWindowRequired: 2_000_000 }, { profile: "balanced" }, SEED_CATALOG);
    expect(r.ranked).toEqual([]);
    expect(r.unsatisfiable?.some((u) => u.includes("min-window"))).toBe(true);
  });

  test("UNKNOWN is surfaced as a coverage gap, never imputed to worst", () => {
    // isolate llama (agentic tool-use = unknown) via the allowlist
    const r = selectModel({ policy: { modelAllowlist: ["meta-llama/llama-4-maverick"] } }, { profile: "tool-reliable" }, SEED_CATALOG);
    expect(r.ranked[0].id).toBe("meta-llama/llama-4-maverick"); // not excluded for unknown agentic
    expect(r.coverageGaps.some((g) => g.startsWith("intelligence"))).toBe(true);
  });

  test("every ranked result carries a 'why this model' explainer", () => {
    const r = selectModel({}, { profile: "balanced" }, SEED_CATALOG);
    const why = r.ranked[0].why;
    expect(Array.isArray(why.passedFilters)).toBe(true);
    expect(why.decidingPreference).toBeTruthy();
    expect(why.tierByAxis.cost.source).toBe("openrouter.api");
  });

  test("deriveRequirements maps an agent's structure to hard filters (the C027 seam)", () => {
    expect(deriveRequirements({ hasRoutes: true, minWindowRequired: 120000 })).toEqual({ needsTools: true, minWindowRequired: 120000 });
  });
});
