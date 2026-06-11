/**
 * The v4-ONLY facets a 3.x renderer structurally cannot express — the product of @suluk/reference:
 *   • COST     (x-suluk-cost)   — per-operation declared cost by source, a coverage rollup, declared-vs-actual drift
 *   • ACCESS   (x-suluk-access) — who can reach an operation → the "View-as" projection (crossCut)
 *   • SIGNATURE (ADA, C003/§A)  — the three-valued collision verdict over requests that share a method on a path
 *
 * Pure functions over the v4 document (no DOM) so they're testable in isolation; index.ts renders their output.
 */
import type { OpenAPIv4Document, Request as V4Request } from "@suluk/core";
import { computeSignature, collide, type CollisionVerdict } from "@suluk/core";

export function escapeHtml(s: string): string {
  // escape ' too — several attributes are single-quoted (data-copy='<json>'), and a JSON value can contain an apostrophe.
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// ── COST ─────────────────────────────────────────────────────────────────────────────────────────────────────
export interface CostComponent { source?: string; basis?: string; microUsd?: number }
/** C024 — the cost facet may declare a non-synchronous trigger (the cost accrues on a background event). */
export interface CostModel { estimateMicroUsd?: number; components?: CostComponent[]; trigger?: string; triggerRef?: string; attribution?: { strategy?: string; expression?: string } }

export function fmtUsd(microUsd: number): string {
  const usd = microUsd / 1_000_000;
  return usd >= 0.01 ? `$${usd.toFixed(2)}` : usd >= 0.0001 ? `$${usd.toFixed(6).replace(/0+$/, "")}` : `${Math.round(microUsd)} µ$`;
}

export function costEstimate(cost: CostModel | undefined): number | null {
  if (!cost) return null;
  if (cost.estimateMicroUsd != null) return Number(cost.estimateMicroUsd);
  if (cost.components?.length) return cost.components.reduce((s, c) => s + Number(c.microUsd ?? 0), 0);
  return null;
}

/** A human label for a cost's trigger when it is a BACKGROUND event (null for the synchronous default). C024. */
export function costTriggerLabel(cost: CostModel | undefined): string | null {
  const t = cost?.trigger;
  if (!t || t === "synchronous") return null;
  const noun = { "webhook-received": "incoming webhook", "scheduled": "scheduled job", "queue-consumed": "queue message", "callback-completed": "callback" }[t] ?? t;
  return `charged on: ${noun}${cost?.triggerRef ? ` (${cost.triggerRef})` : ""}`;
}

/** Document-wide cost coverage: how many operations declare a cost, how many don't, and the total estimate.
 *  Walks paths AND webhooks (C024) — a background cost lives on a webhook op, so it must roll into the total. */
export interface CostRollup { priced: number; undeclared: number; totalMicroUsd: number; deferred: number }
export function costRollup(doc: OpenAPIv4Document): CostRollup {
  let priced = 0, undeclared = 0, totalMicroUsd = 0, deferred = 0;
  const count = (req: unknown) => {
    const cost = (req as Record<string, unknown>)["x-suluk-cost"] as CostModel | undefined;
    const est = costEstimate(cost);
    if (est == null) { undeclared++; return; }
    priced++; totalMicroUsd += est;
    if (cost?.trigger && cost.trigger !== "synchronous") deferred++;
  };
  for (const pi of Object.values(doc.paths ?? {})) {
    for (const req of Object.values((pi as { requests?: Record<string, V4Request> }).requests ?? {})) count(req);
  }
  for (const req of Object.values((doc as { webhooks?: Record<string, V4Request> }).webhooks ?? {})) count(req);
  return { priced, undeclared, totalMicroUsd, deferred };
}

// ── ACCESS → the View-as projection ──────────────────────────────────────────────────────────────────────────
/** Access as a contract facet: who can REACH an operation. Annotated on each request as x-suluk-access. */
export interface AccessFacet { requires?: "anyone" | "authenticated" | "admin"; scope?: "owner" }
/** A viewer the reference can project the surface for. */
export interface Viewer { id: string; label: string; authenticated: boolean; admin: boolean }
export const DEFAULT_VIEWERS: Viewer[] = [
  { id: "anon", label: "Anonymous", authenticated: false, admin: false },
  { id: "user", label: "Signed-in user", authenticated: true, admin: false },
  { id: "admin", label: "Admin", authenticated: true, admin: true },
];

export type ReachState = "full" | "scoped" | "none";
/**
 * Three-valued reachability — `full` (●), `scoped` (◐, reachable but restricted to the caller's OWN rows), or
 * `none` (·). Honest about owner-scoping: a signed-in user can call an owner-scoped op, but only over their own
 * data — not the same as full access. (The View-as lens treats full+scoped as "shown", none as "hidden".)
 */
export function reachState(facet: AccessFacet | undefined, v: Viewer): ReachState {
  switch (facet?.requires ?? "anyone") {
    case "anyone": return "full";
    case "authenticated": return v.authenticated ? (facet?.scope === "owner" && !v.admin ? "scoped" : "full") : "none";
    case "admin": return v.admin ? "full" : "none";
    default: return "full";
  }
}
/** Can a viewer reach an operation at all (full OR scoped)? Drives the View-as lens hide/show. */
export function reachable(facet: AccessFacet | undefined, v: Viewer): boolean { return reachState(facet, v) !== "none"; }

export interface CrossCutRow { path: string; name: string; method: string; requires: string; scope?: string; reach: Record<string, ReachState> }
/** The reachability matrix: every operation × every viewer. The projection made explicit (the contract refracted). */
export function crossCut(doc: OpenAPIv4Document, viewers: Viewer[] = DEFAULT_VIEWERS): { viewers: Viewer[]; rows: CrossCutRow[] } {
  const rows: CrossCutRow[] = [];
  for (const [path, piRaw] of Object.entries(doc.paths ?? {})) {
    const pi = piRaw as { requests?: Record<string, V4Request> };
    for (const [name, req] of Object.entries(pi.requests ?? {})) {
      const facet = (req as unknown as Record<string, unknown>)["x-suluk-access"] as AccessFacet | undefined;
      rows.push({ path, name, method: req.method.toLowerCase(), requires: facet?.requires ?? "anyone", scope: facet?.scope, reach: Object.fromEntries(viewers.map((v) => [v.id, reachState(facet, v)])) });
    }
  }
  return { viewers, rows };
}

// ── SIGNATURE → the collision diagnostic (ADA, C003/§A) ──────────────────────────────────────────────────────
export interface CollisionNote { a: string; b: string; verdict: CollisionVerdict; reason: string }
/**
 * For a path's request set, the pairwise collision verdicts that are NOT provably-disjoint — the three-valued
 * question 3.x never had to ask (path+method is always unique there). Empty when the set is cleanly disjoint.
 */
export function collisionsFor(uriTemplate: string, requests: Record<string, V4Request>): CollisionNote[] {
  const entries = Object.entries(requests);
  const sigs = entries.map(([name, req]) => ({ name, tuple: computeSignature(uriTemplate, req).tuple, req }));
  const notes: CollisionNote[] = [];
  for (let i = 0; i < sigs.length; i++) {
    for (let j = i + 1; j < sigs.length; j++) {
      const verdict = collide(sigs[i].tuple, sigs[j].tuple);
      if (verdict === "provably-disjoint") continue;
      const ct = (m: V4Request["contentType"]) => (m == null ? "*" : Array.isArray(m) ? m.join("/") : m);
      const reason = verdict === "provable-collision"
        ? `both resolve identically (${sigs[i].tuple.method} · ${ct(sigs[i].req.contentType)})`
        : `share ${sigs[i].tuple.method}; disambiguation is body/query-dependent (decided at runtime)`;
      notes.push({ a: sigs[i].name, b: sigs[j].name, verdict, reason });
    }
  }
  return notes;
}

export type { CollisionVerdict };
