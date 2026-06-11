/**
 * @suluk/env — config + secrets as a single source of truth, made post-quantum-safe.
 *
 * Declare each variable ONCE with defineEnv (typed, per-surface, secret-aware); encrypt secret VALUES with
 * ML-KEM-768 + AES-256-GCM so the .env is safe to commit to git and share over public channels; and project the
 * one declaration into every surface — local, Cloudflare, preview, a teammate's machine, the VS Code extension,
 * the admin panel. dotenvx's commit-safely model, quantum-safe, Suluk-native.
 *
 * This entry is RUNTIME-AGNOSTIC (Web Crypto + @noble/post-quantum only — no node:fs), so it imports cleanly in
 * a Cloudflare Worker. Filesystem helpers + the CLI live in `@suluk/env/node`.
 */
export { keygen, encrypt, decrypt, isEncrypted, publicFromPrivate, SCHEME, type Keypair } from "./crypto";
export { parseEnv, resolveEnv, encryptContent, decryptContent, PUBLIC_KEY_NAME, PRIVATE_KEY_NAME } from "./envfile";
export { loadEnv, type LoadOptions } from "./load";
export { defineEnv, type EnvSpec, type VarSpec, type Surface, type DefinedEnv, type ManifestEntry, type HealthStatus, type Parsed } from "./schema";
