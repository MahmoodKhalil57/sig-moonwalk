/**
 * OpenAPI 3.1 → v4 "Suluk" UPGRADE (the reverse projection).
 *
 * 3.1 pathItem (method-keyed Operations)  →  v4 pathItem.requests (name-keyed Requests)
 * 3.1 parameters[] (flat, by `in`)        →  v4 parameterSchema.{query,path,header,cookie} (object schemas)
 * 3.1 requestBody.content[mt].schema      →  v4 Request.contentType + contentSchema
 * 3.1 responses[status]                   →  v4 Request.responses (keyed by status-name) with Response.status
 *
 * Round-trip note: a doc that came FROM downgrade() carries operationId == the original v4 request name,
 * so upgrade() recovers the original request names. Schema Objects pass through verbatim (shared dialect).
 */
import type { OpenAPIv4Document, PathItem, Request, Response, ParameterSchema, HttpMethod, SchemaOrRef } from "@suluk/core";

const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

interface Param31 { name: string; in: string; required?: boolean; schema?: SchemaOrRef }

/** Group 3.1 parameters[] back into per-location object schemas (the inverse of expandParams). */
function collectParams(params: Param31[] | undefined): ParameterSchema | undefined {
  if (!params || params.length === 0) return undefined;
  const buckets: Record<string, { properties: Record<string, unknown>; required: string[] }> = {};
  for (const p of params) {
    const loc = p.in;
    if (!["query", "path", "header", "cookie"].includes(loc)) continue;
    (buckets[loc] ??= { properties: {}, required: [] });
    buckets[loc].properties[p.name] = p.schema ?? {};
    if (p.required) buckets[loc].required.push(p.name);
  }
  const ps: ParameterSchema = {};
  for (const [loc, b] of Object.entries(buckets)) {
    const schema: Record<string, unknown> = { type: "object", properties: b.properties };
    if (b.required.length) schema.required = b.required;
    (ps as Record<string, unknown>)[loc] = schema;
  }
  return Object.keys(ps).length ? ps : undefined;
}

function firstContent(content: Record<string, { schema?: SchemaOrRef }> | undefined): { contentType?: string; schema?: SchemaOrRef } {
  if (!content) return {};
  const types = Object.keys(content);
  if (types.length === 0) return {};
  // preserve all media types on contentType; the schema is taken from the first (3.1 may vary per type — rare).
  return { contentType: types.length === 1 ? types[0] : (types as unknown as string), schema: content[types[0]].schema };
}

function upgradeOperation(method: string, op: Record<string, unknown>): { name: string; request: Request } {
  const name = (op.operationId as string) || `${method}Operation`;
  const responses: Record<string, Response> = {};
  for (const [status, r] of Object.entries((op.responses ?? {}) as Record<string, Record<string, unknown>>)) {
    const c = firstContent(r.content as Record<string, { schema?: SchemaOrRef }> | undefined);
    const resp: Response = { status };
    if (r.description) resp.description = r.description as string;
    if (c.contentType) resp.contentType = c.contentType;
    if (c.schema != null) resp.contentSchema = c.schema;
    responses[status] = resp;
  }
  const request: Request = { method: method as HttpMethod, responses };
  if (op.summary) request.summary = op.summary as string;
  if (op.description) request.description = op.description as string;
  if (op.deprecated) request.deprecated = op.deprecated as boolean;
  if (op.tags) request.tags = op.tags as string[];
  if (op.security) request.security = op.security as Request["security"];

  const ps = collectParams(op.parameters as Param31[] | undefined);
  if (ps) request.parameterSchema = ps;

  const rb = op.requestBody as { content?: Record<string, { schema?: SchemaOrRef }> } | undefined;
  if (rb?.content) {
    const c = firstContent(rb.content);
    if (c.contentType) request.contentType = c.contentType;
    if (c.schema != null) request.contentSchema = c.schema;
  }
  return { name, request };
}

/** Project an OpenAPI 3.1 document up to the v4 "Suluk" model. */
export function upgrade(doc31: Record<string, unknown>): OpenAPIv4Document {
  const out: OpenAPIv4Document = {
    openapi: "4.0.0-candidate",
    info: (doc31.info as OpenAPIv4Document["info"]) ?? { title: "", version: "" },
    paths: {},
  };
  if (doc31.servers) out.servers = doc31.servers as OpenAPIv4Document["servers"];

  for (const [pathKey, piRaw] of Object.entries((doc31.paths ?? {}) as Record<string, Record<string, unknown>>)) {
    const requests: Record<string, Request> = {};
    for (const method of METHODS) {
      const op = piRaw[method] as Record<string, unknown> | undefined;
      if (!op) continue;
      const { name, request } = upgradeOperation(method, op);
      // de-dup names (operationId may be absent/duplicated) by suffixing the method.
      const key = requests[name] ? `${name}_${method}` : name;
      requests[key] = request;
    }
    const pi: PathItem = { requests };
    if (piRaw.summary) pi.summary = piRaw.summary as string;
    if (piRaw.description) pi.description = piRaw.description as string;
    out.paths[pathKey] = pi;
  }

  if (doc31.components) {
    const c31 = doc31.components as Record<string, unknown>;
    const components: OpenAPIv4Document["components"] = {};
    if (c31.schemas) components.schemas = c31.schemas as Record<string, never>;
    if (c31.securitySchemes) components.securitySchemes = c31.securitySchemes as Record<string, never>;
    if (c31.examples) components.examples = c31.examples as Record<string, never>;
    if (Object.keys(components).length) out.components = components;
  }

  if (Array.isArray(doc31.tags)) {
    const tags: Record<string, { summary?: string; description?: string }> = {};
    for (const t of doc31.tags as { name: string; description?: string }[]) {
      if (t?.name) tags[t.name] = { description: t.description };
    }
    if (Object.keys(tags).length) out.tags = tags;
  }
  return out;
}
