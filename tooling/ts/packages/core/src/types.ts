/**
 * OpenAPI v4.0 "Suluk" Candidate — TypeScript type definitions for the document model.
 *
 * Mirrors specification/candidate-v4/v4-meta-schema.json and the pinned canonical model (SPEC §1),
 * per ADRs C003/C004/C005/C009/C013/C019. CANDIDATE, not official OAS. Provisional (~0.55–0.65);
 * revisable with the ADRs. Inner Schema Objects are JSON Schema 2020-12 (kept as an opaque type here).
 *
 * For a TS library / vscode extension: import these as the parsed-document model; use {@link isReference}
 * to discriminate an OpenAPI Reference Object from an inline Schema (the C019 slot+token rule).
 */

/** Top-level OpenAPI v4 document. */
export interface OpenAPIv4Document {
  /** e.g. "4.0.0-candidate". */
  openapi: string;
  info: Info;
  servers?: Server[];
  /** Map keyed by tag name (C009). */
  tags?: Record<string, Tag>;
  /** Map keyed by RFC6570 parseable-profile uriTemplate (C005). */
  paths: Record<string, PathItem>;
  /** Document-level responses reusable across all operations (§5). */
  apiResponses?: Record<string, Response>;
  /** Incoming operations not hosted at the API's own paths (§14, C018). */
  webhooks?: Record<string, Request>;
  /**
   * JOBS vendor map (C025) — non-HTTP background work (cron / queue consumers) that has NO inbound Request, so it
   * can't live in `paths` or `webhooks`. The first-class home C024 pre-blessed for its `scheduled`/`queue-consumed`
   * cost triggers. A VENDOR EXTENSION (the `x-suluk-*` namespace) — NOT a normative async construct (C018 scope held).
   */
  ["x-suluk-jobs"]?: Record<string, SulukJob>;
  components?: Components;
  [ext: `x-${string}`]: unknown;
}

/**
 * A background job (C025) — non-HTTP work fired by a `scheduled` (cron) or `queue-consumed` trigger. It carries no
 * Request/Response (there is no HTTP exchange); its STATIC fields (trigger + schedule/queue) are locally decidable,
 * and it carries the same advisory `x-suluk-*` facets an operation does (notably `x-suluk-cost` with a matching
 * `trigger`, so a job's cost is declared + audited like any other). Provenance via `x-suluk-source`.
 */
export interface SulukJob {
  /** the non-HTTP trigger that fires this job. */
  trigger: "scheduled" | "queue-consumed";
  /** for "scheduled": a cron expression (statically declared — e.g. "0 0 * * *"). */
  schedule?: string;
  /** for "queue-consumed": the queue name the consumer drains. */
  queue?: string;
  summary?: string;
  description?: string;
  /** where in the authored source this job was projected from (advisory provenance; mirrors Request). */
  ["x-suluk-source"]?: SulukSource;
  /** any other vendor facet — notably `x-suluk-cost` (the job's declared cost, read by @suluk/cost). */
  [ext: `x-${string}`]: unknown;
}

export interface Info {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: Record<string, unknown>;
  license?: { name?: string; url?: string };
}

/** Server IDENTITY — a by-name shape primitive (C015 #55); environment URL config is a deployment concern. */
export interface Server {
  url: string;
  description?: string;
}

export interface Tag {
  summary?: string;
  description?: string;
  type?: string;
}

/** A pathItem, keyed in `paths` by its uriTemplate. Each request *is* an operation (SPEC §1.3/1.4). */
export interface PathItem {
  summary?: string;
  description?: string;
  servers?: Server[];
  /** Optional per-level inheritance wrapper (C012 #116). */
  shared?: Shared;
  /** The operations at this path, keyed by stable name (C009). At least one required. */
  requests: Record<string, Request>;
  /** Responses reusable across this pathItem's requests (§5). */
  pathResponses?: Record<string, Response>;
}

/** Optional inheritance wrapper; its `parameterSchema` is allOf-composed into each request (C012 #116, @0.55). */
export interface Shared {
  parameterSchema?: ParameterSchema;
}

export type HttpMethod =
  | "get" | "GET" | "put" | "PUT" | "post" | "POST" | "patch" | "PATCH"
  | "delete" | "DELETE" | "head" | "HEAD" | "options" | "OPTIONS" | "trace" | "TRACE";

/**
 * A Request *is* an operation (SPEC §1.4). DOM handle = its name (the key in `PathItem.requests`);
 * ADA identity = its signature (C003/C019 Appendix A — computed, not authored).
 */
export interface Request {
  method: HttpMethod;
  summary?: string;
  description?: string;
  /** Optional legacy handle; not the v4 primary identity (C009). */
  operationId?: string;
  tags?: string[];
  deprecated?: boolean;
  /** Request body media type(s) — plain IANA media type; params via the content model (§6/§7). */
  contentType?: string | string[];
  contentSchema?: SchemaOrRef;
  parameterSchema?: ParameterSchema;
  /** Named responses (§5); each carries its own status. At least one required. */
  responses: Record<string, Response>;
  callbacks?: Record<string, Callback>;
  /** Applied security, referenced BY NAME (C014 #69). */
  security?: SecurityRequirement[];
  servers?: Server[];
  /**
   * PROVENANCE facet (council whuovh6gs, L2): where in the AUTHORED source this operation was projected FROM.
   * A stable SYMBOLIC pointer (file + exported symbol) — never a line number, never an authz/routing input
   * (advisory only; C022 inv.5). STAMPED by the projection pass, never hand-authored. Scrub from externally
   * published projections (it discloses internal layout) — see core's `scrubSource` / `sourceIndex`.
   */
  ["x-suluk-source"]?: SulukSource;
  /**
   * RATE-LIMIT facet (saastarter-parity Phase 0): the declared per-operation rate budget. ADVISORY VENDOR
   * EXTENSION (see {@link SulukRateLimit}) — @suluk/hono's middleware ENFORCES it on the wire; core only
   * carries the shape + derived reads (`rateLimitIndex`/`rateLimitCoverage`/`retryAfterSeconds`).
   */
  ["x-suluk-ratelimit"]?: SulukRateLimit;
}

/**
 * RATE-LIMIT facet shape (saastarter-parity Phase 0): the per-operation rate budget an operation DECLARES.
 * Orthogonal to the NORMATIVE spec, which holds rate-limiting out-of-scope (C012 / frontier #43, ceiling 0.74):
 * like `x-suluk-cost`/`access`/`source` this is a vendor extension in the `x-suluk-*` namespace, never a
 * normative OAS construct. Advisory only — the facet declares the budget; the middleware enforces it.
 *
 * `windowMs` + `maxRequests` are the fixed-window budget, ported from saastarter's `checkRateLimit` opts
 * (src/lib/effect/rate-limit.ts:16-19). `key` is the declared key STRATEGY the runtime resolves a concrete
 * key from: only `"ip"` is saastarter-faithful (it keys by a resolved IP); `"principal"`/`"api-key"`/`"global"`
 * are ORIGINATED extensions (honestly-low ceiling — `"principal"` keying is gated on the Principal-model
 * decision, roadmap Open-Decision #5, so the Phase-0 middleware implements only `"ip"` + a caller-supplied override).
 */
export interface SulukRateLimit {
  /** fixed window length, milliseconds. */
  windowMs: number;
  /** max requests permitted per resolved key within the window. */
  maxRequests: number;
  /** the key STRATEGY (the runtime derives the concrete key). `"ip"` is the faithful default. */
  key: "ip" | "principal" | "api-key" | "global";
  /** optional sub-bucket name — lets two operations share or separate a budget (advisory). */
  scope?: string;
  description?: string;
}

/** A stable, symbolic pointer back to the authored source an element was projected from (advisory provenance). */
export interface SulukSource {
  /** repo-relative path to the authoring file (e.g. "src/server/schema.ts"). NOT a line number. */
  file: string;
  /** the exported symbol within that file (e.g. a Drizzle table export, or the operation's name). */
  symbol: string;
  /** what kind of authored thing it is — "drizzle-table" | "operation" | "better-auth" | … (advisory label). */
  kind?: string;
}

/** Per-location typed parameter slots (C004 #20). Each slot is a JSON Schema 2020-12 over its instance. */
export interface ParameterSchema {
  query?: SchemaOrRef;
  path?: SchemaOrRef;
  header?: SchemaOrRef;
  cookie?: SchemaOrRef;
  body?: SchemaOrRef;
}

/** Named in its containing map. Precedence: request > pathResponses > apiResponses (C012 #17b). */
export interface Response {
  /** HTTP status ("200"/200), a wildcard ("5XX"), or "default". */
  status: string | number;
  contentType?: string | string[];
  contentSchema?: SchemaOrRef;
  description?: string;
}

/**
 * A runtime-expression-keyed map of pathItem-shaped definitions (§14, C018).
 * The enclosing `Request.callbacks` is name-keyed, so `callbacks[name][expression]` is a {@link PathItem}.
 */
export type Callback = Record<string, PathItem>;

/** Reusable definitions; the referencing anchor (C013). Keyed by name (C009). */
export interface Components {
  schemas?: Record<string, Schema>;
  requests?: Record<string, Request>;
  responses?: Record<string, Response>;
  securitySchemes?: Record<string, SecurityScheme>;
  links?: Record<string, unknown>;
  examples?: Record<string, unknown>;
}

/** Map of securityScheme name → array of scope strings (referenced BY NAME, C014 #69). */
export type SecurityRequirement = Record<string, string[]>;

export interface SecurityScheme {
  type: "apiKey" | "http" | "oauth2" | "openIdConnect" | "mutualTLS";
  name?: string;
  in?: "query" | "header" | "cookie";
  scheme?: string;
  flows?: Record<string, unknown>;
  openIdConnectUrl?: string;
}

/**
 * An OpenAPI Reference Object (C013 #49). `$ref` is a JSON-Pointer "#/components/<type>/<name>"
 * resolved BY NAME (C009; the resolve algorithm is C019 Appendix A).
 */
export interface Reference {
  $ref: string;
  summary?: string;
  description?: string;
}

/**
 * A JSON Schema 2020-12 object (or boolean). Opaque here — validated by the 2020-12 dialect (C013).
 * May itself contain a JSON-Schema `$ref` keyword (distinct from an OpenAPI Reference Object).
 * Its `properties[name]` subschemas are the PROPERTY-LEVEL facet locus ({@link SchemaProperty}).
 */
export type Schema = Record<string, unknown> | boolean;

/**
 * The PROPERTY-LEVEL facet locus (saastarter-parity Phase 0). core's `x-suluk-*` facets are operation-level
 * today (on {@link Request}); a Schema Object's `properties[name]` is the locus for a FUTURE property-level
 * facet — e.g. `@suluk/drizzle` attaching `x-suluk-i18n` to a localized column. This is an ADVISORY typed VIEW
 * over the opaque {@link Schema}: it never narrows the runtime Schema type (which stays 2020-12-opaque), so a
 * property carrying an `x-suluk-*` member is still a valid 2020-12 subschema (the dialect ignores `x-*` keywords).
 */
export interface SchemaProperty {
  /** a property subschema may carry any vendor `x-suluk-*` facet (advisory; ignored by the 2020-12 validator). */
  [facet: `x-suluk-${string}`]: unknown;
}

/** A map of property name → its (optionally facet-bearing) subschema — the property-level facet locus. */
export type PropertyFacets = Record<string, SchemaProperty>;

/** Either an inline Schema Object or an OpenAPI Reference Object. */
export type SchemaOrRef = Schema | Reference;

/**
 * Discriminate an OpenAPI Reference Object from an inline Schema.
 * NOTE: a JSON Schema may *also* contain a `$ref` keyword; per C019 Appendix A the slot+token rule
 * decides the kind — a `$ref` lexically inside a Schema Object is the JSON-Schema kind, not a Reference.
 * This guard is the structural check; callers in Schema-Object position MUST apply the slot rule.
 */
export function isReference(x: SchemaOrRef | undefined): x is Reference {
  return typeof x === "object" && x !== null && "$ref" in x && typeof (x as Reference).$ref === "string";
}
