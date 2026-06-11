/**
 * @suluk/reference — render an OpenAPI v4 "Suluk" document NATIVELY, as v4.
 *
 * Scalar and Swagger UI are OpenAPI 3.x renderers, so @suluk/scalar / @suluk/swagger first DOWNGRADE the v4
 * document to 3.1 (@suluk/openapi-compat) and hand the result to an existing tool. That projection is faithful
 * for the data, but the SURFACE a human reads then announces itself as "OpenAPI 3.1.0", flattens the v4
 * requests-shape into bare HTTP methods, and buries the cost facet — Suluk's identity vanishes at the docs.
 *
 * This renderer reads the v4 document directly and shows what a 3.x tool cannot:
 *   • the real identity            — "OpenAPI 4.0.0-candidate", projected from ONE contract
 *   • the requests-shape           — a path has NAMED requests (operations); several may share one HTTP method
 *                                     (the headline v4 capability the 3.1 downgrade has to drop, C003)
 *   • the cost facet               — x-suluk-cost rendered as a first-class per-operation badge + breakdown
 *   • per-operation security        — referenced by name into components.securitySchemes
 *
 * Self-contained server-rendered HTML (one string; a tiny inline script only for sidebar filtering). No client
 * build, no CDN, no node:fs — it runs in a Cloudflare Worker as happily as in a CLI.
 */
import type { OpenAPIv4Document } from "@suluk/core";
import { isReference, deref } from "@suluk/core";

export interface ReferenceOptions {
  /** Browser tab title (defaults to the document title). */
  pageTitle?: string;
  /** A short tagline under the title (defaults to a "one contract" line). */
  tagline?: string;
}

type AnySchema = Record<string, unknown> | boolean;
interface CostComponent { source?: string; basis?: string; microUsd?: number }
interface CostModel { estimateMicroUsd?: number; components?: CostComponent[] }
interface V4Request {
  method: string; summary?: string; description?: string; operationId?: string; tags?: string[]; deprecated?: boolean;
  contentType?: string | string[]; contentSchema?: unknown;
  parameterSchema?: { query?: unknown; path?: unknown; header?: unknown; cookie?: unknown; body?: unknown };
  responses?: Record<string, { status: string | number; description?: string; contentType?: string | string[]; contentSchema?: unknown }>;
  security?: Record<string, unknown>[];
  ["x-suluk-cost"]?: CostModel;
  [k: string]: unknown;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

const METHOD_COLOR: Record<string, string> = {
  get: "#0e7490", post: "#15803d", put: "#a16207", patch: "#7c3aed", delete: "#b91c1c", head: "#475569", options: "#475569",
};

/** Format µ$ as a compact dollar string (operations here are 1–300 µ$ → sub-cent). */
function fmtUsd(microUsd: number): string {
  const usd = microUsd / 1_000_000;
  return usd >= 0.01 ? `$${usd.toFixed(2)}` : usd >= 0.0001 ? `$${usd.toFixed(6).replace(/0+$/, "")}` : `${microUsd} µ$`;
}

/**
 * The cost facet as a first-class badge + a breakdown by source (compute / db / third-party). An operation with
 * NO declared cost gets an honest "no cost model" badge — never a silent $0, which would misrepresent coverage.
 */
function costBadge(cost: CostModel | undefined): string {
  if (!cost || (cost.estimateMicroUsd == null && !(cost.components ?? []).length)) {
    return `<span class="cost uncosted" title="this operation declares no x-suluk-cost">⛁ no cost model</span>`;
  }
  const est = Number(cost.estimateMicroUsd ?? (cost.components ?? []).reduce((s, c) => s + Number(c.microUsd ?? 0), 0));
  const parts = (cost.components ?? []).map((c) => `${escapeHtml(c.source ?? "?")} ${c.microUsd ?? 0}µ$`).join(" · ");
  return `<span class="cost" title="${escapeHtml(parts || "cost")}">⛁ ${fmtUsd(est)} <span class="cost-raw">${est}µ$</span></span>`;
}

const typeOf = (s: Record<string, unknown>): string => {
  if (Array.isArray(s.type)) return (s.type as string[]).join(" | ");
  if (typeof s.type === "string") return s.type as string;
  if (s.enum) return "enum";
  if (s.allOf || s.anyOf || s.oneOf) return "composed";
  return "any";
};

/** Render a JSON Schema (2020-12) compactly: object → a property table; scalar → a type chip. Derefs $ref once. */
function schemaHtml(doc: OpenAPIv4Document, schema: unknown, depth = 0): string {
  if (schema == null) return "";
  if (isReference(schema)) {
    const name = String((schema as { $ref: string }).$ref).split("/").pop() ?? "ref";
    const resolved = depth < 2 ? deref(doc, schema) : null;
    return resolved && !isReference(resolved)
      ? `<div class="ref"><span class="ref-name">${escapeHtml(name)}</span>${schemaHtml(doc, resolved, depth + 1)}</div>`
      : `<span class="chip">${escapeHtml(name)}</span>`;
  }
  if (typeof schema === "boolean") return `<span class="chip">${schema ? "any" : "never"}</span>`;
  const s = schema as Record<string, unknown>;
  if (s.type === "object" || s.properties) {
    const props = (s.properties ?? {}) as Record<string, unknown>;
    const required = new Set((s.required as string[] | undefined) ?? []);
    const keys = Object.keys(props);
    if (!keys.length) return `<span class="chip">object</span>`;
    const rows = keys.map((k) => {
      const ps = props[k] as Record<string, unknown>;
      const t = isReference(ps) ? String((ps as { $ref: string }).$ref).split("/").pop() : typeOf(ps);
      const desc = !isReference(ps) && typeof ps.description === "string" ? ps.description : "";
      return `<tr><td class="pname">${escapeHtml(k)}${required.has(k) ? '<span class="req">*</span>' : ""}</td><td class="ptype">${escapeHtml(String(t))}</td><td class="pdesc">${escapeHtml(desc)}</td></tr>`;
    }).join("");
    return `<table class="props"><tbody>${rows}</tbody></table>`;
  }
  if (s.enum) return `<span class="chip">enum</span> <span class="muted">${(s.enum as unknown[]).map((e) => escapeHtml(JSON.stringify(e))).join(", ")}</span>`;
  return `<span class="chip">${escapeHtml(typeOf(s))}</span>`;
}

const paramSlot = (doc: OpenAPIv4Document, label: string, schema: unknown): string =>
  schema == null ? "" : `<div class="slot"><div class="slot-label">${label}</div>${schemaHtml(doc, schema)}</div>`;

function requestCard(doc: OpenAPIv4Document, uri: string, name: string, req: V4Request, shareCount: number): string {
  const m = req.method.toLowerCase();
  const color = METHOD_COLOR[m] ?? "#475569";
  const ps = req.parameterSchema ?? {};
  const body = req.contentSchema ?? ps.body;
  const sec = (req.security ?? []).flatMap((o) => Object.keys(o));
  const responses = Object.entries(req.responses ?? {}).map(([rname, r]) =>
    `<div class="resp"><span class="status">${escapeHtml(String(r.status))}</span> <span class="rname">${escapeHtml(rname)}</span>${r.description ? ` <span class="muted">${escapeHtml(r.description)}</span>` : ""}${r.contentSchema ? `<div class="resp-schema">${schemaHtml(doc, r.contentSchema)}</div>` : ""}</div>`).join("");
  return `<section class="op" id="op-${escapeHtml(name)}" data-name="${escapeHtml((name + " " + uri).toLowerCase())}">
    <div class="op-head">
      <span class="method" style="background:${color}">${escapeHtml(req.method.toUpperCase())}</span>
      <code class="op-path">${escapeHtml(uri)}</code>
      <span class="op-name">${escapeHtml(name)}</span>
      ${req.deprecated ? '<span class="dep">deprecated</span>' : ""}
      ${costBadge(req["x-suluk-cost"])}
    </div>
    ${shareCount > 1 ? `<div class="multi">▸ ${shareCount} requests share <b>${escapeHtml(req.method.toUpperCase())}</b> on this path — a v4 capability a 3.1 view cannot show (it would drop all but one).</div>` : ""}
    ${req.summary ? `<p class="op-summary">${escapeHtml(req.summary)}</p>` : ""}
    ${req.description ? `<p class="muted">${escapeHtml(req.description)}</p>` : ""}
    ${sec.length ? `<div class="sec">🔒 ${sec.map((x) => `<span class="chip">${escapeHtml(x)}</span>`).join(" ")}</div>` : ""}
    <div class="slots">
      ${paramSlot(doc, "Path", ps.path)}${paramSlot(doc, "Query", ps.query)}${paramSlot(doc, "Header", ps.header)}
      ${body != null ? `<div class="slot"><div class="slot-label">Request body${req.contentType ? ` <span class="muted">(${escapeHtml(Array.isArray(req.contentType) ? req.contentType.join(", ") : req.contentType)})</span>` : ""}</div>${schemaHtml(doc, body)}</div>` : ""}
    </div>
    ${responses ? `<div class="responses"><div class="slot-label">Responses</div>${responses}</div>` : ""}
  </section>`;
}

/** Render a v4 document to a self-contained native HTML reference page. */
export function referenceHtml(doc: OpenAPIv4Document, opts: ReferenceOptions = {}): string {
  const title = opts.pageTitle ?? doc.info?.title ?? "API Reference";
  const tagline = opts.tagline ?? "One typed v4 contract — projected into CRUD · client · UI · cost · docs.";

  // group operations by their first tag (falls back to the path) — preserves the v4 requests-shape per path.
  const groups = new Map<string, string[]>(); // tag → operation HTML[]
  const navByGroup = new Map<string, { name: string; method: string }[]>();
  let opCount = 0;
  for (const [uri, piRaw] of Object.entries(doc.paths ?? {})) {
    const pi = piRaw as { requests?: Record<string, V4Request> };
    const reqs = Object.entries(pi.requests ?? {});
    const byMethod = new Map<string, number>();
    for (const [, r] of reqs) byMethod.set(r.method.toLowerCase(), (byMethod.get(r.method.toLowerCase()) ?? 0) + 1);
    for (const [name, req] of reqs) {
      opCount++;
      const tag = req.tags?.[0] ?? uri;
      const card = requestCard(doc, uri, name, req, byMethod.get(req.method.toLowerCase()) ?? 1);
      (groups.get(tag) ?? groups.set(tag, []).get(tag)!).push(card);
      (navByGroup.get(tag) ?? navByGroup.set(tag, []).get(tag)!).push({ name, method: req.method.toLowerCase() });
    }
  }

  const nav = [...navByGroup.entries()].map(([tag, ops]) =>
    `<div class="nav-group"><div class="nav-tag">${escapeHtml(tag)}</div>${ops.map((o) =>
      `<a class="nav-op" href="#op-${escapeHtml(o.name)}" data-name="${escapeHtml(o.name.toLowerCase())}"><span class="nm" style="color:${METHOD_COLOR[o.method] ?? "#475569"}">${escapeHtml(o.method.toUpperCase())}</span>${escapeHtml(o.name)}</a>`).join("")}</div>`).join("");

  const body = [...groups.entries()].map(([tag, cards]) =>
    `<div class="group"><h2 id="tag-${escapeHtml(tag)}">${escapeHtml(tag)}</h2>${cards.join("")}</div>`).join("");

  const schemes = doc.components?.securitySchemes ? Object.keys(doc.components.securitySchemes) : [];

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(opts.pageTitle ?? title)}</title>
<style>${STYLE}</style></head><body>
<aside class="side">
  <div class="side-head"><div class="logo">⛬ Suluk</div><div class="ver">v4 reference</div></div>
  <input id="filter" placeholder="Filter operations…" autocomplete="off"/>
  <nav id="nav">${nav}</nav>
</aside>
<main>
  <header class="hero">
    <div class="badges"><span class="badge v4">OpenAPI ${escapeHtml(doc.openapi ?? "4.0.0-candidate")}</span><span class="badge">${opCount} operations</span>${schemes.length ? `<span class="badge">${schemes.length} auth scheme${schemes.length > 1 ? "s" : ""}</span>` : ""}</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="tagline">${escapeHtml(tagline)}</p>
    ${doc.info?.description ? `<p class="muted">${escapeHtml(doc.info.description)}</p>` : ""}
    <p class="native-note">Rendered natively from the v4 document — the <b>requests</b>-shape and the <b>⛁ cost</b> facet shown as-is, not flattened to a 3.1 view.</p>
  </header>
  ${body}
  <footer class="foot">CANDIDATE — not official OpenAPI. Rendered by <b>@suluk/reference</b> directly from the v4 contract.</footer>
</main>
<script>
(function(){
  var f=document.getElementById('filter');
  f&&f.addEventListener('input',function(){
    var q=this.value.trim().toLowerCase();
    document.querySelectorAll('.nav-op').forEach(function(a){a.style.display=!q||a.dataset.name.indexOf(q)>=0?'':'none';});
    document.querySelectorAll('.op').forEach(function(s){s.style.display=!q||s.dataset.name.indexOf(q)>=0?'':'none';});
  });
})();
</script>
</body></html>`;
}

/** Convenience for Hono / Bun.serve / fetch handlers: the native v4 reference as a text/html Response. */
export function referenceResponse(doc: OpenAPIv4Document, opts: ReferenceOptions = {}): Response {
  return new Response(referenceHtml(doc, opts), { headers: { "content-type": "text/html; charset=utf-8" } });
}

export const STYLE = `
:root{--bg:#f8fafc;--panel:#fff;--fg:#0f172a;--muted:#64748b;--line:#e2e8f0;--accent:#6366f1;--accentbg:#eef2ff}
*{box-sizing:border-box}body{margin:0;font:15px/1.55 Inter,system-ui,-apple-system,sans-serif;color:var(--fg);background:var(--bg);display:flex}
code,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.side{width:280px;min-width:280px;height:100vh;position:sticky;top:0;overflow:auto;border-right:1px solid var(--line);background:var(--panel);padding:16px}
.side-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px}
.logo{font-weight:800;font-size:18px;color:var(--accent)}.ver{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
#filter{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;margin-bottom:12px;background:var(--bg)}
.nav-group{margin-bottom:12px}.nav-tag{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;padding:4px 6px}
.nav-op{display:flex;gap:8px;align-items:center;padding:4px 8px;border-radius:6px;color:var(--fg);text-decoration:none;font-size:13px}
.nav-op:hover{background:var(--accentbg)}.nav-op .nm{font-size:10px;font-weight:800;min-width:38px}
main{flex:1;max-width:920px;margin:0 auto;padding:32px 36px 80px}
.hero{border-bottom:1px solid var(--line);padding-bottom:22px;margin-bottom:24px}
.badges{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap}
.badge{font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;background:#f1f5f9;color:var(--muted)}
.badge.v4{background:var(--accent);color:#fff}
h1{font-size:30px;margin:.1em 0}.tagline{color:var(--fg);font-size:16px;margin:.2em 0}
.native-note{font-size:13px;color:var(--muted);background:var(--accentbg);border:1px solid #e0e7ff;border-radius:10px;padding:10px 12px;margin-top:14px}
.muted{color:var(--muted)}
.group{margin:34px 0}.group>h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--accent);border-bottom:1px solid var(--line);padding-bottom:8px}
.op{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin:14px 0}
.op-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.method{color:#fff;font-size:11px;font-weight:800;padding:3px 9px;border-radius:6px;letter-spacing:.03em}
.op-path{font-size:14px;background:#f1f5f9;padding:2px 8px;border-radius:6px}
.op-name{font-weight:700}.dep{font-size:11px;color:#b91c1c;background:#fee2e2;padding:2px 7px;border-radius:5px}
.cost{margin-left:auto;font-size:12px;font-weight:700;color:#3730a3;background:var(--accentbg);border:1px solid #e0e7ff;padding:3px 9px;border-radius:999px;white-space:nowrap}
.cost.uncosted{color:#92400e;background:#fffbeb;border-color:#fde68a}
.cost-raw{color:var(--muted);font-weight:500}
.multi{font-size:12px;color:#7c2d12;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:7px 10px;margin:10px 0}
.op-summary{margin:.5em 0 .2em;font-weight:500}
.sec{font-size:12px;margin:8px 0}
.slots{display:flex;flex-direction:column;gap:10px;margin-top:10px}
.slot-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;margin-bottom:4px}
.chip{display:inline-block;font-size:12px;font-family:ui-monospace,monospace;background:#f1f5f9;color:#334155;padding:1px 7px;border-radius:5px}
.props{width:100%;border-collapse:collapse;font-size:13px;background:var(--bg);border:1px solid var(--line);border-radius:8px;overflow:hidden}
.props td{padding:6px 10px;border-bottom:1px solid var(--line);vertical-align:top}.props tr:last-child td{border-bottom:0}
.pname{font-family:ui-monospace,monospace;font-weight:600;white-space:nowrap}.req{color:var(--accent);font-weight:800;margin-left:2px}
.ptype{color:#0e7490;font-family:ui-monospace,monospace;white-space:nowrap}.pdesc{color:var(--muted)}
.ref{border-left:2px solid var(--accentbg);padding-left:8px}.ref-name{font-size:12px;font-family:ui-monospace,monospace;color:var(--accent);font-weight:600}
.responses{margin-top:12px;border-top:1px dashed var(--line);padding-top:10px}
.resp{margin:6px 0;font-size:13px}.status{font-weight:800;color:#15803d}.rname{font-family:ui-monospace,monospace;color:var(--muted)}
.resp-schema{margin-top:4px}
.foot{margin-top:50px;padding-top:18px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}
@media(max-width:760px){.side{display:none}main{padding:20px}}
`;
