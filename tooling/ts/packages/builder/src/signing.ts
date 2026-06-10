/**
 * Signed registries (L1+) — provenance for the OPEN marketplace. A publisher signs their registry with a
 * private key; a consumer pins the publisher's PUBLIC key and verifies every fetch. A verified signature turns
 * an untrusted "⚠ third-party" registry into "✓ signed by <publisher>"; a present-but-INVALID signature is a
 * hard refuse (tampering / wrong key). Uses Web Crypto ECDSA P-256 — a global standard available in bun, the
 * VS Code extension host (Node), Workers, and browsers. Pure (no host API). Async (crypto.subtle).
 */

/** A signed registry payload: the registry value + a detached base64 signature over its canonical bytes. */
export interface SignedEnvelope {
  registry: unknown;
  /** base64 ECDSA-P256/SHA-256 signature over canonicalBytes(registry) */
  signature: string;
  publisher?: string;
}

export function isSignedEnvelope(v: unknown): v is SignedEnvelope {
  return !!v && typeof v === "object" && !Array.isArray(v)
    && typeof (v as Record<string, unknown>).signature === "string"
    && "registry" in (v as Record<string, unknown>);
}

/**
 * Stable, key-order-independent JSON so the signer and verifier hash identical bytes regardless of key order.
 * Uses a PATH-LOCAL ancestor guard (push before recursing, pop after) so a shared reference (a DAG) serializes
 * fully both times — matching the JSON.stringify→parse tree the consumer reconstructs — while a true cycle still
 * terminates. (A never-removed visited-set would collapse a shared sibling to null and break verification.)
 */
function canonicalJson(value: unknown): string {
  const ancestors = new WeakSet<object>();
  const norm = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (ancestors.has(v as object)) return null; // a true cycle (an ancestor of itself) — break it
    ancestors.add(v as object);
    const out = Array.isArray(v)
      ? v.map(norm)
      : Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, val]) => [k, norm(val)]));
    ancestors.delete(v as object); // pop after the subtree — a re-referenced (DAG) node re-serializes fully
    return out;
  };
  return JSON.stringify(norm(value));
}
function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalJson(value));
}
function toB64(buf: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

const ALG = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN = { name: "ECDSA", hash: "SHA-256" } as const;

/** Generate an ECDSA P-256 keypair as JWKs (for tooling / tests — a publisher keeps the private key). */
export async function generateSigningKeypair(): Promise<{ publicKey: JsonWebKey; privateKey: JsonWebKey }> {
  const kp = await crypto.subtle.generateKey(ALG, true, ["sign", "verify"]);
  return {
    publicKey: await crypto.subtle.exportKey("jwk", kp.publicKey),
    privateKey: await crypto.subtle.exportKey("jwk", kp.privateKey),
  };
}

/** Sign a registry value with a private JWK → a base64 signature over its canonical bytes. */
export async function signRegistry(value: unknown, privateKeyJwk: JsonWebKey): Promise<string> {
  const key = await crypto.subtle.importKey("jwk", privateKeyJwk, ALG, false, ["sign"]);
  return toB64(await crypto.subtle.sign(SIGN, key, canonicalBytes(value) as BufferSource));
}

/** Verify a registry value against a base64 signature + a pinned public JWK. Never throws — false on any error. */
export async function verifyRegistrySignature(value: unknown, signatureB64: string, publicKeyJwk: JsonWebKey): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("jwk", publicKeyJwk, ALG, false, ["verify"]);
    return await crypto.subtle.verify(SIGN, key, fromB64(signatureB64) as BufferSource, canonicalBytes(value) as BufferSource);
  } catch {
    return false;
  }
}
