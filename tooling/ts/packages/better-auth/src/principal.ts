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
}

export interface PrincipalOptions {
  /** Map a role name → the scopes it grants (e.g. { admin: ["read:*","write:*"], user: ["read:self"] }). */
  roleScopes?: Record<string, string[]>;
}

/** Extract a { scopes } principal from a Better Auth session. Null/undefined session ⇒ anonymous (no scopes). */
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

  return { scopes: [...scopes] };
}
