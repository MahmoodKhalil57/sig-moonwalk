/**
 * Phase 3 — the multi-document PORTAL. One index for many APIs / versions / tenants: each entry links to its own
 * /reference. Kept lightweight (a switcher landing, not N inlined references) so it scales to many large docs;
 * each document is served + rendered at its own URL by the consumer. Self-contained HTML, Workers-safe.
 */
import { escapeHtml } from "./facets";
import { STYLE } from "./assets";

export interface PortalEntry { name: string; title: string; description?: string; href: string; version?: string; badge?: string }
export interface PortalOptions { pageTitle?: string; tagline?: string }

export function portalHtml(entries: PortalEntry[], opts: PortalOptions = {}): string {
  const cards = entries.map((e) => `<a class="portal-card" href="${escapeHtml(e.href)}">
    <div class="portal-name">${escapeHtml(e.title)}${e.version ? ` <span class="badge">${escapeHtml(e.version)}</span>` : ""}${e.badge ? ` <span class="badge v4">${escapeHtml(e.badge)}</span>` : ""}</div>
    ${e.description ? `<div class="portal-desc muted">${escapeHtml(e.description)}</div>` : ""}
    <div class="portal-go">Open reference →</div>
  </a>`).join("");
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(opts.pageTitle ?? "API Portal")}</title>
<style>${STYLE}
.portal{max-width:880px;margin:0 auto;padding:48px 24px}
.portal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-top:28px}
.portal-card{display:block;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px 20px;text-decoration:none;color:var(--fg);box-shadow:var(--shadow)}
.portal-card:hover{border-color:var(--accent);transform:translateY(-1px)}
.portal-name{font-weight:700;font-size:17px}.portal-desc{font-size:13px;margin-top:6px}.portal-go{font-size:13px;color:var(--accent);margin-top:12px;font-weight:600}
</style></head><body style="display:block">
<div class="portal">
  <div class="badges"><span class="badge v4">⛬ Suluk · OpenAPI v4</span><span class="badge">${entries.length} APIs</span></div>
  <h1>${escapeHtml(opts.pageTitle ?? "API Portal")}</h1>
  <p class="tagline">${escapeHtml(opts.tagline ?? "One portal, many v4 contracts — each rendered natively.")}</p>
  <div class="portal-grid">${cards}</div>
  <footer class="foot">CANDIDATE — rendered by <b>@suluk/reference</b>.</footer>
</div></body></html>`;
}

export function portalResponse(entries: PortalEntry[], opts: PortalOptions = {}): Response {
  return new Response(portalHtml(entries, opts), { headers: { "content-type": "text/html; charset=utf-8" } });
}
