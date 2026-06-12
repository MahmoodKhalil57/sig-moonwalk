/**
 * Resolution helpers for the agent layer (C027). These walk the document and the agent graph BY NAME (C009/C013)
 * — they NEVER touch the DOM→ADA request→operation matcher. A route's `operationRef` is a by-name JSON-pointer
 * into an EXISTING operation; a sub-agent `ref` is a by-name pointer into the same `x-suluk-agents` map.
 */
import type { OpenAPIv4Document, Request, SulukAgent } from "@suluk/core";

/** Unescape one JSON-Pointer token (RFC6901): `~1`→`/`, `~0`→`~`. */
const unescapeToken = (t: string) => t.replace(/~1/g, "/").replace(/~0/g, "~");

/** Parse a `#/a/b~1c/d` fragment pointer into its decoded tokens (or null if not a local fragment pointer). */
export function parsePointer(ref: string): string[] | null {
  if (typeof ref !== "string" || !ref.startsWith("#/")) return null;
  return ref.slice(2).split("/").map(unescapeToken);
}

export type OperationLocus = "path" | "webhook" | "job";
export interface ResolvedOperation {
  locus: OperationLocus;
  /** the container key (path template / webhook name / job name). */
  container: string;
  /** the by-name request handle within a pathItem (paths only). */
  requestName?: string;
  request?: Request;
}

/**
 * Resolve a route's `operationRef` to an EXISTING operation. Supports the three operation loci:
 *  - `#/paths/<pathTemplate>/requests/<name>`  (a pathItem request — the common case)
 *  - `#/webhooks/<name>`                        (an incoming webhook operation)
 *  - `#/x-suluk-jobs/<name>`                    (a non-HTTP job, C025)
 * Returns null when the ref dangles (the resolve-lint failure — Conin's MCP-only `run_core_primitive`).
 */
export function resolveOperationRef(doc: OpenAPIv4Document, ref: string): ResolvedOperation | null {
  const toks = parsePointer(ref);
  if (!toks) return null;
  if (toks[0] === "paths" && toks.length === 4 && toks[2] === "requests") {
    const pathItem = doc.paths?.[toks[1]];
    const request = pathItem?.requests?.[toks[3]] as Request | undefined;
    return request ? { locus: "path", container: toks[1], requestName: toks[3], request } : null;
  }
  if (toks[0] === "webhooks" && toks.length === 2) {
    const request = doc.webhooks?.[toks[1]];
    return request ? { locus: "webhook", container: toks[1], request } : null;
  }
  if (toks[0] === "x-suluk-jobs" && toks.length === 2) {
    const job = doc["x-suluk-jobs"]?.[toks[1]];
    return job ? { locus: "job", container: toks[1] } : null;
  }
  return null;
}

/** The agent map, or an empty record. */
export const agentMap = (doc: OpenAPIv4Document): Record<string, SulukAgent> => doc["x-suluk-agents"] ?? {};

/** Decode a sub-agent ref `#/x-suluk-agents/<key>` to its key (or null if malformed / not an agent ref). */
export function subAgentKey(ref: string): string | null {
  const toks = parsePointer(ref);
  return toks && toks.length === 2 && toks[0] === "x-suluk-agents" ? toks[1] : null;
}

/** Direct sub-agent keys of an agent (decoded; may include dangling keys — the caller lint-checks existence). */
export function childKeys(agent: SulukAgent): { local: string; key: string | null; ref: string }[] {
  return Object.entries(agent.agents ?? {}).map(([local, r]) => ({ local, key: subAgentKey(r.ref), ref: r.ref }));
}

/**
 * Detect a cycle in the agent graph reachable from `root`, following by-name sub-agent refs. Returns the cycle
 * path (keys) if one exists, else null. JSON-Schema cannot express acyclicity — this is the author/install lint
 * the C027 gate requires. (Same shape as the shipped builder/compose cycle detection, C021.)
 */
export function findCycle(map: Record<string, SulukAgent>, root: string): string[] | null {
  const onStack: string[] = [];
  const inStack = new Set<string>();
  const done = new Set<string>();
  const dfs = (key: string): string[] | null => {
    if (inStack.has(key)) return [...onStack.slice(onStack.indexOf(key)), key]; // back-edge → cycle
    if (done.has(key) || !map[key]) return null;
    onStack.push(key); inStack.add(key);
    for (const c of childKeys(map[key])) {
      if (c.key && map[c.key]) { const hit = dfs(c.key); if (hit) return hit; }
    }
    onStack.pop(); inStack.delete(key); done.add(key);
    return null;
  };
  return dfs(root);
}

/**
 * Longest sub-agent path depth below `root` (a leaf — no sub-agents — is depth 0). Returns Infinity if a cycle is
 * reachable. `maxDepth` on an agent must be >= this for its subtree.
 */
export function subtreeDepth(map: Record<string, SulukAgent>, root: string, seen = new Set<string>()): number {
  if (seen.has(root)) return Infinity;
  const agent = map[root];
  if (!agent) return 0;
  const children = childKeys(agent).filter((c) => c.key && map[c.key!]);
  if (children.length === 0) return 0;
  seen.add(root);
  let max = 0;
  for (const c of children) max = Math.max(max, 1 + subtreeDepth(map, c.key!, new Set(seen)));
  return max;
}

/** Every string value reachable in an object (for the request-value-selector D1 scan). */
export function* deepStrings(v: unknown, path = ""): Generator<{ path: string; value: string }> {
  if (typeof v === "string") { yield { path, value: v }; return; }
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) yield* deepStrings(v[i], `${path}[${i}]`); return; }
  if (v && typeof v === "object") for (const [k, val] of Object.entries(v)) yield* deepStrings(val, path ? `${path}.${k}` : k);
}
