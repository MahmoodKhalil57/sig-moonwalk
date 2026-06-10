/**
 * Ingest Better Auth's own OpenAPI output (from auth.api.generateOpenAPISchema(), which emits OpenAPI 3.0)
 * and lift it into the v4 "Suluk" model — so the auth surface (/sign-up, /sign-in, /get-session, …) is
 * documented in the app's v4 doc without re-typing it.
 *
 * Two steps: (1) normalize 3.0-isms to JSON Schema 2020-12 (nullable, boolean exclusiveMin/Max), since
 * compat.upgrade passes Schema Objects through verbatim and v4 schemas must be 2020-12; (2) compat.upgrade.
 */
import { upgrade } from "@suluk/openapi-compat";
import type { OpenAPIv4Document, PathItem, Components, SecurityScheme } from "@suluk/core";

/** Recursively rewrite OpenAPI-3.0 Schema-Object dialect into JSON Schema 2020-12. */
export function normalizeOas30(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalizeOas30);
  if (node && typeof node === "object") {
    const o = { ...(node as Record<string, unknown>) };
    // nullable: true → add "null" to the type (or fold into enum); drop the 3.0-only keyword.
    if (o.nullable === true) {
      delete o.nullable;
      if (typeof o.type === "string") o.type = [o.type, "null"];
      else if (Array.isArray(o.type) && !o.type.includes("null")) o.type = [...o.type, "null"];
      else if (Array.isArray(o.enum) && !o.enum.includes(null)) o.enum = [...o.enum, null];
    } else if (o.nullable === false) {
      delete o.nullable;
    }
    // boolean exclusiveMinimum/Maximum (3.0) → numeric form (2020-12).
    if (o.exclusiveMinimum === true && typeof o.minimum === "number") { o.exclusiveMinimum = o.minimum; delete o.minimum; }
    else if (o.exclusiveMinimum === false) delete o.exclusiveMinimum;
    if (o.exclusiveMaximum === true && typeof o.maximum === "number") { o.exclusiveMaximum = o.maximum; delete o.maximum; }
    else if (o.exclusiveMaximum === false) delete o.exclusiveMaximum;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) out[k] = normalizeOas30(v);
    return out;
  }
  return node;
}

export interface IngestOptions {
  /** Prefix every ingested path with this base (Better Auth mounts under "/api/auth"). */
  basePath?: string;
}

/** Normalize + upgrade Better Auth's OpenAPI 3.0 schema to a v4 document (the auth surface). */
export function ingestAuthOpenAPI(schema30: Record<string, unknown>, opts: IngestOptions = {}): OpenAPIv4Document {
  const normalized = normalizeOas30(schema30) as Record<string, unknown>;
  const v4 = upgrade(normalized);
  if (opts.basePath) {
    const prefix = opts.basePath.replace(/\/$/, "");
    const reKeyed: Record<string, PathItem> = {};
    for (const [path, pi] of Object.entries(v4.paths)) {
      const clean = path.replace(/^\//, "");
      reKeyed[`${prefix.replace(/^\//, "")}/${clean}`] = pi as PathItem;
    }
    v4.paths = reKeyed;
  }
  return v4;
}

/** Deep-merge auth paths + components (schemas + securitySchemes) into an app's v4 document. */
export function mergeAuth(
  app: OpenAPIv4Document,
  auth: Partial<OpenAPIv4Document>,
  extra: { securitySchemes?: Record<string, SecurityScheme> } = {},
): OpenAPIv4Document {
  const out: OpenAPIv4Document = { ...app, paths: { ...app.paths, ...(auth.paths ?? {}) } };
  const components: Components = { ...(app.components ?? {}) };
  if (auth.components?.schemas) components.schemas = { ...(components.schemas ?? {}), ...auth.components.schemas };
  const mergedSchemes = { ...(components.securitySchemes ?? {}), ...(auth.components?.securitySchemes ?? {}), ...(extra.securitySchemes ?? {}) };
  if (Object.keys(mergedSchemes).length) components.securitySchemes = mergedSchemes;
  if (Object.keys(components).length) out.components = components;
  return out;
}
