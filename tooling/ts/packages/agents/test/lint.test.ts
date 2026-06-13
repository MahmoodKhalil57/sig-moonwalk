import { test, expect, describe } from "bun:test";
import { lintAgents, lintOk } from "../src/index";
import { coninDoc, coninDayOne, cyclicDoc, missingMaxDepthDoc, selectorDoc } from "./fixtures/conin";

const codes = (doc: Parameters<typeof lintAgents>[0]) => lintAgents(doc).filter((f) => f.severity === "error").map((f) => f.code);

describe("C027 agent lint", () => {
  test("the valid Conin agent installs (no errors)", () => {
    const findings = lintAgents(coninDoc);
    expect(findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(lintOk(findings)).toBe(true);
  });

  test("NAMED failure: Conin's MCP-only run_core_primitive is a dangling operationRef", () => {
    const errs = lintAgents(coninDayOne()).filter((f) => f.severity === "error");
    expect(errs.some((e) => e.code === "dangling-operation-ref" && e.at?.includes("run_core_primitive"))).toBe(true);
    expect(lintOk(errs)).toBe(false);
  });

  test("a recursion cycle is rejected", () => {
    expect(codes(cyclicDoc())).toContain("agent-cycle");
  });

  test("sub-agents without a declared maxDepth do not install", () => {
    expect(codes(missingMaxDepthDoc())).toContain("missing-max-depth");
  });

  test("D1: a request-value selector smuggled via a vendor field is forbidden", () => {
    const errs = lintAgents(selectorDoc()).filter((f) => f.severity === "error");
    expect(errs.some((e) => e.code === "request-value-selector")).toBe(true);
  });

  test("a route carrying a model is an error (a route is deterministic)", () => {
    const d = structuredClone(coninDoc);
    (d["x-suluk-agents"]!.conin.routes!.generate_deliverable as unknown as Record<string, unknown>).model = ["x"];
    expect(codes(d)).toContain("route-has-model");
  });

  test("C029: thinking present without maxRounds is rejected", () => {
    const d = structuredClone(coninDoc);
    d["x-suluk-agents"]!.conin.thinking = {} as { maxRounds: number };
    expect(codes(d)).toContain("missing-max-rounds");
  });

  test("C029: maxRounds < 1 is rejected", () => {
    const d = structuredClone(coninDoc);
    d["x-suluk-agents"]!.conin.thinking = { maxRounds: 0 };
    expect(codes(d)).toContain("invalid-max-rounds");
  });

  test("C029: a stopCondition-shaped member is forbidden (declare the bound, not the process)", () => {
    const d = structuredClone(coninDoc);
    d["x-suluk-agents"]!.conin.thinking = { maxRounds: 3, stopCondition: "final-answer" } as unknown as { maxRounds: number };
    expect(codes(d)).toContain("thinking-process-declared");
  });

  test("C029: a valid thinking bound lints clean", () => {
    const d = structuredClone(coninDoc);
    d["x-suluk-agents"]!.conin.thinking = { maxRounds: 6, budget: { tokens: 40000, basis: "estimate" } };
    expect(lintAgents(d).filter((f) => f.severity === "error")).toEqual([]);
  });
});
