import { test, expect, describe } from "bun:test";
import type { OpenAPIv4Document, HttpMethod, Request } from "@suluk/core";
import { agentsView, agentsSummary } from "../src/index";

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

  test("absent agent layer is handled", () => {
    const empty = agentsView({ openapi: "4.0.0-candidate", info: { title: "x", version: "0" }, paths: {} });
    expect(empty.present).toBe(false);
    expect(agentsSummary(empty)).toContain("no agents");
  });
});
