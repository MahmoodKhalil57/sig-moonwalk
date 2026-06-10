/**
 * @suluk/scalar — render an OpenAPI v4 "Suluk" document with Scalar API Reference.
 *
 * Scalar consumes OpenAPI 3.x, so we project the v4 doc down to 3.1 (via @suluk/openapi-compat) and embed
 * the result inline. The page is self-contained: it loads the Scalar standalone bundle from a CDN and
 * initializes it with the spec via `Scalar.createApiReference('#app', { content })`. CANDIDATE tooling.
 */
import { downgrade, type Diagnostic } from "@suluk/openapi-compat";
import type { OpenAPIv4Document } from "@suluk/core";

export interface ScalarOptions {
  /** Browser tab title. */
  pageTitle?: string;
  /** CDN URL for the Scalar standalone bundle (override for pinning/self-hosting). */
  cdn?: string;
  /** Extra Scalar configuration merged into createApiReference (theme, layout, hideModels, …). */
  configuration?: Record<string, unknown>;
}

export interface RenderResult {
  /** A complete, self-contained HTML document. */
  html: string;
  /** Lossy-conversion diagnostics from the v4→3.1 downgrade (e.g. method collisions). */
  diagnostics: Diagnostic[];
}

const DEFAULT_CDN = "https://cdn.jsdelivr.net/npm/@scalar/api-reference";

/** Embed a spec object safely inside a <script> by neutralizing `<` (prevents `</script>` breakout). */
function embed(spec: unknown): string {
  return JSON.stringify(spec).replace(/</g, "\\u003c");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

/** Render a v4 document to a self-contained Scalar HTML page (+ downgrade diagnostics). */
export function scalarHtml(doc: OpenAPIv4Document, opts: ScalarOptions = {}): RenderResult {
  const { document: spec, diagnostics } = downgrade(doc);
  const title = escapeHtml(opts.pageTitle ?? doc.info?.title ?? "API Reference");
  const cdn = opts.cdn ?? DEFAULT_CDN;
  const config = embed({ content: spec, ...(opts.configuration ?? {}) });
  const html = `<!doctype html>
<html>
  <head>
    <title>${title}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="https://raw.githubusercontent.com/MahmoodKhalil57/suluk/main/branding/export/favicon.svg" />
    <link rel="icon" type="image/png" sizes="32x32" href="https://raw.githubusercontent.com/MahmoodKhalil57/suluk/main/branding/export/icon-32.png" />
  </head>
  <body>
    <div id="app"></div>
    <script src="${cdn}"></script>
    <script>
      Scalar.createApiReference('#app', ${config})
    </script>
  </body>
</html>`;
  return { html, diagnostics };
}

/** Convenience for Bun.serve / Hono / fetch handlers: the Scalar page as a text/html Response. */
export function scalarResponse(doc: OpenAPIv4Document, opts: ScalarOptions = {}): Response {
  return new Response(scalarHtml(doc, opts).html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
