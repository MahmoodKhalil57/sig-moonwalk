import { test, expect, describe } from "bun:test";
import type { OpenAPIv4Document } from "@suluk/core";
import {
  effectiveUnderPolicies, policyConstrain, lintPolicy, policyOk,
  agentManifest, assertServedSubsetGoverned,
} from "../src/index";
import { coninDoc } from "./fixtures/conin";

/** Conin under an operator policy that narrows every axis. */
function governed(): OpenAPIv4Document {
  const d = structuredClone(coninDoc);
  d["x-suluk-policy"] = {
    "acme-fleet": {
      appliesTo: ["#/x-suluk-agents/conin", "#/x-suluk-agents/coninRetrieval"],
      scopeAllowlist: ["project:read", "library:read"], // drops deliverable:write
      tools: { deny: ["run_core_primitive"] },
      capTier: "resident",                               // conin.operate is cold-tail → resident
      modelAllowlist: ["google/gemini-2.5-flash"],       // drops opus
      maxDepthCap: 0,
      forbidNesting: true,                               // removes the retrieval sub-agent
      costCeiling: { amount: 5000, amountUnit: "micro-usd", basis: "per-request", enforcedBy: "adapter" },
    },
  };
  return d;
}

describe("C028 policyConstrain — monotone-narrowing MEET (effective = INTERSECT(operator, agent))", () => {
  const d = governed();
  const { effective, narrowings } = effectiveUnderPolicies(d, "conin");

  test("narrows scope, model, tier, tools, depth, nesting — never widens", () => {
    expect(effective.scope).toEqual(["project:read", "library:read"]); // deliverable:write removed
    const operate = effective.skills.find((s) => s.name === "operate")!;
    expect(operate.model).toEqual(["google/gemini-2.5-flash"]); // opus dropped
    expect(operate.tier).toBe("resident");                      // capped from cold-tail
    expect(operate.usable).toBe(true);
    expect(effective.allowedTools).toEqual(["generate_deliverable"]);
    expect(effective.deniedTools).toEqual(["run_core_primitive"]);
    expect(effective.nestingForbidden).toBe(true);
    expect(effective.maxDepth).toBe(0);
    expect(effective.deniedSubAgents).toEqual(["retrieval"]);
    expect(narrowings.map((n) => n.axis).sort()).toEqual(["model", "nesting", "scope", "tier", "tools"]);
  });

  test("the MEET never grants a capability the agent did not self-declare", () => {
    // effective scope ⊆ agent scope
    const declared = d["x-suluk-agents"]!.conin.scope!;
    expect(effective.scope!.every((s) => declared.includes(s))).toBe(true);
  });
});

describe("C028 lintPolicy", () => {
  test("a satisfiable, well-formed policy lints clean (no errors)", () => {
    const findings = lintPolicy(governed());
    expect(findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(policyOk(findings)).toBe(true);
  });

  test("NAMED failure: a modelAllowlist that excludes every model of a skill is unsatisfiable", () => {
    const d = governed();
    d["x-suluk-policy"]!["acme-fleet"].modelAllowlist = ["openai/gpt-9"]; // matches no Conin skill model
    expect(lintPolicy(d).some((f) => f.code === "policy-unsatisfiable")).toBe(true);
  });

  test("appliesTo must resolve to a real agent (dangling caught)", () => {
    const d = governed();
    d["x-suluk-policy"]!["acme-fleet"].appliesTo = ["#/x-suluk-agents/ghost"];
    expect(lintPolicy(d).some((f) => f.code === "policy-applies-dangling")).toBe(true);
  });

  test("D1: a request-value selector smuggled into a policy is forbidden", () => {
    const d = governed();
    d["x-suluk-policy"]!["acme-fleet"]["x-when"] = "{$request.body#/tier}";
    expect(lintPolicy(d).some((f) => f.code === "request-value-selector")).toBe(true);
  });

  test("cap-below-estimate: an operator cap under the agent's own estimate is flagged (cross-facet, static)", () => {
    const d = governed();
    d["x-suluk-agents"]!.conin["x-suluk-cost"] = { estimateMicroUsd: 10000 };
    // cap = 5000 µ$ < estimate 10000 µ$
    expect(lintPolicy(d).some((f) => f.code === "cap-below-estimate")).toBe(true);
  });
});

describe("C028 manifest + conformance folds", () => {
  test("the signed manifest carries the operator-effective surface (so the signature covers caps)", () => {
    const m = agentManifest(governed(), "conin");
    const conin = m.nodes.find((n) => n.name === "conin")!;
    expect(conin.governed).toBeDefined();
    expect(conin.governed!.allowedTools).toEqual(["generate_deliverable"]);
    expect(conin.governed!.deniedTools).toEqual(["run_core_primitive"]);
    expect(conin.governed!.nestingForbidden).toBe(true);
    expect(conin.governed!.maxDepth).toBe(0);
    // an ungoverned agent has no `governed` field
    expect(agentManifest(coninDoc, "conin").nodes.find((n) => n.name === "conin")!.governed).toBeUndefined();
  });

  test("NAMED failure: serving a policy-DENIED tool is an over-serve (operator cap not holding on the wire)", () => {
    const findings = assertServedSubsetGoverned(governed(), "conin", ["generate_deliverable", "run_core_primitive"]);
    expect(findings.map((f) => f.code)).toEqual(["policy-denied-served"]);
    expect(findings[0].detail).toContain("run_core_primitive");
  });
});
