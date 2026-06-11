/**
 * The analytics dashboard (saastarter-parity Phase 3) — a gated cockpit view over the contract's COST facets:
 * cost by source, declared-coverage, the costliest operations, + the rate-limit / background-cost summary. The
 * cockpit is server-rendered HTML with no React build, so the charts are inline SVG (zero-build) — a client-React
 * admin would render the same data with Recharts; here we draw it server-side. Pure: a function of the document.
 */
import { rateLimitCoverage, type OpenAPIv4Document } from "@suluk/core";
import { esc } from "./render";

interface CostModel { estimateMicroUsd?: number; components?: { source?: string; microUsd?: number }[]; trigger?: string; attribution?: { strategy?: string; expression?: string } }

function fmtUsd(microUsd: number): string {
  const usd = microUsd / 1_000_000;
  return usd >= 0.01 ? `$${usd.toFixed(2)}` : usd >= 0.0001 ? `$${usd.toFixed(6).replace(/0+$/, "")}` : `${Math.round(microUsd)} µ$`;
}

/** Every cost locus (paths + webhooks + jobs) with its model — the analytics source. */
function costLoci(doc: OpenAPIv4Document): { name: string; cost: CostModel }[] {
  const out: { name: string; cost: CostModel }[] = [];
  const visit = (name: string, node: unknown) => { const c = (node as Record<string, unknown>)["x-suluk-cost"] as CostModel | undefined; if (c) out.push({ name, cost: c }); };
  for (const pi of Object.values(doc.paths ?? {})) for (const [n, r] of Object.entries((pi as { requests?: Record<string, unknown> }).requests ?? {})) visit(n, r);
  for (const [n, r] of Object.entries((doc as { webhooks?: Record<string, unknown> }).webhooks ?? {})) visit(n, r);
  for (const [n, j] of Object.entries((doc as { ["x-suluk-jobs"]?: Record<string, unknown> })["x-suluk-jobs"] ?? {})) visit(n, j);
  return out;
}

function estimateOf(c: CostModel): number {
  if (c.estimateMicroUsd != null) return Number(c.estimateMicroUsd);
  return (c.components ?? []).reduce((s, x) => s + Number(x.microUsd ?? 0), 0);
}

const PALETTE = ["#f5a97f", "#8aadf4", "#a6da95", "#eed49f", "#c6a0f6", "#ee99a0", "#7dc4e4"];

/** A horizontal SVG bar chart — label · bar · value, max-normalized. Zero-build, server-rendered. */
function barChart(rows: { label: string; value: number; display: string }[]): string {
  if (!rows.length) return '<p class="muted">no data</p>';
  const max = Math.max(...rows.map((r) => r.value), 1);
  const rowH = 26, w = 460, labelW = 130, barW = w - labelW - 80;
  const svgH = rows.length * rowH + 8;
  const bars = rows.map((r, i) => {
    const len = Math.max(2, Math.round((r.value / max) * barW));
    const y = i * rowH + 4;
    return `<text x="0" y="${y + 14}" fill="#cdd6f4" font-size="12">${esc(r.label.slice(0, 18))}</text>` +
      `<rect x="${labelW}" y="${y + 4}" width="${len}" height="14" rx="3" fill="${PALETTE[i % PALETTE.length]}"/>` +
      `<text x="${labelW + len + 6}" y="${y + 15}" fill="#9399b2" font-size="11">${esc(r.display)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${w} ${svgH}" width="100%" style="max-width:${w}px" role="img">${bars}</svg>`;
}

/** A coverage gauge bar (priced / total). */
function gauge(label: string, done: number, total: number): string {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `<div style="margin:6px 0"><div class="muted" style="font-size:12px">${esc(label)} — ${done}/${total} (${pct}%)</div>
    <div style="background:#1e2433;border-radius:4px;height:8px;overflow:hidden"><div style="width:${pct}%;height:8px;background:#a6da95"></div></div></div>`;
}

/** Render the analytics dashboard for a document. */
export function renderAnalytics(doc: OpenAPIv4Document): string {
  const loci = costLoci(doc);
  // total operations (paths + webhooks) for the coverage denominator
  let totalOps = 0;
  for (const pi of Object.values(doc.paths ?? {})) totalOps += Object.keys((pi as { requests?: Record<string, unknown> }).requests ?? {}).length;
  totalOps += Object.keys((doc as { webhooks?: Record<string, unknown> }).webhooks ?? {}).length;

  // cost by source
  const bySource = new Map<string, number>();
  for (const { cost } of loci) for (const c of cost.components ?? []) bySource.set(c.source ?? "?", (bySource.get(c.source ?? "?") ?? 0) + Number(c.microUsd ?? 0));
  const sourceRows = [...bySource.entries()].sort((a, b) => b[1] - a[1]).map(([label, v]) => ({ label, value: v, display: fmtUsd(v) }));

  // costliest operations
  const opRows = loci.map((l) => ({ label: l.name, value: estimateOf(l.cost), display: fmtUsd(estimateOf(l.cost)) }))
    .sort((a, b) => b.value - a.value).slice(0, 8);

  const totalMicroUsd = loci.reduce((s, l) => s + estimateOf(l.cost), 0);
  const deferred = loci.filter((l) => l.cost.trigger && l.cost.trigger !== "synchronous");
  const unattributed = deferred.filter((l) => { const a = l.cost.attribution; return !a || (a.strategy === "event-expression" && !a.expression); }).length;
  const rl = rateLimitCoverage(doc);

  return `<h2>Analytics</h2>
    <p class="muted">A gated view over the contract's cost facets — declared (a contract fact, not telemetry). Total declared subtotal: <b>${fmtUsd(totalMicroUsd)}</b> across ${loci.length} priced ${loci.length === 1 ? "op" : "ops"}.</p>
    <div class="layer"><b>Cost by source</b>${barChart(sourceRows)}</div>
    <div class="layer"><b>Costliest operations</b>${barChart(opRows)}</div>
    <div class="layer"><b>Coverage</b>
      ${gauge("priced operations", loci.length, totalOps)}
      ${gauge("rate-limited operations", rl.limited, rl.total)}
      <p class="muted" style="font-size:12px;margin-top:8px">Background-event costs (C024/C025): <b>${deferred.length}</b> deferred${unattributed ? ` · <span class="pill" style="color:#ee99a0">⚠ ${unattributed} unattributed</span>` : ""}.</p>
    </div>`;
}
