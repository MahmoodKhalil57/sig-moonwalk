/** The panel chrome — a Payload-style two-pane shell (collections sidebar + content), themed with the host site's
 *  CSS-var vocabulary. Ships a light default + OS-following dark so it works standalone; pass `headHtml` (e.g. a
 *  color-scheme sheet + no-flash stamper) to make it obey the host app's theme + scheme. */
import { RICHTEXT_CSS } from "./richtext";
const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export interface ShellOptions {
  title: string;
  brand: string;
  basePath: string;
  entities: { name: string; count?: number }[];
  active: string;       // "" for dashboard, else entity name
  heading: string;
  body: string;
  headHtml?: string;
  crumbs?: { label: string; href?: string }[];
}

export const PANEL_CSS = `
  :root,html[data-theme="light"]{color-scheme:light;--bg:#f6f7f9;--panel:#fff;--bg-soft:#f1f2f5;--line:#e6e7ec;--fg:#15171c;--muted:#6b7280;--accent:#6366f1;--on-accent:#fff;--danger:#e5484d;--ok:#16a34a;--shadow:0 1px 2px rgba(16,16,40,.05),0 10px 30px -16px rgba(16,16,40,.18)}
  @media (prefers-color-scheme:dark){:root:not([data-theme]){color-scheme:dark;--bg:#0b0d12;--panel:#14161d;--bg-soft:#0f1117;--line:#242833;--fg:#e9eaef;--muted:#8b90a0;--accent:#818cf8;--on-accent:#0b0d12;--danger:#ef5350;--ok:#22c55e}}
  html[data-theme="dark"]{color-scheme:dark;--bg:#0b0d12;--panel:#14161d;--bg-soft:#0f1117;--line:#242833;--fg:#e9eaef;--muted:#8b90a0;--accent:#818cf8;--on-accent:#0b0d12;--danger:#ef5350;--ok:#22c55e}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14.5px/1.55 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
  .pf-app{display:grid;grid-template-columns:248px 1fr;min-height:100vh}
  .pf-side{background:var(--panel);border-inline-end:1px solid var(--line);padding:18px 14px;display:flex;flex-direction:column;gap:4px;position:sticky;top:0;height:100vh;overflow-y:auto}
  .pf-brand{display:flex;align-items:center;gap:9px;font-weight:800;letter-spacing:-.02em;font-size:16px;padding:6px 8px 14px}
  .pf-brand .pf-dot{width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,var(--accent),color-mix(in oklab,var(--accent) 60%,#fff));display:grid;place-items:center;color:#fff;font-size:13px}
  .pf-navhead{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);padding:14px 8px 6px}
  .pf-nav a{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;border-radius:9px;color:var(--fg);font-weight:500;font-size:14px}
  .pf-nav a:hover{background:var(--bg-soft);text-decoration:none}.pf-nav a.on{background:color-mix(in oklab,var(--accent) 14%,transparent);color:var(--accent)}
  .pf-nav a .pf-badge{font-size:11px;color:var(--muted);background:var(--bg-soft);border-radius:999px;padding:0 7px}
  .pf-main{min-width:0;display:flex;flex-direction:column}
  .pf-top{padding:18px 28px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 70%,transparent);backdrop-filter:blur(8px);position:sticky;top:0;z-index:5}
  .pf-crumbs{font-size:12.5px;color:var(--muted);display:flex;gap:7px}.pf-crumbs a{color:var(--muted)}
  .pf-h1{font-size:23px;font-weight:800;letter-spacing:-.02em;margin:4px 0 0}
  .pf-content{padding:24px 28px 60px;max-width:1080px;width:100%}
  .pf-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}
  .pf-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;box-shadow:var(--shadow);display:block;color:var(--fg)}
  .pf-card:hover{border-color:color-mix(in oklab,var(--accent) 45%,var(--line));text-decoration:none}.pf-card b{font-size:15px}.pf-card p{margin:4px 0 0;color:var(--muted);font-size:13px}
  .pf-listbar{display:flex;align-items:center;gap:12px;margin-bottom:14px}
  .pf-tablewrap{background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:auto;box-shadow:var(--shadow)}
  .pf-table{width:100%;border-collapse:collapse;font-size:13.5px}
  .pf-table th{text-align:start;font-weight:600;color:var(--muted);padding:11px 14px;border-bottom:1px solid var(--line);white-space:nowrap;font-size:12px;text-transform:uppercase;letter-spacing:.03em}
  .pf-table td{padding:10px 14px;border-bottom:1px solid var(--line);max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pf-table tr:last-child td{border-bottom:0}.pf-table tbody tr:hover{background:var(--bg-soft)}
  .pf-rowact{text-align:end;white-space:nowrap}.pf-rowact a{margin-inline-end:8px}
  .pf-thumb{width:34px;height:34px;border-radius:7px;object-fit:cover;vertical-align:middle;border:1px solid var(--line)}
  .pf-pill{background:var(--bg-soft);border:1px solid var(--line);border-radius:999px;padding:1px 9px;font-size:12px}
  .pf-yes{color:var(--ok);font-weight:700}.pf-no{color:var(--muted)}.pf-muted{color:var(--muted)}
  .pf-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
  .pf-table th[data-col]:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
  .pf-btn:disabled{opacity:.45;cursor:not-allowed}
  .pf-pager{display:flex;align-items:center;gap:12px;justify-content:flex-end;margin-top:12px}
  .pf-form{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:22px 24px;box-shadow:var(--shadow)}
  .pf-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px 20px}
  .pf-field{display:flex;flex-direction:column;gap:6px}.pf-field.pf-wide{grid-column:1/-1}
  .pf-field.pf-inline{flex-direction:row;align-items:center;gap:12px}.pf-field.pf-inline label{order:2}
  .pf-field label{font-size:13px;font-weight:600}.pf-req{color:var(--danger)}.pf-desc{color:var(--muted);font-size:12px}
  .pf-input{font:inherit;font-size:14px;background:var(--bg-soft);color:var(--fg);border:1px solid var(--line);border-radius:9px;padding:9px 11px;width:100%}
  .pf-input:focus{outline:2px solid color-mix(in oklab,var(--accent) 55%,transparent);outline-offset:1px;border-color:var(--accent)}
  .pf-input[readonly],.pf-input:disabled{opacity:.6;cursor:not-allowed}.pf-mono{font-family:ui-monospace,SFMono-Regular,monospace;font-size:13px}
  .pf-switch{position:relative;display:inline-flex;cursor:pointer}.pf-switch input{position:absolute;opacity:0}
  .pf-track{width:42px;height:24px;border-radius:999px;background:var(--line);transition:background .15s;display:inline-block}
  .pf-thumb{position:absolute;top:3px;inset-inline-start:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .pf-switch input:checked+.pf-track{background:var(--accent)}.pf-switch input:checked+.pf-track .pf-thumb{transform:translateX(18px)}
  .pf-actions{display:flex;align-items:center;gap:10px;margin-top:22px;padding-top:18px;border-top:1px solid var(--line)}
  .pf-btn{font:inherit;font-size:14px;font-weight:600;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:9px;padding:8px 15px;cursor:pointer;display:inline-flex;align-items:center}
  .pf-btn:hover{background:var(--bg-soft);text-decoration:none}.pf-primary{background:var(--accent);color:var(--on-accent);border-color:transparent}.pf-primary:hover{filter:brightness(1.06)}
  .pf-danger{color:var(--danger);border-color:color-mix(in oklab,var(--danger) 40%,var(--line))}.pf-link-danger{background:none;border:0;color:var(--danger);cursor:pointer;font:inherit;padding:0}
  .pf-msg{margin:12px 0 0;color:var(--muted);font-size:13px;min-height:18px}
  @media (max-width:820px){.pf-app{grid-template-columns:1fr}.pf-side{position:static;height:auto;flex-direction:row;flex-wrap:wrap;gap:6px}.pf-grid{grid-template-columns:1fr}}
`;

export function renderShell(o: ShellOptions): string {
  const nav = [{ name: "", label: "Dashboard", href: o.basePath }, ...o.entities.map((e) => ({ name: e.name, label: e.name, href: `${o.basePath}/${e.name}`, count: e.count }))];
  const navHtml = nav.map((n: { name: string; label: string; href: string; count?: number }) =>
    `<a href="${esc(n.href)}"${n.name === o.active ? ' class="on"' : ""}>${esc(n.label)}${n.count != null ? `<span class="pf-badge">${n.count}</span>` : ""}</a>`).join("");
  const crumbs = (o.crumbs ?? []).map((c) => c.href ? `<a href="${esc(c.href)}">${esc(c.label)}</a>` : `<span>${esc(c.label)}</span>`).join('<span>/</span>');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
${o.headHtml ?? ""}
<title>${esc(o.heading)} — ${esc(o.brand)}</title>
<style>${PANEL_CSS}${RICHTEXT_CSS}</style></head>
<body><div class="pf-app">
  <aside class="pf-side">
    <a class="pf-brand" href="${esc(o.basePath)}"><span class="pf-dot">${esc(o.brand.charAt(0))}</span> ${esc(o.brand)}</a>
    <div class="pf-navhead">Collections</div>
    <nav class="pf-nav">${navHtml}</nav>
  </aside>
  <main class="pf-main">
    <div class="pf-top">${crumbs ? `<div class="pf-crumbs">${crumbs}</div>` : ""}<h1 class="pf-h1">${esc(o.heading)}</h1></div>
    <div class="pf-content">${o.body}</div>
  </main>
</div></body></html>`;
}
