/**
 * Cost as a CONTRACT FACET. A cost model is attached to each operation as the `x-suluk-cost` vendor
 * extension on its Request — so it bubbles like everything else: it survives the 3.1 downgrade (3.1 keeps
 * `x-*`), Scalar/Swagger render it, and a coverage audit can flag operations that never declared a cost.
 * The contract tells you what an operation *should* cost; the runtime meter tells you what it *did*.
 */
import type { OpenAPIv4Document, PathItem, Request } from "@suluk/core";
import type { CostModel, UsageReport } from "./types";

export const COST_EXT = "x-suluk-cost";

/** Annotate a v4 document in place-safe (returns a new doc): set x-suluk-cost on each named operation. */
export function annotateCosts(doc: OpenAPIv4Document, costs: Record<string, CostModel>): OpenAPIv4Document {
  const out: OpenAPIv4Document = structuredClone(doc);
  for (const pi of Object.values(out.paths ?? {})) {
    for (const [name, req] of Object.entries((pi as PathItem).requests ?? {})) {
      const model = costs[name];
      if (model) (req as Request & Record<string, unknown>)[COST_EXT] = model;
    }
  }
  return out;
}

/** Read the cost model declared on an operation (if any). */
export function costOf(req: Request): CostModel | undefined {
  return (req as Request & Record<string, unknown>)[COST_EXT] as CostModel | undefined;
}

export interface CostFinding {
  code: "no-cost-model" | "zero-cost";
  severity: "warn" | "info";
  path: string;
  operation: string;
  message: string;
}

/**
 * Cost-coverage audit: which operations have NOT declared what they cost. This is the same ceiling-side
 * discipline as the documentation audit — an undeclared cost is a blind spot, surfaced, never assumed zero.
 */
export function costAudit(doc: OpenAPIv4Document): CostFinding[] {
  const findings: CostFinding[] = [];
  for (const [path, piRaw] of Object.entries(doc.paths ?? {})) {
    for (const [name, reqRaw] of Object.entries((piRaw as PathItem).requests ?? {})) {
      const model = costOf(reqRaw as Request);
      if (!model) {
        findings.push({ code: "no-cost-model", severity: "warn", path, operation: name, message: "operation declares no cost — its cost to you is unknown (not assumed zero)" });
      } else if (!model.components.length) {
        findings.push({ code: "zero-cost", severity: "info", path, operation: name, message: "operation declares an empty cost model (explicitly free)" });
      }
    }
  }
  return findings;
}

/** The declared costs across the document, for display (the cockpit/admin show this raw). */
export function costTable(doc: OpenAPIv4Document): { operation: string; path: string; estimateMicroUsd: number; sources: string[] }[] {
  const rows: { operation: string; path: string; estimateMicroUsd: number; sources: string[] }[] = [];
  for (const [path, piRaw] of Object.entries(doc.paths ?? {})) {
    for (const [name, reqRaw] of Object.entries((piRaw as PathItem).requests ?? {})) {
      const model = costOf(reqRaw as Request);
      if (!model) continue;
      const fixed = model.components.filter((c) => c.basis === "per-call").reduce((s, c) => s + c.microUsd, 0);
      rows.push({ operation: name, path, estimateMicroUsd: model.estimateMicroUsd ?? fixed, sources: [...new Set(model.components.map((c) => c.source))] });
    }
  }
  return rows;
}

/**
 * Compute the actual µ$ a request cost, from its declared model + the usage the handler reported. Fixed
 * (per-call) components always count; variable components count their reported units × unit cost. Returns
 * the per-source breakdown + total — raw, for the meter to record.
 */
export function computeCost(model: CostModel | undefined, usage: UsageReport[] = []): { breakdown: { source: string; microUsd: number }[]; totalMicroUsd: number } {
  const bySource = new Map<string, number>();
  const add = (source: string, micro: number) => bySource.set(source, (bySource.get(source) ?? 0) + micro);
  const usageBySource = new Map<string, number>();
  for (const u of usage) usageBySource.set(u.source, (usageBySource.get(u.source) ?? 0) + u.units);

  for (const c of model?.components ?? []) {
    if (c.basis === "per-call") add(c.source, c.microUsd);
    else {
      const units = usageBySource.get(c.source) ?? 0;
      const per = c.basis === "per-1k-tokens" ? c.microUsd / 1000 : c.microUsd;
      add(c.source, Math.round(per * units));
    }
  }
  const breakdown = [...bySource.entries()].map(([source, microUsd]) => ({ source, microUsd }));
  return { breakdown, totalMicroUsd: breakdown.reduce((s, b) => s + b.microUsd, 0) };
}
