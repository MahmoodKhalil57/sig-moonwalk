/**
 * Conformance checks that are NOT lint (they need a runtime/served fact to compare against the contract). The
 * headline one is the OVER-SERVE auditor: the council red-line says the full reachable tool/route surface must be
 * STATICALLY enumerable from the document, and a serving layer's `discover_tools` may REORDER/lazy-load but NEVER
 * WIDEN the declared set. Conin's public MCP `tools/list` (app.ts:2585) ships the FULL catalog — a NAMED
 * conformance failure this function catches.
 */
import type { OpenAPIv4Document } from "@suluk/core";
import { agentMap, childKeys } from "./resolve";
import { contentHash } from "./skill";

export interface ConformanceFinding {
  code: string;
  detail: string;
}

/**
 * The statically-enumerable reachable surface of an agent: its own route keys (the wire ids) + every route key of
 * every transitively-reachable sub-agent. Worst-case authz reach, computed with ZERO requests. (Cycle-safe.)
 */
export function reachableSurface(doc: OpenAPIv4Document, agentName: string): { tools: string[]; agents: string[] } {
  const map = agentMap(doc);
  const tools = new Set<string>();
  const agents = new Set<string>();
  const walk = (key: string) => {
    const a = map[key];
    if (!a || agents.has(key)) return;
    agents.add(key);
    for (const rk of Object.keys(a.routes ?? {})) tools.add(rk);
    for (const c of childKeys(a)) if (c.key) walk(c.key);
  };
  walk(agentName);
  agents.delete(agentName);
  return { tools: [...tools].sort(), agents: [...agents].sort() };
}

/**
 * OVER-SERVE auditor: assert the tools a server actually exposes are a SUBSET of the declared reachable surface.
 * Any served tool NOT in the surface is a WIDENING — the contract is no longer the source of truth for authz reach.
 */
export function assertServedSubset(doc: OpenAPIv4Document, agentName: string, servedToolNames: string[]): ConformanceFinding[] {
  const surface = new Set(reachableSurface(doc, agentName).tools);
  return servedToolNames
    .filter((t) => !surface.has(t))
    .map((t) => ({ code: "over-serve", detail: `served tool "${t}" is NOT in the declared reachable surface — discover_tools may reorder/lazy-load, never widen` }));
}

/**
 * SKILL-FRESHNESS: a skill's declared `provenance.contentHash` must match the hash of the CURRENT served snapshot.
 * A mismatch means the served preprompt drifted after the contentHash was minted — an unsigned change in production
 * (the C021 supply-chain concern). No declared hash ⇒ a warning (drift is undetectable).
 */
export function verifySkillFreshness(declaredHash: string | undefined, currentSnapshot: string): ConformanceFinding[] {
  if (!declaredHash) return [{ code: "unpinned-skill", detail: "no declared contentHash — served-instruction drift cannot be detected" }];
  const now = contentHash(currentSnapshot);
  return declaredHash === now ? [] : [{ code: "stale-skill", detail: `declared contentHash ${declaredHash} ≠ current ${now} — the served instructions drifted` }];
}
