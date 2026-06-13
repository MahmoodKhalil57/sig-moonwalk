/**
 * The signable AGENT MANIFEST (C027 marketplace reuse, C021) — a deterministic, canonical descriptor of an agent
 * and its reachable sub-tree, suitable for distribution through the signed marketplace. It deliberately INCLUDES
 * every skill's `contentHash`, so signing the manifest (with @suluk/builder's `signRegistry`) covers the served
 * preprompt: a preprompt that drifts AFTER the signature is minted is a detectable unsigned change — `verifyAgentFreshness`
 * catches it (the C021 supply-chain concern, council open-Q #8). It also carries the effective (intersection) scope of
 * every node + any escalations, so worst-case authz reach is auditable from the signed artifact alone.
 *
 * Pure + crypto-free: the signing/verifying lives in @suluk/builder; this package only produces what gets signed.
 */
import type { OpenAPIv4Document } from "@suluk/core";
import type { ModelCatalog } from "@suluk/models";
import { agentMap } from "./resolve";
import { reachableSurface, type ConformanceFinding } from "./conformance";
import { analyzeScopes, type Scope, type ScopeEscalation } from "./scope";
import { effectiveUnderPolicies, policiesFor } from "./policy";
import { contextReport } from "./context";
import { skillModels } from "./model-select";
import { contentHash } from "./skill";

export interface AgentManifestSkill {
  name: string;
  model: string[];
  tier?: "resident" | "cold-tail";
  source?: string;
  /** the pinned hash of the served instructions — what the signature ends up covering. */
  contentHash?: string;
  version?: string;
}
export interface AgentManifestRoute {
  name: string;
  operationRef: string;
  guarantee?: "same-in-same-out" | "idempotent" | "safe";
}
/** The operator-effective surface after x-suluk-policy narrowing (present only when a policy governs the agent). */
export interface AgentManifestGoverned {
  scope: Scope;
  maxDepth?: number;
  nestingForbidden: boolean;
  allowedTools: string[];
  deniedTools: string[];
  allowedSubAgents: string[];
}
export interface AgentManifestNode {
  name: string;
  description: string;
  /** effective scope after intersection along the reaching path (null = unconstrained). */
  effectiveScope: Scope;
  skills: AgentManifestSkill[];
  routes: AgentManifestRoute[];
  subAgents: string[];
  /** operator-effective surface after x-suluk-policy (C028) — so the C021 signature covers the operator's caps. */
  governed?: AgentManifestGoverned;
  /** catalog-pinned model selection per skill (present only when agentManifest is given a catalog) — reproducible: the
   * snapshotHash is signed, so a re-pick week-over-week with no author edit is auditable (C027 contentHash discipline). */
  modelSelection?: { skill: string; ids: string[]; from: "declared" | "selected"; snapshotHash: string | null }[];
}
export interface AgentManifest {
  manifestVersion: 1;
  agent: string;
  /** the root + every transitively-reachable sub-agent, sorted by name (canonical). */
  nodes: AgentManifestNode[];
  /** the statically-enumerable worst-case reachable surface. */
  reachable: { tools: string[]; agents: string[] };
  /** any per-edge scope escalations (an installable agent has none). */
  escalations: ScopeEscalation[];
}

const byName = <T extends { name: string }>(xs: T[]) => [...xs].sort((a, b) => a.name.localeCompare(b.name));

/** Build the canonical, signable manifest for an agent and its reachable sub-tree. Pure; does not throw. */
export function agentManifest(doc: OpenAPIv4Document, agentName: string, opts: { catalog?: ModelCatalog } = {}): AgentManifest {
  const map = agentMap(doc);
  const { effective, escalations } = analyzeScopes(doc, agentName);
  const reach = reachableSurface(doc, agentName);
  const nodeKeys = [agentName, ...reach.agents].filter((k) => map[k]).sort((a, b) => a.localeCompare(b));
  // per-agent peak load → the hard min-context gate, when a catalog is supplied (drives the model selection fold)
  const minWinByAgent: Record<string, number> = {};
  if (opts.catalog) for (const l of contextReport(doc, { catalog: opts.catalog }).loads) minWinByAgent[l.agent] = l.minWindowRequired;

  const nodes: AgentManifestNode[] = nodeKeys.map((key) => {
    const a = map[key];
    const skills: AgentManifestSkill[] = byName(
      Object.entries(a.skills ?? {}).map(([name, s]) => ({
        name,
        model: s.model ?? [],
        ...(s.tier ? { tier: s.tier } : {}),
        ...(s.provenance?.source ? { source: s.provenance.source } : {}),
        ...(s.provenance?.contentHash ? { contentHash: s.provenance.contentHash } : {}),
        ...(s.provenance?.version ? { version: s.provenance.version } : {}),
      })),
    );
    const routes: AgentManifestRoute[] = byName(
      Object.entries(a.routes ?? {}).map(([name, r]) => ({ name, operationRef: r.operationRef, ...(r.guarantee ? { guarantee: r.guarantee } : {}) })),
    );
    const subAgents = Object.values(a.agents ?? {}).map((r) => r.ref).sort();
    let governed: AgentManifestGoverned | undefined;
    if (policiesFor(doc, key).length > 0) {
      const e = effectiveUnderPolicies(doc, key).effective;
      governed = {
        scope: e.scope,
        ...(e.maxDepth !== undefined ? { maxDepth: e.maxDepth } : {}),
        nestingForbidden: e.nestingForbidden,
        allowedTools: [...e.allowedTools].sort(),
        deniedTools: [...e.deniedTools].sort(),
        allowedSubAgents: [...e.allowedSubAgents].sort(),
      };
    }
    let modelSelection: AgentManifestNode["modelSelection"];
    if (opts.catalog) {
      modelSelection = Object.keys(a.skills ?? {}).sort().map((sk) => {
        const r = skillModels(doc, key, sk, opts.catalog!, minWinByAgent[key]);
        return { skill: sk, ids: r.ids, from: r.from, snapshotHash: r.snapshotHash };
      });
    }
    return { name: key, description: a.description, effectiveScope: effective[key] ?? null, skills, routes, subAgents, ...(governed ? { governed } : {}), ...(modelSelection ? { modelSelection } : {}) };
  });

  return { manifestVersion: 1, agent: agentName, nodes, reachable: reach, escalations };
}

/**
 * Verify a signed manifest's skills against the CURRENT served snapshots: each skill's signed `contentHash` must
 * equal the hash of its current snapshot. A mismatch ⇒ the served preprompt drifted after the signature was minted
 * (a stale/unsigned change). A skill with no declared `contentHash` ⇒ unpinned (drift undetectable). Snapshots are
 * keyed `"<agentKey>/<skillName>"`; a skill with no provided snapshot is skipped (cannot be checked here).
 */
export function verifyAgentFreshness(manifest: AgentManifest, snapshots: Record<string, string>): ConformanceFinding[] {
  const out: ConformanceFinding[] = [];
  for (const node of manifest.nodes) {
    for (const skill of node.skills) {
      const key = `${node.name}/${skill.name}`;
      if (!skill.contentHash) { out.push({ code: "unpinned-skill", detail: `${key}: no contentHash — drift undetectable` }); continue; }
      const snap = snapshots[key];
      if (snap === undefined) continue;
      const now = contentHash(snap);
      if (now !== skill.contentHash) out.push({ code: "stale-skill", detail: `${key}: signed contentHash ${skill.contentHash} ≠ current ${now} — served instructions drifted after mint` });
    }
  }
  return out;
}
