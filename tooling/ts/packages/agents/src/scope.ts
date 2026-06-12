/**
 * Scope analysis (C027 security red-line) — least-privilege by construction. A child agent's EFFECTIVE scope is the
 * INTERSECTION of its declared scope and its caller's, NEVER the union: scope cannot ESCALATE across a parent→child
 * hop. This makes the confused-deputy structurally impossible (a child can't reach a tool its caller-chain doesn't
 * grant), and the FULL reachable authz surface is computable from the document with zero requests. `null` = an
 * unconstrained scope (no `scope` declared) — it inherits the caller's; intersection with `null` is the other set.
 */
import type { OpenAPIv4Document } from "@suluk/core";
import { agentMap, childKeys } from "./resolve";

export type Scope = string[] | null;

/** INTERSECTION with null-as-unconstrained: ∩(null, X)=X, ∩(X, null)=X, ∩(X, Y)=X∩Y. */
export const intersectScope = (a: Scope, b: Scope): Scope =>
  a === null ? b : b === null ? a : a.filter((x) => b.includes(x));

export interface ScopeEscalation {
  /** the agent whose declared grant is exceeded by a child. */
  parent: string;
  /** the local handle of the offending sub-agent. */
  childLocal: string;
  /** the resolved child agent key. */
  child: string;
  /** the permissions the child declares that the parent does NOT grant (silently dropped under intersection). */
  perms: string[];
}

/**
 * Walk the agent tree from `root`, computing each reachable node's effective (intersected) scope and every per-edge
 * escalation. Cycle-guarded (lint rejects cycles independently); on a DAG/tree each node's effective is its first
 * reaching path's intersection — sufficient for the shallow agent graphs C027 ships.
 */
export function analyzeScopes(doc: OpenAPIv4Document, root: string): { effective: Record<string, Scope>; escalations: ScopeEscalation[] } {
  const map = agentMap(doc);
  const effective: Record<string, Scope> = {};
  const escalations: ScopeEscalation[] = [];
  const seen = new Set<string>();

  const walk = (key: string, callerEff: Scope) => {
    const agent = map[key];
    if (!agent || seen.has(key)) return;
    seen.add(key);
    const declared: Scope = agent.scope ?? null;
    const myEff = intersectScope(declared, callerEff);
    effective[key] = myEff;
    for (const c of childKeys(agent)) {
      if (!c.key || !map[c.key]) continue;
      const childDeclared: Scope = map[c.key].scope ?? null;
      if (childDeclared !== null && myEff !== null) {
        const over = childDeclared.filter((p) => !myEff.includes(p));
        if (over.length) escalations.push({ parent: key, childLocal: c.local, child: c.key, perms: over });
      }
      walk(c.key, myEff);
    }
  };
  walk(root, null);
  return { effective, escalations };
}

/**
 * A LOCAL author-time escalation check for one agent's direct children: a child may not DECLARE a permission its
 * immediate parent does not grant (under intersection it would be silently dropped — flag the author's confusion /
 * a confused-deputy attempt). Used by the linter; the transitive picture is {@link analyzeScopes}.
 */
export function localEscalations(doc: OpenAPIv4Document, agentName: string): ScopeEscalation[] {
  const map = agentMap(doc);
  const parent = map[agentName];
  if (!parent || parent.scope === undefined) return []; // unconstrained parent grants everything → no escalation
  const grant = parent.scope;
  const out: ScopeEscalation[] = [];
  for (const c of childKeys(parent)) {
    const child = c.key ? map[c.key] : undefined;
    if (!child || !child.scope) continue;
    const over = child.scope.filter((p) => !grant.includes(p));
    if (over.length) out.push({ parent: agentName, childLocal: c.local, child: c.key!, perms: over });
  }
  return out;
}
