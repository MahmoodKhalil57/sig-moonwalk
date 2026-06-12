import { test, expect, describe } from "bun:test";
import { reachableSurface, assertServedSubset, verifySkillFreshness, contentHash } from "../src/index";
import { coninDoc, coninInstructions } from "./fixtures/conin";

describe("C027 conformance — static reachable surface + over-serve auditor", () => {
  test("the full reachable tool surface is statically enumerable (zero requests)", () => {
    const s = reachableSurface(coninDoc, "conin");
    expect(s.tools).toEqual(["find_comparables", "generate_deliverable", "run_core_primitive", "search_library"]);
    expect(s.agents).toEqual(["coninRetrieval"]);
  });

  test("a served set equal to the surface is conformant", () => {
    expect(assertServedSubset(coninDoc, "conin", ["generate_deliverable", "run_core_primitive", "search_library", "find_comparables"])).toEqual([]);
  });

  test("NAMED failure: a server that WIDENS the surface (Conin's full-catalog over-serve) is flagged", () => {
    const findings = assertServedSubset(coninDoc, "conin", ["generate_deliverable", "list_everything", "audit_boq_raw"]);
    expect(findings.map((f) => f.code)).toEqual(["over-serve", "over-serve"]);
    expect(findings[0].detail).toContain("list_everything");
  });
});

describe("C027 conformance — skill freshness (drift detection)", () => {
  const snap = coninInstructions.operate;
  test("a matching declared hash is fresh", () => {
    expect(verifySkillFreshness(contentHash(snap), snap)).toEqual([]);
  });
  test("a drifted served snapshot is caught as stale", () => {
    expect(verifySkillFreshness("sha256-0000000000000000", snap).map((f) => f.code)).toEqual(["stale-skill"]);
  });
  test("an unpinned skill (no declared hash) is flagged — drift would be invisible", () => {
    expect(verifySkillFreshness(undefined, snap).map((f) => f.code)).toEqual(["unpinned-skill"]);
  });
});
