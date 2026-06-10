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
  ["", "Overview"], ["builder", "Builder"], ["docs", "Docs"], ["checks", "Checks"], ["deploy", "Deploy"],
] as const;

export function layout(title: string, base: string, active: string, body: string): string {
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
  :root { color-scheme: dark; }
  body { font: 14px/1.5 ui-monospace, monospace; margin: 0; background: #0b0e14; color: #cdd6f4; }
  header { padding: 14px 20px; border-bottom: 1px solid #1e2433; display: flex; gap: 18px; align-items: baseline; }
  header b { color: #f5a97f; letter-spacing: .04em; }
  nav a { color: #8aadf4; text-decoration: none; margin-right: 14px; }
  nav a.on { color: #f5a97f; border-bottom: 2px solid #f5a97f; padding-bottom: 2px; }
  main { padding: 20px; max-width: 980px; }
  h2 { color: #f5a97f; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; margin: 22px 0 8px; }
  .layer { border: 1px solid #1e2433; border-radius: 8px; padding: 10px 14px; margin: 8px 0; }
  .layer .sum { color: #9399b2; }
  ul { margin: 6px 0; padding-left: 18px; } li { margin: 2px 0; }
  .muted { color: #6c7086; } .pill { color: #a6da95; }
  code { color: #eed49f; } pre { background: #11141c; padding: 12px; border-radius: 8px; overflow:auto; }
  .candidate { color: #6c7086; font-size: 12px; }
</style></head>
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
