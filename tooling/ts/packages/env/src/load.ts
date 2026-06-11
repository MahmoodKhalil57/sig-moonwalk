/**
 * Runtime injection — resolve encrypted .env content and set it into a target env object (process.env by
 * default). This is the library form of `dotenvx run -- <cmd>`, but it also works INSIDE a Cloudflare Worker:
 * commit the encrypted .env, ship the file's text into the bundle (or a KV/asset), and call loadEnv with the
 * private key from a secret binding — the same one source of truth decrypts on every surface.
 */
import { resolveEnv } from "./envfile";
import { isEncrypted } from "./crypto";

export interface LoadOptions {
  /** the .env file text (with encrypted tokens). */
  content: string;
  /** SULUK_PRIVATE_KEY — required iff any value is encrypted. */
  privateKey?: string;
  /** where to inject (default: process.env when it exists). Pass an object to capture without touching the real env. */
  target?: Record<string, string | undefined>;
  /** overwrite keys already set in the target (default false — a real environment variable wins over the file). */
  override?: boolean;
}

/** Resolve + inject. Returns the decrypted { KEY: value } record that was loaded. */
export async function loadEnv(opts: LoadOptions): Promise<Record<string, string>> {
  const resolved = await resolveEnv(opts.content, opts.privateKey);
  const target = opts.target ?? (typeof process !== "undefined" ? (process.env as Record<string, string | undefined>) : undefined);
  // a real env var wins over the file (override=false), EXCEPT when the target already holds the raw encrypted
  // token (e.g. a runtime that auto-loads .env, like Bun) — a ciphertext is never a usable value, so replace it.
  if (target) for (const [k, v] of Object.entries(resolved)) { const cur = target[k]; if (opts.override || cur === undefined || (typeof cur === "string" && isEncrypted(cur))) target[k] = v; }
  return resolved;
}
