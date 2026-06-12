/**
 * Conin as an `x-suluk-agents` fixture (C027) — the live, un-standardized cowpath, serialized. A FLAT two-tier
 * agent: an orchestrator (`conin`) with a model-bearing skill + two deterministic routes + one sub-agent (the
 * untrusted retrieval tier `coninRetrieval`). Plus the NAMED conformance-failure variants the council requires
 * tracked (not laundered): Conin's MCP-only primitive (a dangling operationRef), a cycle, a missing depth bound,
 * and a forbidden request-value selector.
 */
import type { OpenAPIv4Document, Request, HttpMethod } from "@suluk/core";

const req = (method: HttpMethod): Request => ({ method, responses: { ok: { status: 200 } } });

/** The valid, installable Conin agent (all four routes resolve to real operations). */
export const coninDoc: OpenAPIv4Document = {
  openapi: "4.0.0-candidate",
  info: { title: "Conin — Construction Intelligence", version: "1.0.0" },
  paths: {
    "v1/deliverables": { requests: { generateDeliverable: req("post") } },
    "v1/primitives": { requests: { runCorePrimitive: req("post") } },
    "v1/library/search": { requests: { searchLibrary: req("get") } },
    "v1/comparables": { requests: { findComparables: req("get") } },
  },
  "x-suluk-agents": {
    conin: {
      description: "Construction-intelligence orchestrator: messy project docs → provenance-graded deliverables. Use to cost/value/certify/reconcile a MENA capital project.",
      // the orchestrator must GRANT what its sub-tree uses (incl. the retrieval child's library:read) — a child's
      // effective scope is INTERSECTION(child, caller), so a permission absent here would be silently dropped.
      scope: ["project:read", "deliverable:write", "library:read"],
      maxDepth: 1,
      skills: {
        operate: {
          model: ["anthropic/claude-opus-4", "google/gemini-2.5-flash"],
          tier: "cold-tail",
          whenToUse: "Always loaded first; governs deterministic-first + SOURCED/ASSUMED grading; routes to a deliverable kind.",
          trust: "author-declared",
          scope: ["project:read"],
          provenance: { source: "https://construction-intelligence.saastemly.com/v1/instructions", contentHash: "sha256-9f2c0000deadbeef", version: "2026-06-11" },
        },
      },
      routes: {
        generate_deliverable: { operationRef: "#/paths/v1~1deliverables/requests/generateDeliverable", guarantee: "same-in-same-out", scope: ["deliverable:write"] },
        run_core_primitive: { operationRef: "#/paths/v1~1primitives/requests/runCorePrimitive", guarantee: "same-in-same-out", scope: ["project:read"] },
      },
      agents: { retrieval: { ref: "#/x-suluk-agents/coninRetrieval" } },
    },
    coninRetrieval: {
      description: "Untrusted retrieval tier: search_library / find_comparables. Returns ASSUMED-grade material only; never emits a graded figure.",
      scope: ["library:read"],
      maxDepth: 0,
      trustBoundary: "untrusted",
      skills: {
        search: {
          model: ["google/gemini-2.5-flash"],
          tier: "resident",
          whenToUse: "Find comparables/evidence; returns ASSUMED-grade material only.",
          provenance: { source: "https://construction-intelligence.saastemly.com/v1/instructions#retrieval", contentHash: "sha256-1a7d0000feedface", version: "2026-06-11" },
        },
      },
      routes: {
        search_library: { operationRef: "#/paths/v1~1library~1search/requests/searchLibrary", guarantee: "idempotent", scope: ["library:read"] },
        find_comparables: { operationRef: "#/paths/v1~1comparables/requests/findComparables", guarantee: "idempotent", scope: ["library:read"] },
      },
      agents: {},
    },
  },
};

/** The instruction snapshots a projector is fed (pinned; never fetched at generate time). */
export const coninInstructions: Record<string, string> = {
  operate: "You are Conin. Deterministic-first: every NUMBER comes from a deterministic tool; the LLM only routes. Grade every figure SOURCED or ASSUMED.",
  search: "Retrieval tier. Find comparables and evidence. You return ASSUMED-grade material only — never a graded figure.",
};

/** FAILURE FIXTURE — Conin's REAL day-one gap: run_core_primitive is dispatched MCP-only, with no REST operation. */
export function coninDayOne(): OpenAPIv4Document {
  const d = structuredClone(coninDoc);
  delete (d.paths as Record<string, unknown>)["v1/primitives"]; // the operationRef now dangles
  return d;
}

/** FAILURE FIXTURE — a recursion cycle (a ↔ b), each with a (useless) declared maxDepth. */
export function cyclicDoc(): OpenAPIv4Document {
  return {
    openapi: "4.0.0-candidate",
    info: { title: "cyclic", version: "0" },
    paths: {},
    "x-suluk-agents": {
      a: { description: "agent a", maxDepth: 1, agents: { toB: { ref: "#/x-suluk-agents/b" } } },
      b: { description: "agent b", maxDepth: 1, agents: { toA: { ref: "#/x-suluk-agents/a" } } },
    },
  };
}

/** FAILURE FIXTURE — sub-agents present but no maxDepth declared (must not install). */
export function missingMaxDepthDoc(): OpenAPIv4Document {
  const d = structuredClone(coninDoc);
  delete d["x-suluk-agents"]!.conin.maxDepth;
  return d;
}

/** FAILURE FIXTURE — a forbidden request-value selector smuggled in via a vendor field (the #20 tripwire, D1). */
export function selectorDoc(): OpenAPIv4Document {
  const d = structuredClone(coninDoc);
  d["x-suluk-agents"]!.conin["x-suluk-route-when"] = "{$request.body#/kind}";
  return d;
}

/** FAILURE FIXTURE — scope escalation: the retrieval child needs library:read but the orchestrator no longer grants it. */
export function escalationDoc(): OpenAPIv4Document {
  const d = structuredClone(coninDoc);
  d["x-suluk-agents"]!.conin.scope = ["project:read", "deliverable:write"]; // drops library:read → child escalates
  return d;
}
