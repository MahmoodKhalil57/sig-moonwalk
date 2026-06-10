import { test, expect, describe } from "bun:test";
import { generateSigningKeypair, signRegistry, verifyRegistrySignature, isSignedEnvelope } from "../src/index";

const REGISTRY = { name: "Community", modules: [{ title: "Blog", description: "posts", module: { name: "blog", version: "0.1.0", provides: ["Post"], schemas: { Post: { type: "object" } } } }] };

describe("signed registries (ECDSA P-256)", () => {
  test("a registry signed by a publisher verifies with that publisher's public key", async () => {
    const { publicKey, privateKey } = await generateSigningKeypair();
    const sig = await signRegistry(REGISTRY, privateKey);
    expect(await verifyRegistrySignature(REGISTRY, sig, publicKey)).toBe(true);
  });

  test("verification is INSENSITIVE to key order (canonical bytes)", async () => {
    const { publicKey, privateKey } = await generateSigningKeypair();
    const sig = await signRegistry(REGISTRY, privateKey);
    const reordered = { modules: REGISTRY.modules, name: REGISTRY.name }; // keys swapped
    expect(await verifyRegistrySignature(reordered, sig, publicKey)).toBe(true);
  });

  test("a TAMPERED registry fails verification", async () => {
    const { publicKey, privateKey } = await generateSigningKeypair();
    const sig = await signRegistry(REGISTRY, privateKey);
    const tampered = { ...REGISTRY, modules: [{ ...REGISTRY.modules[0], module: { ...REGISTRY.modules[0].module, name: "evil" } }] };
    expect(await verifyRegistrySignature(tampered, sig, publicKey)).toBe(false);
  });

  test("a DIFFERENT publisher's key fails verification", async () => {
    const a = await generateSigningKeypair();
    const b = await generateSigningKeypair();
    const sig = await signRegistry(REGISTRY, a.privateKey);
    expect(await verifyRegistrySignature(REGISTRY, sig, b.publicKey)).toBe(false);
  });

  test("a malformed signature or key never throws — returns false", async () => {
    const { publicKey } = await generateSigningKeypair();
    expect(await verifyRegistrySignature(REGISTRY, "not-base64-!!!", publicKey)).toBe(false);
    expect(await verifyRegistrySignature(REGISTRY, "", publicKey)).toBe(false);
    expect(await verifyRegistrySignature(REGISTRY, "AAAA", {} as JsonWebKey)).toBe(false);
  });

  test("a registry built with a SHARED object reference (DAG) verifies against its JSON round-trip", async () => {
    const { publicKey, privateKey } = await generateSigningKeypair();
    const shared = { kind: "demo" };
    const withDag = { name: "Reg", modules: [], a: shared, b: shared }; // `shared` referenced twice
    const sig = await signRegistry(withDag, privateKey);
    const served = JSON.parse(JSON.stringify(withDag)); // what a consumer reconstructs from the wire
    expect(await verifyRegistrySignature(served, sig, publicKey)).toBe(true);
  });

  test("isSignedEnvelope detects the { registry, signature } shape", () => {
    expect(isSignedEnvelope({ registry: REGISTRY, signature: "abc" })).toBe(true);
    expect(isSignedEnvelope(REGISTRY)).toBe(false); // a bare registry is unsigned
    expect(isSignedEnvelope({ signature: "abc" })).toBe(false); // no registry
    expect(isSignedEnvelope(null)).toBe(false);
  });
});
