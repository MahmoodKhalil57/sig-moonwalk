/**
 * Scope-aware API-key verification (saastarter-parity Phase 0). Closes the key-auth hole the advisory-facet model
 * leaves: @suluk/hono's enforceAccess works off a `{ scopes }` Principal, but only `principalFromSession` produced
 * one — a caller authenticating with an API KEY had no Principal, so a scope-gated op was unreachable-or-undefended
 * for key auth. `verifyApiKey` wraps Better Auth's server `verifyApiKey` and returns the SAME `{ scopes }` Principal,
 * so enforceAccess / createGuard gate key callers and session callers identically.
 *
 * Ported from saastarter src/lib/api-key/ (scopes.ts, metadata.ts) + the scope-check in services/auth.ts:133-147.
 */
import type { Principal } from "./principal";

/** Metadata stored on a key for delegation tracking (saastarter metadata.ts:4-8). */
export interface ApiKeyMetadata {
  parentKeyId?: string;
  parentKeyName?: string;
  createdVia?: "delegation";
}

/**
 * Safely parse key metadata, handling Better Auth's potential DOUBLE-stringification of the JSON field.
 * Ported verbatim from saastarter metadata.ts:14-39 (the double-JSON.parse guard is load-bearing — without it a
 * double-stringified blob silently reads as a string, not the object).
 */
export function parseApiKeyMetadata(raw: unknown): ApiKeyMetadata | null {
  if (!raw) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as ApiKeyMetadata;
  if (typeof raw === "string") {
    try {
      let parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "string") parsed = JSON.parse(parsed); // double-stringified
      if (typeof parsed === "object" && parsed && !Array.isArray(parsed)) return parsed as ApiKeyMetadata;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Flat scopes → Better Auth permissions. `["cart:read","cart:write"]` → `{ cart: ["read","write"] }`.
 * Ported from saastarter scopes.ts:150-161 — `split(":")` destructures only the first two segments, so a malformed
 * `"a:b:c"` yields `{ a: ["b"] }` and a segment-less `"x"` is skipped (no action). Faithful to saastarter semantics.
 */
export function scopesToPermissions(scopes: string[]): Record<string, string[]> {
  const perms: Record<string, string[]> = {};
  for (const scope of scopes) {
    const [resource, action] = scope.split(":");
    if (!resource || !action) continue;
    (perms[resource] ??= []).push(action);
  }
  return perms;
}

/**
 * Better Auth permissions → flat scopes. `{ cart: ["read","write"] }` → `["cart:read","cart:write"]`.
 * DEVIATION from saastarter scopes.ts:167-179 (receipted): the `if (scope in API_SCOPES)` catalog filter is REMOVED.
 * The scope catalog is APP-domain vocabulary (saastarter's ecommerce products/cart/orders), not auth machinery —
 * baking a fixed catalog into a candidate-spec package would couple it to one app's domain. An app that wants
 * catalog-validation filters the result against its own catalog. Lowered ceiling: this is reusable-primitive intent,
 * not a behavioral port.
 */
export function permissionsToScopes(perms: Record<string, string[]> | null | undefined): string[] {
  if (!perms) return [];
  const scopes: string[] = [];
  for (const [resource, actions] of Object.entries(perms)) {
    for (const action of actions ?? []) scopes.push(`${resource}:${action}`);
  }
  return scopes;
}

/** A duck-typed view of Better Auth's server `verifyApiKey` (the app injects `betterAuth.api`). */
export interface ApiKeyVerifierLike {
  verifyApiKey(args: { body: { key: string; permissions?: Record<string, string[]> } }): Promise<{
    valid: boolean;
    error?: { message?: string; code?: string } | null;
    key?: { id?: string; userId?: string; name?: string; permissions?: Record<string, string[]> | null; metadata?: unknown } | null;
  }>;
}

export type VerifyReason = "invalid" | "insufficient_scope" | "error";

/** The verified key's identity surface (metadata parsed via the double-stringification guard). */
export interface VerifiedKey {
  id?: string;
  userId?: string;
  name?: string;
  metadata: ApiKeyMetadata | null;
}

export interface VerifyApiKeyResult {
  ok: boolean;
  /** why verification failed (absent on success). */
  reason?: VerifyReason;
  /** the `{ scopes }` Principal — the SAME shape principalFromSession returns, so enforceAccess works identically. */
  principal?: Principal;
  key?: VerifiedKey;
}

export interface VerifyApiKeyOptions {
  /** require the key to carry these scopes (checked in the SAME call via Better Auth `permissions`, services/auth.ts:133-147). */
  requireScopes?: string[];
}

/**
 * Verify an API key (optionally requiring scopes) and return a `{ scopes }` Principal.
 *
 * DEVIATION from saastarter (receipted): saastarter never derives IDENTITY from `verifyApiKey` — identity comes from
 * the session, and `verifyApiKey` is used ONLY to check scopes (services/auth.ts:133-147). Suluk's key-auth-only
 * path uses the verified key's `userId` + `permissions` AS the Principal — an invented composition for stateless API
 * callers that have no session. Result-returning (not throwing) to match the package idiom (preview.ts/principal.ts).
 */
export async function verifyApiKey(
  verifier: ApiKeyVerifierLike,
  key: string,
  opts: VerifyApiKeyOptions = {},
): Promise<VerifyApiKeyResult> {
  const want = opts.requireScopes?.length ? scopesToPermissions(opts.requireScopes) : undefined;
  let res: Awaited<ReturnType<ApiKeyVerifierLike["verifyApiKey"]>>;
  try {
    res = await verifier.verifyApiKey({ body: want ? { key, permissions: want } : { key } });
  } catch {
    return { ok: false, reason: "error" };
  }
  if (!res?.valid || !res.key) {
    // best-effort: distinguish a scope failure from a bad key via the error code/message (only when scopes were required).
    const code = `${res?.error?.code ?? ""} ${res?.error?.message ?? ""}`;
    if (want && /scope|permission|forbidden/i.test(code)) return { ok: false, reason: "insufficient_scope" };
    return { ok: false, reason: "invalid" };
  }
  return {
    ok: true,
    principal: { scopes: permissionsToScopes(res.key.permissions) },
    key: { id: res.key.id, userId: res.key.userId, name: res.key.name, metadata: parseApiKeyMetadata(res.key.metadata) },
  };
}
