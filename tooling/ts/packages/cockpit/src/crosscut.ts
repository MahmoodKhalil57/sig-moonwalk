/**
 * The cross-cut (M1) — the moat. The cockpit already projects all 9 layers for ONE viewer (buildCycle's
 * principal filter). This compares ACROSS viewers: one contract, refracted through every principal, so you can
 * see exactly which operations are gated and who can reach them. No other tool can do this, because none owns
 * the derivation. Pure (no host) → unit-tested; the extension renders the matrix.
 */
import { buildAda } from "@suluk/core";
import type { OpenAPIv4Document, Request, SecurityRequirement } from "@suluk/core";

/** A viewer to project for. `scopes: undefined` ⇒ the full/operator view; `[]` ⇒ no scopes.
 *  `authenticated` distinguishes a logged-in viewer from a truly anonymous one — an auth-only operation
 *  (`security: [{ bearer: [] }]`, a requirement with zero scopes) is reachable by any AUTHENTICATED viewer but
 *  NOT by anonymous. (This is more precise than the cockpit's single-principal "View as", which keys on scopes
 *  alone; the cross-cut is the purpose-built security view.) */
export interface Viewer {
  label: string;
  scopes: string[] | undefined;
  /** does this viewer hold a credential? defaults to "holds at least one scope". */
  authenticated?: boolean;
}
export interface ViewerView {
  label: string;
  scopes: string[] | null;
  visible: string[];
  hidden: string[];
}
export interface GatedOp {
  operation: string;
  detail: string;
  /** the scope requirements (OR of AND-groups); empty ⇒ public */
  requiredScopes: string[][];
  /** the labels of the viewers who CAN see it */
  visibleTo: string[];
}
export interface CrossCut {
  operations: { name: string; detail: string }[];
  viewers: ViewerView[];
  /** operations not visible to every viewer — the scope-gated surface */
  gated: GatedOp[];
}

function requiredScopes(req: Request): string[][] {
  const reqs = (req.security as SecurityRequirement[] | undefined) ?? [];
  return reqs.map((r) => Object.values(r).flat());
}
function visibleTo(req: Request, viewer: Viewer): boolean {
  if (viewer.scopes === undefined) return true; // full operator view sees all
  const reqs = requiredScopes(req);
  if (reqs.length === 0) return true; // genuinely public op
  const held = new Set(viewer.scopes);
  const authed = viewer.authenticated ?? viewer.scopes.length > 0; // holding a scope implies a credential
  // a requirement of [] (auth-only, no scope) is satisfied iff authenticated; a scoped requirement needs its scopes
  return reqs.some((needed) => (needed.length === 0 ? authed : needed.every((s) => held.has(s))));
}

/** Every scope referenced by any operation's security requirements (sorted, deduped). */
export function documentScopes(doc: OpenAPIv4Document): string[] {
  return [...new Set(buildAda(doc).operations.flatMap((o) => requiredScopes(o.request).flat()))].sort();
}

/**
 * Sensible default viewers for a document: anonymous, one per declared scope, and the full operator view —
 * so a single command shows the whole gated surface without the user hand-entering scope sets.
 */
export function defaultViewers(doc: OpenAPIv4Document): Viewer[] {
  const ops = buildAda(doc).operations;
  const scopes = [...new Set(ops.flatMap((o) => requiredScopes(o.request).flat()))].sort();
  // only show a distinct "authenticated" viewer when some operation requires auth WITHOUT a scope (else its
  // column would duplicate "anonymous" — a logged-in user with no role sees the same public + scoped surface).
  const hasAuthOnly = ops.some((o) => requiredScopes(o.request).some((r) => r.length === 0));
  return [
    { label: "anonymous", scopes: [], authenticated: false },
    ...(hasAuthOnly ? [{ label: "authenticated", scopes: [] as string[], authenticated: true }] : []),
    ...scopes.map((s) => ({ label: s, scopes: [s], authenticated: true })),
    { label: "full", scopes: undefined },
  ];
}

/** Project the contract through every viewer and surface the gated operations. */
export function crossCut(doc: OpenAPIv4Document, viewers: Viewer[]): CrossCut {
  const ops = buildAda(doc).operations.map((o) => ({ name: o.name, detail: `${o.request.method.toUpperCase()} ${o.pathTemplate}`, req: o.request }));
  const views: ViewerView[] = viewers.map((v) => {
    const visible: string[] = [];
    const hidden: string[] = [];
    for (const o of ops) (visibleTo(o.req, v) ? visible : hidden).push(o.name);
    return { label: v.label, scopes: v.scopes ?? null, visible, hidden };
  });
  const gated: GatedOp[] = [];
  for (const o of ops) {
    const seers = views.filter((v) => v.visible.includes(o.name)).map((v) => v.label);
    if (seers.length !== views.length) {
      gated.push({ operation: o.name, detail: o.detail, requiredScopes: requiredScopes(o.req), visibleTo: seers });
    }
  }
  return { operations: ops.map((o) => ({ name: o.name, detail: o.detail })), viewers: views, gated };
}

/** A principal you can preview the running app AS — derived from the contract, never hardcoded. */
export interface PreviewRole {
  label: string;
  /** the role token passed to the preview deploy's /preview/login?role=… (or "anonymous"). */
  role: string;
  /** the scopes this role implies in the cross-cut (here, just the role itself; the runtime maps role→scopes). */
  scopes: string[];
  authenticated: boolean;
}

/**
 * The previewable principals for live role-preview (the LAST roadmap slice): anonymous, then ONE per role the
 * contract's `User.role` enum declares (the auth module ships ["user","admin","superadmin"]). Pure; degrades
 * HONESTLY to anonymous-only when there is no User.role enum — never a hardcoded role list. The extension turns
 * each into a deep-link to the preview deploy's own login; the cockpit never mints or holds a session.
 */
// the safe identifier charset a previewable role name must match — it flows into a URL, into seed.sql, AND into
// the deployed gate's allow-list, so all three agree on exactly this set. Anything else is not previewable.
const SAFE_ROLE = /^[A-Za-z0-9_-]{1,40}$/;

export function previewRoles(doc: OpenAPIv4Document): PreviewRole[] {
  const anonymous: PreviewRole = { label: "anonymous", role: "anonymous", scopes: [], authenticated: false };
  const user = (doc.components?.schemas as Record<string, unknown> | undefined)?.["User"] as
    | { properties?: { role?: { enum?: unknown } } }
    | undefined;
  const raw = user?.properties?.role?.enum;
  const seen = new Set<string>();
  const roles = (Array.isArray(raw) ? raw : [])
    .filter((r): r is string => typeof r === "string" && r.length > 0)
    // exclude the RESERVED "anonymous" (it is never a mintable session — login-less by definition), apply the safe
    // charset (URL + SQL + gate safety), and DEDUP — so the previewable set == the seeded set == the gate allow-list.
    .filter((r) => r !== "anonymous" && SAFE_ROLE.test(r))
    .filter((r) => (seen.has(r) ? false : (seen.add(r), true)));
  return [anonymous, ...roles.map((r) => ({ label: r, role: r, scopes: [r], authenticated: true }))];
}

/**
 * The roles a preview may be minted AS — the authenticated principals, EXCLUDING the login-less `anonymous`. This
 * is the ONE source for the deployed gate's allow-list AND for which demo users seed.sql seeds; keeping them equal
 * means a role can be previewed iff it is seeded iff the gate allows it (no allow-but-unseedable divergence).
 */
export function previewAllowedRoles(doc: OpenAPIv4Document): string[] {
  return previewRoles(doc).filter((r) => r.authenticated).map((r) => r.role);
}

/**
 * Resolve the browser deep-link for previewing AS a role — the security-critical guard, made PURE so it is
 * unit-testable (the extension package has no test harness). Hard-REFUSES any non-preview env BEFORE producing
 * a URL (INV-08: role-preview can never target prod/local). anonymous ⇒ just the app; a role ⇒ the preview
 * deploy's own gated /preview/login. The extension calls this, then openExternal — it never builds the URL itself.
 */
export function previewLaunchUrl(
  env: { baseUrl: string; isPreview: boolean },
  role: string,
): { refused: true; reason: string } | { refused: false; url: string } {
  if (!env.isPreview) return { refused: true, reason: "not a preview deployment — role-preview is refused on prod/local" };
  const base = env.baseUrl.replace(/\/+$/, "");
  const url = role === "anonymous" ? base : `${base}/preview/login?role=${encodeURIComponent(role)}`;
  return { refused: false, url };
}
