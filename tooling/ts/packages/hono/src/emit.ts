/**
 * emitV4 — the keystone Derivation: render(contracts, principal, now) -> v4 Document.
 *
 * NOT a static file: the document is a pure function of the contracts × the requesting principal (scopes,
 * the "who") × time (now, the "when"). A public export is just emitV4(routes) with no principal/now.
 */
import { buildAda } from "@suluk/core";
import type {
  OpenAPIv4Document, PathItem, Request, Response, ParameterSchema, SecurityRequirement, Server, Info, SecurityScheme,
} from "@suluk/core";
import { zodToV4 } from "@suluk/zod";
import { responseList, type RouteContract, type Method } from "./contract";

export interface EmitContext {
  info?: Partial<Info>;
  servers?: Server[];
  /** The "who": include only operations whose required scopes the principal holds. Omit ⇒ full public doc. */
  principal?: { scopes?: string[] };
  /** The "when": ISO date / Date. Drives deprecatedSince + removedSince. Omit ⇒ no time filtering. */
  now?: string | Date;
  /** Name of the security scheme that `scopes` map onto (e.g. "bearerAuth"). Enables scopes→security. */
  securityScheme?: string;
  /** Declared security schemes for components (C014). */
  securitySchemes?: Record<string, SecurityScheme>;
  /** Include operations flagged deprecated (default true; they are marked, not hidden). */
  includeDeprecated?: boolean;
}

export interface EmitDiagnostic {
  kind: "collision" | "filtered" | "note";
  operation?: string;
  message: string;
}

export interface EmitResult {
  document: OpenAPIv4Document;
  diagnostics: EmitDiagnostic[];
}

function pascal(s: string): string {
  return s.replace(/(^|[-_])(\w)/g, (_, __, c: string) => c.toUpperCase());
}

/** Hono path "/pet/:petId" / "/files/*" → v4 uriTemplate "pet/{petId}" / "files/{+wildcard}" (no leading slash). */
function toUriTemplate(honoPath: string): { template: string; segments: string[] } {
  const segs = honoPath.replace(/^\//, "").split("/").filter(Boolean).map((s) => {
    if (s === "*") return "{+wildcard}";
    if (s.startsWith(":")) return `{${s.slice(1).replace(/\{.*$/, "")}}`; // strip Hono regex constraints
    return s;
  });
  return { template: segs.join("/"), segments: segs };
}

function deriveName(method: Method, segments: string[]): string {
  const parts = segments.map((s) =>
    s.startsWith("{+") ? "By" + pascal(s.slice(2, -1)) : s.startsWith("{") ? "By" + pascal(s.slice(1, -1)) : pascal(s),
  );
  return method + parts.join("");
}

function zParam(schema: unknown): Record<string, unknown> | undefined {
  if (!schema) return undefined;
  return zodToV4(schema as Parameters<typeof zodToV4>[0]).schema;
}

function toMs(d: string | Date): number {
  return (typeof d === "string" ? new Date(d) : d).getTime();
}

/** Build one v4 Request from a route contract. */
function buildRequest(route: RouteContract, deprecated: boolean, ctx: EmitContext): Request {
  const req: Request = { method: route.method, responses: {} };
  if (route.summary) req.summary = route.summary;
  if (route.description) req.description = route.description;
  if (route.tags) req.tags = route.tags;
  if (deprecated) req.deprecated = true;

  if (route.request?.json) {
    req.contentType = route.request.contentType ?? "application/json";
    req.contentSchema = zodToV4(route.request.json as Parameters<typeof zodToV4>[0]).schema;
  }

  const ps: ParameterSchema = {};
  const q = zParam(route.request?.query); if (q) ps.query = q;
  const p = zParam(route.request?.params); if (p) ps.path = p;
  const h = zParam(route.request?.header); if (h) ps.header = h;
  if (Object.keys(ps).length) req.parameterSchema = ps;

  const responses: Record<string, Response> = {};
  for (const r of responseList(route.responses)) {
    const resp: Response = { status: r.status };
    if (r.description) resp.description = r.description;
    if (r.schema) {
      resp.contentType = r.contentType ?? "application/json";
      resp.contentSchema = zodToV4(r.schema as Parameters<typeof zodToV4>[0]).schema;
    }
    responses[String(r.status)] = resp;
  }
  if (Object.keys(responses).length === 0) responses["200"] = { status: 200 };
  req.responses = responses;

  // security: explicit wins; else synthesize from scopes if a scheme name is configured.
  const security: SecurityRequirement[] | undefined =
    route.security ?? (route.scopes && ctx.securityScheme ? [{ [ctx.securityScheme]: route.scopes }] : undefined);
  if (security) req.security = security;
  return req;
}

/**
 * Project a list of route contracts into a v4 document for a given principal + time.
 * - WHEN: removedSince ≤ now ⇒ hidden; deprecatedSince ≤ now ⇒ marked deprecated.
 * - WHO: if a principal is supplied, an operation requiring scopes the principal lacks is omitted.
 */
export function emitV4(routes: readonly RouteContract[], ctx: EmitContext = {}): EmitResult {
  const diagnostics: EmitDiagnostic[] = [];
  const nowMs = ctx.now != null ? toMs(ctx.now) : undefined;
  const principalScopes = ctx.principal ? new Set(ctx.principal.scopes ?? []) : undefined;

  const paths: Record<string, PathItem> = {};
  for (const route of routes) {
    const { template, segments } = toUriTemplate(route.path);
    const name = route.name ?? deriveName(route.method, segments);

    // WHEN filter
    if (nowMs != null && route.removedSince && toMs(route.removedSince) <= nowMs) {
      diagnostics.push({ kind: "filtered", operation: name, message: `hidden: removed since ${route.removedSince}` });
      continue;
    }
    // WHO filter
    if (principalScopes && route.scopes && !route.scopes.every((s) => principalScopes.has(s))) {
      diagnostics.push({ kind: "filtered", operation: name, message: `hidden: principal lacks scope(s) ${route.scopes.join(", ")}` });
      continue;
    }
    const deprecated =
      !!route.deprecated || (nowMs != null && !!route.deprecatedSince && toMs(route.deprecatedSince) <= nowMs);
    if (deprecated && ctx.includeDeprecated === false) {
      diagnostics.push({ kind: "filtered", operation: name, message: "hidden: deprecated (includeDeprecated=false)" });
      continue;
    }

    const pi = (paths[template] ??= { requests: {} });
    if (pi.requests[name]) {
      diagnostics.push({ kind: "collision", operation: name, message: `duplicate operation name '${name}' at '${template}'` });
      pi.requests[`${name}_${route.method}`] = buildRequest(route, deprecated, ctx);
    } else {
      pi.requests[name] = buildRequest(route, deprecated, ctx);
    }
  }

  const document: OpenAPIv4Document = {
    openapi: "4.0.0-candidate",
    info: { title: ctx.info?.title ?? "API", version: ctx.info?.version ?? "0.0.0", ...ctx.info },
    paths,
  };
  if (ctx.servers) document.servers = ctx.servers;
  if (ctx.securitySchemes) document.components = { securitySchemes: ctx.securitySchemes };

  // static collision audit over the ADA (detect-and-tolerate; surfaced as diagnostics, never a gate).
  for (const c of buildAda(document).collisions) {
    if (c.verdict === "provable-collision") {
      diagnostics.push({ kind: "collision", operation: `${c.a.name} / ${c.b.name}`, message: `provable signature collision at '${c.a.pathTemplate}'` });
    }
  }
  return { document, diagnostics };
}
