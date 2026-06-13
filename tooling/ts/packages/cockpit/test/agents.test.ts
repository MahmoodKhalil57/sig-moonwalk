import { test, expect, describe } from "bun:test";
import type { OpenAPIv4Document, HttpMethod, Request } from "@suluk/core";
import { agentsView, agentsSummary } from "../src/index";
import { SEED_CATALOG } from "@suluk/agents";

const req = (method: HttpMethod): Request => ({ method, responses: { ok: { status: 200 } } });

const doc: OpenAPIv4Document = {
  openapi: "4.0.0-candidate",
  info: { title: "agents-view", version: "0" },
  paths: {
    "v1/deliverables": { requests: { generateDeliverable: req("post") } },
    "v1/library/search": { requests: { searchLibrary: req("get") } },
  },
  "x-suluk-agents": {
    conin: {
      description: "Orchestrator: docs → graded deliverables.",
      scope: ["project:read", "library:read"],
      maxDepth: 1,
      skills: { operate: { model: ["anthropic/claude-opus-4"], tier: "cold-tail", provenance: { source: "https://x/v1/instructions", contentHash: "sha256-abc", version: "1" } } },
      routes: { generate_deliverable: { operationRef: "#/paths/v1~1deliverables/requests/generateDeliverable", guarantee: "same-in-same-out" } },
      agents: { retrieval: { ref: "#/x-suluk-agents/coninRetrieval" } },
    },
    coninRetrieval: {
      description: "Untrusted retrieval leaf.",
      scope: ["library:read"],
      maxDepth: 0,
      skills: { search: { model: ["google/gemini-2.5-flash"], tier: "resident" } }, // no provenance ⇒ unpinned
      routes: { search_library: { operationRef: "#/paths/v1~1library~1search/requests/searchLibrary" } },
      agents: {},
    },
  },
};

describe("C027 cockpit agents view (OBSERVE)", () => {
  const v = agentsView(doc);

  test("derives the tier tree + roots", () => {
    expect(v.present).toBe(true);
    expect(v.agents.map((a) => a.name)).toEqual(["conin", "coninRetrieval"]);
    expect(v.roots).toEqual(["conin"]); // retrieval is referenced as a sub-agent → not a root
    const [conin, retr] = v.agents;
    expect(conin.kind).toBe("orchestrator");
    expect(retr.kind).toBe("leaf");
  });

  test("shows effective (intersection) scope + skill pinning + route resolution", () => {
    const conin = v.agents.find((a) => a.name === "conin")!;
    const retr = v.agents.find((a) => a.name === "coninRetrieval")!;
    expect(conin.effectiveScope).toEqual(["project:read", "library:read"]);
    expect(retr.effectiveScope).toEqual(["library:read"]);
    expect(conin.skills[0].pinned).toBe(true);   // has contentHash
    expect(retr.skills[0].pinned).toBe(false);   // no provenance
    expect(conin.routes[0].resolves).toBe(true);
    expect(conin.reachable.tools).toEqual(["generate_deliverable", "search_library"]);
  });

  test("projection preview is names-only (no execution, no creds)", () => {
    const conin = v.agents.find((a) => a.name === "conin")!;
    expect(conin.projection.pluginFiles).toEqual(["plugin.json", ".mcp.json", "skills/operate/SKILL.md"]);
    expect(conin.projection.openRouterTools).toEqual(["generate_deliverable"]);
  });

  test("tier-trim is visible in the projection preview (resident vs discoverable)", () => {
    const t = structuredClone(doc);
    t["x-suluk-agents"]!.coninRetrieval.routes!.search_library.tier = "cold-tail";
    const retr = agentsView(t).agents.find((a) => a.name === "coninRetrieval")!;
    expect(retr.projection.discoverableTools).toEqual(["search_library"]);
    expect(retr.projection.residentTools).not.toContain("search_library");
    expect(retr.routes.find((r) => r.name === "search_library")!.tier).toBe("cold-tail");
  });

  test("installable + summary when the gate is clean", () => {
    expect(v.installable).toBe(true);
    expect(agentsSummary(v)).toContain("✓ installable");
  });

  test("a dangling operationRef surfaces in the view AND blocks installability", () => {
    const bad = structuredClone(doc);
    bad["x-suluk-agents"]!.conin.routes!.generate_deliverable.operationRef = "#/paths/nope/requests/x";
    const bv = agentsView(bad);
    expect(bv.installable).toBe(false);
    expect(bv.agents.find((a) => a.name === "conin")!.routes[0].resolves).toBe(false);
    expect(bv.findings.some((f) => f.code === "dangling-operation-ref")).toBe(true);
    expect(agentsSummary(bv)).toContain("blocking");
  });

  test("context-budget load is attached, and unflatten surfaces when an agent is over budget (the add-a-layer check)", () => {
    expect(v.agents.find((a) => a.name === "conin")!.context.totalTokens).toBeGreaterThan(0);
    const tiny = structuredClone(doc);
    tiny["x-suluk-agents"]!.conin.contextBudget = { tokens: 50, basis: "estimate" };
    const v2 = agentsView(tiny);
    expect(v2.contextFindings.some((f) => f.code === "context-over-budget")).toBe(true);
    expect(v2.unflatten.some((u) => u.agent === "conin")).toBe(true);
    expect(agentsSummary(v2)).toContain("unflatten");
  });

  test("model selection surfaces 'why this model' when a catalog is supplied (C027 × @suluk/models)", () => {
    const view = agentsView(doc, { catalog: SEED_CATALOG });
    const conin = view.agents.find((a) => a.name === "conin")!;
    expect(conin.modelSelection).toBeDefined();
    const operate = conin.modelSelection!.find((m) => m.skill === "operate")!;
    expect(operate.from).toBe("declared"); // operate has an explicit model[] → opt-out
    expect(operate.ids).toEqual(["anthropic/claude-opus-4"]);
    expect(agentsView(doc).agents[0].modelSelection).toBeUndefined(); // no catalog ⇒ no surface (back-compat)

    const d = structuredClone(doc);
    d["x-suluk-agents"]!.conin.skills!.operate = { modelProfile: "cheap-fast" };
    const sel = agentsView(d, { catalog: SEED_CATALOG }).agents.find((a) => a.name === "conin")!.modelSelection!.find((m) => m.skill === "operate")!;
    expect(sel.from).toBe("selected");
    expect(sel.ids.length).toBeGreaterThan(0);
    expect(sel.decidingPreference).toBeTruthy();
  });

  test("absent agent layer is handled", () => {
    const empty = agentsView({ openapi: "4.0.0-candidate", info: { title: "x", version: "0" }, paths: {} });
    expect(empty.present).toBe(false);
    expect(agentsSummary(empty)).toContain("no agents");
  });

  test("operator policy (C028): the OBSERVE diff shows declared vs effective + the cost three-number", () => {
    const g = structuredClone(doc);
    g["x-suluk-agents"]!.conin["x-suluk-cost"] = { estimateMicroUsd: 8000 };
    g["x-suluk-policy"] = {
      "acme-fleet": {
        appliesTo: ["#/x-suluk-agents/conin"],
        tools: { deny: ["generate_deliverable"] },
        forbidNesting: true,
        costCeiling: { amount: 5000, amountUnit: "micro-usd", basis: "per-request", enforcedBy: "adapter" },
      },
    };
    const conin = agentsView(g).agents.find((a) => a.name === "conin")!;
    expect(conin.governed).toBeDefined();
    expect(conin.governed!.deniedTools).toEqual(["generate_deliverable"]);
    expect(conin.governed!.nestingForbidden).toBe(true);
    expect(conin.governed!.cost.cap).toContain("5000 micro-usd");
    expect(conin.governed!.cost.cap).toContain("enforcedBy adapter"); // never reads as schema-enforced
    expect(conin.governed!.cost.estimate).toBe("8000 µ$");
    expect(conin.governed!.cost.actual).toContain("runtime");
    expect(conin.governed!.narrowings.some((n) => n.axis === "tools")).toBe(true);
    // an ungoverned agent has no diff
    expect(agentsView(doc).agents.find((a) => a.name === "conin")!.governed).toBeUndefined();
  });
});
