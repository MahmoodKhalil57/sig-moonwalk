/**
 * emitV4 — the keystone Derivation: render(contracts, principal, now) -> v4 Document.
 *
 * NOT a static file: the document is a pure function of the contracts × the requesting principal (scopes,
 * the "who") × time (now, the "when"). A public export is just emitV4(routes) with no principal/now.
 */
import { buildAda, PROBLEM_CONTENT_TYPE, PROBLEM_DETAILS_SCHEMA } from "@suluk/core";
import type {
  OpenAPIv4Document, PathItem, Request, Response, ParameterSchema, SecurityRequirement, Server, Info, SecurityScheme,
  Components, Schema,
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
  /**
   * Synthesize RFC-9457 error responses (401/403 from access, 429 from a rate-limit facet, always-500, plus any
   * `route.errors`) + a shared `components.schemas.ProblemDetails`. Default true — the SDK's `isApiError` guard and
   * testgen's error-conformance need declared non-2xx responses to check. Set false for a success-only projection.
   */
  synthesizeErrors?: boolean;
}

/** A human title per synthesized error status (RFC-9457 `description`). */
const ERROR_DESCRIPTION: Readonly<Record<number, string>> = {
  400: "Bad request", 401: "Unauthorized", 402: "Payment required", 403: "Forbidden",
  404: "Not found", 409: "Conflict", 429: "Too many requests", 500: "Internal server error", 502: "Bad gateway",
};

/**
 * Which error statuses an operation declares it can return: explicit `route.errors`, + 401/403 when the op is
 * auth-gated (it can deny), + 429 when it declares a rate-limit budget, + always-500 (any handler can fail).
 */
function errorStatusesFor(route: RouteContract, ctx: EmitContext): number[] {
  if (ctx.synthesizeErrors === false) return [];
  const set = new Set<number>(route.errors ?? []);
  if ((route.scopes && route.scopes.length > 0) || route.security) { set.add(401); set.add(403); }
  if (route.rateLimit) set.add(429);
  set.add(500);
  return [...set].sort((a, b) => a - b);
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
  // synthesize RFC-9457 error responses — but never clobber a user-declared one for the same status.
  for (const status of errorStatusesFor(route, ctx)) {
    const key = String(status);
    if (responses[key]) continue;
    responses[key] = {
      status,
      description: ERROR_DESCRIPTION[status] ?? "Error",
      contentType: PROBLEM_CONTENT_TYPE,
      contentSchema: { $ref: "#/components/schemas/ProblemDetails" },
    };
  }
  req.responses = responses;

  // stamp the declared rate-limit facet so rateLimitIndex/coverage + the middleware can read it off the document.
  if (route.rateLimit) req["x-suluk-ratelimit"] = route.rateLimit;

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

  // components: securitySchemes (C014) + the shared ProblemDetails schema iff any op synthesized a problem+json response.
  const usesProblem = Object.values(paths).some((pi) =>
    Object.values(pi.requests).some((r) =>
      Object.values(r.responses).some((resp) => resp.contentType === PROBLEM_CONTENT_TYPE)));
  const components: Components = {};
  if (ctx.securitySchemes) components.securitySchemes = ctx.securitySchemes;
  if (usesProblem) components.schemas = { ProblemDetails: PROBLEM_DETAILS_SCHEMA as unknown as Schema };
  if (Object.keys(components).length > 0) document.components = components;

  // static collision audit over the ADA (detect-and-tolerate; surfaced as diagnostics, never a gate).
  for (const c of buildAda(document).collisions) {
    if (c.verdict === "provable-collision") {
      diagnostics.push({ kind: "collision", operation: `${c.a.name} / ${c.b.name}`, message: `provable signature collision at '${c.a.pathTemplate}'` });
    }
  }
  return { document, diagnostics };
}
