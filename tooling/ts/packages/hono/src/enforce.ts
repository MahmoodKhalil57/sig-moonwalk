/**
 * ENFORCEMENT — the reusable server-side authz primitive (saastarter-parity roadmap, Phase 0).
 *
 * Suluk's facets are ADVISORY; the server is the only authz boundary (C022 inv.3). For CRUD routes the
 * derivation engine can scope rows, but CUSTOM operations are raw handlers — so without a shared primitive an
 * `x-suluk-access` facet on a custom op is DECORATIVE: nothing makes the wire honor it. This module is that
 * primitive, in two shapes:
 *
 *   • `enforceAccess(cfg)` — ONE facet-driven middleware: for each request it resolves the operation, reads its
 *     declared `x-suluk-access`, and enforces it on the wire (anon → 401 on a non-public op; wrong scope → 403).
 *     Applied once, it makes EVERY operation's access facet load-bearing — the contract-first way to close the
 *     "facet is decorative on custom ops" gap. Row-level `scope: "owner"` stays the app's concern (the CRUD
 *     factory filters rows); this enforces the requires-LEVEL (anyone < authenticated < admin) + named scopes.
 *   • `createGuard(cfg)` — explicit per-route middlewares (`requireAuth` / `requireAdmin` / `requireScopes(...)`)
 *     for apps that want to gate specific routes by hand, or that have no ADA to match against.
 *
 * Identity is INJECTED (the app knows its own principal/scope model — Better Auth session, API token, etc.), so
 * the primitive is generic over any Suluk app. It never trusts a header it didn't verify; the app's `principal`
 * / `isAdmin` callbacks are responsible for verification.
 */
import type { Context, MiddlewareHandler } from "hono";

export type AccessRequires = "anyone" | "authenticated" | "admin";
export interface AccessFacet { requires?: AccessRequires | string; scope?: string }

/** Read identity from a request — the app supplies these (it owns its principal/scope model). */
export interface IdentityConfig {
  /** the caller's verified principal id, or null/undefined for anonymous. */
  principal: (c: Context) => string | null | undefined;
  /** fast-path admin check (verified). If omitted, the literal "admin" scope is used. */
  isAdmin?: (c: Context) => boolean;
  /** the caller's granted scopes (e.g. ["admin"], ["org:1:read"]). Default: none. */
  scopes?: (c: Context) => string[] | undefined;
}

const PROBLEM = "application/problem+json";
/** A deny response. Shape is RFC-9457-shaped (the error model formalizes `type`); status is what the wire honors. */
function deny(c: Context, status: 401 | 403, scope?: string): Response {
  const body = status === 401
    ? { error: "unauthorized", title: "Unauthorized", status, message: "authentication required" }
    : { error: "forbidden", title: "Forbidden", status, message: scope ? `requires scope: ${scope}` : "insufficient permissions" };
  return c.json(body, status, { "content-type": PROBLEM });
}

function hasScope(cfg: IdentityConfig, c: Context, scope: string): boolean {
  if (scope === "admin" && cfg.isAdmin) return cfg.isAdmin(c);
  return (cfg.scopes?.(c) ?? []).includes(scope);
}

export interface EnforceAccessConfig extends IdentityConfig {
  /** the operation name for this request, or undefined for non-contract paths (static/auth/docs → allowed). */
  operationOf: (c: Context) => string | undefined;
  /** the declared access facet for an operation (e.g. from the document's x-suluk-access). */
  accessOf: (operation: string) => AccessFacet | undefined;
  /**
   * what an operation that declares NO access facet requires. Defaults to "authenticated" — DENY BY DEFAULT, so a
   * dropped/missing facet is a 401 in tests, NEVER a silent public route (a fail-open default is how an annotation
   * gap becomes a live breach). Mark genuinely-public ops explicitly `requires:"anyone"`.
   */
  defaultRequires?: AccessRequires;
}

/** Normalize a wire-supplied `requires` to the CLOSED enum; an unknown/typo'd value is `null` → fail closed. */
function normalizeRequires(raw: string | undefined, fallback: AccessRequires): AccessRequires | null {
  const v = (raw ?? fallback).toLowerCase().trim();
  return v === "anyone" || v === "authenticated" || v === "admin" ? v : null;
}

/**
 * The facet-driven gate. Apply once (after identity is resolved, before the handlers): every operation is then
 * enforced at the level its `x-suluk-access` declares. FAIL-CLOSED throughout — a missing facet denies (deny-by-
 * default), an unknown/mis-cased `requires` denies, and a non-owner `scope` is enforced even when `requires` is
 * "anyone" (a named scope implies authentication). Non-contract paths (operationOf → undefined) pass untouched;
 * a consumer's operationOf MUST be at least as strict as the router and MUST fail closed if it can't resolve.
 */
export function enforceAccess(cfg: EnforceAccessConfig): MiddlewareHandler {
  const fallback = cfg.defaultRequires ?? "authenticated"; // deny by default
  return async (c, next) => {
    const op = cfg.operationOf(c);
    if (!op) return next(); // not a contract operation (static asset, /api/auth, docs) — out of scope
    const facet = cfg.accessOf(op);
    const requires = normalizeRequires(facet?.requires, fallback);
    if (requires === null) return deny(c, 403); // unknown/typo'd level — fail closed, never degrade to authenticated
    // a named (non-owner) scope is a real requirement; row-level "owner" is the app's CRUD concern, not enforced here
    const namedScope = facet?.scope && facet.scope !== "owner" ? facet.scope : undefined;
    if (requires === "anyone" && !namedScope) return next(); // truly public
    if (!cfg.principal(c)) return deny(c, 401);                                    // authenticated / admin / a named scope all need a caller
    if (requires === "admin" && !hasScope(cfg, c, "admin")) return deny(c, 403, "admin");
    if (namedScope && !hasScope(cfg, c, namedScope)) return deny(c, 403, namedScope);
    return next();
  };
}

export interface Guard {
  /** 401 unless a verified principal is present. */
  requireAuth: MiddlewareHandler;
  /** 401 if anonymous, else 403 unless the caller is admin. */
  requireAdmin: MiddlewareHandler;
  /** 401 if anonymous, else 403 unless the caller holds EVERY named scope. */
  requireScopes: (...need: string[]) => MiddlewareHandler;
}

/** Build explicit, hand-applied guards bound to one identity model (for fine-grained per-route gating). */
export function createGuard(cfg: IdentityConfig): Guard {
  const requireAuth: MiddlewareHandler = async (c, next) => (cfg.principal(c) ? next() : deny(c, 401));
  const requireScopes = (...need: string[]): MiddlewareHandler => async (c, next) => {
    if (!cfg.principal(c)) return deny(c, 401);
    for (const s of need) if (!hasScope(cfg, c, s)) return deny(c, 403, s);
    return next();
  };
  return { requireAuth, requireScopes, requireAdmin: requireScopes("admin") };
}
