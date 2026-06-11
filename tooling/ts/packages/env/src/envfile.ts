/**
 * The encrypted-.env file MODEL — parse/serialize .env CONTENT and encrypt/decrypt the values inside it, while
 * preserving comments, blank lines, and ordering (so an encrypted .env stays a readable, diffable, committable
 * file). Runtime-agnostic: operates on strings only (no node:fs), so it runs in a Worker as happily as in a CLI.
 * Filesystem wrappers (encryptEnvFile(path), loadEnvFile(path)) live in ./node.
 *
 * Layout (dotenvx-compatible idea, quantum-safe values):
 *   SULUK_PUBLIC_KEY="mlkem768:…"        ← committed, can only ENCRYPT
 *   STRIPE_SECRET_KEY="encrypted:mlkem768:…"
 *   BASE_URL="http://localhost:3000"      ← left plaintext (not a secret)
 * and the matching private key lives OUTSIDE this file (.env.keys, gitignored, or a secret binding):
 *   SULUK_PRIVATE_KEY="mlkem768:…"
 */
import { encrypt, decrypt, isEncrypted } from "./crypto";

export const PUBLIC_KEY_NAME = "SULUK_PUBLIC_KEY";
export const PRIVATE_KEY_NAME = "SULUK_PRIVATE_KEY";

interface Line { kind: "pair" | "raw"; key?: string; value?: string; exported?: boolean; raw?: string }
const PAIR = /^(\s*)(export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

/** Decode a raw RHS into its logical value (handles "double", 'single', and unquoted with inline # comments). */
function decodeValue(rest: string): string {
  rest = rest.trim();
  if (!rest) return "";
  const q = rest[0];
  if (q === '"' || q === "'") {
    let out = ""; let i = 1;
    for (; i < rest.length; i++) {
      const ch = rest[i];
      if (ch === "\\" && q === '"' && i + 1 < rest.length) { const n = rest[++i]; out += n === "n" ? "\n" : n === "t" ? "\t" : n === "r" ? "\r" : n; continue; }
      if (ch === q) break;
      out += ch;
    }
    return out;
  }
  const hash = rest.search(/\s+#/); // an inline comment after an unquoted value
  return (hash >= 0 ? rest.slice(0, hash) : rest).trim();
}

/** Encode a logical value as a double-quoted, escaped RHS (always quoted — safe for any plaintext or token). */
function encodeValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")}"`;
}

function parse(content: string): Line[] {
  return content.split(/\r?\n/).map((raw): Line => {
    const m = PAIR.exec(raw);
    if (!m || raw.trimStart().startsWith("#")) return { kind: "raw", raw };
    return { kind: "pair", key: m[3], value: decodeValue(m[4]), exported: Boolean(m[2]) };
  });
}

function stringify(lines: Line[]): string {
  return lines.map((l) => l.kind === "raw" ? (l.raw ?? "") : `${l.exported ? "export " : ""}${l.key}=${encodeValue(l.value ?? "")}`).join("\n");
}

/** Parse .env content → an ordered { key, value } record (raw values; encrypted ones stay as tokens). */
export function parseEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of parse(content)) if (l.kind === "pair" && l.key) out[l.key] = l.value ?? "";
  return out;
}

const isKeyVar = (k?: string) => k === PUBLIC_KEY_NAME || k === PRIVATE_KEY_NAME;

/**
 * Encrypt every plaintext value in the content to `publicKey`, leaving already-encrypted values + the key vars +
 * comments untouched, and ensuring the SULUK_PUBLIC_KEY line is present. Returns the new file content.
 * `only` restricts which keys get encrypted (default: all). `skipPlain` leaves listed keys as plaintext.
 */
export async function encryptContent(content: string, publicKey: string, opts: { only?: string[]; skipPlain?: string[] } = {}): Promise<string> {
  const lines = parse(content);
  const skip = new Set(opts.skipPlain ?? []);
  const only = opts.only ? new Set(opts.only) : null;
  let hasPub = false;
  for (const l of lines) {
    if (l.kind !== "pair" || !l.key) continue;
    if (l.key === PUBLIC_KEY_NAME) { l.value = publicKey; hasPub = true; continue; }
    if (isKeyVar(l.key) || skip.has(l.key) || (only && !only.has(l.key)) || isEncrypted(l.value ?? "") || (l.value ?? "") === "") continue;
    l.value = await encrypt(publicKey, l.value ?? "");
  }
  if (!hasPub) lines.unshift({ kind: "pair", key: PUBLIC_KEY_NAME, value: publicKey }, { kind: "raw", raw: "" });
  return stringify(lines);
}

/** Decrypt every encrypted value in the content with `privateKey` → plaintext file content (for inspection). */
export async function decryptContent(content: string, privateKey: string): Promise<string> {
  const lines = parse(content);
  for (const l of lines) if (l.kind === "pair" && l.key && !isKeyVar(l.key) && isEncrypted(l.value ?? "")) l.value = await decrypt(privateKey, l.value!);
  return stringify(lines);
}

/**
 * Resolve .env content to a plain { KEY: value } record with every encrypted value DECRYPTED. The runtime
 * primitive: a Worker calls this with the committed .env text + the private key from a secret binding; a CLI
 * calls it with the file + .env.keys. The key vars (SULUK_PUBLIC_KEY/PRIVATE_KEY) are never emitted.
 */
export async function resolveEnv(content: string, privateKey?: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const l of parse(content)) {
    if (l.kind !== "pair" || !l.key || isKeyVar(l.key)) continue;
    const v = l.value ?? "";
    if (isEncrypted(v)) {
      if (!privateKey) throw new Error(`@suluk/env: ${l.key} is encrypted but no private key was provided (set ${PRIVATE_KEY_NAME})`);
      out[l.key] = await decrypt(privateKey, v);
    } else out[l.key] = v;
  }
  return out;
}
