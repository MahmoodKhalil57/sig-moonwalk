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
  components?: Components;
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

/** A name-keyed map; each callback is a runtime-expression-keyed map of pathItem-shaped definitions (§14, C018). */
export type Callback = Record<string, Record<string, PathItem>>;

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
 */
export type Schema = Record<string, unknown> | boolean;

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
