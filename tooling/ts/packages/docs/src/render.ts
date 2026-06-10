/**
 * Render a harvested FrameworkDoc into a static, GitHub-Pages-ready site (flat HTML files + one stylesheet,
 * relative links so it serves correctly from a project-pages subpath). Every page is server-rendered HTML —
 * no client build, nothing to install to read the docs.
 */
import type { FrameworkDoc, PackageDoc } from "./harvest";
import { mdToHtml, inline, escapeHtml } from "./md";

const NAV = [
  ["index.html", "Home"],
  ["getting-started.html", "Get started"],
  ["index.html#packages", "Packages"],
  ["architecture.html", "Architecture"],
  ["contributing.html", "Contributing"],
  ["community.html", "Community"],
] as const;

function layout(fw: FrameworkDoc, active: string, title: string, body: string): string {
  const nav = NAV.map(([href, label]) => {
    const on = href.startsWith(active) && active !== "" ? ' class="on"' : "";
    return `<a href="${href}"${on}>${label}</a>`;
  }).join("");
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)} — ${escapeHtml(fw.title)}</title>
<link rel="stylesheet" href="style.css"/>
</head><body>
<header class="top">
  <a class="brand" href="index.html">${escapeHtml(fw.title)}</a>
  <nav>${nav}<a class="gh" href="${fw.repoUrl}">GitHub ↗</a></nav>
</header>
<main>${body}</main>
<footer><span class="candidate">CANDIDATE — not official OpenAPI. Generated from source by @suluk/docs.</span></footer>
</body></html>`;
}

function packageCard(p: PackageDoc): string {
  return `<a class="card" href="${p.slug}.html">
    <div class="card-name">${escapeHtml(p.name)}${p.private ? ' <span class="tag">demo</span>' : ""}</div>
    <div class="card-desc">${inline(p.description)}</div>
  </a>`;
}

const CYCLE = `Drizzle  ──▶  contract (Hono + Zod + Better Auth)  ──▶  v4 document (the hub)
  data                                                          │
                       ┌──────────────────────────────────────┼─────────────────────────────┐
                       ▼                  ▼                    ▼                ▼              ▼
                  Scalar / Swagger   Nano Stores          shadcn UI       contract tests   doc audit
                     (docs)         (client state)          (UI)           (the doc as a    (coverage)
                                                                            check)
        @suluk/builder composes it (pages → sections → blocks → components, contract-narrowing)
        @suluk/deploy ships it to Cloudflare · @suluk/cockpit drives it (vscode + /superadmin)`;

export function renderIndex(fw: FrameworkDoc): string {
  const cards = fw.packages.map(packageCard).join("\n");
  const body = `
  <section class="hero">
    <h1>${escapeHtml(fw.title)}</h1>
    <p class="tagline">${inline(fw.tagline)}</p>
    <div class="cta">
      <a class="btn" href="getting-started.html">Get started</a>
      <a class="btn ghost" href="architecture.html">How it works</a>
      <a class="btn ghost" href="${fw.repoUrl}">Star on GitHub</a>
    </div>
  </section>
  <section class="prose">${mdToHtml(fw.description)}</section>
  <section><h2>The cycle</h2><pre class="diagram">${escapeHtml(CYCLE)}</pre></section>
  <section id="packages"><h2>Packages <span class="muted">(${fw.packages.length})</span></h2>
    <div class="grid">${cards}</div>
  </section>`;
  return layout(fw, "index.html", "Home", body);
}

export function renderPackage(fw: FrameworkDoc, p: PackageDoc): string {
  const install = p.private ? "" : `<h2>Install</h2><pre><code>bun add ${escapeHtml(p.name)}</code></pre>`;
  const exportsHtml = p.exports.length
    ? `<h2>Public API</h2><div class="chips">${p.exports.map((e) => `<code class="chip">${escapeHtml(e)}</code>`).join("")}</div>`
    : "";
  const depsHtml = p.dependencies.length || p.peerDependencies.length
    ? `<h2>Depends on</h2><div class="chips">${[...p.dependencies, ...p.peerDependencies.map((d) => d + " (peer)")].map((d) => `<code class="chip">${escapeHtml(d)}</code>`).join("")}</div>`
    : "";
  const modulesHtml = p.modules.length
    ? `<h2>Modules</h2><dl class="modules">${p.modules.map((m) => `<dt><code>${escapeHtml(m.file)}</code></dt><dd>${inline(m.doc.split("\n").find((l) => l.trim()) ?? "")}</dd>`).join("")}</dl>`
    : "";
  const body = `
  <article class="package">
    <p class="crumb"><a href="index.html#packages">Packages</a> / ${escapeHtml(p.name)}</p>
    <h1>${escapeHtml(p.name)} <span class="ver">v${escapeHtml(p.version)}</span></h1>
    <p class="lead">${inline(p.description)}</p>
    ${install}
    <h2>Overview</h2><div class="prose">${mdToHtml(p.overview || "_No overview._")}</div>
    ${exportsHtml}
    ${depsHtml}
    ${modulesHtml}
  </article>`;
  return layout(fw, `${p.slug}.html`, p.name, body);
}

export function renderMarkdownPage(fw: FrameworkDoc, file: string, title: string, md: string): string {
  return layout(fw, file, title, `<article class="prose">${mdToHtml(md)}</article>`);
}

export const STYLE = `
:root { color-scheme: dark; --bg:#0b0e14; --panel:#11141c; --line:#1e2433; --fg:#cdd6f4; --muted:#9399b2; --accent:#f5a97f; --link:#8aadf4; }
* { box-sizing: border-box; }
body { margin:0; font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:var(--bg); color:var(--fg); }
code, pre, .diagram { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
a { color: var(--link); text-decoration: none; } a:hover { text-decoration: underline; }
.top { position:sticky; top:0; display:flex; gap:18px; align-items:center; padding:12px 22px; background:rgba(11,14,20,.9); border-bottom:1px solid var(--line); backdrop-filter:blur(6px); flex-wrap:wrap; }
.brand { color:var(--accent); font-weight:700; letter-spacing:.04em; }
.top nav { display:flex; gap:16px; flex-wrap:wrap; } .top nav a { color:var(--muted); font-size:14px; } .top nav a.on { color:var(--accent); }
.top .gh { color:var(--link); }
main { max-width:920px; margin:0 auto; padding:28px 22px 60px; }
.hero { padding:34px 0 14px; } .hero h1 { font-size:40px; margin:0 0 6px; letter-spacing:-.01em; }
.tagline { font-size:19px; color:var(--muted); margin:0 0 20px; max-width:64ch; }
.cta { display:flex; gap:10px; flex-wrap:wrap; }
.btn { background:var(--accent); color:#11141c; padding:8px 16px; border-radius:8px; font-weight:600; }
.btn.ghost { background:transparent; color:var(--fg); border:1px solid var(--line); }
h2 { color:var(--accent); font-size:14px; text-transform:uppercase; letter-spacing:.07em; margin:30px 0 10px; }
h3 { color:var(--fg); font-size:16px; }
.diagram { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px; overflow:auto; font-size:12.5px; color:var(--muted); line-height:1.5; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:12px; }
.card { display:block; background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
.card:hover { border-color:var(--accent); text-decoration:none; } .card-name { color:var(--accent); font-family:ui-monospace,monospace; font-weight:600; font-size:14px; }
.card-desc { color:var(--muted); font-size:13.5px; margin-top:4px; }
.tag { background:var(--line); color:var(--muted); font-size:10px; padding:1px 6px; border-radius:99px; vertical-align:middle; }
.chips { display:flex; flex-wrap:wrap; gap:7px; } .chip { background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:3px 8px; font-size:13px; color:var(--fg); }
.prose p, .prose li { color:var(--fg); } .prose code { background:var(--panel); border:1px solid var(--line); border-radius:5px; padding:1px 5px; font-size:.92em; color:#eed49f; }
pre { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px; overflow:auto; } pre code { background:none; border:0; padding:0; color:#cdd6f4; }
table { border-collapse:collapse; width:100%; margin:8px 0; font-size:14px; } th,td { text-align:left; padding:7px 10px; border-bottom:1px solid var(--line); } th { color:var(--muted); }
blockquote { border-left:3px solid var(--accent); margin:10px 0; padding:2px 14px; color:var(--muted); }
.crumb, .muted { color:var(--muted); } .lead { font-size:17px; color:var(--muted); } .ver { color:var(--muted); font-size:14px; }
.modules dt { color:var(--accent); margin-top:8px; } .modules dd { margin:2px 0 0 0; color:var(--muted); }
footer { border-top:1px solid var(--line); padding:18px 22px; text-align:center; } .candidate { color:var(--muted); font-size:12.5px; }
hr { border:0; border-top:1px solid var(--line); margin:22px 0; }
`;

export interface SiteFile { path: string; content: string }
