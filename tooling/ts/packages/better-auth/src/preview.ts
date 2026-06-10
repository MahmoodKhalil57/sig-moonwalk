/**
 * previewLoginHandler — the ONE credentialed surface in the whole cockpit, and the only place a session is
 * minted for role-preview (the LAST roadmap slice, charter-bounded by C020). It runs INSIDE the generated
 * PREVIEW Worker, never in the IDE: the extension merely deep-links `GET /preview/login?role=…` in the system
 * browser, so no auth token ever lives in the editor.
 *
 * It is FAIL-CLOSED behind TWO INDEPENDENT LOCKS — both must say "preview":
 *   1. a deploy-time var  `env.SULUK_PREVIEW === "1"`   (a prod wrangler config never sets it)
 *   2. a binding          `env.PREVIEW_DB` is present    (a D1 only the preview deploy declares; prod has none)
 * Absence of EITHER ⇒ 404, as if the route did not exist. A prod deploy that copy-pastes the var still lacks
 * the binding; a stray binding without the var still 404s. The role is decided SERVER-SIDE from the verified
 * gate + the request's `role` query param checked against an allow-list — never a client-trusted header, and
 * the session binds ONLY to a seeded throwaway demo user (the injected mintSession owns that lookup), never a
 * real row. Dependency-injected (env, allowedRoles, mintSession, now) so it is hermetically unit-testable with
 * a plain Request + a fake env — no Worker, no D1, no wrangler, no creds.
 *
 * TTL / single-use is the deployed Worker's Better Auth SESSION policy (a preview session should be short and
 * the env ephemeral) — not a Suluk artifact; previewDeployPlan's DEPLOY.md notes it and the teardown. This
 * handler owns the GATE + the role-binding, which is Suluk's responsibility.
 */

/** A minimal view of the Worker request — only `.url` (to read the `role` query param) is needed. Web `Request` satisfies it. */
export interface PreviewRequestLike {
  url: string;
}

/** The two independent locks live on the Worker env: a var and a binding. Duck-typed; extra keys ignored. */
export interface PreviewEnvLike {
  /** lock 1 — the deploy-time preview flag. */
  SULUK_PREVIEW?: string;
  /** lock 2 — a D1 binding only the preview deploy declares (presence is the lock; we never read prod's DB here). */
  PREVIEW_DB?: unknown;
}

/** What a successful mint returns: the headers to set on the redirect (e.g. the session Set-Cookie). */
export interface MintedSession {
  setCookie: string;
}

export interface PreviewLoginOptions {
  /** The roles a preview may assume — derive from the contract (cockpit previewRoles), NEVER a hardcoded list.
   *  A requested role MUST be a member; "anonymous" is handled by the launcher (it opens the app with no login). */
  allowedRoles: string[];
  /** Establish a role-scoped session for the SEEDED demo user of `role` (looks it up in env.PREVIEW_DB).
   *  This is the only code that touches a session; it must bind to a seeded throwaway row, never a real user. */
  mintSession: (role: string) => MintedSession | Promise<MintedSession>;
  /** Where to land after login (default "/"). */
  redirectTo?: string;
}

/** True iff BOTH independent locks say "preview". Exported so callers/tests can assert the gate in isolation. */
export function isPreviewRuntime(env: PreviewEnvLike): boolean {
  return env.SULUK_PREVIEW === "1" && env.PREVIEW_DB != null;
}

/**
 * Handle `GET /preview/login?role=…`. Fail-closed: 404 unless both locks pass; 403 for a role not in the
 * allow-list; else mint the seeded demo session and 302 to the app. Never throws on a hostile request.
 */
export async function previewLoginHandler(
  req: PreviewRequestLike,
  env: PreviewEnvLike,
  opts: PreviewLoginOptions,
): Promise<Response> {
  // LOCK: both must say preview, or the route does not exist. Checked FIRST — before reading any client input —
  // so a forged ?role= or x-role header can never reach the mint path on a non-preview deploy.
  if (!isPreviewRuntime(env)) return new Response("not found", { status: 404 });

  let role = "";
  try { role = new URL(req.url).searchParams.get("role") ?? ""; } catch { role = ""; }

  // "anonymous" is login-less by definition — never a mintable session, regardless of the allow-list (the launcher
  // opens the app with no login for anonymous). Reject it explicitly so a caller can never mint an "anonymous" user.
  if (role === "anonymous") return new Response("anonymous is not a preview login", { status: 403 });
  // the role must be one the contract declares; membership is the only thing trusted from the client.
  if (!opts.allowedRoles.includes(role)) return new Response("unknown preview role", { status: 403 });

  const minted = await opts.mintSession(role); // binds to the SEEDED demo user for `role` (mintSession owns the lookup)
  return new Response(null, {
    status: 302,
    headers: { Location: opts.redirectTo ?? "/", "Set-Cookie": minted.setCookie },
  });
}
