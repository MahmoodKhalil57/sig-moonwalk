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
  /**
   * AGENTS vendor map (C027) — `x-suluk-agents`. A composition manifest layered ON TOP of the API: each SulukAgent
   * is an LLM-orchestrated unit of SKILLS (model-bearing instruction bundles) + deterministic ROUTES (by-name
   * $refs into EXISTING operations, no `model`) + optional sub-AGENTS (by-name refs; recursion bounded by a
   * REQUIRED `maxDepth` + a cycle-linter, never the schema). A VENDOR EXTENSION riding the C025 `x-suluk-jobs`
   * precedent EXACTLY — NOT a normative kind, NEVER read by the DOM→ADA matcher (D1 held; see
   * plan/facts/0agents-d1.bn + test/agents-d1-invariance.test.ts). Selection/tiering is RUNTIME-ADVISORY;
   * determinism is DECLARED, never enforced. Severable: a 3.1 downgrade DROPS this map whole and the routes
   * survive as the ordinary operations they always referenced. Originated, low ceiling (~0.52); pairs with ADR C027.
   */
  ["x-suluk-agents"]?: Record<string, SulukAgent>;
  /**
   * POLICY vendor map (C028) — `x-suluk-policy`, keyed by OPERATOR/fleet name (not agent name: the operator owns
   * it, one policy spans many third-party agents). An operator-owned governance overlay that NARROWS what an agent
   * self-declares (effective = INTERSECT(operatorPolicy, agentSelfDeclaration); monotone — never grants). Rides the
   * x-suluk-jobs/x-suluk-agents move EXACTLY: optional, additive, NO new normative kind, NEVER read by the matcher
   * (D1; see plan/facts/0policy-d1.bn + test/policy-d1-invariance.test.ts). Only the STATIC subset is decidable here;
   * the `costCeiling` is DECLARED, enforced by a runtime adapter (`enforcedBy`), never by the schema. Originated, low
   * ceiling (~0.52); pairs with ADR C028.
   */
  ["x-suluk-policy"]?: Record<string, SulukPolicy>;
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

/**
 * A composition agent (C027) — an LLM-orchestrated unit. The map KEY is its stable wire-level identity (the emitted
 * MCP-tool / OpenRouter-function id; C009 by-name, never by index). It carries NO Request/Response and is NEVER
 * consulted by the request→operation matcher (D1). `description` is required + routing-oriented (the field the
 * serving LLM selects on). `routes` are deterministic (a by-name `operationRef` into an existing operation, NO
 * `model`); `skills` are LLM (a `model` is present). `agents` are by-name sub-agent refs; `maxDepth` is REQUIRED
 * whenever `agents` is non-empty (a typed LEAF = `maxDepth` 0, `agents` {}), and a cycle-linter rejects name-cycles
 * at author/install time (JSON-Schema cannot express acyclicity). A child's effective scope is INTERSECTION(child,
 * caller), never union. Determinism is DECLARED, never schema-enforced.
 */
export interface SulukAgent {
  /** required, routing-oriented — the field the serving LLM selects on (a lint rejects empty/one-word). */
  description: string;
  /** static resource:action authz; the agent's complete reachable surface is statically enumerable from the document. */
  scope?: string[];
  /** instruction bundles; PRESENCE of `model` is the hard static skill(LLM)-vs-route(deterministic) discriminator. */
  skills?: Record<string, SulukSkillRef>;
  /** deterministic routes: by-name `$ref`s into EXISTING operations; NO `model` field, ever. */
  routes?: Record<string, SulukRouteRef>;
  /** by-name sub-agent refs (never inline — inlining would fork C009 identity). */
  agents?: Record<string, SulukAgentRef>;
  /** REQUIRED when `agents` is non-empty (a lint, not the schema): the recursion depth ceiling; a leaf is 0. */
  maxDepth?: number;
  /** marks a tier whose retrieved / lower-tier content may NOT escalate scope or upgrade a figure's provenance. */
  trustBoundary?: "untrusted";
  /** advisory per-tier context budget (basis: estimate); fail-loud, never silent-zero. */
  contextBudget?: { tokens: number; basis: "estimate" };
  /**
   * THINKING ENVELOPE (C029) — a static cap on WITHIN-agent iteration (reason→tool→reason in the SAME completion,
   * context accreting), orthogonal to `maxDepth` (which bounds cross-agent nesting depth, a fresh context per hop).
   * `maxRounds` is REQUIRED when `thinking` is present. DECLARED-not-enforced: it bounds re-entries and is consumed
   * by the context analyzer (round-accretion) + the linter; it NEVER enforces termination, and is NEVER read by the
   * matcher. The loop TRAJECTORY (when/why each round stops) stays runtime-opaque (matching Strands / the Claude
   * Agent SDK / OpenAI Agents). There is deliberately NO stopCondition vocabulary — that would model runtime control
   * flow a generator could only echo. Absent ⇒ opaque single pass (zero-migration default). Conin's 6-round loop.
   */
  thinking?: { maxRounds: number; budget?: { tokens: number; basis: "estimate" } };
  /** any other vendor facet — notably `x-suluk-cost` (an agent/skill boundary's declared cost; PROVISIONAL per C026). */
  [ext: `x-${string}`]: unknown;
}

/** A by-name reference to a sub-agent within the same `x-suluk-agents` map (C009/C013; resolved at projection time, never by the matcher). */
export interface SulukAgentRef {
  /** a by-name `$ref` like `#/x-suluk-agents/<key>` (never an inline agent). */
  ref: string;
}

/**
 * A SKILL within an agent — an instruction bundle (the LLM tier). PRESENCE of `model` is what makes this a skill
 * (the system-text path) rather than a deterministic route. Skill text is a PROVENANCE POINTER (source URL +
 * content-hash + version), not inlined mutable prose: the served instructions are the single source of truth and a
 * projected SKILL.md is GENERATED from it, the content-hash binding making drift tool-detectable and fail-loud.
 */
export interface SulukSkillRef {
  /**
   * EXPLICIT model preference list (OpenRouter ids), cheap→capable — the opt-out path. OR declare NEEDS via
   * `modelProfile`/`modelPrefer`/`modelRequire` and let `@suluk/models` pick the best CURRENT model (a skill
   * declares what it needs, not a frozen id). Structural-only — never read by the matcher (C027 seam to @suluk/models).
   */
  model?: string[];
  /** a named selection profile resolved against the model catalog (@suluk/models). */
  modelProfile?: "tool-reliable" | "cheap-fast" | "balanced" | "max-reasoning" | "long-context" | "vision";
  /** escape-hatch preference weights (0-3) over the 4 author-facing axes. */
  modelPrefer?: { intelligence?: 0 | 1 | 2 | 3; cost?: 0 | 1 | 2 | 3; speed?: 0 | 1 | 2 | 3; context?: 0 | 1 | 2 | 3 };
  /** explicit hard requirements the author adds (beyond what's derived from the agent + the context analyzer). */
  modelRequire?: { needsStructured?: boolean; inputModalities?: string[]; minContext?: number };
  /** static serving partition: `resident` (default tools/list) vs `cold-tail` (revealed via discover_tools). */
  tier?: "resident" | "cold-tail";
  /** routing-oriented precondition prose (runtime-advisory; never a request-value selector — D1). */
  whenToUse?: string;
  /** author-declared (trusted) vs retrieved (untrusted) content (a retrieved skill may not escalate scope/provenance). */
  trust?: "author-declared" | "retrieved";
  scope?: string[];
  /** single source of truth + staleness binding (SKILL.md is generated from `source`, hashed to detect drift). */
  provenance?: { source: string; contentHash: string; version?: string };
  [ext: `x-${string}`]: unknown;
}

/**
 * A deterministic ROUTE within an agent — EXCLUSIVELY a by-name `operationRef` into an EXISTING
 * paths[*]/webhooks/x-suluk-jobs operation (never an inline re-declaration — inlining forks C009 identity and
 * strands the operation on a 3.1 downgrade). It has NO `model` field, ever — that absence is the hard static
 * route-vs-skill discriminator. `guarantee` is DECLARED intent, never schema-enforced (mirrors C026 PROVISIONAL).
 */
export interface SulukRouteRef {
  /** a by-name `$ref` into an existing operation (resolve-linted; a dangling ref fails burhan-converge). */
  operationRef: string;
  /** declared determinism intent (advisory, unverifiable-by-schema); NOT enforced. */
  guarantee?: "same-in-same-out" | "idempotent" | "safe";
  /**
   * Static serving partition (C027): `resident` (in the default tool list) vs `cold-tail` (revealed via
   * `discover_tools` on demand). Absent ⇒ resident. This is what a serving adapter trims to make the cheap/lower
   * tier carry a SMALLER tool surface — the conditional context reduction the tiering thesis needs (it must be
   * actively performed by the adapter, never enforced by the schema).
   */
  tier?: "resident" | "cold-tail";
  scope?: string[];
  // NB: NO `model` field — by construction. A route never carries a model.
}

/**
 * An OPERATOR governance policy (C028) — a member of the `x-suluk-policy` map, keyed by operator/fleet name. Every
 * field is STATIC, locally decidable, and NARROW-ONLY: applying a policy can only REMOVE capability an agent
 * self-declared (effective = INTERSECT(policy, agent)), never grant. No field may reference request/DOM/header/body
 * values (D1; the #20 tripwire is declined here too). `appliesTo` binds BY AGENT NAME (`#/x-suluk-agents/<key>`).
 */
export interface SulukPolicy {
  /** by-name refs into x-suluk-agents keys this policy governs (NEVER a request predicate). Empty/absent ⇒ all agents. */
  appliesTo?: string[];
  /** operator's max scope ceiling — effective agent scope = INTERSECT(agent.scope, scopeAllowlist). */
  scopeAllowlist?: string[];
  /** deny/allow sub-agent keys (an allow-list, when present, is the only permitted set). */
  agents?: { deny?: string[]; allow?: string[] };
  /** deny/allow route (tool) keys. */
  tools?: { deny?: string[]; allow?: string[] };
  /** deny/allow the retrieval/untrusted tier's tools specifically (its non-deterministic blast radius). */
  retrievalTools?: { deny?: string[]; allow?: string[] };
  /** pin the MAX tier — a cold-tail skill under `capTier: resident` is downgraded (and flagged). */
  capTier?: "resident" | "cold-tail";
  /** the only model ids permitted — effective skill model[] = INTERSECT(skill.model, modelAllowlist). */
  modelAllowlist?: string[];
  /** an upper bound on recursion depth — effective maxDepth = min(agent.maxDepth, maxDepthCap). */
  maxDepthCap?: number;
  /** forbid sub-agents entirely (⇒ effective maxDepth 0). */
  forbidNesting?: boolean;
  /**
   * The operator's DECLARED cost cap — the third of cap/estimate/actual (estimate = the agent's own x-suluk-cost,
   * actual = the C026 reconciled charge). The SCHEMA DECLARES this number; it does NOT enforce it — `enforcedBy`
   * names who does (a runtime admission-gate / adapter). Required so a reader can never mistake declaration for
   * enforcement (C026 PROVISIONAL honesty).
   */
  costCeiling?: { amount: number; amountUnit: "micro-usd" | "cents" | "usd"; basis?: string; enforcedBy: "adapter" | "runtime" };
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
