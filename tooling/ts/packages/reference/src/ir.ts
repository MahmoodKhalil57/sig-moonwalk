/**
 * The versioned SEMANTIC IR — `normalize(doc) → RefDoc`. THE CORE (the roadmap's Phase 1). This is the only place
 * that reads raw v4 spec shapes; every adapter (render, try-it, code-samples) consumes RefDoc. It never throws —
 * dangling refs / collisions / lossy inputs become `diagnostics`. It computes the EFFECTIVE (C012-composed) request
 * + responses (so the reference shows what you actually call, not just what was authored), path-scoped stable ids
 * (so repeated operation names across paths don't collide), the ADA signature collisions, and the v4 facets.
 *
 * When OAS-4 (or a 3.x upgrade adapter) shifts an object shape, only this translator changes.
 */
import type { OpenAPIv4Document } from "@suluk/core";
import { computeSignature, collide, isReference } from "@suluk/core";
import type { CostModel, AccessFacet, CollisionVerdict } from "./facets";

export interface Diagnostic { kind: "dangling-ref" | "collision" | "lossy"; where: string; message: string }
export interface ServerEntry { url: string; description?: string }
export interface TagEntry { name: string; summary?: string; description?: string; type?: string; order?: number }
export interface ModelEntry { name: string; schema: unknown }
export interface SecuritySchemeEntry { name: string; type?: string; scheme?: string; in?: string; description?: string }
export type ParamLoc = "path" | "query" | "header" | "cookie";
export interface NormalizedParam { name: string; in: ParamLoc; required: boolean; schema: unknown; description?: string; inherited: boolean }
export interface NormalizedBody { contentType: string; schema: unknown }
export interface NormalizedRequest { method: string; path: string; params: NormalizedParam[]; body?: NormalizedBody }
export interface NormalizedResponse { name: string; status: string; description?: string; contentType?: string; schema?: unknown; inherited: boolean }
export interface CollisionNote { with: string; verdict: CollisionVerdict; reason: string }
export interface OpSignature { method: string; pathShape: string; contentType: string }
export interface NormalizedOperation {
  id: string; name: string; method: string; path: string; tag?: string;
  summary?: string; description?: string; deprecated?: boolean;
  request: NormalizedRequest; responses: NormalizedResponse[]; security: string[]; servers: ServerEntry[];
  cost?: CostModel; access?: AccessFacet; collisions: CollisionNote[]; shareCount: number;
  signature: OpSignature; // the ADA identity tuple (for the resolution playground)
}
export interface RefDoc {
  spec: { dialect: string; version: string };
  info: { title: string; version?: string; description?: string };
  servers: ServerEntry[]; tags: TagEntry[]; operations: NormalizedOperation[];
  models: ModelEntry[]; security: SecuritySchemeEntry[]; webhooks: NormalizedOperation[];
  diagnostics: Diagnostic[];
}

interface RawReq {
  method: string; summary?: string; description?: string; deprecated?: boolean; tags?: string[];
  contentType?: string | string[]; contentSchema?: unknown;
  parameterSchema?: Partial<Record<ParamLoc | "body", unknown>>;
  responses?: Record<string, { status: string | number; description?: string; contentType?: string | string[]; contentSchema?: unknown }>;
  security?: Record<string, unknown>[];
  ["x-suluk-cost"]?: CostModel; ["x-suluk-access"]?: AccessFacet;
}

export const slug = (s: string): string => s.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
const first = (ct: string | string[] | undefined, fallback = "application/json"): string => (ct == null ? fallback : Array.isArray(ct) ? ct[0] ?? fallback : ct);

/** Expand a per-location object schema into individual params; mark which came only from the shared (inherited) schema. */
function expandSlot(loc: ParamLoc, own: unknown, shared: unknown, diags: Diagnostic[], where: string): NormalizedParam[] {
  const obj = (s: unknown): { props: Record<string, unknown>; required: Set<string> } => {
    if (s == null || typeof s !== "object" || isReference(s)) { if (s && isReference(s)) diags.push({ kind: "lossy", where, message: `${loc} params behind a $ref are not expanded` }); return { props: {}, required: new Set() }; }
    const o = s as Record<string, unknown>;
    return { props: (o.properties ?? {}) as Record<string, unknown>, required: new Set((o.required as string[] | undefined) ?? []) };
  };
  const sh = obj(shared), ow = obj(own);
  const names = [...new Set([...Object.keys(sh.props), ...Object.keys(ow.props)])];
  return names.map((name) => {
    const inherited = name in sh.props && !(name in ow.props);
    const schema = (ow.props[name] ?? sh.props[name]) as Record<string, unknown>;
    const required = loc === "path" || sh.required.has(name) || ow.required.has(name);
    return { name, in: loc, required, schema, description: (typeof schema === "object" && schema && !isReference(schema) ? (schema as Record<string, unknown>).description as string : undefined), inherited };
  });
}

/** Project a v4 document into the normalized IR. Never throws; problems become diagnostics. */
export function normalize(doc: OpenAPIv4Document): RefDoc {
  const diagnostics: Diagnostic[] = [];
  const docServers: ServerEntry[] = (doc.servers ?? []).map((s) => ({ url: s.url, description: s.description }));
  const apiResponses = (doc.apiResponses ?? {}) as Record<string, NormalizedResponse extends never ? never : { status: string | number; description?: string; contentType?: string | string[]; contentSchema?: unknown }>;

  const tags: TagEntry[] = Object.entries(doc.tags ?? {}).map(([name, t]) => ({ name, summary: (t as Record<string, unknown>).summary as string, description: (t as Record<string, unknown>).description as string, type: (t as Record<string, unknown>).type as string, order: (t as Record<string, unknown>).order as number }));

  const buildOp = (uri: string, name: string, raw: RawReq, shared: RawReq["parameterSchema"], pathResponses: Record<string, { status: string | number; description?: string; contentType?: string | string[]; contentSchema?: unknown }>, pathServers: ServerEntry[], collisions: CollisionNote[], shareCount: number): NormalizedOperation => {
    const ps = raw.parameterSchema ?? {};
    const params: NormalizedParam[] = (["path", "query", "header", "cookie"] as ParamLoc[]).flatMap((loc) => expandSlot(loc, ps[loc], shared?.[loc], diagnostics, `${uri}#${name}`));
    const bodySchema = raw.contentSchema ?? ps.body;
    const request: NormalizedRequest = { method: raw.method.toLowerCase(), path: uri, params, body: bodySchema != null ? { contentType: first(raw.contentType), schema: bodySchema } : undefined };

    // responses: apiResponses ∪ pathResponses overlaid by the request's own (C012 precedence). Keyed by NAME.
    const composed: Record<string, NormalizedResponse> = {};
    const add = (src: Record<string, { status: string | number; description?: string; contentType?: string | string[]; contentSchema?: unknown }>, inherited: boolean) => {
      for (const [rname, r] of Object.entries(src ?? {})) composed[rname] = { name: rname, status: String(r.status), description: r.description, contentType: first(r.contentType, ""), schema: r.contentSchema, inherited };
    };
    add(apiResponses as never, true); add(pathResponses, true); add(raw.responses ?? {}, false);

    const sig = computeSignature(uri, raw as never).tuple;
    return {
      id: `${slug(uri)}__${slug(name)}`, name, method: raw.method.toLowerCase(), path: uri, tag: raw.tags?.[0],
      summary: raw.summary, description: raw.description, deprecated: raw.deprecated,
      request, responses: Object.values(composed), security: (raw.security ?? []).flatMap((o) => Object.keys(o)),
      servers: (raw as { servers?: ServerEntry[] }).servers ?? pathServers,
      cost: raw["x-suluk-cost"], access: raw["x-suluk-access"], collisions, shareCount,
      signature: { method: sig.method, pathShape: sig.path, contentType: sig.contentType },
    };
  };

  const operations: NormalizedOperation[] = [];
  for (const [uri, piRaw] of Object.entries(doc.paths ?? {})) {
    const pi = piRaw as { requests?: Record<string, RawReq>; shared?: { parameterSchema?: RawReq["parameterSchema"] }; pathResponses?: Record<string, never>; servers?: ServerEntry[] };
    const reqs = Object.entries(pi.requests ?? {});
    const byMethod = new Map<string, number>();
    for (const [, r] of reqs) byMethod.set(r.method.toLowerCase(), (byMethod.get(r.method.toLowerCase()) ?? 0) + 1);
    // signature collisions for this path's request set (the 3-valued ADA verdict)
    const sigs = reqs.map(([n, r]) => ({ n, tuple: computeSignature(uri, r as never).tuple, r }));
    const noteByName = new Map<string, CollisionNote[]>();
    for (let i = 0; i < sigs.length; i++) for (let j = i + 1; j < sigs.length; j++) {
      const v = collide(sigs[i].tuple, sigs[j].tuple);
      if (v === "provably-disjoint") continue;
      diagnostics.push({ kind: "collision", where: uri, message: `${sigs[i].n} ↔ ${sigs[j].n}: ${v}` });
      const ct = (m: RawReq["contentType"]) => (m == null ? "*" : Array.isArray(m) ? m.join("/") : m);
      const reason = v === "provable-collision" ? `both resolve identically (${sigs[i].tuple.method} · ${ct(sigs[i].r.contentType)})` : `share ${sigs[i].tuple.method}; disambiguation is body/query-dependent (runtime)`;
      (noteByName.get(sigs[i].n) ?? noteByName.set(sigs[i].n, []).get(sigs[i].n)!).push({ with: sigs[j].n, verdict: v, reason });
      (noteByName.get(sigs[j].n) ?? noteByName.set(sigs[j].n, []).get(sigs[j].n)!).push({ with: sigs[i].n, verdict: v, reason });
    }
    const pathServers = pi.servers ?? docServers;
    for (const [name, raw] of reqs) operations.push(buildOp(uri, name, raw, pi.shared?.parameterSchema, pi.pathResponses ?? {}, pathServers, noteByName.get(name) ?? [], byMethod.get(raw.method.toLowerCase()) ?? 1));
  }

  const webhooks: NormalizedOperation[] = Object.entries(doc.webhooks ?? {}).map(([name, raw]) => buildOp(`webhooks/${name}`, name, raw as unknown as RawReq, undefined, {}, docServers, [], 1));

  const models: ModelEntry[] = Object.entries(doc.components?.schemas ?? {}).map(([name, schema]) => ({ name, schema }));
  const security: SecuritySchemeEntry[] = Object.entries(doc.components?.securitySchemes ?? {}).map(([name, s]) => { const o = s as unknown as Record<string, unknown>; return { name, type: o.type as string, scheme: o.scheme as string, in: o.in as string, description: o.description as string }; });

  return {
    spec: { dialect: "suluk-v4", version: doc.openapi ?? "4.0.0-candidate" },
    info: { title: doc.info?.title ?? "API Reference", version: doc.info?.version, description: doc.info?.description },
    servers: docServers, tags, operations, models, security, webhooks, diagnostics,
  };
}
