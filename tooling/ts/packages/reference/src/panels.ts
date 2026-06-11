/**
 * Phase-4 DIFFERENTIATORS — v4-only interactive panels no 3.x tool can host, fed by the IR:
 *   • Cost Explorer + Workflow Calculator — every op by declared cost/source; tick a sequence → cumulative µ$ + ×N/mo
 *   • ADA Resolution Playground — enter a request, see which NAMED operation it resolves to (unique/collision/runtime)
 */
import { escapeHtml, fmtUsd, costEstimate } from "./facets";
import type { RefDoc } from "./ir";
import type { DocAudit, Grade } from "@suluk/harden";

const embed = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

export const HARDEN_COLOR: Record<Grade, { bg: string; fg: string }> = {
  A: { bg: "#dcfce7", fg: "#166534" }, B: { bg: "#ecfccb", fg: "#3f6212" }, C: { bg: "#fef9c3", fg: "#854d0e" }, D: { bg: "#ffedd5", fg: "#9a3412" }, F: { bg: "#fee2e2", fg: "#991b1b" },
};
export function hardenBadge(g: Grade, title: string): string {
  const c = HARDEN_COLOR[g];
  return `<span class="harden" style="background:${c.bg};color:${c.fg}" title="${escapeHtml(title)}">🛡 ${g}</span>`;
}

/** The Hardening incentive panel — the weakest operations + their concrete fixes, gamified toward the next grade. */
export function hardeningPanel(audit: DocAudit): string {
  const worst = audit.byOperation.filter((o) => o.findings.length);
  const next: Record<Grade, string> = { F: "D", D: "C", C: "B", B: "A", A: "A" };
  return `<div class="section" id="hardening"><h2>Hardening — input-validation grade ${hardenBadge(audit.grade, `${audit.score}/100`)} <span class="muted">${audit.score}/100</span></h2>
    <p class="muted">Untrusted input is the attack surface. Every string wants a <b>maxLength</b> + a <b>pattern</b> (a character allowlist), every number a <b>maximum</b>, every array a <b>maxItems</b>, every object <b>closed</b> (additionalProperties:false) + typed, and <b>no any/unknown</b> — so malformed or oversized input can't break the system. <b>${audit.bySeverity.high}</b> high · <b>${audit.bySeverity.medium}</b> medium · <b>${audit.bySeverity.low}</b> low findings.${audit.grade !== "A" ? ` Harden the operations below to reach grade <b>${next[audit.grade]}</b>.` : ""}</p>
    ${worst.length === 0 ? '<p class="ok-line">✓ every input is fully bounded — grade A.</p>' : worst.map((o) => `<div class="harden-op"><div class="harden-op-head">${hardenBadge(o.grade, "")} <a href="#${escapeHtml(o.operation)}"><code>${escapeHtml(o.operation)}</code></a> <span class="muted">${o.findings.length} finding${o.findings.length > 1 ? "s" : ""}</span></div><ul class="harden-list">${o.findings.slice(0, 8).map((f) => `<li><span class="sev sev-${f.severity}">${f.severity}</span> ${escapeHtml(f.message)} → <span class="muted">${escapeHtml(f.fix)}</span></li>`).join("")}</ul></div>`).join("")}</div>`;
}

export function costExplorer(ir: RefDoc): string {
  const rows = ir.operations.map((o) => {
    const est = costEstimate(o.cost);
    const sources: Record<string, number> = {};
    for (const c of o.cost?.components ?? []) sources[c.source ?? "?"] = (sources[c.source ?? "?"] ?? 0) + Number(c.microUsd ?? 0);
    return { name: o.name, id: o.id, total: est ?? 0, costed: est != null, sources };
  });
  const allSources = [...new Set(rows.flatMap((r) => Object.keys(r.sources)))].sort();
  const body = rows.slice().sort((a, b) => b.total - a.total).map((r) =>
    `<tr data-total="${r.total}"><td><input type="checkbox" class="cx-pick" data-total="${r.total}" data-sources='${escapeHtml(JSON.stringify(r.sources))}'/></td><td class="opn"><a href="#${escapeHtml(r.id)}">${escapeHtml(r.name)}</a></td><td>${r.costed ? `${fmtUsd(r.total)} <span class="muted">${r.total}µ$</span>` : '<span class="cost uncosted">no model</span>'}</td>${allSources.map((s) => `<td class="muted">${r.sources[s] ? r.sources[s] + "µ$" : ""}</td>`).join("")}</tr>`).join("");
  return `<div class="section" id="cost-explorer"><h2>Cost Explorer + Workflow Calculator</h2>
    <p class="muted">Every operation by declared cost + source (a contract fact, not telemetry). Tick a sequence of operations to build a WORKFLOW — see its cumulative cost + per-source breakdown + a monthly projection. Budget a user journey <i>before</i> you build it. No 3.x tool models cost at all.</p>
    <div class="cx-calc"><b>Workflow:</b> <span id="cx-sum">$0</span> <span id="cx-bd" class="muted"></span> · <label>×<input id="cx-mult" type="number" value="1000" min="0"/> calls/mo = <b id="cx-month">$0</b></label> <button class="tbtn" id="cx-clear">clear</button></div>
    <table class="matrix cx-table"><thead><tr><th></th><th>operation</th><th data-sort="cost" class="sortable">cost ⇅</th>${allSources.map((s) => `<th>${escapeHtml(s)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function adaPlayground(ir: RefDoc): string {
  const index = ir.operations.map((o) => ({ name: o.name, id: o.id, method: o.signature.method, pathShape: o.signature.pathShape, contentType: o.signature.contentType }));
  return `<div class="section" id="ada"><h2>ADA Resolution Playground</h2>
    <p class="muted">v4 dispatches a request to a NAMED operation by its computed <b>signature</b>, not by method+path (which need not be unique). Enter a request and watch it resolve — uniquely, to a <b>collision</b>, or to a runtime-dependent set. A question 3.x never had to ask.</p>
    <div class="ada-form"><select id="ada-method"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select><input id="ada-path" placeholder="/product/42" aria-label="path"/><input id="ada-ct" placeholder="content-type (optional)" aria-label="content-type"/><button class="tbtn" id="ada-go">Resolve →</button></div>
    <div id="ada-out" class="muted">Enter a request and press Resolve.</div>
    <script>window.__SULUK_SIG_INDEX=${embed(index)};</script></div>`;
}

/** The projection thesis as a compact map: this ONE contract becomes N layers. Contract-derivable counts only. */
export function projectionMap(ir: RefDoc): string {
  const priced = ir.operations.filter((o) => costEstimate(o.cost) != null).length;
  const gated = ir.operations.filter((o) => o.access).length;
  const layers = [
    ["Contract", `${ir.operations.length} operations`, "#main"],
    ["Data", `${ir.models.length} models`, "#models"],
    ["Access", `${gated} gated`, "#reachability"],
    ["Cost", `${priced} priced`, "#cost-explorer"],
    ["Client", `curl · JS · Python`, "#main"],
    ["Auth", `${ir.security.length} schemes`, "#security"],
  ] as const;
  return `<div class="section" id="projections"><h2>One contract → every layer</h2>
    <p class="muted">The same v4 contract is not a document but a function — it projects into each layer below. Change the contract, and all of them change.</p>
    <div class="proj-grid">${layers.map(([name, detail, href]) => `<a class="proj-card" href="${href}"><div class="proj-name">${escapeHtml(name)}</div><div class="proj-detail muted">${escapeHtml(detail)}</div></a>`).join("")}</div></div>`;
}
