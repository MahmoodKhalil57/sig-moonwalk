/**
 * Generate a complete TypeScript SDK from a v4 "Suluk" document. The output is one self-contained .ts file:
 *   • the contract's input JSON Schemas shipped AS DATA — NOT transpiled into any one validator's source.
 *     v4 stores JSON Schema 2020-12 (the lossless, portable interchange); the SDK validates THAT, directly.
 *   • each input is exposed as a STANDARD SCHEMA (`~standard`, the validator-agnostic interface from the
 *     Zod/Valibot/ArkType authors) backed by a generic, eval-free engine (@cfworker/json-schema, Workers-native).
 *     So `.input` plugs straight into react-hook-form / TanStack Form / tRPC — not locked to one library.
 *   • an ofetch-based createClient(config) factory — auth wired via an onRequest interceptor (bearer / cookie)
 *   • methods grouped intuitively: CRUD by entity (client.product.create), custom ops by path (client.checkout.order)
 *   • the v4 SUPERPOWERS surfaced as TYPED METADATA on each method: `.cost` (µ$), `.requires` (access), `.input`
 *     (the Standard Schema). Metadata + a client-side guard, not enforcement — the server is the boundary (C022).
 * Static TS types come from the SAME JSON Schema (tsType), so the body is typed AND validated from one source.
 */
import type { OpenAPIv4Document } from "@suluk/core";
import { isReference } from "@suluk/core";

const reserved = new Set(["delete", "new", "function", "default", "return", "class", "in", "for"]);
const ident = (s: string) => { const c = s.replace(/[^a-zA-Z0-9_$]/g, "_").replace(/^[0-9]/, "_$&"); return reserved.has(c) ? `${c}_` : c; };
const camel = (s: string) => s.replace(/[-_/]+(.)/g, (_, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9_$]/g, "");
const jsKey = (k: string) => (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k));
const refName = (r: unknown) => (isReference(r) ? String((r as { $ref: string }).$ref).split("/").pop()! : null);

/** A JSON schema → a TS type string (used for typed method inputs + response types). */
export function tsType(doc: OpenAPIv4Document, schema: unknown, depth = 0): string {
  if (schema == null || schema === true) return "unknown";
  if (schema === false) return "never";
  const rn = refName(schema);
  if (rn) return ident(rn);
  const s = schema as Record<string, unknown>;
  if (Array.isArray(s.enum)) return (s.enum as unknown[]).map((e) => JSON.stringify(e)).join(" | ") || "never";
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (Array.isArray(s.oneOf) || Array.isArray(s.anyOf)) return ((s.oneOf ?? s.anyOf) as unknown[]).map((x) => tsType(doc, x, depth + 1)).join(" | ");
  if (Array.isArray(s.allOf)) return (s.allOf as unknown[]).map((x) => tsType(doc, x, depth + 1)).join(" & ");
  const t = Array.isArray(s.type) ? (s.type as string[])[0] : s.type;
  if (t === "array" || s.items) return `${tsType(doc, s.items, depth + 1)}[]`;
  if (t === "object" || s.properties) {
    const props = (s.properties ?? {}) as Record<string, unknown>;
    const required = new Set((s.required as string[] | undefined) ?? []);
    const keys = Object.keys(props);
    if (!keys.length || depth > 8) return "Record<string, unknown>";
    return `{ ${keys.map((k) => `${jsKey(k)}${required.has(k) ? "" : "?"}: ${tsType(doc, props[k], depth + 1)}`).join("; ")} }`;
  }
  return t === "string" ? "string" : t === "integer" || t === "number" ? "number" : t === "boolean" ? "boolean" : t === "null" ? "null" : "unknown";
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
  pathParams: string[]; queryRaw?: unknown; bodyRaw?: unknown; respType: string;
  cost: number | null; requires: string; scope?: string; summary?: string;
  bid?: string; qid?: string; bodyTs?: string; queryTs?: string; // assigned after collision resolution
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
        name, ns, member, method: req.method.toLowerCase(), uri, pathParams: pathVars(uri),
        queryRaw: ps.query, bodyRaw: req.contentSchema ?? ps.body, respType: respType(doc, req),
        cost: costOf(req), requires: acc?.requires ?? "anyone", scope: acc?.scope, summary: req.summary,
      });
    }
  }
  return ops;
}

function emitMethod(op: OpInfo): string {
  const args: string[] = op.pathParams.map((p) => `${ident(p)}: string | number`);
  if (op.qid) args.push(`query?: ${op.queryTs}`);
  if (op.bid) args.push(`body: ${op.bodyTs}`);
  const url = "`" + op.uri.replace(/^\/?/, "/").replace(/\{\+?([^}?&]+)\}/g, (_, p) => "${" + ident(p) + "}") + "`";
  const opts = [`method: "${op.method.toUpperCase()}"`];
  if (op.bid) opts.push(`body: _v ? parse(${op.bid}, body) : body`);
  if (op.qid) opts.push(`query: _v && query ? parse(${op.qid}, query) : query`);
  const meta = `{ cost: ${op.cost ?? "null"}, requires: ${JSON.stringify(op.requires)}${op.scope ? `, scope: ${JSON.stringify(op.scope)}` : ""}${op.bid ? `, input: ${op.bid}` : ""} }`;
  const doc = op.summary ? `      /** ${op.summary.replace(/\*\//g, "*\\/")} — ${op.requires}${op.cost != null ? ` · ⛁ ${op.cost}µ$` : ""} */\n` : "";
  return `${doc}      ${ident(op.member)}: Object.assign(\n        (${args.join(", ")}) => api<${op.respType}>(${url}, { ${opts.join(", ")} }),\n        ${meta},\n      )`;
}

function emitTree(ops: OpInfo[]): string {
  const tree = new Map<string, OpInfo[]>();
  for (const op of ops) tree.set(op.ns.join("."), [...(tree.get(op.ns.join(".")) ?? []), op]);
  return [...tree.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([ns, list]) => {
    const methods = list.map(emitMethod).join(",\n");
    return ns === "" ? methods : `      ${ident(ns.split(".").pop()!)}: {\n${methods.split("\n").map((l) => "  " + l).join("\n")}\n      }`;
  }).join(",\n");
}

export interface SdkOptions { baseURL?: string }

export function generateSdk(doc: OpenAPIv4Document, opts: SdkOptions = {}): string {
  const ops = walkOps(doc);
  // resolve method-name collisions DETERMINISTICALLY (council wf4pmh1ie: never a runtime guess) — append the HTTP
  // method, then a stable index; surface them in the header.
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

  // Emit a JSON Schema AS A LITERAL. When it $refs components, splice them in as $defs and rewrite the pointers,
  // so each validator is self-contained (the generic engine resolves refs without the whole document).
  const defs = (doc.components?.schemas ?? {}) as Record<string, unknown>;
  const hasDefs = Object.keys(defs).length > 0;
  const schemaLiteral = (s: unknown): string => {
    const str = JSON.stringify(s ?? {});
    if (!hasDefs || !str.includes("#/components/schemas/")) return str;
    const merged = { $defs: JSON.parse(JSON.stringify(defs)), ...JSON.parse(str) };
    return JSON.stringify(merged).replace(/#\/components\/schemas\//g, "#/$defs/");
  };

  // per-op input schemas (body + query), stored AS DATA in `schemas`, then wrapped as Standard Schemas. Keyed off
  // the final (post-collision) method path so the id is stable + unique.
  const schemaEntries: string[] = [];
  const inputDecls: string[] = [];
  for (const op of ops) {
    const base = [...op.ns, op.member].join("_").replace(/[^a-zA-Z0-9_$]/g, "_");
    if (op.bodyRaw != null) {
      op.bid = `${base}Input`; op.bodyTs = tsType(doc, op.bodyRaw);
      schemaEntries.push(`  ${ident(base)}: ${schemaLiteral(op.bodyRaw)},`);
      inputDecls.push(`const ${op.bid} = std<${op.bodyTs}>(schemas.${ident(base)});`);
    }
    if (op.queryRaw != null) {
      op.qid = `${base}_q`; op.queryTs = tsType(doc, op.queryRaw);
      schemaEntries.push(`  ${ident(base + "_q")}: ${schemaLiteral(op.queryRaw)},`);
      inputDecls.push(`const ${op.qid} = std<${op.queryTs}>(schemas.${ident(base + "_q")});`);
    }
  }
  const manifest = Object.fromEntries(ops.map((o) => [[...o.ns, o.member].join("."), { cost: o.cost, requires: o.requires, ...(o.scope ? { scope: o.scope } : {}) }]));
  const title = doc.info?.title ?? "API";
  const version = doc.openapi ?? "4.0.0-candidate";
  // shared models (components.schemas): a Standard Schema + an inferred TS type, both from the one JSON Schema.
  const models = Object.entries(defs).map(([n, s]) => `export type ${ident(n)} = ${tsType(doc, s)};\nexport const ${ident(n)}Schema = std<${ident(n)}>(${schemaLiteral(s)});`).join("\n");
  const totalCost = ops.filter((o) => o.cost != null).reduce((s, o) => s + (o.cost ?? 0), 0);

  return `/**
 * ${title} — TypeScript SDK. AUTO-GENERATED by @suluk/sdk from the v4 contract (OpenAPI ${version}). Do not edit.
 *
 * Generated straight from the contract: ${ops.length} operations, fully typed. The contract's input JSON Schemas
 * are shipped AS DATA (\`schemas\`) and validated DIRECTLY by a generic, eval-free engine — never transpiled into a
 * single validator's source — so what runs is exactly what the contract stores (lossless). Each input is a STANDARD
 * SCHEMA (\`.input\`), so it drops into react-hook-form / TanStack Form / tRPC unchanged. Auth is wired via an
 * interceptor; every method carries the v4 facets as typed metadata — \`.cost\` (µ$), \`.requires\` (who can call it),
 * \`.input\` (the Standard Schema). Those are HINTS + a client-side guard, not enforcement — the server is the
 * security boundary.${collisions.length ? `\n * Namespaced ${collisions.length} method collision(s) (a v4 multi-request-per-method capability): ${collisions.join("; ")}.` : ""}
 *
 *   import { createClient } from "./suluk-sdk";
 *   const api = createClient({ baseURL: "${opts.baseURL ?? ""}", token: () => localStorage.getItem("token") });
 *   const products = await api.product.list();
 *   const order = await api.checkout.order({ items: [{ productId: 1, qty: 2 }] }); // input validated before send
 *
 * Requires: \`npm i ofetch @cfworker/json-schema\`.
 */
import { ofetch, type FetchError } from "ofetch";
import { Validator } from "@cfworker/json-schema";

export type { FetchError };

/** The Standard Schema v1 interface — \`.input\` implements this, so any Standard-Schema-aware tool can consume it. */
export interface StandardSchemaV1<Output = unknown> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: "suluk";
    readonly validate: (value: unknown) => StandardResult<Output>;
    readonly types?: { readonly output: Output };
  };
}
export type StandardIssue = { readonly message: string; readonly path: ReadonlyArray<string | number> };
export type StandardResult<O> = { readonly value: O } | { readonly issues: ReadonlyArray<StandardIssue> };

/** Thrown by a method when its input fails the contract's JSON Schema (only when \`validate\` is on). */
export class SulukValidationError extends Error {
  constructor(public readonly issues: ReadonlyArray<StandardIssue>) {
    super("Input failed contract validation: " + issues.map((i) => \`\${i.path.join(".") || "(root)"}: \${i.message}\`).join("; "));
    this.name = "SulukValidationError";
  }
}

/** The contract's input JSON Schemas (2020-12), shipped AS DATA — introspectable, validated directly. */
export const schemas = {
${schemaEntries.join("\n")}
} as const;

/** Wrap a stored JSON Schema as a Standard Schema, backed by a generic, eval-free validator (Workers-native). */
function std<Output>(schema: unknown): StandardSchemaV1<Output> {
  const v = new Validator(schema as object, "2020-12");
  return {
    "~standard": {
      version: 1,
      vendor: "suluk",
      validate(value: unknown): StandardResult<Output> {
        const r = v.validate(value);
        if (r.valid) return { value: value as Output };
        return { issues: (r.errors as Array<{ error?: string; instanceLocation?: string }>).map((e) => ({ message: e.error ?? "invalid", path: (e.instanceLocation ?? "").split("/").slice(1).filter(Boolean) })) };
      },
    },
  };
}

/** Validate \`value\` against an input schema; return it (typed) or throw SulukValidationError. */
function parse<Output>(input: StandardSchemaV1<Output>, value: unknown): Output {
  const r = input["~standard"].validate(value);
  if ("issues" in r) throw new SulukValidationError(r.issues);
  return r.value;
}

${models}

${inputDecls.join("\n")}

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
  /** validate inputs against the contract's JSON Schemas before sending (default true). */
  validate?: boolean;
}

/** Create a typed, input-validating client for ${title}. */
export function createClient(config: SulukClientConfig = {}) {
  const _v = config.validate !== false;
  const api = ofetch.create({
    baseURL: config.baseURL ?? ${JSON.stringify(opts.baseURL ?? "")},
    credentials: config.credentials ?? "include",
    headers: config.headers,
    retry: config.retry,
    async onRequest({ options }) {
      const t = typeof config.token === "function" ? await config.token() : config.token;
      if (t) { const h = new Headers(options.headers as HeadersInit | undefined); h.set("Authorization", \`Bearer \${t}\`); options.headers = h; }
    },
  });
  return {
${emitTree(ops)},
    /** the raw ofetch instance — escape hatch for anything the typed methods don't cover. */
    $fetch: api,
    /** the contract's input JSON Schemas, as data (for codegen / forms / introspection). */
    $schemas: schemas,
    /** introspectable per-operation facet manifest (for agents/tooling): { "<method.path>": { cost, requires } }. */
    $manifest: ${JSON.stringify(manifest)} as const,
    /** total declared cost of all priced operations (µ$): ${totalCost}. */
    $meta: { operations: ${ops.length}, totalDeclaredMicroUsd: ${totalCost}, version: ${JSON.stringify(version)} },
  };
}

export type SulukClient = ReturnType<typeof createClient>;
`;
}
