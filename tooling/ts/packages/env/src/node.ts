/**
 * Filesystem helpers — the thin Node/Bun layer over the runtime-agnostic core. Deliberately NOT re-exported by
 * the package's main entry (src/index.ts), so the core (crypto/envfile/load/schema) stays node:fs-free and
 * imports cleanly inside a Cloudflare Worker. The CLI + local dev use this module.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { keygen, publicFromPrivate, isEncrypted, type Keypair } from "./crypto";
import { encryptContent, decryptContent, resolveEnv, parseEnv, PUBLIC_KEY_NAME, PRIVATE_KEY_NAME } from "./envfile";

export interface FileOpts { envPath?: string; keysPath?: string }
const ENV = (o?: FileOpts) => o?.envPath ?? ".env";
const KEYS = (o?: FileOpts) => o?.keysPath ?? ".env.keys";
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

/** The private key, from the SULUK_PRIVATE_KEY env var (wins — for CI/prod) or the .env.keys file. */
export function readPrivateKey(o?: FileOpts): string | undefined {
  return process.env[PRIVATE_KEY_NAME] || parseEnv(read(KEYS(o)))[PRIVATE_KEY_NAME];
}
/** The public key, from the .env file's SULUK_PUBLIC_KEY, else derived from the private key. */
export function readPublicKey(o?: FileOpts): string | undefined {
  const fromFile = parseEnv(read(ENV(o)))[PUBLIC_KEY_NAME];
  if (fromFile) return fromFile;
  const priv = readPrivateKey(o);
  return priv ? publicFromPrivate(priv) : undefined;
}

function writePrivateKey(path: string, privateKey: string): void {
  if (parseEnv(read(path))[PRIVATE_KEY_NAME]) return; // never clobber an existing private key
  const existing = read(path);
  const header = existing ? existing.replace(/\n*$/, "\n") : "#-------------------------------------------------------------\n# Suluk PRIVATE keys — DO NOT COMMIT. Anyone with these can\n# decrypt your secrets. Keep .env.keys gitignored.\n#-------------------------------------------------------------\n";
  writeFileSync(path, `${header}${PRIVATE_KEY_NAME}="${privateKey}"\n`);
}

/** Return the keypair, generating + persisting it on first use (private → .env.keys; public is written into .env by encryptEnvFile). */
export function ensureKeypair(o?: FileOpts): Keypair {
  const priv = readPrivateKey(o);
  if (priv) return { privateKey: priv, publicKey: publicFromPrivate(priv) };
  const kp = keygen();
  writePrivateKey(KEYS(o), kp.privateKey);
  return kp;
}

/**
 * The public key to ENCRYPT with — the existing SULUK_PUBLIC_KEY from .env if present (so a teammate holding ONLY
 * the public key can add/encrypt vars WITHOUT a private key — dotenvx's core property), else generate a keypair.
 */
function encryptKey(o?: FileOpts): string {
  return readPublicKey(o) ?? ensureKeypair(o).publicKey;
}

const writeFile = (p: string, s: string) => writeFileSync(p, s.endsWith("\n") ? s : s + "\n");

/** Encrypt every plaintext value in the .env file in place (using the existing public key, or generating one). */
export async function encryptEnvFile(o?: FileOpts & { skipPlain?: string[] }): Promise<{ publicKey: string }> {
  const publicKey = encryptKey(o);
  writeFile(ENV(o), await encryptContent(read(ENV(o)), publicKey, { skipPlain: o?.skipPlain }));
  return { publicKey };
}

/** Decrypt the .env file → plaintext content (does NOT write — caller decides). Throws if no private key. */
export async function decryptEnvFileToString(o?: FileOpts): Promise<string> {
  const priv = readPrivateKey(o);
  if (!priv) throw new Error(`@suluk/env: no private key (set ${PRIVATE_KEY_NAME} or create ${KEYS(o)})`);
  return decryptContent(read(ENV(o)), priv);
}

/** Set (add or update) one variable in the .env file — encrypted by default, `plain:true` to leave it readable. */
export async function setVar(name: string, value: string, o?: FileOpts & { plain?: boolean }): Promise<void> {
  const publicKey = o?.plain ? "" : encryptKey(o); // plaintext needs no key; otherwise use the existing public key
  const content = read(ENV(o));
  const lines = content.split(/\r?\n/);
  const enc = o?.plain ? value : await (await import("./crypto")).encrypt(publicKey, value);
  const rendered = `${name}="${enc.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const idx = lines.findIndex((l) => new RegExp(`^(export\\s+)?${name}\\s*=`).test(l));
  if (idx >= 0) lines[idx] = rendered; else lines.push(rendered);
  // ensure the public key line is present (so the file is self-describing + the next `set` can find it)
  if (publicKey && name !== PUBLIC_KEY_NAME && !parseEnv(content)[PUBLIC_KEY_NAME]) lines.unshift(`${PUBLIC_KEY_NAME}="${publicKey}"`, "");
  writeFile(ENV(o), lines.join("\n"));
}

/** Resolve the .env (decrypting) and inject into process.env. The local form of `loadEnv`. */
export async function loadEnvFile(o?: FileOpts & { override?: boolean }): Promise<Record<string, string>> {
  const resolved = await resolveEnv(read(ENV(o)), readPrivateKey(o));
  // replace undefined OR an encrypted token already in process.env (Bun auto-loads the raw .env before we run).
  for (const [k, v] of Object.entries(resolved)) { const cur = process.env[k]; if (o?.override || cur === undefined || isEncrypted(cur)) process.env[k] = v; }
  return resolved;
}

/** The raw .env record (encrypted tokens intact) — feed to defineEnv().manifest() for the config-health view. */
export function rawEnvRecord(o?: FileOpts): Record<string, string> {
  return parseEnv(read(ENV(o)));
}
