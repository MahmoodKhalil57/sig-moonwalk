/**
 * Server-rendered HTML for the admin panel — the SAME cockpit models the vscode extension shows, painted as
 * web pages (no build step). Every renderer takes a @suluk/cockpit model and returns HTML.
 */
import type { CycleModel, CycleLayer, BuilderNode, DocCheck, DeployPlan } from "@suluk/cockpit";

export function esc(s: unknown): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

const STATUS_DOT: Record<string, string> = { ok: "🟢", warn: "🟡", error: "🔴", info: "🔵" };

const SECTIONS = [
  ["", "Overview"], ["builder", "Builder"], ["data", "Data"], ["analytics", "Analytics"], ["docs", "Docs"], ["checks", "Checks"], ["deploy", "Deploy"],
] as const;

export function layout(title: string, base: string, active: string, body: string, headHtml = ""): string {
  const nav = SECTIONS.map(([slug, label]) => {
    const href = slug ? `${base}/${slug}` : base;
    const on = slug === active ? ' class="on"' : "";
    return `<a href="${esc(href)}"${on}>${esc(label)}</a>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="icon" type="image/svg+xml" href="https://raw.githubusercontent.com/MahmoodKhalil57/suluk/main/branding/export/favicon.svg"/>
<link rel="icon" type="image/png" sizes="32x32" href="https://raw.githubusercontent.com/MahmoodKhalil57/suluk/main/branding/export/icon-32.png"/>
<title>${esc(title)} — Suluk superadmin</title>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${esc(title)} — Suluk superadmin"/>
<meta property="og:description" content="One typed OpenAPI v4 contract, projected into every full-stack layer."/>
<meta property="og:image" content="https://raw.githubusercontent.com/MahmoodKhalil57/suluk/main/branding/export/social-card.png"/>
<meta name="twitter:card" content="summary_large_image"/>
<style>
  /* Theme-aware: uses the SITE's CSS-var vocabulary so a host app's theme/scheme (injected via headHtml) drives it.
     Standalone, it ships a light default + a dark variant that follows data-theme or the OS preference. */
  :root, html[data-theme="light"] { color-scheme: light; --bg:#ffffff; --panel:#ffffff; --line:#ececf1; --fg:#0b0b12; --muted:#646474; --accent:#6366f1; --on-accent:#ffffff; --ok:#16a34a; --danger:#e5484d; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme]) { color-scheme:dark; --bg:#09090c; --panel:#131319; --line:#23232c; --fg:#ededf2; --muted:#8c8c99; --accent:#818cf8; --on-accent:#0b0b12; } }
  html[data-theme="dark"] { color-scheme:dark; --bg:#09090c; --panel:#131319; --line:#23232c; --fg:#ededf2; --muted:#8c8c99; --accent:#818cf8; --on-accent:#0b0b12; }
  body { font: 14px/1.5 ui-monospace, monospace; margin: 0; background: var(--bg); color: var(--fg); }
  header { padding: 14px 20px; border-bottom: 1px solid var(--line); display: flex; gap: 18px; align-items: baseline; }
  header b { color: var(--accent); letter-spacing: .04em; }
  nav a { color: var(--accent); text-decoration: none; margin-right: 14px; opacity:.82; }
  nav a.on { opacity:1; border-bottom: 2px solid var(--accent); padding-bottom: 2px; }
  main { padding: 20px; max-width: 980px; }
  h2 { color: var(--accent); font-size: 13px; text-transform: uppercase; letter-spacing: .08em; margin: 22px 0 8px; }
  .layer { border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px; margin: 8px 0; }
  .layer .sum { color: var(--muted); }
  ul { margin: 6px 0; padding-left: 18px; } li { margin: 2px 0; }
  .muted { color: var(--muted); } .pill { color: var(--ok); }
  a { color: var(--accent); }
  code { color: var(--accent); } pre { background: var(--panel); border:1px solid var(--line); padding: 12px; border-radius: 8px; overflow:auto; }
  .candidate { color: var(--muted); font-size: 12px; }
</style>${headHtml}</head>
<body>
  <header><b>SULUK · SUPERADMIN</b> <span class="candidate">candidate — not official OAS</span></header>
  <header><nav>${nav}</nav></header>
  <main>${body}</main>
</body></html>`;
}

export function renderCycle(model: CycleModel): string {
  const layers = model.layers.map((l: CycleLayer) => {
    const items = l.items.length ? `<ul>${l.items.map((i) => `<li>${esc(i.label)} <span class="muted">${esc(i.detail ?? "")}</span></li>`).join("")}</ul>` : "";
    return `<div class="layer"><div>${STATUS_DOT[l.status] ?? "⚪"} <b>${esc(l.title)}</b> — <span class="sum">${esc(l.summary)}</span></div>${items}</div>`;
  }).join("");
  return `<h2>Cycle</h2><p class="muted">valid: ${model.valid ? "yes" : "no"} · coverage ${model.coverage.toFixed(2)}</p>${layers}`;
}

function renderNode(n: BuilderNode): string {
  const contract = n.contract.length ? ` <span class="pill">may set { ${esc(n.contract.join(", "))} }</span>` : "";
  const kids = n.children.length ? `<ul>${n.children.map(renderNode).join("")}</ul>` : "";
  return `<li><b>${esc(n.label)}</b> <span class="muted">${esc(n.tier)}</span>${contract}${kids}</li>`;
}

export function renderBuilder(tree: BuilderNode[]): string {
  return `<h2>Builder</h2><p class="muted">pages → sections → blocks → components · each tier shows what it may set (the contract-narrowing)</p><ul>${tree.map(renderNode).join("")}</ul>`;
}

export function renderChecks(checks: DocCheck[]): string {
  const rows = checks.map((c) => `<li>${c.pass ? "🟢" : "🔴"} ${esc(c.name)}${c.pass ? "" : ` <span class="muted">— ${esc(c.message)}</span>`}</li>`).join("");
  return `<h2>Contract checks</h2><ul>${rows}</ul>`;
}

export function renderDeploy(plan: DeployPlan): string {
  const steps = plan.steps.map((s, i) => `<li><code>${esc(s.cmd)}</code><div class="muted">${esc(s.note)}</div></li>`).join("");
  const files = plan.files.map((f) => `<li><code>${esc(f.path)}</code></li>`).join("");
  const notes = plan.notes.map((n) => `<li>${esc(n)}</li>`).join("");
  return `<h2>Deploy — ${esc(plan.provider)}</h2>
    <p class="muted">files</p><ul>${files}</ul>
    <p class="muted">steps (run in your terminal — Suluk never runs them for you)</p><ol>${steps}</ol>
    <p class="muted">notes</p><ul>${notes}</ul>`;
}
