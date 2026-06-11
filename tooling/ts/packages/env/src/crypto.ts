/**
 * Post-quantum encryption for individual config values — the heart of @suluk/env. Each value is sealed with
 * ML-KEM-768 (FIPS-203 key-encapsulation, via @noble/post-quantum — pure JS, runs on Node/Bun/browsers AND
 * Cloudflare Workers) combined with AES-256-GCM:
 *
 *     encapsulate(publicKey) → { kemCiphertext, sharedSecret }
 *     AES-256-GCM(key = sharedSecret, iv, plaintext) → aesCiphertext+tag
 *     token = "encrypted:mlkem768:" + base64( kemCiphertext[1088] | iv[12] | aesCiphertext+tag )
 *
 * Only the PRIVATE key can decapsulate, so only it can decrypt. The PUBLIC key — and therefore the whole
 * encrypted .env — is safe to commit to git and share over public channels, and anyone holding the public key
 * can ADD or re-encrypt values without ever seeing the secrets. That is dotenvx's commit-safely model, made
 * quantum-safe. Per-value encapsulation (a fresh KEM ciphertext per value) is what makes "add one var with only
 * the public key" work.
 *
 * Runtime-agnostic: uses only globalThis.crypto (Web Crypto) + @noble/post-quantum. No node:fs, no Buffer — so
 * this module imports cleanly inside a Cloudflare Worker. Filesystem helpers live in ./node.
 */
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";

/** The cipher/key scheme tag embedded in keys + tokens. Bump if the construction ever changes. */
export const SCHEME = "mlkem768";
const KEM_CT_LEN = 1088; // ML-KEM-768 ciphertext length, in bytes
const PK_LEN = 1184; // ML-KEM-768 public key (ek) length
const SK_PK_OFFSET = 1152; // sk = dk_PKE[1152] | ek/publicKey[1184] | H(ek)[32] | z[32]  (FIPS-203, k=3)
const IV_LEN = 12; // AES-GCM nonce
const ENC_PREFIX = "encrypted:";

const te = new TextEncoder();
const td = new TextDecoder();

// base64 without Buffer or array-spread (Workers-safe, and won't overflow the call stack on multi-KB keys).
function toB64(bytes: Uint8Array): string { let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); }
function fromB64(b64: string): Uint8Array { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
// Web Crypto's BufferSource wants an ArrayBuffer-backed view; @noble returns a generic Uint8Array<ArrayBufferLike>.
// This is a type-level boundary only — the bytes are identical at runtime.
const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

export interface Keypair {
  /** `mlkem768:<base64>` — commit/share this; it can only ENCRYPT. */
  publicKey: string;
  /** `mlkem768:<base64>` — keep secret (.env.keys / a secret binding); it can DECRYPT. */
  privateKey: string;
}

/** Generate an ML-KEM-768 keypair. Pass a 64-byte seed only for deterministic/test keygen. */
export function keygen(seed?: Uint8Array): Keypair {
  const { publicKey, secretKey } = seed ? ml_kem768.keygen(seed) : ml_kem768.keygen();
  return { publicKey: `${SCHEME}:${toB64(publicKey)}`, privateKey: `${SCHEME}:${toB64(secretKey)}` };
}

function keyMaterial(key: string): Uint8Array {
  const i = key.indexOf(":");
  const scheme = i > 0 ? key.slice(0, i) : "";
  if (scheme !== SCHEME) throw new Error(`@suluk/env: unsupported key scheme '${scheme || "?"}' (expected ${SCHEME})`);
  return fromB64(key.slice(i + 1));
}

/** Is this value an `encrypted:…` token (vs plaintext)? */
export function isEncrypted(value: string): boolean { return value.startsWith(ENC_PREFIX); }

/** Derive the public key string from a private key (so `set`/`encrypt` work given only the secret). */
export function publicFromPrivate(privateKey: string): string {
  // an ML-KEM-768 secret key embeds the public key (ek) at offset 1152, length 1184 (FIPS-203 dk layout).
  const sk = keyMaterial(privateKey);
  return `${SCHEME}:${toB64(sk.subarray(SK_PK_OFFSET, SK_PK_OFFSET + PK_LEN))}`;
}

/** Seal a plaintext value to a public key → an `encrypted:mlkem768:…` token. */
export async function encrypt(publicKey: string, plaintext: string): Promise<string> {
  const { cipherText, sharedSecret } = ml_kem768.encapsulate(keyMaterial(publicKey));
  const key = await crypto.subtle.importKey("raw", bs(sharedSecret), { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const aes = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bs(te.encode(plaintext))));
  const payload = new Uint8Array(cipherText.length + IV_LEN + aes.length);
  payload.set(cipherText, 0); payload.set(iv, cipherText.length); payload.set(aes, cipherText.length + IV_LEN);
  return `${ENC_PREFIX}${SCHEME}:${toB64(payload)}`;
}

/** Open an `encrypted:mlkem768:…` token with the private key. Throws if the key is wrong or the token is tampered. */
export async function decrypt(privateKey: string, token: string): Promise<string> {
  const m = /^encrypted:([a-z0-9]+):([\s\S]*)$/.exec(token);
  if (!m) throw new Error("@suluk/env: not an encrypted value");
  if (m[1] !== SCHEME) throw new Error(`@suluk/env: unsupported cipher scheme '${m[1]}' (expected ${SCHEME})`);
  const payload = fromB64(m[2]);
  const cipherText = payload.subarray(0, KEM_CT_LEN);
  const iv = payload.subarray(KEM_CT_LEN, KEM_CT_LEN + IV_LEN);
  const aes = payload.subarray(KEM_CT_LEN + IV_LEN);
  const sharedSecret = ml_kem768.decapsulate(cipherText, keyMaterial(privateKey)); // wrong key → pseudo-random ss → GCM auth fails below
  const key = await crypto.subtle.importKey("raw", bs(sharedSecret), { name: "AES-GCM" }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bs(iv) }, key, bs(aes));
  return td.decode(pt);
}
