/**
 * The principal extractor — the loop-closer for per-viewer docs. A Better Auth session (its user role,
 * granted permissions, or an apiKey's scopes) is mapped to a { scopes } principal that @suluk/hono's
 * emitV4(routes, { principal }) uses to project the doc each viewer is allowed to see.
 */

export interface Principal {
  scopes: string[];
}

/** A minimal view of a Better Auth session (duck-typed; works with the real Session shape). */
export interface SessionLike {
  user?: { role?: string | string[]; scopes?: string[] } | null;
  /** apiKey plugin: a key carries its own permissions/scopes. */
  apiKey?: { scopes?: string[]; permissions?: Record<string, string[]> } | null;
  scopes?: string[];
  /** twoFactor plugin: the session has cleared its second factor ⇒ the `mfa:verified` scope (Phase 1). */
  twoFactorVerified?: boolean;
  /** organization plugin: memberships → `org:<id>:<scope>` scopes (Phase 1, tenancy via scope-encoding). */
  organizations?: { id: string; role?: string; scopes?: string[] }[];
}

export interface PrincipalOptions {
  /** Map a role name → the scopes it grants (e.g. { admin: ["read:*","write:*"], user: ["read:self"] }). */
  roleScopes?: Record<string, string[]>;
  /** Map an ORG role → the scopes it grants WITHIN an org (each namespaced to `org:<id>:<scope>`). */
  orgRoleScopes?: Record<string, string[]>;
}

/** The scope a route requires to be sure the caller cleared their second factor (twoFactor plugin). */
export const MFA_SCOPE = "mfa:verified" as const;

/** Build the org-namespaced scope `org:<orgId>:<action>` (the tenancy encoding). */
export function orgScope(orgId: string, action: string): string {
  return `org:${orgId}:${action}`;
}

/** Parse an `org:<id>:<action>` scope back into its parts (null if it isn't one). */
export function parseOrgScope(scope: string): { orgId: string; action: string } | null {
  const m = /^org:([^:]+):(.+)$/.exec(scope);
  return m ? { orgId: m[1], action: m[2] } : null;
}

/**
 * Extract a { scopes } principal from a Better Auth session. Null/undefined session ⇒ anonymous (no scopes).
 * Beyond the user/apiKey scopes, it encodes MFA + org state AS scopes (Phase 1): a 2FA-cleared session gains
 * `mfa:verified`, and each org membership contributes `org:<id>:<scope>` (explicit + role-mapped) — so a route
 * gates 2FA/tenancy through the same scope check enforceAccess already does, no richer Principal type required.
 */
export function principalFromSession(session: SessionLike | null | undefined, opts: PrincipalOptions = {}): Principal {
  if (!session) return { scopes: [] };
  const scopes = new Set<string>();
  for (const s of session.scopes ?? []) scopes.add(s);
  for (const s of session.user?.scopes ?? []) scopes.add(s);
  for (const s of session.apiKey?.scopes ?? []) scopes.add(s);
  for (const list of Object.values(session.apiKey?.permissions ?? {})) for (const s of list) scopes.add(s);

  const roles = session.user?.role;
  const roleList = Array.isArray(roles) ? roles : roles ? [roles] : [];
  for (const role of roleList) for (const s of opts.roleScopes?.[role] ?? []) scopes.add(s);

  // MFA state → scope (the twoFactor plugin)
  if (session.twoFactorVerified) scopes.add(MFA_SCOPE);

  // org memberships → org-namespaced scopes (the organization plugin)
  for (const org of session.organizations ?? []) {
    for (const s of org.scopes ?? []) scopes.add(orgScope(org.id, s));
    if (org.role) for (const s of opts.orgRoleScopes?.[org.role] ?? []) scopes.add(orgScope(org.id, s));
  }

  return { scopes: [...scopes] };
}
