/**
 * @suluk/reference — a COMPLETE, v4-native OpenAPI reference renderer, built as a PLATFORM (see ROADMAP.md).
 *
 * Pipeline: normalize(doc) → RefDoc (the semantic IR — the only place raw v4 shapes are read) → render adapter
 * (this file) → self-contained HTML (no client build, no CDN — runs in a Cloudflare Worker). try-it + every code
 * sample consume the IR's normalized request, so they can't drift. v4-only facets a 3.x tool cannot host: cost
 * (badge + coverage + drift), access (View-as projection + 3-state reachability matrix), signature collisions,
 * effective-vs-authored composition. Plugin seams (onNormalize + render slots) are locked here at v1.
 */
import type { OpenAPIv4Document } from "@suluk/core";
import {
  escapeHtml, fmtUsd, costEstimate, costRollup, type CostModel,
  type AccessFacet, type Viewer, DEFAULT_VIEWERS, reachable, reachState, crossCut,
} from "./facets";
import { schemaHtml, sampleOf, constraintNotes } from "./schema";
import { normalize, type RefDoc, type NormalizedOperation, type NormalizedParam, type ServerEntry } from "./ir";
import { codeSamples } from "./codegen";
import { costExplorer, adaPlayground, projectionMap, hardeningPanel, hardenBadge } from "./panels";
import { auditDocument, type OpAudit, type DocAudit } from "@suluk/harden";
import { STYLE, SCRIPT } from "./assets";

export interface ReferencePlugin {
  name: string;
  onNormalize?: (ir: RefDoc) => RefDoc | void;
  slots?: { heroAfter?: (ir: RefDoc) => string; opCardAfter?: (op: NormalizedOperation) => string };
}
export interface ReferenceOptions {
  pageTitle?: string;
  tagline?: string;
  viewers?: Viewer[];
  /** a same-origin URL returning the cost ledger (with opStats) → live declared-vs-actual cost drift. */
  costLedgerUrl?: string;
  /** enable the in-page try-it executor (same-origin fetch). Default true. */
  tryIt?: boolean;
  /**
   * a same-origin URL returning `{ viewer: "<id>" }` for the CURRENT session → the renderer auto-selects that
   * viewer's lens (the council-ratified L2 "live per-user view") and re-checks on focus. The full canonical document
   * is ALWAYS the source + always escapable via "Everything" — the projection is a client-side legible subset.
   */
  whoamiUrl?: string;
  /** a URL serving a generated TypeScript SDK (@suluk/sdk) → a prominent "Download SDK" affordance. */
  sdkUrl?: string;
  plugins?: ReferencePlugin[];
}

const METHOD_COLOR: Record<string, string> = { get: "#0e7490", post: "#15803d", put: "#a16207", patch: "#7c3aed", delete: "#b91c1c", head: "#475569", options: "#475569" };
const mdInline = (s: string) => escapeHtml(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
const statusClass = (st: string) => (st.startsWith("2") ? "s2" : st.startsWith("4") ? "s4" : st.startsWith("5") ? "s5" : "sd");

const ACCESS_CHIP: Record<string, { icon: string; label: string; cls: string }> = {
  anyone: { icon: "🌐", label: "public", cls: "acc-any" },
  authenticated: { icon: "👤", label: "signed-in", cls: "acc-auth" },
  admin: { icon: "🔒", label: "admin", cls: "acc-admin" },
};
function accessChip(facet: AccessFacet | undefined): string {
  const a = ACCESS_CHIP[facet?.requires ?? "anyone"] ?? ACCESS_CHIP.anyone; // ?? guard: a typo'd requires can't throw
  return `<span class="acc ${a.cls}" title="reachable by: ${a.label}${facet?.scope === "owner" ? " (own rows only)" : ""}">${a.icon} ${a.label}${facet?.scope === "owner" ? " · own" : ""}</span>`;
}
function costBadge(cost: CostModel | undefined): string {
  const est = costEstimate(cost);
  if (est == null) return `<span class="cost uncosted" title="declares no x-suluk-cost">⛁ no cost model</span>`;
  const parts = (cost?.components ?? []).map((c) => `${escapeHtml(c.source ?? "?")} ${c.microUsd ?? 0}µ$`).join(" · ");
  return `<span class="cost" title="${escapeHtml(parts || "cost")}">⛁ ${fmtUsd(est)} <span class="cost-raw">${Math.round(est)}µ$</span><span class="drift" data-drift></span></span>`;
}
const codeBlock = (v: unknown) => `<pre class="json">${escapeHtml(JSON.stringify(v, null, 2))}</pre>`;

function paramTable(doc: OpenAPIv4Document, label: string, loc: string, params: NormalizedParam[], tryIt: boolean): string {
  if (!params.length) return "";
  const rows = params.map((p) => {
    const inh = p.inherited ? ' <span class="inh" title="inherited from the path-level shared schema">inherited</span>' : "";
    const cons = typeof p.schema === "object" && p.schema ? constraintNotes(p.schema as Record<string, unknown>) : "";
    const input = tryIt ? `<input class="ti" data-param-name="${escapeHtml(p.name)}" data-param-in="${loc}" placeholder="${escapeHtml(p.name)}"/>` : "";
    return `<tr><td class="pname">${escapeHtml(p.name)}${p.required ? '<span class="req">*</span>' : ""}${inh}</td><td class="ptype">${schemaHtml(doc, p.schema)}</td><td class="pdesc">${p.description ? mdInline(p.description) : ""} ${cons}</td>${tryIt ? `<td>${input}</td>` : ""}</tr>`;
  }).join("");
  return `<div class="slot"><div class="slot-label">${label}</div><table class="props"><thead><tr><th>name</th><th>type</th><th>notes</th>${tryIt ? "<th>value</th>" : ""}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function opCard(doc: OpenAPIv4Document, ir: RefDoc, op: NormalizedOperation, viewers: Viewer[], server: string, opts: ReferenceOptions, harden?: OpAudit): string {
  const m = op.method;
  const reach = viewers.filter((v) => reachable(op.access, v)).map((v) => v.id);
  const bodySample = op.request.body ? sampleOf(doc, op.request.body.schema) : undefined;
  const samples = codeSamples(server, op, bodySample);
  const sampleTabs = `<div class="samples"><div class="tabs">${samples.map((s, i) => `<button class="tab${i === 0 ? " on" : ""}" data-tab="${escapeHtml(op.id)}-${s.lang}">${escapeHtml(s.label)}</button>`).join("")}<span class="copy" data-copy="${escapeHtml(samples[0].code)}">copy</span></div>${samples.map((s, i) => `<pre class="json sample${i === 0 ? " on" : ""}" id="${escapeHtml(op.id)}-${s.lang}">${escapeHtml(s.code)}</pre>`).join("")}</div>`;

  const collide = op.collisions.map((c) => `<div class="collide ${c.verdict}"><b>signature ${c.verdict.replace(/-/g, " ")}</b> with <code>${escapeHtml(c.with)}</code> — ${escapeHtml(c.reason)}</div>`).join("");
  const byLoc = (loc: string) => op.request.params.filter((p) => p.in === loc);
  const responses = op.responses.map((r) => `<div class="resp"><span class="status ${statusClass(r.status)}">${escapeHtml(r.status)}</span> <span class="rname">${escapeHtml(r.name)}</span>${r.contentType ? ` <span class="muted">(${escapeHtml(r.contentType)})</span>` : ""}${r.inherited ? ' <span class="inh">inherited</span>' : ""}${r.description ? ` <span class="muted">${mdInline(r.description)}</span>` : ""}${r.schema ? `<div class="resp-schema">${schemaHtml(doc, r.schema)}</div>${(() => { const s = sampleOf(doc, r.schema); return s !== undefined ? `<div class="example"><div class="slot-label">example <span class="copy" data-copy='${escapeHtml(JSON.stringify(s))}'>copy</span></div>${codeBlock(s)}</div>` : ""; })()}` : ""}</div>`).join("");

  const tryIt = opts.tryIt !== false;
  const tryPanel = tryIt ? `<div class="tryit"><button class="tbtn ti-send" data-method="${m}" data-path="${escapeHtml(op.path)}" data-server="${escapeHtml(server)}"${op.request.body ? ' data-has-body="1"' : ""}>▶ Send</button>${op.request.body ? `<div class="ti-body"><div class="slot-label">body</div><textarea class="ti-body-input" rows="4">${escapeHtml(JSON.stringify(bodySample, null, 2))}</textarea></div>` : ""}<div class="ti-out"></div></div>` : "";

  const est = costEstimate(op.cost);
  return `<section class="op" id="${escapeHtml(op.id)}" data-name="${escapeHtml((op.name + " " + op.path + " " + m).toLowerCase())}" data-reach="${escapeHtml(reach.join(" "))}" data-op="${escapeHtml(op.name)}" data-cost="${est ?? ""}">
    <button class="op-head" type="button" aria-expanded="true" aria-controls="body-${escapeHtml(op.id)}">
      <span class="method" style="background:${METHOD_COLOR[m] ?? "#475569"}">${escapeHtml(m.toUpperCase())}</span>
      <code class="op-path">${escapeHtml(op.path)}</code>
      <span class="op-name">${escapeHtml(op.name)}</span>
      ${op.deprecated ? '<span class="dep">deprecated</span>' : ""}
      <span class="spacer"></span>
      ${harden ? hardenBadge(harden.grade, `hardening: ${harden.findings.length} finding(s) · ${harden.score}/100`) : ""}
      ${accessChip(op.access)}
      ${costBadge(op.cost)}
      <span class="caret" aria-hidden="true">▾</span>
    </button>
    <div class="op-body" id="body-${escapeHtml(op.id)}">
      ${op.shareCount > 1 ? `<div class="multi">▸ ${op.shareCount} named requests share <b>${escapeHtml(m.toUpperCase())}</b> on this path — a v4 capability a 3.1 view cannot represent.</div>` : ""}
      ${collide}
      ${op.summary ? `<p class="op-summary">${mdInline(op.summary)}</p>` : ""}
      ${op.description ? `<p class="muted">${mdInline(op.description)}</p>` : ""}
      ${op.security.length ? `<div class="sec">🔒 requires ${op.security.map((x) => `<a class="chip" href="#scheme-${escapeHtml(x)}">${escapeHtml(x)}</a>`).join(" ")}</div>` : ""}
      <div class="toolbar"><span class="copy" data-copy="${escapeHtml(server + op.path)}">copy path</span><span class="copy deeplink" data-frag="${escapeHtml(op.id)}">copy link</span></div>
      ${sampleTabs}
      ${tryPanel}
      <div class="slots">
        ${paramTable(doc, "Path params", "path", byLoc("path"), tryIt)}${paramTable(doc, "Query params", "query", byLoc("query"), tryIt)}${paramTable(doc, "Headers", "header", byLoc("header"), tryIt)}${paramTable(doc, "Cookies", "cookie", byLoc("cookie"), tryIt)}
        ${op.request.body ? `<div class="slot"><div class="slot-label">Request body <span class="muted">(${escapeHtml(op.request.body.contentType)})</span></div>${schemaHtml(doc, op.request.body.schema)}</div>` : ""}
      </div>
      ${responses ? `<div class="responses"><div class="slot-label">Responses (by name)</div>${responses}</div>` : ""}
    </div>
    ${(opts.plugins ?? []).map((p) => p.slots?.opCardAfter?.(op) ?? "").join("")}
  </section>`;
}

export function referenceHtml(doc: OpenAPIv4Document, opts: ReferenceOptions = {}): string {
  let ir = normalize(doc);
  for (const p of opts.plugins ?? []) ir = p.onNormalize?.(ir) ?? ir;
  const viewers = opts.viewers ?? DEFAULT_VIEWERS;
  const servers = ir.servers.length ? ir.servers : [{ url: "" }];
  const server = servers[0].url;
  const hardening = auditDocument(doc); // the hardening facet (grade per op + a doc rollup)
  const hardenByName = new Map(hardening.byOperation.map((o) => [o.operation, o]));

  // group operations by tag (preserving the IR's tag metadata + order)
  const tagOrder = new Map(ir.tags.map((t, i) => [t.name, t.order ?? i]));
  const groups = new Map<string, NormalizedOperation[]>();
  for (const op of ir.operations) { const tag = op.tag ?? op.path; (groups.get(tag) ?? groups.set(tag, []).get(tag)!).push(op); }
  const sortedTags = [...groups.keys()].sort((a, b) => (tagOrder.get(a) ?? 999) - (tagOrder.get(b) ?? 999));
  const tagMeta = new Map(ir.tags.map((t) => [t.name, t]));

  const nav = sortedTags.map((tag) => `<div class="nav-group"><div class="nav-tag">${escapeHtml(tag)}</div>${groups.get(tag)!.map((op) => { const reach = viewers.filter((v) => reachable(op.access, v)).map((v) => v.id); return `<a class="nav-op" href="#${escapeHtml(op.id)}" data-name="${escapeHtml((op.name + " " + op.path).toLowerCase())}" data-reach="${escapeHtml(reach.join(" "))}"><span class="nm" style="color:${METHOD_COLOR[op.method] ?? "#475569"}">${escapeHtml(op.method.toUpperCase())}</span>${escapeHtml(op.name)}</a>`; }).join("")}</div>`).join("");

  const body = sortedTags.map((tag) => { const t = tagMeta.get(tag); return `<div class="group"><h2 id="tag-${escapeHtml(tag)}">${escapeHtml(t?.summary ?? tag)}${t?.type ? ` <span class="badge">${escapeHtml(t.type)}</span>` : ""}</h2>${t?.description ? `<p class="muted">${mdInline(t.description)}</p>` : ""}${groups.get(tag)!.map((op) => opCard(doc, ir, op, viewers, server, opts, hardenByName.get(op.name))).join("")}</div>`; }).join("");

  const roll = costRollup(doc);
  const costHero = `<span class="badge cost" title="${roll.priced} priced · ${roll.undeclared} undeclared">⛁ ${fmtUsd(roll.totalMicroUsd)} priced subtotal · ${roll.priced}/${roll.priced + roll.undeclared} priced</span>`;
  const hardenHero = `<a class="badge harden-hero" href="#hardening" style="background:${["F","D"].includes(hardening.grade) ? "#fee2e2" : hardening.grade === "C" ? "#fef9c3" : "#dcfce7"};color:${["F","D"].includes(hardening.grade) ? "#991b1b" : hardening.grade === "C" ? "#854d0e" : "#166534"}" title="${hardening.bySeverity.high} high · ${hardening.bySeverity.medium} medium findings">🛡 Hardening ${hardening.grade} · ${hardening.score}% bounded</a>`;

  const lens = `<div class="lens" role="radiogroup" aria-label="View as"><div class="lens-label">View as</div><div class="lens-btns">
    <button class="lens-btn" role="radio" data-view="all">Everything <span class="cnt" id="view-count">${ir.operations.length}</span></button>
    ${viewers.map((v) => `<button class="lens-btn" role="radio" data-view="${escapeHtml(v.id)}">${escapeHtml(v.label)}</button>`).join("")}
  </div><div id="view-status" class="view-status"></div></div>`;

  const cc = crossCut(doc, viewers);
  const GLYPH: Record<string, string> = { full: '<span class="yes" title="reachable">●</span>', scoped: '<span class="scoped" title="reachable, restricted to own rows">◐</span>', none: '<span class="no" title="not reachable">·</span>' };
  const matrix = `<div class="section" id="reachability"><h2>Reachability — the contract refracted per viewer</h2>
    <p class="muted">Access is a contract facet (<code>x-suluk-access</code>). ● full · ◐ own rows only · · not reachable. The <b>View as</b> lens recomputes the visible operation set from this.</p>
    <table class="matrix"><thead><tr><th>operation</th><th>requires</th>${viewers.map((v) => `<th>${escapeHtml(v.label)}</th>`).join("")}</tr></thead><tbody>
    ${cc.rows.map((r) => `<tr><td class="opn">${escapeHtml(r.name)}</td><td><span class="acc ${ACCESS_CHIP[r.requires]?.cls ?? "acc-any"}">${escapeHtml(r.requires)}${r.scope === "owner" ? " · own" : ""}</span></td>${viewers.map((v) => `<td class="cell" aria-label="${escapeHtml(v.label)}: ${r.reach[v.id]}">${GLYPH[r.reach[v.id]]}</td>`).join("")}</tr>`).join("")}
    </tbody></table></div>`;

  const webhooks = ir.webhooks.length ? `<div class="section" id="webhooks"><h2>Webhooks — operations the API receives</h2>${ir.webhooks.map((op) => opCard(doc, ir, op, viewers, server, opts, hardenByName.get(op.name))).join("")}</div>` : "";
  const models = ir.models.length ? `<div class="section" id="models"><h2>Models</h2>${ir.models.map((mod) => `<div class="model" id="model-${escapeHtml(mod.name)}" data-name="${escapeHtml(mod.name.toLowerCase())}"><h3>${escapeHtml(mod.name)}</h3>${schemaHtml(doc, mod.schema)}</div>`).join("")}</div>` : "";
  const security = ir.security.length ? `<div class="section" id="security"><h2>Authentication</h2>${ir.security.map((s) => `<div class="scheme" id="scheme-${escapeHtml(s.name)}"><b>${escapeHtml(s.name)}</b> <span class="chip">${escapeHtml(s.type ?? "")}${s.scheme ? " · " + escapeHtml(s.scheme) : ""}${s.in ? " · in " + escapeHtml(s.in) : ""}</span>${s.description ? `<p class="muted">${mdInline(s.description)}</p>` : ""}</div>`).join("")}</div>` : "";

  const diag = ir.diagnostics.length ? `<div class="diags" title="from normalize()">⚠ ${ir.diagnostics.length} diagnostic${ir.diagnostics.length > 1 ? "s" : ""}: ${ir.diagnostics.slice(0, 3).map((d) => escapeHtml(`${d.kind} @ ${d.where}`)).join(" · ")}${ir.diagnostics.length > 3 ? " …" : ""}</div>` : "";
  const serverSel = servers.length > 1 ? `<div class="serverbar"><label>Server</label><select id="server-select">${servers.map((s) => `<option value="${escapeHtml(s.url)}">${escapeHtml(s.url)}${s.description ? ` — ${escapeHtml(s.description)}` : ""}</option>`).join("")}</select></div>` : "";
  const authBar = (opts.tryIt !== false) ? `<div class="authbar"><label>Bearer token</label><input id="ti-token" type="password" placeholder="for Try-it requests"/></div>` : "";
  const costInit = opts.costLedgerUrl ? `<script>window.__SULUK_COST_URL=${JSON.stringify(opts.costLedgerUrl)};</script>` : "";
  const whoamiInit = opts.whoamiUrl ? `<script>window.__SULUK_WHOAMI=${JSON.stringify(opts.whoamiUrl)};</script>` : "";
  const heroSlots = (opts.plugins ?? []).map((p) => p.slots?.heroAfter?.(ir) ?? "").join("");

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(opts.pageTitle ?? ir.info.title)}</title>
<style>${STYLE}</style></head><body>
<a class="skip" href="#main">Skip to content</a>
<button class="iconbtn menu-toggle" data-act="menu" aria-label="Toggle navigation">☰</button>
<aside class="side">
  <div class="side-head"><div class="logo">⛬ Suluk</div><div class="side-actions"><button class="iconbtn" data-act="theme" title="Toggle theme" aria-label="Toggle theme">◑</button></div></div>
  <div style="position:relative"><input id="filter" placeholder="Filter operations + models…" autocomplete="off" aria-label="Filter"/><span class="kbd" style="position:absolute;right:8px;top:8px">⌘K</span></div>
  ${lens}
  <nav id="nav" aria-label="Operations">${nav}</nav>
  <div class="side-foot">
    ${opts.sdkUrl ? `<a class="sdk-dl" href="${escapeHtml(opts.sdkUrl)}" download>⬇ TypeScript SDK</a>` : ""}<a href="/openapi.json">⬇ OpenAPI v4 document</a><a href="#hardening">🛡 Hardening ${hardening.grade}</a><a href="#cost-explorer">Cost Explorer</a><a href="#ada">ADA Playground</a><a href="#reachability">Reachability matrix</a>${models ? '<a href="#models">Models</a>' : ""}${security ? '<a href="#security">Authentication</a>' : ""}
  </div>
</aside>
<main id="main">
  <header class="hero">
    <div class="badges"><span class="badge v4">OpenAPI ${escapeHtml(ir.spec.version)}</span><span class="badge">${ir.operations.length} operations</span>${costHero}${hardenHero}${ir.security.length ? `<span class="badge">${ir.security.length} auth scheme${ir.security.length > 1 ? "s" : ""}</span>` : ""}</div>
    <h1>${escapeHtml(ir.info.title)}</h1>
    <p class="tagline">${escapeHtml(opts.tagline ?? "One typed v4 contract — projected into CRUD · client · UI · cost · docs.")}</p>
    ${ir.info.description ? `<p class="muted">${mdInline(ir.info.description)}</p>` : ""}
    ${serverSel}${authBar}${diag}
    <p class="native-note">Rendered natively from the v4 document via a semantic IR — the <b>requests</b>-shape, <b>⛁ cost</b>, signature <b>collisions</b>, <b>effective</b> (composed) shape, and the <b>View-as</b> access projection shown as-is, not flattened to a 3.1 view.</p>
    ${heroSlots}
  </header>
  <div class="toolbar"><button class="tbtn" data-act="expand">Expand all</button><button class="tbtn" data-act="collapse">Collapse all</button></div>
  ${body}
  ${webhooks}
  ${projectionMap(ir)}
  ${hardeningPanel(hardening)}
  ${costExplorer(ir)}
  ${adaPlayground(ir)}
  ${matrix}
  ${models}
  ${security}
  <footer class="foot">CANDIDATE — not official OpenAPI. Rendered by <b>@suluk/reference</b> from the v4 contract via its semantic IR.</footer>
</main>
${costInit}${whoamiInit}
<script>${SCRIPT}</script>
</body></html>`;
}

export function referenceResponse(doc: OpenAPIv4Document, opts: ReferenceOptions = {}): Response {
  return new Response(referenceHtml(doc, opts), { headers: { "content-type": "text/html; charset=utf-8" } });
}

export { normalize, type RefDoc, type NormalizedOperation } from "./ir";
export { escapeHtml, crossCut, reachable, reachState, costRollup, DEFAULT_VIEWERS, type Viewer, type AccessFacet, type CostModel, type CrossCutRow } from "./facets";
export { schemaHtml, sampleOf, constraintNotes } from "./schema";
export { codeSamples } from "./codegen";
export { costExplorer, adaPlayground, projectionMap, hardeningPanel, hardenBadge } from "./panels";
export { portalHtml, portalResponse, type PortalEntry, type PortalOptions } from "./portal";
export { auditDocument, auditOperation, assertGrade, type DocAudit, type OpAudit, type Grade } from "@suluk/harden";
