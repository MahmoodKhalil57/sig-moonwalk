import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument, buildAda, matchRequest } from "../src/index";

/**
 * D1 SAFETY GATE for C028 (`x-suluk-policy`) — the witness for `d1_policy_selector_safe` (plan/facts/0policy-d1.bn).
 * An operator governance overlay is ALSO a top-level vendor map that the DOM→ADA matcher must never read. This test
 * proves the matcher is invariant to an `x-suluk-policy` block — including a maximally-restrictive deny-all one —
 * exactly as agents-d1-invariance.test.ts proved it for x-suluk-agents. The moment the matcher consults a policy
 * field, the ADA stops being invariant and this fails loud.
 */
const here = import.meta.dir;
const petstore = parseDocument(readFileSync(join(here, "conformance", "valid", "01-petstore.yaml"), "utf8"));

const DENY_ALL_POLICY = {
  "x-suluk-policy": {
    "lockdown-fleet": {
      appliesTo: ["#/x-suluk-agents/conin"],
      scopeAllowlist: [],
      agents: { deny: ["coninRetrieval"] },
      tools: { deny: ["generate_deliverable", "run_core_primitive"] },
      retrievalTools: { deny: ["search_library"] },
      capTier: "resident",
      modelAllowlist: [],
      maxDepthCap: 0,
      forbidNesting: true,
      costCeiling: { amount: 0, amountUnit: "micro-usd", basis: "per-request", enforcedBy: "adapter" },
    },
  },
};

const project = (ada: ReturnType<typeof buildAda>) => ({
  operations: ada.operations
    .map((o) => ({ pathTemplate: o.pathTemplate, name: o.name, method: o.request.method, signatureKey: o.signatureKey, tuple: o.tuple }))
    .sort((a, b) => (a.signatureKey + a.name).localeCompare(b.signatureKey + b.name)),
  collisions: ada.collisions.map((c) => ({ a: c.a.name, b: c.b.name, verdict: c.verdict })),
  signatureKeys: [...ada.bySignature.keys()].sort(),
});

const concrete = (tpl: string) => tpl.replace(/\{\?[^}]*\}/g, "").replace(/\{[^}]+\}/g, "x");

describe("D1 gate (C028): the request→operation matcher is INVARIANT to an x-suluk-policy block", () => {
  const withoutPolicy = petstore;
  const withPolicy = { ...petstore, ...DENY_ALL_POLICY } as unknown as typeof petstore;

  test("buildAda is identical with vs without a deny-all x-suluk-policy", () => {
    expect(project(buildAda(withPolicy))).toEqual(project(buildAda(withoutPolicy)));
  });

  test("matchRequest resolves every operation identically with vs without the policy", () => {
    const adaW = buildAda(withPolicy);
    const adaWo = buildAda(withoutPolicy);
    for (const op of adaWo.operations) {
      const norm = (r: ReturnType<typeof matchRequest>) =>
        r === null ? null : { name: r.operation.name, pathTemplate: r.operation.pathTemplate, pathParams: r.pathParams, query: r.query };
      expect(norm(matchRequest(adaW, op.request.method, concrete(op.pathTemplate)))).toEqual(
        norm(matchRequest(adaWo, op.request.method, concrete(op.pathTemplate))),
      );
    }
  });
});
