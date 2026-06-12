import { test, expect, describe } from "bun:test";
import { signRegistry, verifyRegistrySignature, generateSigningKeypair } from "@suluk/builder";
import { agentManifest, verifyAgentFreshness, contentHash } from "../src/index";
import { coninDoc, coninInstructions } from "./fixtures/conin";

/**
 * The C027 marketplace supply-chain loop (council open-Q #8): an agent manifest is signed through the SAME
 * @suluk/builder ECDSA-P256 registry signing (C021). Because the manifest carries each skill's contentHash, the
 * signature COVERS the served preprompt — a preprompt that drifts after mint is detectable (verifyAgentFreshness),
 * and any structural tamper breaks the signature. One mechanism, reused unchanged.
 */
describe("C027 × C021 — a signed agent manifest covers preprompt drift", () => {
  const snapshot = coninInstructions.operate;

  test("sign → verify → preprompt-drift caught → structural-tamper caught", async () => {
    // pin the operate skill's contentHash to the actual served snapshot, then mint a signature over the manifest
    const manifest = agentManifest(coninDoc, "conin");
    manifest.nodes.find((n) => n.name === "conin")!.skills[0].contentHash = contentHash(snapshot);

    const { publicKey, privateKey } = await generateSigningKeypair();
    const sig = await signRegistry(manifest, privateKey);

    // (1) a faithfully-distributed manifest verifies, and its skills are fresh against the current snapshot
    expect(await verifyRegistrySignature(manifest, sig, publicKey)).toBe(true);
    expect(verifyAgentFreshness(manifest, { "conin/operate": snapshot }).filter((f) => f.code === "stale-skill")).toEqual([]);

    // (2) PREPROMPT DRIFT after mint: the served text changes but the signed manifest does not — the signature still
    //     verifies (nothing in the artifact changed), yet the freshness check catches the drift via the signed hash
    const drifted = snapshot + "  ← edited on the server after signing";
    expect(await verifyRegistrySignature(manifest, sig, publicKey)).toBe(true);
    expect(verifyAgentFreshness(manifest, { "conin/operate": drifted }).map((f) => f.code)).toContain("stale-skill");

    // (3) STRUCTURAL TAMPER: mutate the manifest (redirect a route) — the signature no longer verifies
    const tampered = structuredClone(manifest);
    tampered.nodes.find((n) => n.name === "conin")!.routes[0].operationRef = "#/paths/evil/requests/x";
    expect(await verifyRegistrySignature(tampered, sig, publicKey)).toBe(false);

    // (4) key-order independence: same content, different top-level insertion order, still verifies (canonicalJson)
    const reordered = {
      escalations: manifest.escalations, reachable: manifest.reachable,
      nodes: manifest.nodes, agent: manifest.agent, manifestVersion: manifest.manifestVersion,
    };
    expect(await verifyRegistrySignature(reordered, sig, publicKey)).toBe(true);
  });
});
