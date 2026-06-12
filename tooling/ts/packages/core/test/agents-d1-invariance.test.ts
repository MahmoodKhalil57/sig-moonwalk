import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument, buildAda, matchRequest } from "../src/index";

/**
 * D1 SAFETY GATE for C027 (`x-suluk-agents`) — the INDEPENDENT, MAINTAINED witness for the burhan claim
 * `d1_agent_selector_safe` (plan/facts/0agents-d1.bn; council workflow wf_9e8712c7-871, 2026-06-12).
 *
 * The agent layer is a top-level OPTIONAL `x-suluk-agents` vendor map (the C025 x-suluk-jobs move). D1 — the
 * load-bearing invariant — says the DOM→ADA request→operation matcher MUST be statically + locally decidable and
 * must NEVER consult an agent field. buildAda iterates `doc.paths` only; matchRequest reads only method + the
 * compiled path-template. This test ENFORCES that invariant as a regression tripwire: the moment anyone makes the
 * matcher read `x-suluk-agents` (or any agent field), the ADA stops being invariant to the block and this fails.
 *
 * It is a SECOND, methodologically-distinct witness (executable/empirical) to the code-reading argument in the
 * ledger — exactly the independent witness mizan_verify_claim recommended to lift the sole-witness cap.
 */

const here = import.meta.dir;
const petstore = parseDocument(readFileSync(join(here, "conformance", "valid", "01-petstore.yaml"), "utf8"));

/**
 * A representative `x-suluk-agents` block (the C027 candidate shape: skills with a `model`, deterministic routes
 * as by-name operationRefs with NO model, a by-name sub-agent ref, a cycle-linted depth bound, and a typed leaf).
 * If the matcher ever grew to read any of this, the invariance assertions below would break.
 */
const AGENTS_BLOCK = {
  "x-suluk-agents": {
    conin: {
      description: "Construction-intelligence orchestrator (routing-oriented).",
      scope: ["project:read", "deliverable:write"],
      maxDepth: 1,
      skills: {
        operate: {
          model: ["anthropic/claude-opus-4", "google/gemini-2.5-flash"],
          tier: "cold-tail",
          whenToUse: "Always loaded first; governs deterministic-first grading.",
          provenance: { source: "https://example.com/v1/instructions", contentHash: "sha256-9f2c", version: "2026-06-11" },
        },
      },
      routes: {
        // by-name operationRefs into REAL petstore operations — never inline (C009), never read by the matcher
        listPets: { operationRef: "#/paths/pet/requests/listPets", guarantee: "same-in-same-out" },
        getPet: { operationRef: "#/paths/pet~1{petId}/requests/getPet", guarantee: "idempotent" },
      },
      agents: { retrieval: { ref: "#/x-suluk-agents/coninRetrieval" } },
    },
    coninRetrieval: {
      description: "Untrusted retrieval tier — never emits a graded figure.",
      maxDepth: 0,
      trustBoundary: "untrusted",
      skills: { search: { model: ["google/gemini-2.5-flash"], tier: "resident", whenToUse: "Find comparables." } },
      routes: {},
      agents: {}, // typed LEAF base-case
    },
  },
};

/** Serializable projection of the ADA — the load-bearing static identity (signatures + collisions), compiled internals aside. */
const project = (ada: ReturnType<typeof buildAda>) => ({
  operations: ada.operations
    .map((o) => ({ pathTemplate: o.pathTemplate, name: o.name, method: o.request.method, signatureKey: o.signatureKey, tuple: o.tuple }))
    .sort((a, b) => (a.signatureKey + a.name).localeCompare(b.signatureKey + b.name)),
  collisions: ada.collisions.map((c) => ({ a: c.a.name, b: c.b.name, verdict: c.verdict })),
  signatureKeys: [...ada.bySignature.keys()].sort(),
});

/** A concrete path/method probe derived from each operation's own template (drop the query operator; fill vars). */
const concrete = (tpl: string) => tpl.replace(/\{\?[^}]*\}/g, "").replace(/\{[^}]+\}/g, "x");

describe("D1 gate (C027): the request→operation matcher is INVARIANT to an x-suluk-agents block", () => {
  const withoutAgents = petstore;
  const withAgents = { ...petstore, ...AGENTS_BLOCK } as unknown as typeof petstore;

  test("buildAda yields an identical ADA with vs without x-suluk-agents", () => {
    expect(project(buildAda(withAgents))).toEqual(project(buildAda(withoutAgents)));
  });

  test("matchRequest resolves every operation identically with vs without x-suluk-agents", () => {
    const adaW = buildAda(withAgents);
    const adaWo = buildAda(withoutAgents);
    for (const op of adaWo.operations) {
      const url = concrete(op.pathTemplate);
      const method = op.request.method;
      const rW = matchRequest(adaW, method, url);
      const rWo = matchRequest(adaWo, method, url);
      const norm = (r: ReturnType<typeof matchRequest>) =>
        r === null ? null : { name: r.operation.name, pathTemplate: r.operation.pathTemplate, pathParams: r.pathParams, query: r.query };
      expect(norm(rW)).toEqual(norm(rWo));
    }
  });

  test("a deliberately CYCLIC / unbounded agents block still does not perturb the matcher (front-door re-entry; recursion is a lint concern, never the matcher's)", () => {
    const cyclic = {
      ...petstore,
      "x-suluk-agents": {
        a: { description: "a", agents: { toB: { ref: "#/x-suluk-agents/b" } } }, // no maxDepth, cyclic a↔b
        b: { description: "b", agents: { toA: { ref: "#/x-suluk-agents/a" } } },
      },
    } as unknown as typeof petstore;
    expect(project(buildAda(cyclic))).toEqual(project(buildAda(petstore)));
  });
});
