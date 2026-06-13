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
      // benchmark tiers are UNKNOWN in the facts-only catalog (never imputed)
      expect(r.intel.agenticToolUse.value).toBeNull();
    }
  });

  test("the selector runs end-to-end against the real catalog (tool-reliable, min-context)", () => {
    const r = selectModel({ needsTools: true, minWindowRequired: 200000 }, { profile: "tool-reliable" }, OPENROUTER_CATALOG);
    expect(r.ranked.length).toBeGreaterThan(0);
    expect(r.ranked[0].why.passedFilters).toContain("tool-calling");
  });
});
