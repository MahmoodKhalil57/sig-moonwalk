// Inject ONLY the favicon + og/twitter head block into the already-committed docs/*.html,
// matching tooling/ts/packages/docs/src/render.ts output exactly (so a future gen:docs is a no-op
// on the head). Avoids re-harvesting bodies from a working tree with unrelated in-progress edits.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DOCS = resolve(import.meta.dir, "../../docs");
const B = "https://raw.githubusercontent.com/MahmoodKhalil57/suluk/main/branding/export";
const VIEWPORT =
  '<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>';
const FAVICON =
  VIEWPORT +
  "\n" +
  `<link rel="icon" type="image/svg+xml" href="${B}/favicon.svg"/>` +
  "\n" +
  `<link rel="icon" type="image/png" sizes="32x32" href="${B}/icon-32.png"/>`;

let n = 0;
for (const f of readdirSync(DOCS).filter((x) => x.endsWith(".html"))) {
  const p = resolve(DOCS, f);
  let html = readFileSync(p, "utf8");
  if (html.includes('rel="icon"')) { console.log(`${f}: already wired`); continue; }
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) ?? [, ""])[1];
  const og =
    `<title>${title}</title>` +
    "\n" +
    '<meta property="og:type" content="website"/>' +
    "\n" +
    `<meta property="og:title" content="${title}"/>` +
    "\n" +
    '<meta property="og:description" content="One typed OpenAPI v4 contract, projected into every full-stack layer."/>' +
    "\n" +
    `<meta property="og:image" content="${B}/social-card.png"/>` +
    "\n" +
    '<meta name="twitter:card" content="summary_large_image"/>' +
    "\n" +
    `<meta name="twitter:image" content="${B}/social-card.png"/>`;
  html = html.replace(VIEWPORT, FAVICON).replace(`<title>${title}</title>`, og);
  writeFileSync(p, html);
  n++;
  console.log(`${f}: injected`);
}
console.log(`\n${n} docs pages wired (head-only).`);
