/**
 * @suluk/reference — a COMPLETE, v4-native OpenAPI reference renderer. Reads an OpenAPIv4Document directly (never
 * the 3.1 downgrade) and renders, in one self-contained server-rendered page (no client build, no CDN — runs in a
 * Cloudflare Worker), everything a senior API-reference would ship PLUS the v4-only facets a 3.x tool cannot host:
 *
 *   identity   — operations as NAMED requests (method is a chip, not the key); multiple requests can share a method
 *   dispatch   — the 3-valued ADA collision verdict over a path's request set (provably-disjoint/collision/?)
 *   cost       — x-suluk-cost as a per-op badge + source breakdown, a coverage rollup, and declared-vs-actual drift
 *   projection — x-suluk-access → a "View-as" lens that recomputes the reachable operation SET per viewer + a matrix
 *   structure  — typed parameter slots, named-response variants, $ref models, webhooks
 *   chrome     — ⌘K search, scroll-spy, deep-linking, collapse, dark mode, copy-as-curl, generated examples
 */
import type { OpenAPIv4Document } from "@suluk/core";
import {
  escapeHtml, fmtUsd, costEstimate, costRollup, type CostModel,
  type AccessFacet, type Viewer, DEFAULT_VIEWERS, reachable, crossCut, collisionsFor,
} from "./facets";
import { schemaHtml, sampleOf } from "./schema";
import { STYLE, SCRIPT } from "./assets";

export interface ReferenceOptions {
  pageTitle?: string;
  tagline?: string;
  /** the viewers the View-as lens can project for (default: Anonymous / Signed-in user / Admin). */
  viewers?: Viewer[];
  /** a same-origin URL returning the cost ledger (with a byOperation map) → enables live declared-vs-actual drift. */
  costLedgerUrl?: string;
}

interface V4Req {
  method: string; summary?: string; description?: string; deprecated?: boolean; tags?: string[];
  contentType?: string | string[]; contentSchema?: unknown;
  parameterSchema?: { query?: unknown; path?: unknown; header?: unknown; cookie?: unknown; body?: unknown };
  responses?: Record<string, { status: string | number; description?: string; contentType?: string | string[]; contentSchema?: unknown }>;
  security?: Record<string, unknown>[];
  ["x-suluk-cost"]?: CostModel; ["x-suluk-access"]?: AccessFacet;
  [k: string]: unknown;
}

const METHOD_COLOR: Record<string, string> = { get: "#0e7490", post: "#15803d", put: "#a16207", patch: "#7c3aed", delete: "#b91c1c", head: "#475569", options: "#475569" };
const id = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "-");
const mdInline = (s: string) => escapeHtml(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
const statusClass = (st: string | number) => { const s = String(st); return s.startsWith("2") ? "s2" : s.startsWith("4") ? "s4" : s.startsWith("5") ? "s5" : "sd"; };

const ACCESS_CHIP: Record<string, { icon: string; label: string; cls: string }> = {
  anyone: { icon: "🌐", label: "public", cls: "acc-any" },
  authenticated: { icon: "👤", label: "signed-in", cls: "acc-auth" },
  admin: { icon: "🔒", label: "admin", cls: "acc-admin" },
};
function accessChip(facet: AccessFacet | undefined): string {
  const a = ACCESS_CHIP[facet?.requires ?? "anyone"];
  return `<span class="acc ${a.cls}" title="reachable by: ${a.label}${facet?.scope === "owner" ? " (own rows only)" : ""}">${a.icon} ${a.label}${facet?.scope === "owner" ? " · own" : ""}</span>`;
}
function costBadge(cost: CostModel | undefined): string {
  const est = costEstimate(cost);
  if (est == null) return `<span class="cost uncosted" title="this operation declares no x-suluk-cost">⛁ no cost model</span>`;
  const parts = (cost?.components ?? []).map((c) => `${escapeHtml(c.source ?? "?")} ${c.microUsd ?? 0}µ$`).join(" · ");
  return `<span class="cost" title="${escapeHtml(parts || "cost")}">⛁ ${fmtUsd(est)} <span class="cost-raw">${Math.round(est)}µ$</span><span class="drift" data-drift></span></span>`;
}

const codeBlock = (v: unknown) => `<pre class="json">${escapeHtml(JSON.stringify(v, null, 2))}</pre>`;
const slot = (doc: OpenAPIv4Document, label: string, schema: unknown) => schema == null ? "" : `<div class="slot"><div class="slot-label">${label}</div>${schemaHtml(doc, schema)}</div>`;

function curlFor(server: string, method: string, uri: string, ct: string | undefined, sample: unknown): string {
  const path = uri.replace(/\{[?&][^}]*\}/g, "").replace(/^\/?/, "/");
  let c = `curl -X ${method.toUpperCase()} ${server}${path}`;
  if (sample !== undefined && method.toLowerCase() !== "get") c += ` \\\n  -H '${ct || "application/json"}' \\\n  -d '${JSON.stringify(sample)}'`;
  return c;
}

function requestCard(doc: OpenAPIv4Document, server: string, uri: string, name: string, req: V4Req, shareCount: number, collideHtml: string, reach: string[]): string {
  const m = req.method.toLowerCase();
  const ps = req.parameterSchema ?? {};
  const body = req.contentSchema ?? ps.body;
  const ct = Array.isArray(req.contentType) ? req.contentType[0] : req.contentType;
  const sec = (req.security ?? []).flatMap((o) => Object.keys(o));
  const est = costEstimate(req["x-suluk-cost"]);
  const responses = Object.entries(req.responses ?? {}).map(([rname, r]) => {
    const sample = r.contentSchema != null ? sampleOf(doc, r.contentSchema) : undefined;
    return `<div class="resp"><span class="status ${statusClass(r.status)}">${escapeHtml(String(r.status))}</span> <span class="rname">${escapeHtml(rname)}</span>${r.description ? ` <span class="muted">${mdInline(r.description)}</span>` : ""}${r.contentSchema ? `<div class="resp-schema">${schemaHtml(doc, r.contentSchema)}</div>${sample !== undefined ? `<div class="example"><div class="slot-label">example <span class="copy" data-copy='${escapeHtml(JSON.stringify(sample))}'>copy</span></div>${codeBlock(sample)}</div>` : ""}` : ""}</div>`;
  }).join("");
  const bodySample = body != null ? sampleOf(doc, body) : undefined;
  return `<section class="op" id="op-${id(name)}" data-name="${escapeHtml((name + " " + uri + " " + m).toLowerCase())}" data-reach="${escapeHtml(reach.join(" "))}" data-op="${escapeHtml(name)}" data-cost="${est ?? ""}">
    <div class="op-head">
      <span class="method" style="background:${METHOD_COLOR[m] ?? "#475569"}">${escapeHtml(req.method.toUpperCase())}</span>
      <code class="op-path">${escapeHtml(uri)}</code>
      <span class="op-name">${escapeHtml(name)}</span>
      ${req.deprecated ? '<span class="dep">deprecated</span>' : ""}
      <span class="spacer"></span>
      ${accessChip(req["x-suluk-access"])}
      ${costBadge(req["x-suluk-cost"])}
      <span class="caret">▾</span>
    </div>
    <div class="op-body">
      ${shareCount > 1 ? `<div class="multi">▸ ${shareCount} named requests share <b>${escapeHtml(req.method.toUpperCase())}</b> on this path — a v4 capability a 3.1 view cannot represent.</div>` : ""}
      ${collideHtml}
      ${req.summary ? `<p class="op-summary">${mdInline(req.summary)}</p>` : ""}
      ${req.description ? `<p class="muted">${mdInline(req.description)}</p>` : ""}
      ${sec.length ? `<div class="sec">🔒 requires ${sec.map((x) => `<span class="chip">${escapeHtml(x)}</span>`).join(" ")}</div>` : ""}
      <div class="toolbar"><span class="copy" data-copy="${escapeHtml(server + uri)}">copy path</span><span class="copy" data-copy="${escapeHtml(curlFor(server, m, uri, ct, bodySample))}">copy as curl</span></div>
      <div class="slots">
        ${slot(doc, "Path params", ps.path)}${slot(doc, "Query params", ps.query)}${slot(doc, "Headers", ps.header)}${slot(doc, "Cookies", ps.cookie)}
        ${body != null ? `<div class="slot"><div class="slot-label">Request body${ct ? ` <span class="muted">(${escapeHtml(ct)})</span>` : ""}</div>${schemaHtml(doc, body)}${bodySample !== undefined ? `<div class="example"><div class="slot-label">example <span class="copy" data-copy='${escapeHtml(JSON.stringify(bodySample))}'>copy</span></div>${codeBlock(bodySample)}</div>` : ""}</div>` : ""}
      </div>
      ${responses ? `<div class="responses"><div class="slot-label">Responses (by name)</div>${responses}</div>` : ""}
    </div>
  </section>`;
}

export function referenceHtml(doc: OpenAPIv4Document, opts: ReferenceOptions = {}): string {
  const title = opts.pageTitle ?? doc.info?.title ?? "API Reference";
  const tagline = opts.tagline ?? "One typed v4 contract — projected into CRUD · client · UI · cost · docs.";
  const viewers = opts.viewers ?? DEFAULT_VIEWERS;
  const server = doc.servers?.[0]?.url ?? "";

  // walk paths → named requests, computing per-op facets (cost / access-reach / collisions)
  const groups = new Map<string, string[]>();
  const navByGroup = new Map<string, string>();
  let opCount = 0;
  for (const [uri, piRaw] of Object.entries(doc.paths ?? {})) {
    const pi = piRaw as { requests?: Record<string, V4Req> };
    const reqs = Object.entries(pi.requests ?? {});
    const byMethod = new Map<string, number>();
    for (const [, r] of reqs) byMethod.set(r.method.toLowerCase(), (byMethod.get(r.method.toLowerCase()) ?? 0) + 1);
    const collisions = collisionsFor(uri, pi.requests as never);
    for (const [name, req] of reqs) {
      opCount++;
      const tag = req.tags?.[0] ?? uri;
      const reach = viewers.filter((v) => reachable(req["x-suluk-access"], v)).map((v) => v.id);
      const myCollisions = collisions.filter((c) => c.a === name || c.b === name);
      const collideHtml = myCollisions.map((c) => `<div class="collide ${c.verdict}"><b>signature ${c.verdict.replace(/-/g, " ")}</b> with <code>${escapeHtml(c.a === name ? c.b : c.a)}</code> — ${escapeHtml(c.reason)}</div>`).join("");
      const card = requestCard(doc, server, uri, name, req, byMethod.get(req.method.toLowerCase()) ?? 1, collideHtml, reach);
      (groups.get(tag) ?? groups.set(tag, []).get(tag)!).push(card);
      const navItem = `<a class="nav-op" href="#op-${id(name)}" data-name="${escapeHtml((name + " " + uri).toLowerCase())}" data-reach="${escapeHtml(reach.join(" "))}"><span class="nm" style="color:${METHOD_COLOR[req.method.toLowerCase()] ?? "#475569"}">${escapeHtml(req.method.toUpperCase())}</span>${escapeHtml(name)}</a>`;
      navByGroup.set(tag, (navByGroup.get(tag) ?? "") + navItem);
    }
  }

  const nav = [...navByGroup.entries()].map(([tag, items]) => `<div class="nav-group"><div class="nav-tag">${escapeHtml(tag)}</div>${items}</div>`).join("");
  const body = [...groups.entries()].map(([tag, cards]) => `<div class="group"><h2 id="tag-${id(tag)}">${escapeHtml(tag)}</h2>${cards.join("")}</div>`).join("");

  // the cost coverage rollup (priced / undeclared / total)
  const roll = costRollup(doc);
  const costBadgeHero = `<span class="badge cost" title="${roll.priced} priced · ${roll.undeclared} undeclared">⛁ ${fmtUsd(roll.totalMicroUsd)} total · ${roll.priced}/${roll.priced + roll.undeclared} priced</span>`;

  // the View-as lens (sidebar) + the reachability matrix (section)
  const lens = `<div class="lens"><div class="lens-label">View as</div><div class="lens-btns">
    <button class="lens-btn" data-view="all">Everything <span class="cnt" id="view-count">${opCount}</span></button>
    ${viewers.map((v) => `<button class="lens-btn" data-view="${escapeHtml(v.id)}">${escapeHtml(v.label)}</button>`).join("")}
  </div></div>`;
  const cc = crossCut(doc, viewers);
  const matrix = `<div class="section" id="reachability"><h2>Reachability — the contract refracted per viewer</h2>
    <p class="muted">Access is a contract facet (<code>x-suluk-access</code>). Each operation × each viewer: ● reachable / · not. The <b>View as</b> lens recomputes the visible operation set from this.</p>
    <table class="matrix"><thead><tr><th>operation</th><th>requires</th>${viewers.map((v) => `<th>${escapeHtml(v.label)}</th>`).join("")}</tr></thead><tbody>
    ${cc.rows.map((r) => `<tr><td class="opn">${escapeHtml(r.name)}</td><td><span class="acc ${ACCESS_CHIP[r.requires]?.cls ?? "acc-any"}">${escapeHtml(r.requires)}${r.scope === "owner" ? " · own" : ""}</span></td>${viewers.map((v) => `<td class="cell ${r.reach[v.id] ? "yes" : "no"}">${r.reach[v.id] ? "●" : "·"}</td>`).join("")}</tr>`).join("")}
    </tbody></table></div>`;

  // webhooks
  const webhookEntries = Object.entries(doc.webhooks ?? {});
  const webhooks = webhookEntries.length ? `<div class="section" id="webhooks"><h2>Webhooks — operations the API receives</h2>${webhookEntries.map(([name, req]) => requestCard(doc, server, `webhooks/${name}`, name, req as unknown as V4Req, 1, "", viewers.map((v) => v.id))).join("")}</div>` : "";

  // models (components.schemas)
  const schemas = doc.components?.schemas ? Object.entries(doc.components.schemas) : [];
  const models = schemas.length ? `<div class="section" id="models"><h2>Models</h2>${schemas.map(([n, s]) => `<div class="model" id="model-${id(n)}"><h3>${escapeHtml(n)}</h3>${schemaHtml(doc, s)}</div>`).join("")}</div>` : "";

  // security schemes
  const schemes = doc.components?.securitySchemes ? Object.entries(doc.components.securitySchemes) : [];
  const security = schemes.length ? `<div class="section" id="security"><h2>Authentication</h2>${schemes.map(([n, s]) => { const o = s as unknown as Record<string, unknown>; return `<div class="scheme"><b>${escapeHtml(n)}</b> <span class="chip">${escapeHtml(String(o.type ?? ""))}${o.scheme ? " · " + escapeHtml(String(o.scheme)) : ""}${o.in ? " · in " + escapeHtml(String(o.in)) : ""}</span>${o.description ? `<p class="muted">${mdInline(String(o.description))}</p>` : ""}</div>`; }).join("")}</div>` : "";

  const costInit = opts.costLedgerUrl ? `<script>window.__SULUK_COST_URL=${JSON.stringify(opts.costLedgerUrl)};</script>` : "";

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(opts.pageTitle ?? title)}</title>
<style>${STYLE}</style></head><body>
<button class="iconbtn menu-toggle" data-act="menu" aria-label="menu">☰</button>
<aside class="side">
  <div class="side-head"><div class="logo">⛬ Suluk</div><div class="side-actions"><button class="iconbtn" data-act="theme" title="theme" aria-label="theme">◑</button></div></div>
  <div style="position:relative"><input id="filter" placeholder="Filter operations…" autocomplete="off"/><span class="kbd" style="position:absolute;right:8px;top:8px">⌘K</span></div>
  ${lens}
  <nav id="nav">${nav}</nav>
  <div class="side-foot">
    <a href="/openapi.json">⬇ OpenAPI v4 document</a>
    <a href="#reachability">Reachability matrix</a>
    ${models ? '<a href="#models">Models</a>' : ""}
    ${security ? '<a href="#security">Authentication</a>' : ""}
  </div>
</aside>
<main>
  <header class="hero">
    <div class="badges"><span class="badge v4">OpenAPI ${escapeHtml(doc.openapi ?? "4.0.0-candidate")}</span><span class="badge">${opCount} operations</span>${costBadgeHero}${schemes.length ? `<span class="badge">${schemes.length} auth scheme${schemes.length > 1 ? "s" : ""}</span>` : ""}</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="tagline">${escapeHtml(tagline)}</p>
    ${doc.info?.description ? `<p class="muted">${mdInline(doc.info.description)}</p>` : ""}
    <p class="native-note">Rendered natively from the v4 document — the <b>requests</b>-shape, the <b>⛁ cost</b> facet, signature <b>collisions</b>, and the <b>View-as</b> access projection shown as-is, not flattened to a 3.1 view.</p>
  </header>
  <div class="toolbar"><button class="tbtn" data-act="expand">Expand all</button><button class="tbtn" data-act="collapse">Collapse all</button></div>
  ${body}
  ${webhooks}
  ${matrix}
  ${models}
  ${security}
  <footer class="foot">CANDIDATE — not official OpenAPI. Rendered by <b>@suluk/reference</b> directly from the v4 contract.</footer>
</main>
${costInit}
<script>${SCRIPT}</script>
</body></html>`;
}

export function referenceResponse(doc: OpenAPIv4Document, opts: ReferenceOptions = {}): Response {
  return new Response(referenceHtml(doc, opts), { headers: { "content-type": "text/html; charset=utf-8" } });
}

export {
  escapeHtml, crossCut, reachable, costRollup, DEFAULT_VIEWERS,
  type Viewer, type AccessFacet, type CostModel, type CrossCutRow,
} from "./facets";
export { schemaHtml, sampleOf } from "./schema";
