/**
 * @suluk/swagger — render an OpenAPI v4 "Suluk" document with Swagger UI.
 *
 * Swagger UI consumes OpenAPI 3.x, so we project the v4 doc down to 3.1 (via @suluk/openapi-compat) and
 * embed the result inline as `SwaggerUIBundle({ spec })`. The page is self-contained: it loads swagger-ui-dist
 * from a CDN. CANDIDATE tooling.
 */
import { downgrade, type Diagnostic } from "@suluk/openapi-compat";
import type { OpenAPIv4Document } from "@suluk/core";

export interface SwaggerOptions {
  /** Browser tab title. */
  pageTitle?: string;
  /** Base CDN URL for swagger-ui-dist (override for pinning/self-hosting). */
  cdn?: string;
  /** swagger-ui-dist version to pin (used with the default CDN). */
  version?: string;
  /** Extra SwaggerUIBundle configuration merged in (deepLinking, docExpansion, …). */
  configuration?: Record<string, unknown>;
}

export interface RenderResult {
  html: string;
  diagnostics: Diagnostic[];
}

const DEFAULT_CDN = "https://cdn.jsdelivr.net/npm/swagger-ui-dist";

function embed(spec: unknown): string {
  return JSON.stringify(spec).replace(/</g, "\\u003c");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

/** Render a v4 document to a self-contained Swagger UI HTML page (+ downgrade diagnostics). */
export function swaggerHtml(doc: OpenAPIv4Document, opts: SwaggerOptions = {}): RenderResult {
  const { document: spec, diagnostics } = downgrade(doc);
  const title = escapeHtml(opts.pageTitle ?? doc.info?.title ?? "Swagger UI");
  const base = opts.cdn ?? (opts.version ? `${DEFAULT_CDN}@${opts.version}` : DEFAULT_CDN);
  const config = embed({ spec, dom_id: "#swagger-ui", ...(opts.configuration ?? {}) });
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="${base}/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${base}/swagger-ui-bundle.js" crossorigin></script>
    <script src="${base}/swagger-ui-standalone-preset.js" crossorigin></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle(Object.assign(${config}, {
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: "StandaloneLayout",
        }));
      };
    </script>
  </body>
</html>`;
  return { html, diagnostics };
}

/** Convenience for Bun.serve / Hono / fetch handlers: the Swagger UI page as a text/html Response. */
export function swaggerResponse(doc: OpenAPIv4Document, opts: SwaggerOptions = {}): Response {
  return new Response(swaggerHtml(doc, opts).html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
