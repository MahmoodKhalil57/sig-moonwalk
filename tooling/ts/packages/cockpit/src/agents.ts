/**
 * The AGENTS view (C027) — the cockpit's OBSERVE surface for the `x-suluk-agents` composition layer. Pure
 * (no host) → unit-tested; the extension/admin shells render it. STRICTLY OBSERVE: this derives the static tier
 * tree, effective (intersection) scope, the gate findings, the worst-case reachable surface, and a PROJECTION
 * PREVIEW (artifact file/tool NAMES only). It NEVER executes an agent, fetches a preprompt, or touches a
 * credential — agent execution + secrets live outside the cockpit (C020 no-credentials seam / C023 L3 line).
 */
import type { OpenAPIv4Document } from "@suluk/core";
import {
  lintAgents, lintOk, reachableSurface, analyzeScopes, resolveOperationRef,
  agentMap, subAgentKey, effectiveUnderPolicies, policiesFor, lintPolicy,
  type LintFinding, type Scope,
} from "@suluk/agents";

export interface AgentSkillView {
  name: string;
  model: string[];
  tier?: "resident" | "cold-tail";
  /** has a provenance.contentHash ⇒ drift is detectable (the staleness binding). */
  pinned: boolean;
  source?: string;
}
export interface AgentRouteView {
  name: string;
  operationRef: string;
  guarantee?: string;
  /** serving partition: resident (default tool list) vs cold-tail (behind discover_tools). Absent ⇒ resident. */
  tier?: "resident" | "cold-tail";
  /** does the operationRef resolve to a real operation? (false ⇒ a dangling ref, like Conin's MCP-only primitive). */
  resolves: boolean;
}
export interface AgentNodeView {
  name: string;
  description: string;
  /** an orchestrator has sub-agents; a leaf does not (the recursion base case). */
  kind: "orchestrator" | "leaf";
  maxDepth?: number;
  /** scope after INTERSECTION along the reaching path (null = unconstrained). */
  effectiveScope: Scope;
  skills: AgentSkillView[];
  routes: AgentRouteView[];
  subAgents: string[];
  /** worst-case statically-enumerable reach (tools + transitively-reachable sub-agents). */
  reachable: { tools: string[]; agents: string[] };
  /** OBSERVE-only preview of what projection WOULD emit — names, never executed, never credentialed. */
  projection: { pluginFiles: string[]; openRouterTools: string[]; residentTools: string[]; discoverableTools: string[] };
  /** operator governance diff (C028) — present only when an x-suluk-policy governs this agent. */
  governed?: AgentGovernedView;
}
/** The agent-declared vs operator-effective diff + the cost three-number (cap / estimate / actual). Read-only. */
export interface AgentGovernedView {
  effectiveScope: Scope;
  effectiveMaxDepth?: number;
  nestingForbidden: boolean;
  deniedTools: string[];
  deniedSubAgents: string[];
  narrowings: { axis: string; detail: string }[];
  /** the three distinct owners: cap (operator x-suluk-policy, enforced-by-adapter) / estimate (author) / actual (C026 runtime). */
  cost: { cap: string | null; estimate: string | null; actual: string };
}
export interface AgentsView {
  present: boolean;
  agents: AgentNodeView[];
  /** entry-point agents — not referenced as a sub-agent by any other agent. */
  roots: string[];
  findings: LintFinding[];
  /** true ⇒ no error-severity findings across the whole map (the gate). */
  installable: boolean;
}

/** Agents referenced as a sub-agent by someone else (so the complement is the set of roots). */
function referencedChildren(doc: OpenAPIv4Document): Set<string> {
  const ref = new Set<string>();
  for (const a of Object.values(agentMap(doc))) {
    for (const r of Object.values(a.agents ?? {})) {
      const k = subAgentKey(r.ref);
      if (k) ref.add(k);
    }
  }
  return ref;
}

/** The operator-governance diff for one agent (declared vs effective + the cost three-number). */
function governedView(doc: OpenAPIv4Document, agentName: string): AgentGovernedView {
  const { effective, narrowings } = effectiveUnderPolicies(doc, agentName);
  const policy = policiesFor(doc, agentName).find((p) => p.costCeiling);
  const cap = policy?.costCeiling ? `${policy.costCeiling.amount} ${policy.costCeiling.amountUnit} (enforcedBy ${policy.costCeiling.enforcedBy})` : null;
  const cost = agentMap(doc)[agentName]["x-suluk-cost"] as { estimateMicroUsd?: number; amount?: number } | undefined;
  const est = cost?.estimateMicroUsd ?? cost?.amount;
  return {
    effectiveScope: effective.scope,
    ...(effective.maxDepth !== undefined ? { effectiveMaxDepth: effective.maxDepth } : {}),
    nestingForbidden: effective.nestingForbidden,
    deniedTools: effective.deniedTools,
    deniedSubAgents: effective.deniedSubAgents,
    narrowings: narrowings.map((n) => ({ axis: n.axis, detail: n.detail })),
    // three distinct owners — cap (operator, enforced-by-adapter) / estimate (author) / actual (runtime, C026)
    cost: { cap, estimate: typeof est === "number" ? `${est} µ$` : null, actual: "reconciled at runtime (C026)" },
  };
}

/** Build the OBSERVE view-model for the agent layer of a document. Never throws; tolerates non-installable agents. */
export function agentsView(doc: OpenAPIv4Document): AgentsView {
  const map = agentMap(doc);
  const names = Object.keys(map).sort((a, b) => a.localeCompare(b));
  const present = names.length > 0;
  const findings = [...lintAgents(doc), ...lintPolicy(doc)];

  // effective scopes across the whole map: merge a walk from every root (covers every reachable node)
  const referenced = referencedChildren(doc);
  const roots = names.filter((n) => !referenced.has(n));
  const effAll: Record<string, Scope> = {};
  for (const r of roots) Object.assign(effAll, analyzeScopes(doc, r).effective);

  const agents: AgentNodeView[] = names.map((name) => {
    const a = map[name];
    const subAgents = Object.values(a.agents ?? {}).map((r) => r.ref).sort();
    const skills: AgentSkillView[] = Object.entries(a.skills ?? {}).map(([sk, s]) => ({
      name: sk,
      model: s.model ?? [],
      ...(s.tier ? { tier: s.tier } : {}),
      pinned: !!s.provenance?.contentHash,
      ...(s.provenance?.source ? { source: s.provenance.source } : {}),
    })).sort((x, y) => x.name.localeCompare(y.name));
    const routes: AgentRouteView[] = Object.entries(a.routes ?? {}).map(([rk, r]) => ({
      name: rk,
      operationRef: r.operationRef,
      ...(r.guarantee ? { guarantee: r.guarantee } : {}),
      ...(r.tier ? { tier: r.tier } : {}),
      resolves: !!resolveOperationRef(doc, r.operationRef),
    })).sort((x, y) => x.name.localeCompare(y.name));
    return {
      name,
      description: a.description,
      kind: subAgents.length > 0 ? "orchestrator" : "leaf",
      ...(a.maxDepth !== undefined ? { maxDepth: a.maxDepth } : {}),
      effectiveScope: effAll[name] ?? (a.scope ?? null),
      skills,
      routes,
      subAgents,
      reachable: reachableSurface(doc, name),
      projection: {
        pluginFiles: ["plugin.json", ".mcp.json", ...skills.map((s) => `skills/${s.name}/SKILL.md`)],
        openRouterTools: routes.map((r) => r.name),
        // the tier-trim: only resident tools are in the default surface; cold-tail sits behind discover_tools
        residentTools: routes.filter((r) => r.tier !== "cold-tail").map((r) => r.name),
        discoverableTools: routes.filter((r) => r.tier === "cold-tail").map((r) => r.name),
      },
      ...(policiesFor(doc, name).length > 0 ? { governed: governedView(doc, name) } : {}),
    };
  });

  return { present, agents, roots, findings, installable: lintOk(findings) };
}

/** A one-line ship-readiness summary for the agent layer (mirrors the cockpit's other *Summary helpers). */
export function agentsSummary(view: AgentsView): string {
  if (!view.present) return "no agents (x-suluk-agents absent)";
  const errs = view.findings.filter((f) => f.severity === "error").length;
  const warns = view.findings.filter((f) => f.severity === "warning").length;
  const verdict = view.installable ? "✓ installable" : `✕ ${errs} blocking`;
  return `${view.agents.length} agent(s), ${view.roots.length} root(s) — ${verdict}${warns ? `, ${warns} warning(s)` : ""}`;
}
