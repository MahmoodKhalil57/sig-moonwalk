/**
 * Generate a complete TypeScript SDK from a v4 "Suluk" document. The output is one self-contained .ts file:
 *   • types emitted from the request/response schemas (typed input + output)
 *   • an ofetch-based createClient(config) factory — auth wired via an onRequest interceptor (bearer / cookie)
 *   • methods grouped intuitively: CRUD by entity (client.product.create), custom ops by path (client.checkout.order)
 *   • the v4 SUPERPOWERS surfaced as TYPED METADATA on each method: `.cost` (declared µ$) + `.requires` (access).
 *     Metadata, not enforcement — the server is the boundary (council C022). It is a faithful, deterministic
 *     projection of the contract.
 */
import type { OpenAPIv4Document } from "@suluk/core";
import { isReference, deref } from "@suluk/core";

const reserved = new Set(["delete", "new", "function", "default", "return", "class", "in", "for"]);
const ident = (s: string) => { const c = s.replace(/[^a-zA-Z0-9_$]/g, "_").replace(/^[0-9]/, "_$&"); return reserved.has(c) ? `${c}_` : c; };
const camel = (s: string) => s.replace(/[-_/]+(.)/g, (_, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9_$]/g, "");
const jsKey = (k: string) => (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k));
const refName = (r: unknown) => (isReference(r) ? String((r as { $ref: string }).$ref).split("/").pop()! : null);

/** A JSON schema → a TS type string. $refs become the model name; cycles/depth guarded; falls back to unknown. */
export function tsType(doc: OpenAPIv4Document, schema: unknown, depth = 0, seen: Set<string> = new Set()): string {
  if (schema == null || schema === true) return "unknown";
  if (schema === false) return "never";
  const rn = refName(schema);
  if (rn) return ident(rn);
  const s = schema as Record<string, unknown>;
  if (Array.isArray(s.enum)) return (s.enum as unknown[]).map((e) => JSON.stringify(e)).join(" | ") || "never";
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (Array.isArray(s.oneOf) || Array.isArray(s.anyOf)) return ((s.oneOf ?? s.anyOf) as unknown[]).map((x) => tsType(doc, x, depth + 1, seen)).join(" | ");
  if (Array.isArray(s.allOf)) return (s.allOf as unknown[]).map((x) => tsType(doc, x, depth + 1, seen)).join(" & ");
  const t = Array.isArray(s.type) ? (s.type as string[])[0] : s.type;
  if (t === "array" || s.items) return `${tsType(doc, s.items, depth + 1, seen)}[]`;
  if (t === "object" || s.properties) {
    const props = (s.properties ?? {}) as Record<string, unknown>;
    const required = new Set((s.required as string[] | undefined) ?? []);
    const keys = Object.keys(props);
    if (!keys.length) return "Record<string, unknown>";
    if (depth > 8) return "Record<string, unknown>";
    const fields = keys.map((k) => `${jsKey(k)}${required.has(k) ? "" : "?"}: ${tsType(doc, props[k], depth + 1, seen)}`).join("; ");
    return `{ ${fields} }`;
  }
  if (t === "string") return "string";
  if (t === "integer" || t === "number") return "number";
  if (t === "boolean") return "boolean";
  if (t === "null") return "null";
  return "unknown";
}

interface RawReq {
  method: string; summary?: string; contentSchema?: unknown;
  parameterSchema?: Record<string, unknown>;
  responses?: Record<string, { status: string | number; contentSchema?: unknown }>;
  ["x-suluk-cost"]?: { estimateMicroUsd?: number; components?: { microUsd?: number }[] };
  ["x-suluk-access"]?: { requires?: string; scope?: string };
}
interface OpInfo {
  name: string; ns: string[]; member: string; method: string; uri: string;
  pathParams: string[]; queryType?: string; bodyType?: string; respType: string;
  cost: number | null; requires: string; scope?: string; summary?: string;
}

const pathVars = (uri: string) => [...uri.matchAll(/\{\+?([^}?&]+)\}/g)].map((m) => m[1]);
function costOf(req: RawReq): number | null {
  const c = req["x-suluk-cost"]; if (!c) return null;
  return c.estimateMicroUsd ?? (c.components ?? []).reduce((s, x) => s + Number(x.microUsd ?? 0), 0);
}
function respType(doc: OpenAPIv4Document, req: RawReq): string {
  const r = Object.values(req.responses ?? {}).find((x) => String(x.status).startsWith("2") && x.contentSchema != null);
  return r ? tsType(doc, r.contentSchema) : "unknown";
}

function walkOps(doc: OpenAPIv4Document): OpInfo[] {
  const ops: OpInfo[] = [];
  for (const [uri, piRaw] of Object.entries(doc.paths ?? {})) {
    const pi = piRaw as { requests?: Record<string, RawReq> };
    for (const [name, req] of Object.entries(pi.requests ?? {})) {
      const crud = /^(list|get|create|update|delete)([A-Z]\w*)$/.exec(name);
      let ns: string[], member: string;
      if (crud) { ns = [camel(crud[2][0].toLowerCase() + crud[2].slice(1))]; member = crud[1]; }
      else { const segs = uri.split("/").filter((x) => x && !x.startsWith("{")); ns = segs.slice(0, -1).map(camel); member = camel(segs[segs.length - 1] ?? name); }
      const ps = req.parameterSchema ?? {};
      const acc = req["x-suluk-access"];
      ops.push({
        name, ns, member, method: req.method.toLowerCase(), uri,
        pathParams: pathVars(uri),
        queryType: ps.query ? tsType(doc, ps.query) : undefined,
        bodyType: req.contentSchema ?? ps.body ? tsType(doc, req.contentSchema ?? ps.body) : undefined,
        respType: respType(doc, req),
        cost: costOf(req), requires: acc?.requires ?? "anyone", scope: acc?.scope, summary: req.summary,
      });
    }
  }
  return ops;
}

function emitMethod(op: OpInfo): string {
  const args: string[] = op.pathParams.map((p) => `${ident(p)}: string | number`);
  if (op.queryType) args.push(`query?: ${op.queryType}`);
  if (op.bodyType) args.push(`body: ${op.bodyType}`);
  const url = "`" + op.uri.replace(/^\/?/, "/").replace(/\{\+?([^}?&]+)\}/g, (_, p) => "${" + ident(p) + "}") + "`";
  const opts = [`method: "${op.method.toUpperCase()}"`];
  if (op.bodyType) opts.push("body");
  if (op.queryType) opts.push("query");
  const meta = `{ cost: ${op.cost ?? "null"}, requires: ${JSON.stringify(op.requires)}${op.scope ? `, scope: ${JSON.stringify(op.scope)}` : ""} }`;
  const doc = op.summary ? `      /** ${op.summary.replace(/\*\//g, "*\\/")} — ${op.requires}${op.cost != null ? ` · ⛁ ${op.cost}µ$` : ""} */\n` : "";
  return `${doc}      ${ident(op.member)}: Object.assign(\n        (${args.join(", ")}) => api<${op.respType}>(${url}, { ${opts.join(", ")} }),\n        ${meta},\n      )`;
}

function emitTree(ops: OpInfo[]): string {
  const tree = new Map<string, OpInfo[]>(); // ns key ("" for top-level) → ops
  for (const op of ops) tree.set(op.ns.join("."), [...(tree.get(op.ns.join(".")) ?? []), op]);
  const groups = [...tree.entries()].sort(([a], [b]) => a.localeCompare(b));
  const parts = groups.map(([ns, list]) => {
    const methods = list.map(emitMethod).join(",\n");
    return ns === "" ? methods : `      ${ident(ns.split(".").pop()!)}: {\n${methods.split("\n").map((l) => "  " + l).join("\n")}\n      }`;
  });
  return parts.join(",\n");
}

export interface SdkOptions { clientName?: string; baseURL?: string }

export function generateSdk(doc: OpenAPIv4Document, opts: SdkOptions = {}): string {
  const ops = walkOps(doc);
  // collisions (council wf4pmh1ie / hudlow): never emit a client that GUESSES at runtime. We resolve DETERMINISTICALLY
  // by namespacing — two named requests sharing a method-path (e.g. a v4 GET+POST on one path) get distinct, stable
  // method names (append the HTTP method, then a stable index by name), and the collision is surfaced in the header.
  const collisions: string[] = [];
  const byKey = new Map<string, OpInfo[]>();
  for (const op of ops) { const k = [...op.ns, op.member].join("."); (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(op); }
  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    collisions.push(`client.${key} ← ${list.map((o) => o.name).join(", ")}`);
    const used = new Map<string, number>();
    for (const op of [...list].sort((a, b) => a.name.localeCompare(b.name) || a.method.localeCompare(b.method))) {
      const cand = op.member + op.method.charAt(0).toUpperCase() + op.method.slice(1);
      const n = used.get(cand) ?? 0; used.set(cand, n + 1);
      op.member = n === 0 ? cand : `${cand}${n + 1}`;
    }
  }
  const manifest = Object.fromEntries(ops.map((o) => [[...o.ns, o.member].join("."), { cost: o.cost, requires: o.requires, ...(o.scope ? { scope: o.scope } : {}) }]));
  const title = doc.info?.title ?? "API";
  const version = doc.openapi ?? "4.0.0-candidate";
  const models = Object.entries(doc.components?.schemas ?? {}).map(([n, s]) => {
    const ty = tsType(doc, s);
    return ty.startsWith("{") ? `export interface ${ident(n)} ${ty}` : `export type ${ident(n)} = ${ty};`;
  }).join("\n");
  const priced = ops.filter((o) => o.cost != null);
  const totalCost = priced.reduce((s, o) => s + (o.cost ?? 0), 0);

  return `/**
 * ${title} — TypeScript SDK. AUTO-GENERATED by @suluk/sdk from the v4 contract (OpenAPI ${version}). Do not edit.
 *
 * Generated straight from the contract: ${ops.length} operations, fully typed. Auth is wired via an interceptor;
 * every method carries the v4 facets as typed metadata — \`.cost\` (declared µ$) and \`.requires\` (who can call it).
 * Those are HINTS, not enforcement — the server is the security boundary.${collisions.length ? `\n * Namespaced ${collisions.length} method collision(s) (a v4 multi-request-per-method capability): ${collisions.join("; ")}.` : ""}
 *
 *   import { createClient } from "./suluk-sdk";
 *   const api = createClient({ baseURL: "${opts.baseURL ?? ""}", token: () => localStorage.getItem("token") });
 *   const products = await api.product.list();
 *   const order = await api.checkout.order({ items: [{ productId: 1, qty: 2 }] });
 *   api.product.create.requires; // "admin"   api.product.create.cost; // µ$
 *
 * Requires: \`npm i ofetch\`.
 */
import { ofetch, type FetchError } from "ofetch";

export type { FetchError };
export interface SulukClientConfig {
  /** API base URL (default: same-origin "${opts.baseURL ?? ""}"). */
  baseURL?: string;
  /** a bearer token, or a (sync/async) getter — injected as \`Authorization: Bearer …\` on every request. */
  token?: string | (() => string | null | undefined | Promise<string | null | undefined>);
  /** send cookies for session auth (default "include"). */
  credentials?: RequestCredentials;
  /** extra default headers (e.g. a \`x-suluk-action\` tag for cost attribution). */
  headers?: Record<string, string>;
  /** retries for idempotent requests (ofetch default). */
  retry?: number;
}

${models}

/** Create a typed client for ${title}. */
export function createClient(config: SulukClientConfig = {}) {
  const api = ofetch.create({
    baseURL: config.baseURL ?? ${JSON.stringify(opts.baseURL ?? "")},
    credentials: config.credentials ?? "include",
    headers: config.headers,
    retry: config.retry,
    async onRequest({ options }) {
      const t = typeof config.token === "function" ? await config.token() : config.token;
      if (t) options.headers = { ...(options.headers as Record<string, string>), Authorization: \`Bearer \${t}\` };
    },
  });
  return {
${emitTree(ops)},
    /** the raw ofetch instance — escape hatch for anything the typed methods don't cover. */
    $fetch: api,
    /** introspectable per-operation facet manifest (for agents/tooling): { "<method.path>": { cost, requires } }. */
    $manifest: ${JSON.stringify(manifest)} as const,
    /** total declared cost of all priced operations (µ$): ${totalCost}. */
    $meta: { operations: ${ops.length}, totalDeclaredMicroUsd: ${totalCost}, version: ${JSON.stringify(version)} },
  };
}

export type SulukClient = ReturnType<typeof createClient>;
`;
}
