import { test, expect, describe } from "bun:test";
import type { OpenAPIv4Document } from "@suluk/core";
import { skillModels, resolveSkillModels, deriveCQT, SEED_CATALOG } from "../src/index";

/** An agent with routes (⇒ needs tool-calling) and two skills: a needs-based one + an explicit opt-out. */
function doc(): OpenAPIv4Document {
  return {
    openapi: "4.0.0-candidate",
    info: { title: "x", version: "0" },
    paths: { "v1/s": { requests: { search: { method: "get", responses: { ok: { status: 200 } } } } } },
    "x-suluk-agents": {
      conin: {
        description: "orchestrator with a tool",
        routes: { search: { operationRef: "#/paths/v1~1s/requests/search" } },
        skills: {
          operate: { modelProfile: "cheap-fast" },          // needs-based ⇒ catalog selects
          legacy: { model: ["anthropic/claude-opus-4"] },   // explicit list ⇒ opt-out, returned verbatim
        },
      },
    },
  } as OpenAPIv4Document;
}

describe("C027 × @suluk/models — the model-selection seam", () => {
  test("a needs-based skill resolves to a catalog SELECTION (tool-calling derived from the agent's routes)", () => {
    const r = skillModels(doc(), "conin", "operate", SEED_CATALOG);
    expect(r.from).toBe("selected");
    expect(r.ids.length).toBeGreaterThan(0);
    expect(r.snapshotHash).toBe(SEED_CATALOG.snapshotHash); // reproducible pin
    // hasRoutes ⇒ needsTools was derived ⇒ the winner passed the tool-calling filter
    expect(r.selection!.ranked[0].why.passedFilters).toContain("tool-calling");
    // cheap-fast ⇒ a cheap model, never the premium ones
    expect(["anthropic/claude-opus-4", "openai/gpt-5"]).not.toContain(r.ids[0]);
  });

  test("an explicit model[] with no profile is the author's OPT-OUT — returned verbatim", () => {
    const r = skillModels(doc(), "conin", "legacy", SEED_CATALOG);
    expect(r.from).toBe("declared");
    expect(r.ids).toEqual(["anthropic/claude-opus-4"]);
    expect(r.snapshotHash).toBeNull();
  });

  test("the analyzer's minWindowRequired flows in as a hard min-context filter", () => {
    // require a 500k window ⇒ only the 1M-window seed models survive
    const sel = resolveSkillModels(doc(), "conin", "operate", SEED_CATALOG, 500000);
    const ids = sel.ranked.map((x) => x.id);
    expect(ids.every((id) => ["google/gemini-2.5-flash", "google/gemini-2.5-pro", "meta-llama/llama-4-maverick"].includes(id))).toBe(true);
  });

  test("the C028 modelAllowlist is the TERMINAL MEET — selection is restricted to it", () => {
    const d = doc();
    d["x-suluk-policy"] = { fleet: { appliesTo: ["#/x-suluk-agents/conin"], modelAllowlist: ["google/gemini-2.5-flash"] } };
    const r = skillModels(d, "conin", "operate", SEED_CATALOG);
    expect(r.ids).toEqual(["google/gemini-2.5-flash"]); // even though cheap-fast might prefer gpt-4o-mini
  });
});

describe("C030 resolution target — pin (default) / router (delegate) / latest, governance-gated", () => {
  test("default is a REPRODUCIBLE pin", () => {
    const r = skillModels(doc(), "conin", "operate", SEED_CATALOG);
    expect(r.target).toEqual({ kind: "pinned", model: r.ids[0] });
    expect(r.pickPinned).toBe(true);
  });

  test("modelResolve:'router' (ungoverned) delegates to openrouter/auto with an ENUMERATED survivor allowlist", () => {
    const d = doc();
    d["x-suluk-agents"]!.conin.skills!.operate = { modelProfile: "cheap-fast", modelResolve: "router" };
    const r = skillModels(d, "conin", "operate", SEED_CATALOG);
    expect(r.target.kind).toBe("router");
    if (r.target.kind === "router") {
      expect(r.target.model).toBe("openrouter/auto");
      expect(r.target.allowedModels).toEqual(r.ids); // enumerated survivor ids — NEVER a wildcard
      expect(r.target.costQualityTradeoff).toBeGreaterThan(5); // cheap-fast leans cost
    }
    expect(r.pickPinned).toBe(false);
  });

  test("a GOVERNED skill declaring 'router' FAILS LOUD (must pin — reproducible + endpoint-bindable)", () => {
    const d = doc();
    d["x-suluk-policy"] = { fleet: { appliesTo: ["#/x-suluk-agents/conin"], modelAllowlist: ["google/gemini-2.5-flash"] } };
    d["x-suluk-agents"]!.conin.skills!.operate = { modelProfile: "balanced", modelResolve: "router" };
    expect(() => skillModels(d, "conin", "operate", SEED_CATALOG)).toThrow(/GOVERNED|pinned/);
  });

  test("modelResolve:'latest' emits a ~-latest alias (non-reproducible, recorded)", () => {
    const d = doc();
    d["x-suluk-agents"]!.conin.skills!.operate = { modelProfile: "max-reasoning", modelResolve: "latest" };
    const r = skillModels(d, "conin", "operate", SEED_CATALOG);
    expect(r.target.kind).toBe("latest");
    if (r.target.kind === "latest") expect(r.target.model.startsWith("~")).toBe(true);
    expect(r.pickPinned).toBe(false);
  });

  test("deriveCQT is mechanical: cheap-fast leans cost (>5), max-reasoning leans quality (0)", () => {
    expect(deriveCQT({ modelProfile: "cheap-fast" })).toBeGreaterThan(5);
    expect(deriveCQT({ modelProfile: "max-reasoning" })).toBe(0);
  });
});
