import { test, expect, describe } from "bun:test";
import { OPENROUTER_CATALOG, selectModel } from "../src/index";

/** The committed live catalog is real data that churns weekly, so assert SHAPE + invariants, not exact values. */
describe("@suluk/models — the committed OpenRouter catalog", () => {
  test("loads with rows, a content-addressed snapshot, and well-formed fact cells", () => {
    expect(OPENROUTER_CATALOG.rows.length).toBeGreaterThan(100);
    expect(OPENROUTER_CATALOG.snapshotHash).toStartWith("sha256-");
    for (const r of OPENROUTER_CATALOG.rows.slice(0, 20)) {
      expect(r.id).toBeTruthy();
      expect(r.cost.inputPerMtok.value === null || typeof r.cost.inputPerMtok.value === "number").toBe(true);
    }
    // a few frontier rows carry CITED intel tiers (the Class-B seed); the long tail stays UNKNOWN, never imputed
    const withTier = OPENROUTER_CATALOG.rows.filter((r) => r.intel.reasoning.value !== null);
    expect(withTier.length).toBeGreaterThan(0);
    expect(withTier.length).toBeLessThan(OPENROUTER_CATALOG.rows.length);
    expect(withTier[0].intel.reasoning.source).toBeTruthy();
  });

  test("the selector runs end-to-end against the real catalog + uses the overlaid tiers", () => {
    const tool = selectModel({ needsTools: true, minWindowRequired: 200000 }, { profile: "tool-reliable" }, OPENROUTER_CATALOG);
    expect(tool.ranked.length).toBeGreaterThan(0);
    expect(tool.ranked[0].why.passedFilters).toContain("tool-calling");
    // max-reasoning ⇒ a frontier/strong reasoner floats to the top (the overlay is live)
    const reason = selectModel({ needsTools: true, minWindowRequired: 200000 }, { profile: "max-reasoning" }, OPENROUTER_CATALOG);
    expect(["frontier", "strong"]).toContain(reason.ranked[0].why.tierByAxis.intelligence.tier);
  });
});
