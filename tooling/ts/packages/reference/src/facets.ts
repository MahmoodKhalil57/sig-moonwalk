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
export interface CostModel { estimateMicroUsd?: number; components?: CostComponent[] }

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

/** Document-wide cost coverage: how many operations declare a cost, how many don't, and the total estimate. */
export interface CostRollup { priced: number; undeclared: number; totalMicroUsd: number }
export function costRollup(doc: OpenAPIv4Document): CostRollup {
  let priced = 0, undeclared = 0, totalMicroUsd = 0;
  for (const pi of Object.values(doc.paths ?? {})) {
    for (const req of Object.values((pi as { requests?: Record<string, V4Request> }).requests ?? {})) {
      const est = costEstimate((req as unknown as Record<string, unknown>)["x-suluk-cost"] as CostModel | undefined);
      if (est == null) undeclared++; else { priced++; totalMicroUsd += est; }
    }
  }
  return { priced, undeclared, totalMicroUsd };
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

/** Can a viewer reach an operation, given its access facet? An absent facet means public (reachable by all). */
export function reachable(facet: AccessFacet | undefined, v: Viewer): boolean {
  switch (facet?.requires ?? "anyone") {
    case "anyone": return true;
    case "authenticated": return v.authenticated;
    case "admin": return v.admin;
    default: return true;
  }
}

export interface CrossCutRow { path: string; name: string; method: string; requires: string; scope?: string; reach: Record<string, boolean> }
/** The reachability matrix: every operation × every viewer. The projection made explicit (the contract refracted). */
export function crossCut(doc: OpenAPIv4Document, viewers: Viewer[] = DEFAULT_VIEWERS): { viewers: Viewer[]; rows: CrossCutRow[] } {
  const rows: CrossCutRow[] = [];
  for (const [path, piRaw] of Object.entries(doc.paths ?? {})) {
    const pi = piRaw as { requests?: Record<string, V4Request> };
    for (const [name, req] of Object.entries(pi.requests ?? {})) {
      const facet = (req as unknown as Record<string, unknown>)["x-suluk-access"] as AccessFacet | undefined;
      rows.push({ path, name, method: req.method.toLowerCase(), requires: facet?.requires ?? "anyone", scope: facet?.scope, reach: Object.fromEntries(viewers.map((v) => [v.id, reachable(facet, v)])) });
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
