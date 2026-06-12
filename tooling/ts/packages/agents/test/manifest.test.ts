import { test, expect, describe } from "bun:test";
import { agentManifest, verifyAgentFreshness, contentHash } from "../src/index";
import { coninDoc, coninInstructions } from "./fixtures/conin";

describe("C027 signable agent manifest", () => {
  const m = agentManifest(coninDoc, "conin");

  test("canonical: root + reachable sub-tree, sorted, no escalations", () => {
    expect(m.manifestVersion).toBe(1);
    expect(m.agent).toBe("conin");
    expect(m.nodes.map((n) => n.name)).toEqual(["conin", "coninRetrieval"]);
    expect(m.escalations).toEqual([]);
    expect(m.reachable.tools).toEqual(["find_comparables", "generate_deliverable", "run_core_primitive", "search_library"]);
  });

  test("carries each skill's contentHash (so a signature over the manifest covers preprompt drift)", () => {
    const conin = m.nodes.find((n) => n.name === "conin")!;
    expect(conin.skills[0].contentHash).toBe("sha256-9f2c0000deadbeef");
    expect(conin.effectiveScope).toEqual(["project:read", "deliverable:write", "library:read"]);
    const retr = m.nodes.find((n) => n.name === "coninRetrieval")!;
    expect(retr.effectiveScope).toEqual(["library:read"]);
  });

  test("deterministic — twice equal", () => {
    expect(agentManifest(coninDoc, "conin")).toEqual(m);
  });

  test("freshness: a drifted served snapshot is caught against the signed contentHash", () => {
    // declared hashes in the fixture are placeholders → any real snapshot drifts
    const drift = verifyAgentFreshness(m, { "conin/operate": coninInstructions.operate });
    expect(drift.map((f) => f.code)).toContain("stale-skill");
    // a snapshot whose hash MATCHES the signed one is fresh
    const matchHash = m.nodes.find((n) => n.name === "conin")!.skills[0].contentHash!;
    const synthetic = "X".repeat(3);
    // build a manifest whose skill hash equals the synthetic snapshot's hash, then verify fresh
    const m2 = structuredClone(m);
    m2.nodes.find((n) => n.name === "conin")!.skills[0].contentHash = contentHash(synthetic);
    expect(verifyAgentFreshness(m2, { "conin/operate": synthetic }).filter((f) => f.code === "stale-skill")).toEqual([]);
    expect(matchHash.startsWith("sha256-")).toBe(true);
  });
});
