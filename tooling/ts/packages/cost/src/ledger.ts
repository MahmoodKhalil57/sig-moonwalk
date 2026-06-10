/**
 * The ledger — aggregate cost events into the raw picture: total, and breakdowns by principal (what each
 * USER cost you), by operation, by frontend action, and by source (which third party). We display these AS
 * THEY ARE; pricing, margins, and limits are something the consumer builds on top — not something we impose.
 */
import type { CostEvent } from "./types";

export interface CostSummary {
  total: number;
  count: number;
  byPrincipal: Record<string, number>;
  byOperation: Record<string, number>;
  byAction: Record<string, number>;
  bySource: Record<string, number>;
}

function bump(rec: Record<string, number>, key: string | undefined, micro: number): void {
  if (!key) return;
  rec[key] = (rec[key] ?? 0) + micro;
}

export function summarize(events: CostEvent[]): CostSummary {
  const s: CostSummary = { total: 0, count: events.length, byPrincipal: {}, byOperation: {}, byAction: {}, bySource: {} };
  for (const e of events) {
    s.total += e.totalMicroUsd;
    bump(s.byPrincipal, e.principal, e.totalMicroUsd);
    bump(s.byOperation, e.operation, e.totalMicroUsd);
    bump(s.byAction, e.action, e.totalMicroUsd);
    for (const b of e.breakdown) bump(s.bySource, b.source, b.microUsd);
  }
  return s;
}

/** What ONE principal cost you (the question that lets you price them) — and the trace by operation + action. */
export function principalCost(events: CostEvent[], principal: string): CostSummary {
  return summarize(events.filter((e) => e.principal === principal));
}
