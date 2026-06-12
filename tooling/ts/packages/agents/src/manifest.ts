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
import { agentMap } from "./resolve";
import { reachableSurface, type ConformanceFinding } from "./conformance";
import { analyzeScopes, type Scope, type ScopeEscalation } from "./scope";
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
export interface AgentManifestNode {
  name: string;
  description: string;
  /** effective scope after intersection along the reaching path (null = unconstrained). */
  effectiveScope: Scope;
  skills: AgentManifestSkill[];
  routes: AgentManifestRoute[];
  subAgents: string[];
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
export function agentManifest(doc: OpenAPIv4Document, agentName: string): AgentManifest {
  const map = agentMap(doc);
  const { effective, escalations } = analyzeScopes(doc, agentName);
  const reach = reachableSurface(doc, agentName);
  const nodeKeys = [agentName, ...reach.agents].filter((k) => map[k]).sort((a, b) => a.localeCompare(b));

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
    return { name: key, description: a.description, effectiveScope: effective[key] ?? null, skills, routes, subAgents };
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
