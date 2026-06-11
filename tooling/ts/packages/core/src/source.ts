/**
 * Provenance (council whuovh6gs, L2) — pure, DERIVED operations over the `x-suluk-source` facet. Never stores
 * state on the document; the reverse index is computed on demand (forbidden to cache INTO the canonical, lest a
 * stale second-source-of-truth appear). All advisory: a source pointer is the audit trail of WHERE a contract
 * element came from — never an authz, routing, or identity input (C022 inv.5).
 */
import type { OpenAPIv4Document, SulukSource } from "./types";

export type { SulukSource };

/** "<file>#<symbol>" — the canonical string key for a source pointer. */
export const sourceKey = (s: SulukSource): string => `${s.file}#${s.symbol}`;

export interface SourceRef { path: string; name: string; method: string }
export interface SourceGroup { file: string; symbol: string; kind?: string; operations: SourceRef[] }

/**
 * The DERIVED reverse index: source pointer → the operations projected from it. Computed by walking the document;
 * never read back from stored doc state. One authored symbol (a Drizzle table, an operation function) typically
 * fans out to several operations (a table → its 5 CRUD ops), so this is the "what does this source drive?" lookup.
 */
export function sourceIndex(doc: OpenAPIv4Document): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  for (const [path, piRaw] of Object.entries(doc.paths ?? {})) {
    const requests = (piRaw as { requests?: Record<string, { method?: string; ["x-suluk-source"]?: SulukSource }> }).requests ?? {};
    for (const [name, req] of Object.entries(requests)) {
      const src = req["x-suluk-source"];
      if (!src) continue;
      const key = sourceKey(src);
      const g = groups.get(key) ?? { file: src.file, symbol: src.symbol, kind: src.kind, operations: [] };
      g.operations.push({ path, name, method: String(req.method ?? "").toLowerCase() });
      groups.set(key, g);
    }
  }
  return [...groups.values()].sort((a, b) => sourceKey(a).localeCompare(sourceKey(b)));
}

/** Count of operations carrying a source pointer vs total — the provenance-coverage gauge. */
export function sourceCoverage(doc: OpenAPIv4Document): { stamped: number; total: number } {
  let stamped = 0, total = 0;
  for (const piRaw of Object.values(doc.paths ?? {})) {
    const requests = (piRaw as { requests?: Record<string, { ["x-suluk-source"]?: SulukSource }> }).requests ?? {};
    for (const req of Object.values(requests)) { total++; if (req["x-suluk-source"]) stamped++; }
  }
  return { stamped, total };
}

/**
 * Return a CLONE of the document with every `x-suluk-source` removed — for externally published projections, where
 * a source pointer is internal-layout disclosure (council: scrub from external). Shallow-clones paths/requests so
 * the canonical (which keeps provenance for the maintainer view) is never mutated.
 */
export function scrubSource(doc: OpenAPIv4Document): OpenAPIv4Document {
  const paths: Record<string, unknown> = {};
  for (const [uri, piRaw] of Object.entries(doc.paths ?? {})) {
    const pi = piRaw as unknown as { requests?: Record<string, Record<string, unknown>> };
    if (!pi.requests) { paths[uri] = piRaw; continue; }
    const requests: Record<string, unknown> = {};
    for (const [name, req] of Object.entries(pi.requests)) {
      if ("x-suluk-source" in req) { const { ["x-suluk-source"]: _omit, ...rest } = req; requests[name] = rest; }
      else requests[name] = req;
    }
    paths[uri] = { ...pi, requests };
  }
  return { ...doc, paths: paths as typeof doc.paths };
}
