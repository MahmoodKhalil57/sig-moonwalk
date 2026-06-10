# OpenAPI v4.0 — Suluk Candidate Specification

<!--
  FRONT MATTER — projection from the C001–C017 ADR set (doc/architecture/decisions/)
  and the plan/ ledger. Candidate-fork artifact, NOT official OpenAPI text.
  Source of truth is the ledger; this document is downstream of the decisions (C002).
-->

> **Suluk** (سُلوك, "the walk"; substrate codename `asl-ojs`) — an independent v4.0 candidate
> forked from the OpenAPI "Moonwalk" effort. Authored end-to-end by a single contributor under the
> Adam substrate (burhan reasoning / daftar memory / mizan gates), having read the full SIG record
> (166 discussions, 22 issues, 20 PRs).

## STATUS — read this before trusting any sentence below

This is a **CANDIDATE**, not a standard.

- **NOT official OAS.** This document is the artifact of the Suluk fork. It is not the OpenAPI
  Specification, not a product of the OpenAPI Initiative, and confers no conformance meaning.
- **NOT SIG-ratified.** The OpenAPI Moonwalk SIG ratifies by multi-stakeholder consensus
  (discussions → weekly-call consensus → ADRs → formal spec). At authoring time the SIG had produced
  exactly one substantive technical ADR (0002, IRIs) and had not begun the formal spec. Every open
  question resolved here is resolved **by this fork**, never on the SIG's behalf. We are an external
  contributor; we cannot ratify.
- **Authored from ADRs C001–C017** (`doc/architecture/decisions/Cxxx-*.md`). Each numbered section of
  this spec is a *projection* of an ADR's ledger (`plan/facts/*.bn` + daftar receipts), not hand-written
  prose. The document is downstream of the decisions; the decisions are the source of truth (C002).
- **Posture: adopt-by-default, deviate-by-receipt (C001).** Every SIG prior is inherited unchanged
  unless contested; each Deviation carries a recorded receipt (the contested claim, its cite-chain, why
  the prior was insufficient, and a lowered ceiling). No silent divergence.

**Decisions carry confidence ceilings (0.5–0.85), not certainty.** The ceiling is part of the decision.

| Confidence band | What lives here | Examples |
|---|---|---|
| **High (~0.85)** — the structural backbone | The non-deferrable rules the rest of the design rests on. These are inherited from the SIG default or are referentially forced (a rule that holds under *any* of the deferred wire-shapes). | collections-are-**maps** for open name-spaces (C009); paths-as-**uriTemplate** keys (C005); **per-location slots** `{query, path, header, cookie, body}` (C004); **DOM→ADA** as the surface tools consume + the **resolve-by-stable-NAME** rule (C003/C009); aspect menu for signatures (C003). |
| **Contested (~0.6–0.7)** — flagged inline | Resolved, but at a deliberately lowered ceiling: thin record, single-witness, or a receipted Deviation from SIG-consensus *shape*. | responses-as-array-vs-map verdict (C009, lowest ceiling — the array door stays open on the reuse residual); the RFC6570 parseable-profile headline (C005 @0.62); the referencing-cluster frame (C013 @~0.70); media-type params (C016 @0.6–0.78). |
| **Originated / DEFERRED (~0.5–0.6)** — flagged inline | No strong SIG prior; constructed by burhan from principles, OR a grammar/policy explicitly deferred. | mechanical 3.x→4.0 upgrade (C017, semi-automated, @0.5–0.6); the fragment-reference SYNTAX (#26/#49/#72); JSON Schema dialect + Relative-JSON-Pointer value-equality vocabulary (#73); the collision-resolution POLICY (#16); query/header evaluative mapping (#108). |

> ⚠ **Candidate @0.85 (the ceiling, not certainty)**: "high-confidence backbone" means high *relative to
> the rest of this document* and capped at 0.85 — most backbone claims are **sole-witness** (one ledger
> fact-file, no independent SIG ratification), which mizan caps at 0.85. A single new witness (a real SIG
> ratification or an independent corroboration) should trigger re-verification, not be treated as
> already-settled.

**The hard honesty rule (C001).** Throughout this document, any decision at ceiling **≤ 0.6** or marked
**DEFERRED** carries an inline callout in this form:

> ⚠ **Candidate @&lt;ceiling&gt;**: &lt;what is provisional, contested, or deferred — and to which open issue&gt;

If a paragraph asserts a contested or deferred shape *without* such a callout, that is a defect in the
projection, not a settled fact. The structural backbone (collections-are-maps, paths-as-uriTemplate,
per-location slots, DOM→ADA) is the high-confidence spine; the contested wire-shapes and the deferred
grammars are explicitly *not*.

---

## Object-model overview

An OpenAPI v4.0 (Candidate) **Description** is a JSON/YAML document whose **open, user-named collections
are MAPS** and whose **closed vocabularies are fixed-key STRUCTs**. Tools never consume the raw document
(the **DOM**) directly; they consume the **ADA** — the *abstract description surface* the DOM normalizes
into (C003). Identity is **typed-component-name identity**: every cross-reference resolves by a stable
**NAME**, never by array index and never by map-insertion order (C009/C013). The headline collections —
`paths`, and within a pathItem the name-keyed `requests` / `responses` maps — are therefore *referentially
equivalent* whether their eventual wire shape is a map or an array of named objects, which is exactly why
the by-name rule can be fixed at high confidence while the wire syntax is deferred. A **pathItem** is keyed
by an **RFC6570 uriTemplate** constrained to an injective, reverse-parseable matching profile (C005). An
**operation** is what a request matches; what *identifies* it is its **signature** — a uniform, ADA-exposed
composition over an aspect menu (`method | uriTemplate | content-type | headers | request-body shape`),
with best-effort, three-valued collision analysis (`provably-disjoint | provable-collision |
not-statically-determinable`) that **reports** rather than **gates** (C003). How a request is
schema-validated is expressed in **per-location parameterSchema SLOTS** — `{query, path, header, cookie,
body}`, a closed five-member struct (C004) — with a rare, **opt-in** cross-cutting construct for genuine
cross-type dependencies. All schemas are **JSON Schema 2020-12**. A **mechanical 3.x→4.0 upgrade** (C017,
Originated, low ceiling) is a *semi-automated* transformer with a human-review ledger, not full automation.

```text
Description (v4.0 Candidate)
├─ info / servers / security            ── document framing (inherited from 3.x)
├─ paths : MAP                          ── KEY = RFC6570 uriTemplate (C005, matching profile)
│    "speakers" : pathItem
│    "speakers/{id}" : pathItem
│         └─ requests : MAP             ── KEY = friendly NAME (createSpeaker, getSpeakers)
│              <name> : operation
│                ├─ method, contentType
│                ├─ signature           ── DOM→ADA; aspect menu; collision = report-not-gate (C003)
│                ├─ parameterSchema     ── per-location SLOTS {query,path,header,cookie,body} (C004)
│                │                          + opt-in crossDependencies (rare cross-type case)
│                ├─ contentSchema       ── body; JSON Schema 2020-12
│                └─ responses : MAP     ── KEY = friendly NAME; status is a FIELD (C009)
│         └─ pathResponses : MAP        ── pathItem-scoped responses (NAME-keyed)
├─ apiResponses : MAP                   ── document-scoped responses (NAME-keyed)
├─ tags : MAP                           ── FLIPPED array→map to enable $ref-to-tag (C009, the one deviation)
└─ components : MAP                     ── dynamic-key store; resolve by NAME, never index (C009/C013)

   Identity rule (C009/C013): every $ref resolves by stable NAME.  Fragment SYNTAX is DEFERRED.
   Surface rule (C003): tooling consumes the ADA (the normalized abstract surface), not the raw DOM.
```

> ⚠ **Candidate @0.62 / DEFERRED**: the **wire shape** of `responses`/`requests` (map vs array of named
> objects) and the **fragment-reference syntax** (`#schemas.Speaker` vs `#/components/...` vs a #72
> `namespace:componentName` form) are NOT settled. The by-NAME *identity* rule is fixed; the *spelling*
> is deferred to #26/#49/#72/#73. The `#schemas.Speaker` form in the example below is **illustrative
> only**. Responses additionally carry the lowest ceiling in the model — the array door is left open on
> the keyless-inline-$ref reuse residual (#83).

> ⚠ **Candidate @0.62**: the uriTemplate **matching profile** (which RFC6570 operators are permitted in
> path-identity position) and its required reverse-parse grammar/algorithm are a receipted Deviation set
> (C005); richer operators (explode, reserved, fragment, label, lossy prefix) are FORBIDDEN in identity
> position, which makes slash-bearing single-value path params inexpressible — a deliberate expressiveness
> regression, the price of parseability.

### The canonical example — the simplest thing that works

A minimal `speakers` resource: create one (`createSpeaker`) and list them (`getSpeakers`). This is the
v4.0 Candidate shape — paths-as-uriTemplate maps, name-keyed `requests`/`responses` maps with status as a
field, by-NAME refs into `components`, and per-location `parameterSchema` slots.

```yaml
openapi: 4.0.0
info:
  title: Speakers API
  version: 1.0.0

paths:                                   # MAP — keys are RFC6570 uriTemplates (C005)
  "speakers":                            # literal segment; profile-valid, reverse-parseable
    requests:                            # MAP — keys are friendly operation NAMEs (C009)
      createSpeaker:
        method: post
        contentType: application/json
        contentSchema: { $ref: "#schemas.Speaker" }   # by-NAME ref, never by index (C009/C013)
        responses:                       # MAP keyed by NAME; HTTP status is a FIELD (C009)
          created:
            status: 201
            contentSchema: { $ref: "#schemas.Speaker" }

      getSpeakers:
        method: get
        parameterSchema:                 # per-location SLOTS {query,path,header,cookie,body} (C004)
          query:                         # plain JSON Schema 2020-12 over the query slice
            type: object
            properties:
              limit: { type: integer, minimum: 1, maximum: 100 }
          # path / header / cookie / body slots omitted — absent slot ⇒ no constraint
        responses:
          ok:
            status: 200
            contentSchema:
              type: array
              items: { $ref: "#schemas.Speaker" }

  "speakers/{id}":                       # single-segment var — MATCH-SAFE operator (C005)
    requests:
      getSpeaker:
        method: get
        parameterSchema:
          path:                          # capture group of the uriTemplate populates the path slot
            type: object
            properties: { id: { type: string } }
            required: [id]
        responses:
          ok:       { status: 200, contentSchema: { $ref: "#schemas.Speaker" } }
    pathResponses:                       # pathItem-scoped, NAME-keyed (C009)
      notFound: { status: 404, contentType: application/http-problem }

apiResponses:                            # document-scoped fallbacks, NAME-keyed (C009)
  serverError: { status: "5XX", contentType: application/http-problem }

components:                              # dynamic-key MAP; resolve by NAME (C009/C013)
  schemas:                               # JSON Schema 2020-12 dialect
    Speaker:
      type: object
      required: [id, name]
      properties:
        id:    { type: string }
        name:  { type: string }
        topic: { type: string }
```

> ⚠ **Candidate @0.62 / DEFERRED — applies to the example above**: the `#schemas.Speaker` reference
> spelling is illustrative; the ratified fragment grammar is deferred to the referencing cluster
> (#26/#49/#72/#73, C013). The query/header **evaluative mapping** (how a raw URL query-string and header
> set become the JSON instance the `query`/`header` slots validate) is deferred to #108/#100 — the `path`
> slot is closed by the C005 matcher, but the request-grammar is incomplete until #108 lands. JSON Schema
> dialect is **2020-12**, but the Relative-JSON-Pointer *value-equality* vocabulary (e.g. PUT path-id ==
> body-id) is DEFERRED to #73.

---

*Deferred / low-ceiling markers added in this front matter (5):*
1. ⚠ **@0.85 ceiling-not-certainty** — sole-witness cap on the backbone (STATUS preamble).
2. ⚠ **@0.62 / DEFERRED** — responses/requests wire shape + fragment-reference syntax (object-model overview).
3. ⚠ **@0.62** — uriTemplate matching profile + forbidden-operator expressiveness regression (object-model overview).
4. ⚠ **@0.62 / DEFERRED** — fragment spelling + query/header evaluative mapping + #73 value-equality vocabulary (canonical example).
5. The C001 hard-honesty-rule callout template itself, declared normatively in the STATUS section.


---

## Table of contents

1. Document Structure & Object Model
2. Paths & URI Templates
3. Signatures & Request Matching
4. Requests & Parameters
5. Responses
6. Schemas, Content & Data Modeling
7. HTTP Fields (Headers, Cookies, Trailers)
8. Components, References & Imports
9. Security
10. Servers & Deployment
11. Tags, Functional Areas & Annotations
12. Mechanical Upgrade from OpenAPI 3.x
13. Conformance: DOM, ADA & Tooling Interface

---

## 1. Document Structure & Object Model

### 1.1 Overview

An OpenAPI v4.0 document describes an HTTP API surface through a tree of typed object definitions. The root **Document** object contains metadata (`openapi`, `info`, `servers`, `tags`) and four primary collections: `paths`, `requests`, `responses`, and `components`. The object model is mixed — **paths** and **components** are dynamic-key MAPS; **requests** and **responses** are NAME-KEYED MAPS; per-location parameter schema **slots** (query, path, header, cookie, body) are a FIXED-KEY STRUCT. This structure achieves coherence via name-based identity (never array index, never map-insertion order) across all references.

The model operationalizes two critical layers:

1. **DOM** (Document Object Model) — the wire representation: what authors edit, what tools parse and serialize.
2. **ADA** (Abstract Description API) — the consumption surface for routing, validation, and code generation: what tooling exposes to application logic. The DOM→ADA layer performs signature matching, collision detection, and parameter extraction.

### 1.2 Root Document Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `openapi` | string (semver) | MUST | Version string; for v4 candidates, `"4.0.0-candidate"` or `"4.0.0-rc.1"`, etc. |
| `info` | Info Object | MUST | Metadata: title, description, version, contact, license. |
| `servers` | array [Server Object] | MAY | Deployment endpoints. Default: `[{url: "/"}]` if absent. |
| `tags` | Map[tagName → Tag Object] | MAY | Named tag definitions for operation classification. Keyed by `name` for referenceability (C009). |
| `paths` | Map[uriTemplate → Path Item Object] | MUST | Keyed by RFC6570 parseable-profile uriTemplate (C005). |
| `apiResponses` | Map[responseName → Response Object] | MAY | API-level responses reusable across all operations (e.g. a shared `serverError`, §5). |
| `webhooks` | Map[name → Webhook Object] | MAY | Incoming operations the API receives but does not host at its own paths (§14). |
| `components` | Components Object | MAY | Reusable definitions keyed by name: `schemas`, `requests`, `responses`, `securitySchemes`, `links`, `examples` (§8). The dynamic-key referencing anchor (C013). |

(Reusable *requests* and *responses* live in `components` — §8 — not as separate root collections. `pathResponses` is a **pathItem** field, §1.3, not a root field.)

**Normative language:**

- The document MUST be valid JSON or YAML.
- All NAME-keyed collections (requests, responses, apiResponses, tags, components.*) resolve references **by stable NAME, never by array index or map-insertion order** (C009). Tooling MUST NOT assume order-based identity.
- Paths MUST be keyed by RFC6570 parseable-profile uriTemplate (C005); the key itself is the reverse-parse input for routing.
- Components MUST be a dynamic-key MAP for referential anchoring and schema reuse.

---

### 1.3 Path Item Object

A **Path Item** describes the operations exposed at a single URI template. It is keyed in `paths` by its uriTemplate and contains a name-keyed **`requests`** map (each Request *is* an operation — §1.4), pathItem-scoped `pathResponses`, and an optional `shared` inheritance wrapper. **This §1 object model is canonical; where a later section's field table differs in detail, §1 governs.**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `summary` | string | MAY | Short description of the path. |
| `description` | string | MAY | Detailed description. |
| `servers` | array [Server Object] | MAY | Path-specific deployment endpoints (override document root). |
| `requests` | Map[requestName → Request Object] | MUST | The operations at this path, keyed by stable **name** (C009). Each Request *is* an operation (§1.4). At least one required. |
| `pathResponses` | Map[responseName → Response Object] | MAY | Responses reusable across the requests of this pathItem only (§5). |
| `shared` | Shared Object | MAY | Optional per-level inheritance wrapper carrying parameterSchema down to the requests (§4.5, C012). |

Each Request carries an operation **signature** — its *identity*, computed by the **ADA** from the request's method and disambiguating aspects (content-type, headers, URI-template variables, request-body shape; §3, C003). The signature is an **ADA** concept used for request→operation *matching*; it is **not** a separate DOM collection — the DOM keys requests by stable **name** (C009), and the ADA derives each request's signature.

> ⚠ **Candidate @0.5–0.6**: The signature's exact composition and collision policy are contested (C003). The framing (uniform, aspect-based, detect-and-tolerate collision) is accepted; the literal signature encoding and the ambiguous-case policy (invalid vs. precedence vs. priority) remain OPEN.

**Normative language:**

- At least one request MUST exist at a pathItem (empty pathItems are invalid).
- Request/response names at the pathItem level are scoped to that path and override document-root definitions for that path only.
- Per-location parameter schema slots (query, path, header, cookie, body) are attached to individual **requests** (§1.4), and MAY be inherited from a pathItem-level `shared` wrapper (§4.5, C012 @0.55).

---

### 1.4 Operation Object

A **Request Object** *is* an operation: a single HTTP operation's method, request schema, response schema(s), security, and behavior. It is keyed in the pathItem's **`requests`** map by a stable **name** (C009); its **ADA identity** is its **signature** (§3, C003) — the name is the DOM handle, the signature is the matching identity. (The 3.x `requestBody`/`mediaType`/`operation` nesting is flattened into this one object per the initial proposal.)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `method` | string (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, TRACE) | MUST | HTTP method. |
| `summary` | string | MAY | Short description. |
| `description` | string | MAY | Detailed description. |
| `operationId` | string | MAY | Optional legacy handle (codegen/doc links). Coexists with the request name; **not** the primary identity in v4 (C009). |
| `tags` | array [string] | MAY | References to Tag names for classification (§11). |
| `deprecated` | boolean | MAY | Default false. |
| `contentType` | string \| array[string] | MAY | The request body media type(s) (§1.5). Absent ⇒ no body. |
| `contentSchema` | Schema Object | MAY | JSON Schema 2020-12 for the request body (§6). |
| `parameterSchema` | Parameter Schema Object | MAY | Per-location typed parameter slots: query, path, header, cookie, body (C004, §4). |
| `responses` | Map[responseName → Response Object] | MUST | Named responses (§5); each carries its own `status`. At least one required. |
| `callbacks` | Map[callbackName → Callback Object] | MAY | Outbound callbacks (§14). |
| `security` | array [Security Requirement Object] | MAY | Applied security; inherits pathItem/document if absent (§9). |
| `servers` | array [Server Object] | MAY | Request-specific endpoints (override pathItem/document). |

**Normative language:**

- A Request MUST have exactly one `method`.
- The request's identity in the **ADA** is its **signature** (C003): the ADA derives it from (method, content-type, headers, URI-template variables, request-body shape). The DOM handle is the request **name**, which MUST be stable.
- At least one response MUST be defined; a wildcard/`5XX` or `default`-named entry covers the unenumerated cases (§5).
- The 3.x `parameters` array upgrades into `parameterSchema` slots (§4); see §12 for the migration rules.

---

### 1.5 Request & Response Objects

**Request Object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | MUST | Friendly name for the request (used as the key in `requests` maps). |
| `description` | string | MAY | Description of this request variant. |
| `contentType` | string or array [string] | MAY | Applicable MIME types (e.g. "application/json", "application/xml"). If array, the request matches if the Content-Type header matches any entry. |
| `content` | Map[mediaType → Media Type Object] | MAY | Schema and examples per media type. |
| `headers` | Map[headerName → Header Object] | MAY | Header definitions and constraints. |
| `body` | Schema Object (JSON Schema 2020-12) | MAY | Request body JSON Schema. Preferred over `content` for typed bodies; if both present, body is the normative schema. |

**Response Object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | MUST | Friendly name for the response (used as the key in `responses` maps). |
| `status` | string or integer | MAY | HTTP status code (e.g. "200", "404", "default"). Used if the response is defined inline; if keyed in a responses map, the key is the status. |
| `description` | string | MAY | Description of the response and when it is returned. |
| `contentType` | string or array [string] | MAY | Applicable MIME types for the response body. |
| `content` | Map[mediaType → Media Type Object] | MAY | Schema and examples per media type. |
| `headers` | Map[headerName → Header Object] | MAY | Response headers and their schemas. |
| `body` | Schema Object (JSON Schema 2020-12) | MAY | Response body JSON Schema. Preferred for typed bodies; if both present, body is normative. |
| `links` | Map[linkName → Link Object] | MAY | Links to follow-up operations (HATEOAS). |

**Normative language:**

- Request and Response objects that appear in the `requests`, `responses`, `pathResponses`, or `apiResponses` maps MUST have a `name` field matching the key.
- If both `content` (media-type-keyed schemas) and `body` (single JSON Schema) are present, tooling MUST respect `body` as the canonic schema and derive media-type variants from it or validate both (application-defined). The spec does NOT mandate which takes precedence; document authors SHOULD use only one.
- A Response MUST include either `content`, `body`, or `headers`; a purely-metadata response (e.g., "204 No Content") MAY omit both `content` and `body`.

---

### 1.6 Per-Location Parameter Schema Slots (C004)

**Parameter Schema Object:**

The operation's parameter validation is expressed through per-location schema SLOTS. Each slot receives a JSON Schema 2020-12 object that constrains that location's parameters.

| Slot | Type | Required | Applies to | Description |
|------|------|----------|-----------|-------------|
| `query` | Schema Object | MAY | Query string parameters | JSON Schema over parsed query key-value pairs. Keys are the parameter names; no reserved `in` keywords. |
| `path` | Schema Object | MAY | Path template variables | JSON Schema over extracted RFC6570 uriTemplate variables. Keys match the curly-brace var names. |
| `header` | Schema Object | MAY | HTTP request headers | JSON Schema over request headers. Header names SHOULD be case-insensitive (per HTTP/1.1; normalization is tooling-defined). |
| `cookie` | Schema Object | MAY | HTTP Cookie header parameters | JSON Schema over parsed Cookie header values. Keys are cookie names. |
| `body` | Schema Object or Reference Object | MAY | Request body | A single JSON Schema for the entire request body (or a `$ref` to a schema in components). Replaces and supercedes the `RequestBody.content[mediaType]` schema for typed validation. |

**Normative language (C004):**

- All slots are OPTIONAL; an absent slot permits any value (implicit `additionalProperties: true` for object-typed locations).
- Within each slot's schema, `additionalProperties` defaults to `true` for open-ended locations (query, header, cookie) and SHOULD be explicitly set if a closed schema is desired.
- Cross-location dependencies (e.g., "path ID must equal body ID") are expressed using an OPT-IN cross-cutting construct, evaluated over a materialized `{query, path, header, cookie, body}` envelope when needed. This construct is evaluated at runtime and MUST NOT be compiled into the static signature matcher (C003 D1).

> ⚠ **Candidate @0.45–0.6**: The exact shape and nesting of the cross-location envelope (handrews Position 3 in C004 context) is contested at lower ceiling due to unresolved prerequisites (header model #108, query-string deserialization #100, Relative-JSON-Pointer vocabulary #73). Per-location slots are stable; cross-type deps via an opt-in envelope are the direction, but detailed specification is deferred.

---

### 1.7 Collections: Maps and Name-Based Identity (C009)

The document model uses **maps** for user-keyed collections and **name-based identity** throughout. This decision resolves a long-standing ambiguity: whether collections like `responses` should be JSON arrays (keyed by insertion order) or maps (keyed by explicit name).

**Rule:** All user-keyed collections **resolve identity by stable NAME, never by array index or map-insertion order** (C009). This is true whether the wire representation is a JSON object map or an array of named objects; the identity mechanism is name-based.

**Affected collections:**

1. **paths** — keyed by RFC6570 uriTemplate (the reverse-parse input; C005).
2. **requests** / **responses** / **pathResponses** / **apiResponses** — keyed by friendly name; status-code or response type is a field, not the key.
3. **tags** — keyed by tag name for referenceability (C009).
4. **components** (schemas, securitySchemes, links, examples) — keyed by component name for referential anchoring.

**Per-location parameter slots** (query, path, header, cookie, body) are a FIXED-KEY STRUCT with exactly 5 members, not user-keyed.

**Normative language (C009):**

- A `$ref` to a named collection MUST resolve by name: `#/components/responses/NotFound`, `#/paths/~1users`, `#/tags/auth` (JSON Pointer escaping applies to special characters).
- Tooling MUST NOT assume a map's insertion order is semantically significant for operations, responses, or requests. Order MAY be present as an optional field (see § 1.7.1) for guidance but is NOT the identity mechanism.
- Array-of-named-objects and map representations are referentially equivalent under name-based identity; migration tooling MAY convert between them without loss of identity.

#### 1.7.1 Optional Ordering (@0.6)

A collection MAY include an optional `order` field (e.g., on each response or request entry) to indicate authoring or presentation order. This is a guidance affordance, not an identity or matching primitive.

> ⚠ **Candidate @0.6**: The `order` field's semantics (integer index, relative ordering, presentation vs. routing) are not fully specified. It is a lowered-ceiling exploration for future tooling. Use only if your tooling explicitly requires explicit ordering; the absence of `order` is the default and requires no special handling.

---

### 1.8 DOM → ADA Boundary

The **Abstract Description API** (ADA) is the consumption surface that tooling (code generators, routers, validators) uses to understand an API. The DOM→ADA boundary performs three critical operations:

1. **Signature determination** (C003): Given an inbound HTTP request (method, content-type, headers, URI, body), the ADA's **matcher** routes it to a single operation or produces a three-valued verdict (provably-disjoint, provable-collision, not-statically-determinable).

2. **Per-location parameter extraction** (C005): The RFC6570 parseable-profile uriTemplate is compiled into a deterministic matcher; captured variables populate the `path` slot, and form-query operators populate the `query` slot.

3. **Collision analysis** (C003): Static ambiguity detection surfaces a three-valued verdict but is **not** a validation gate. Collision policy (invalid, precedence, priority, strict-mode) is application-defined and outside this spec.

**Normative language (C003):**

- The ADA MUST expose the three-valued verdict for signature collisions: `provably-disjoint | provable-collision | not-statically-determinable`.
- Collision analysis is **best-effort and bounded**; the ADA MUST NOT require a collision-resolution policy as a precondition for routing.
- Matching (request→operation) and correlating (request↔response schema) are separate concerns. This spec addresses matching; correlating is handled per-location schema validation.

> ⚠ **Candidate @0.5**: The policy for resolving collisions (what an implementation MUST/SHOULD do when a request matches multiple operations) is OPEN. C003 specifies only the detection mechanism and the exposure of the verdict. SIG adoption of a collision policy (e.g., "runtime precedence by specificity") will upgrade this ceiling.

---

### 1.9 Canonical Example

The following minimal Document illustrates the object model:

```yaml
openapi: 4.0.0-candidate
info:
  title: Pet Store API
  version: 1.0.0
paths:
  /pets:
    requests:
      CreatePet:
        name: CreatePet
        contentType: application/json
        body:
          type: object
          properties:
            name:
              type: string
            species:
              type: string
          required: [name, species]
    responses:
      PetCreated:
        name: PetCreated
        status: "201"
        contentType: application/json
        body:
          type: object
          properties:
            id:
              type: integer
            name:
              type: string
            species:
              type: string
    operations:
      POST:
        method: POST
        summary: Create a pet
        requestBody:
          content:
            application/json:
              schema:
                $ref: "#/paths/~1pets/requests/CreatePet/body"
        responses:
          "201":
            description: Pet created
            content:
              application/json:
                schema:
                  $ref: "#/paths/~1pets/responses/PetCreated/body"
          "400":
            description: Invalid input
  /pets/{petId}:
    operations:
      GET:
        method: GET
        summary: Retrieve a pet by ID
        parameterSchema:
          path:
            type: object
            properties:
              petId:
                type: integer
                minimum: 1
            required: [petId]
        responses:
          "200":
            description: Success
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    id:
                      type: integer
                    name:
                      type: string
          "404":
            description: Pet not found
components:
  schemas:
    Pet:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
        species:
          type: string
```

---

### 1.10 Summary of Normative Principles

| Principle | Basis | Ceiling |
|-----------|-------|---------|
| Collections are NAME-keyed maps; identity is by stable name | C009 | @0.85 |
| Paths are keyed by RFC6570 parseable-profile uriTemplate | C005 | @0.62 |
| Signatures are uniform, ADA-determined, collision-aware (detect-and-tolerate) | C003 | @0.85 (frame) / @0.5 (collision policy) |
| Per-location parameter schema slots (query, path, header, cookie, body) are a FIXED-KEY STRUCT | C004 | @0.6 (slots stable; cross-type deps deferred) |
| DOM→ADA layer performs matching, extraction, and collision analysis; policy is separate | C003 | @0.85 (matching) / @0.5 (policy) |

---

### 1.11 Deferred Decisions

The following topics are OPEN and deferred to future ADRs or SIG ratification:

1. **C003 D1, C004 §Caveat:** Collision resolution policy (invalid vs. precedence vs. priority vs. strict-mode).
2. **C004 §Cross-cutting:** Exact shape and nesting of cross-location dependency construct; awaits #73 (Relative-JSON-Pointer vocabulary).
3. **C005 §Per-segment:** Per-segment literal-vs-variable EXPOSURE detail and recursive/nested path modeling.
4. **C005 §Query-placement:** Whether query parameters appear in the uriTemplate or in a separate signature.query slot.
5. **C004 §Prerequisites:** Header data model (#108), query-string deserialization (#100), cookie/trailer placement.
6. **C003 D2:** Declared signature enumeration (PR #183 optional-at-most); currently optional authoring affordance.
7. **Signature string format:** The exact grammar and serialization of the signature key in the `operations` map DOM.

---

## 2. Paths & URI Templates

### 2.1 Overview

A Paths Object is a map of path identifiers to pathItem Objects. Each path identifier is an RFC6570-compliant **uriTemplate** string (RFC 6570, §1.1), subject to a normative constrained operator profile (§2.2). The uriTemplate surface is inherited from RFC6570; the matching semantics and operator restrictions are Candidate-specific.

Paths are **identity-primary**: they identify operations in conjunction with HTTP methods (C003), not via a resource-oriented hierarchy decoupling. The path component is parseable in the **reverse direction** (URL to uriTemplate) by a deterministic algorithm (§2.4), enabling signature recognition and per-location parameter extraction. Expressiveness is bounded: certain RFC6570 operators are forbidden in path identity position to guarantee parseability and injectivity.

> ⚠ **Candidate @0.62**: The headline constraint-set ceiling reflects three lower-confidence components: (1) the operator restriction mechanism (D1-127), (2) the custom reverse-parse algorithm (D2-127, zero SIG precedent), and (3) the grammar artifact (D2-127, grafted from extended-Moonwalk-template design at 0.36). The foundational parseability and expressiveness trade-off is verified; the normalized operator taxonomy is verified; the specific implementation machinery is candidate.

### 2.2 Operator Tiering & Matching Profile

The RFC6570 operator set is partitioned into three tiers. Only Tier 1 (MATCH-SAFE) operators MAY appear in path-identity position. Operators in Tiers 2 and 3 are author errors if placed in the pathItem key.

#### Table 2.1: Operator Tiering

| Tier | Classification | Permitted Operators | Examples | Constraints |
|------|---|---|---|---|
| **1: MATCH-SAFE** | Path identity | Literal text | `/users` | No variable. |
| | | Single-segment variable | `{id}` | Single RFC6570 variable, OAS-3.x charset (excludes unescaped `/`, `?`, `#`). Matches exactly one path segment. |
| | | Leading single-var slash form | `{+path}` | RFC6570 reserved operator `+` in a single variable at the segment boundary. Captures remaining path depth (multi-segment). See note on slash-bearing params below. |
| | | Name-bearing matrix | `;name={id}` | RFC6570 semicolon operator with variable NAME serialized into the path. Fully delimited; injective. Example: `/users;id=123` unmaps to `id=123`. Zero risk of name-collision with adjacent variables. |
| **2: QUERY-ONLY** | Query component only, evaluated order/repetition-insensitive | Form-query operators: `?{&x,y,z}`, `?{?a,b}` | Query-string parsing. | Parsed as a key-set; operator choice (`;`, `,`, `&`) affects value joining within a key but not key routing. See C004 (evaluative query mapping, deferred). |
| **3: FORBIDDEN in identity** | Authoring error; MUST be rejected at schema-validation time or runtime | Explode `{x*}`, multi-segment explode `{+x*}`, reserved `{+x}` (in non-slash-boundary position), fragment `{#x}`, label `{.x}`, prefix `{x:2}`, arbitrary regex, list/composite-typed or comma-bearing scalar variable | `/products/{+cat*}`, `{#anchor}`, `{x:4}` | Use in path identity triggers a schema validation error (diagnostics: "operator forbidden in path identity") or forces the operation verdict to "not-statically-determinable" per C003. |

#### Slash-Bearing Path Parameters

Single-segment variables (Tier 1) cannot capture a literal `/` in the captured value (OAS-3.x charset enforcement). The reserved single-var slash form `{+path}` is MATCH-SAFE and MUST be parsed as a multi-segment capture (the variable matches remaining path depth). Authors MUST NOT use the full explode form `{+path*}` (Tier 3, forbidden) in path identity.

> ⚠ **Candidate @0.62**: Slash-bearing single-value path parameters (e.g., `/bucket/{+path}` where the user intends to capture `/folder/subfolder/file.txt`) are INEXPRESSIBLE in the parseable profile without the reserved explode operator. This is a conscious expressiveness trade-off: forbidden operators are the price of deterministic reverse parsing. Non-slash-bearing recursion (e.g., `/api/v1/{resource}/{id}` with independent segment variables) is fully supported.

#### 2.2.1 Query parameters — dual role (normative)

A query parameter has up to **two distinct, non-exclusive roles** (resolves the placement question):

1. **Identity (uriTemplate).** A query parameter named in the uriTemplate key via a Tier-Q form-query expression — e.g. `pet/findByStatus{?status}` — **participates in operation identity**: it is part of the matcher input, so two requests distinguished only by query are different operations. The query component is parsed as a **key-set**, order- and repetition-insensitive (Tier-Q); the operator (`{?…}`/`{&…}`) affects value-joining within a key, not key routing.
2. **Validation (slot).** A query parameter declared in the `parameterSchema.query` slot (§4, C004) is **validated** against that JSON Schema at runtime.

The roles compose: a parameter MAY be in **both** (template for routing/identity, slot for value validation — see the petstore example, `pet/findByStatus{?status}`), in the **slot only** (a pure runtime filter that does not distinguish operations — the common case), or — rarely — in the **template only** (identity-bearing, validated by the template literal alone). Query parameters in the slot but absent from the template do **not** participate in signature matching.

> ⚠ **Candidate @0.62 / DEFERRED**: the **evaluative mapping** — how a raw query-string (always-string values, repeated keys, no native types) becomes the JSON instance the `query` slot validates — is deferred (Hudlow "a query string is not JSON", #100/#108). The *identity* role above is closed by the C005 matcher; the *validation* role's deserialization is not.

### 2.3 Grammar & Parse Model

#### Normative Observable Behavior

A uriTemplate is a sequence of literal segments (text) and template expressions (curly-brace var syntax). Parsing proceeds left-to-right, splitting the template on the `/` character boundary:

1. **Tokenization.** Split the uriTemplate into segments on unescaped `/`. Each segment is either literal text, a template expression `{...}`, or a combination (e.g., `prefix{var}suffix`).
2. **Literal matching.** Literal segments are matched character-for-character against incoming URL path segments (percent-decoding applied per RFC3986 §2.1).
3. **Variable capture.** A segment containing a Tier 1 operator variable captures the corresponding URL segment (or remaining segments, if leading-slash-form `{+var}`) into the named variable. Captured values are percent-decoded per RFC3986 and assigned to the per-location PATH slot (C004).
4. **Determinism.** For a given uriTemplate and incoming path, the match outcome is a single-valued function: either zero captures (no match) or one set of captures (injective match). No operator in Tier 1 can produce multiple interpretations of the same path.

#### Parse Injectivity Guarantee

A profile-valid uriTemplate (containing only Tier 1 operators) satisfies the following property: **For any two distinct incoming URLs, the parse result is either both-match with distinct variable values, or one/both do not match.** Formally, no URL can match two different profile-valid uriTemplates with ambiguously overlapping variable assignments. This guarantee enables the reverse-parse algorithm (§2.4).

### 2.4 Reverse-Parse Algorithm

> ⚙ **Tooling note**: the precise, buildable reverse-parse algorithm (split-BEFORE-decode, capture-rest ranking) is in **Appendix A — Tooling Profile** (C019); where this narrative and Appendix A differ, **Appendix A governs** for implementers.

Given an incoming request URL and a set of profile-valid uriTemplates in the Paths Object, the reverse-parse algorithm MUST route the request to zero or one pathItem. This algorithm is the mechanism by which the evaluative URL-to-parameter mapping (C004 §4.2) extracts per-location PATH slot values.

#### Pseudocode

```
Input: URL path component (string, %-decoded)
       Paths Object (map of uriTemplate → pathItem)

Output: (pathItem, capture_dict) or (null, {})

Algorithm:
  1. Split URL path on '/' into segments.
  2. For each (uriTemplate, pathItem) in Paths:
       a. Compile uriTemplate into a segment-aligned regex/matcher
          (literal segments become literal-match patterns; 
           single-var segments become capture groups; 
           {+var} at boundary captures remaining depth).
       b. Attempt to match URL segments against the compiled template.
       c. If match succeeds, extract captures into a dict {varname: value, ...}
          and return (pathItem, captures).
  3. If no uriTemplate matches, return (null, {}).
```

**Segment-Alignment Invariant.** Each Tier 1 uriTemplate compiles to a matcher that respects segment boundaries: literal text never spans an unescaped `/`, and variable captures align to segment or remaining-path depth. This alignment ensures that the matcher produces a unique route per path.

> ⚠ **Candidate @0.62**: The reverse-parse algorithm is not part of the official RFC6570 specification; it is a Candidate-specific normative artifact. Implementations MUST implement this algorithm (or an equivalent deterministic routing strategy) to comply with this spec. The algorithm is intentionally pseudo-code (not pseudocode), to permit language-agnostic and framework-specific optimizations (regex engines, trie-based route trees, etc.).

### 2.5 Paths Object Structure

#### PathsObject

| Field | Type | Required | Description |
|-------|------|----------|---|
| `{uriTemplate}` | [pathItem Object](#section-3) | No | A pathItem keyed by a profile-valid uriTemplate. The key MUST be an RFC6570-compliant string subject to the operator restrictions (Tier 1 only, §2.2). Keys are not regex patterns; they are literal URI templates. Multiple pathItems with overlapping literal prefixes (e.g., `/users/me` and `/users/{id}`) are permitted; runtime collision policy is deferred to C003. |

The Paths Object is a map (key-value pairs), not an array. Each key is a uriTemplate. The order of pathItems within the Paths Object is not significant for parsing; the reverse-parse algorithm MUST treat all pathItems as candidates and return zero or one match.

### 2.6 Path Identity & Signature Recognition (Reference to C003)

Each uriTemplate is a stable identity component of an operation's **signature** (C003). The signature of an operation is the combination of (1) HTTP method, (2) uriTemplate, and (3) request body/header schema identity (when multi-method or multi-representation operations are modeled, see C003 for handling). The uriTemplate is never a symbolic name (unlike some resource-oriented designs); it is the literal path pattern itself.

Path collision (two uriTemplates that match the same incoming request URL, e.g., `/users/me` vs `/users/{id}` when the incoming URL is `/users/me`) is a runtime concern, not a parse failure. C003 §3.3 specifies the three-valued verdict and runtime tiebreak (concrete value wins over variable) for operation matching. The path component does not unilaterally determine an operation; the full signature (method, path, request identity) does.

> ⚠ **Candidate @0.74**: Resource-oriented modeling (decoupling operation identity from path/method to a separate "resource" hierarchy) is explicitly deferred as a tooling/documentation overlay (C015 §2.3). This spec keeps paths+method identity-primary. Document generators and API frameworks MAY overlay a resource-oriented view on the canonical path+method signatures, but the Candidate spec itself does not ship a decoupled resource construct.

### 2.7 Per-Location Schema Slots

The reverse-parse algorithm populates the **PATH** per-location schema slot (C004 §4.1). Each variable captured from the uriTemplate is assigned to the corresponding parameter name in the PATH slot of the request's parameterSchema Object. No other per-location slots (query, header, cookie, body) are populated by path parsing.

Example:

```yaml
paths:
  /users/{id}:
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
    get:
      # operation details
```

When an incoming request matches `/users/12345`, the reverse-parse algorithm extracts `id=12345` and assigns it to the PATH slot: `{id: "12345"}`. The parameter schema then validates the captured value against the declared schema (type: string, constraints, etc.).

### 2.8 Example

```yaml
paths:
  /users:
    get:
      summary: List users
      operationId: listUsers
      responses:
        '200':
          description: OK
  /users/{id}:
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
          pattern: '^[0-9]+$'
    get:
      summary: Get user by ID
      operationId: getUser
  /files/{+path}:
    parameters:
      - name: path
        in: path
        required: true
        schema:
          type: string
      # Note: {+path} captures remaining path depth,
      # e.g., /files/docs/report.pdf → path="docs/report.pdf"
    get:
      summary: Get file
      operationId: getFile
  /archive;version={ver}:
    parameters:
      - name: ver
        in: path
        required: true
        schema:
          type: string
    get:
      summary: Get archive with version parameter
      # Note: matrix syntax is fully delimited;
      # /archive;version=1.0 unmaps to ver="1.0"
      operationId: getArchive
```

In this example:
- `/users` is a literal path with no variables.
- `/users/{id}` uses a single-segment variable (Tier 1).
- `/files/{+path}` uses the leading-slash-form reserved operator (Tier 1), capturing multi-segment depth.
- `/archive;version={ver}` uses name-bearing matrix syntax (Tier 1).

All four uriTemplates are profile-valid and deterministically parseable.

---

### Deferred Decisions Referenced

- **C004 Query Placement & Evaluative Query Mapping** (#100, #108): Whether query parameters are serialized inline in the uriTemplate (e.g., `/search?query={q}`) or declared separately in a signature.query slot. Query PLACEMENT is surfaced but not finalized in this wave. The full evaluative query-string-to-data-model mapping (Hudlow #100 "query-string-is-not-JSON") is deferred to #108 and beyond.
- **C003 Operation Collision Policy** (#16, runtime tiebreak): When two paths match the same incoming URL (e.g., `/users/me` vs `/users/{id}`), which operation is selected? The collision POLICY (invalid, precedence, priority, strict-mode) is deferred; #16 specifies the best-effort three-valued verdict and runtime tiebreak (concrete > variable).
- **C004 Per-Location Schema Evaluation** (#108, header/trailer models): The full per-location request grammar (body, header, trailer, cookie) is gated on #108. This section closes the PATH grammar; the remaining per-location mappings are incomplete.
- **Recursive/Nested Path Modeling** (#119): Whether and how to surface per-segment literal-vs-variable structure for doc generators that wish to model path hierarchy as a tree. The profile guarantees the segment structure is computable; the surface shape is a deferred tooling choice.

---

## 3. Signatures & Request Matching

### 3.1 Overview

A **signature** is the composite identity of an operation for the purpose of request matching: mapping an incoming HTTP request deterministically to a single operation in the API description, or identifying a collision (ambiguity). In OpenAPI 3.x, signatures are implicitly path + method. The Candidate v4.0 specification extends this to a **multi-aspect tuple** that may compose method, URI template (including query parameters), content-type, header values, and request body shape.

Signatures are **non-mandatory** for tooling. They are exposed at the DOM→ADA (Document Object Model → Abstract Description Abstraction) layer, where both the semantic authoring (DOM) and the artifact's runtime consumption surface (ADA) are optional. The ADA's role is to provide a uniform contract for request-to-operation matching and to surface static collision analysis where feasible.

**Matching** (correlating an HTTP request to an operation) and **correlating** (schema-to-schema mapping of request and response bodies across operations) are separated concerns. This section addresses matching only.

### 3.2 Signature Composition — Aspect Menu

A signature MAY compose any subset of the following aspects:

| Aspect | Presence | Notes |
|--------|----------|-------|
| **method** | Optional | HTTP verb (GET, POST, etc.). Subordinatable; method-only signatures are valid. |
| **URI template** (RFC 6570 or extended form) | Optional | Includes path and query parameters as a single template per operation. Query and path aspects are not separated in the signature. |
| **content-type** | Optional | Request `Content-Type` header value (e.g., `application/json`); used to discriminate among request body schemas. |
| **headers** | Optional | Named header values or header presence; used when operations differ by authorization scheme, custom headers, or negotiation directives. ⚠ **Candidate @0.6**: header aspects depend on RFC 8941 / RFC 9110 header-modeling work (issues #22, #108) not yet concluded. This aspect is admitted but prerequisite-gated. |
| **request body shape** | Optional | JSON Schema or other schema type expressing request payload structure; used as a last-resort matcher when other aspects do not disambiguate. ⚠ **Candidate @0.55**: JSON Schema discrimination (e.g., `oneOf` composition) is demoted to a **runtime-only** tier and flagged `schema-dependent / not-statically-collision-checked` by the ADA. The static contract does not guarantee JSON-Schema overlap analysis; see §3.4.2. |

At minimum, a signature composes **method** and **URI template**. All other aspects are optional and are selected only when necessary to disambiguate operations or to model legitimate business logic (RPC-style operations, content negotiation, etc.).

> ⚠ **Candidate @0.5**: No required per-API declared "signature style" indicator (e.g., a top-level enumeration signaling whether signatures are "path-based" vs "content-negotiated" vs "header-aware"). The signature mechanism is **uniform and implicit**, driven by the ADA's exposure contract. An optional authoring affordance (such as PR #183's proposed `signatures` array) MAY be supplied by the DOM and is normalized away by the ADA; it is not authoritative or mandatory.

### 3.3 Signature Identity and Matching

#### 3.3.1 Signature Formation

The ADA MUST normalize each operation's signature by:

1. **Extracting all declared signature aspects** from the pathItem and operation in the DOM.
2. **Composing the concrete tuple** (method, path-template, content-type, headers, body-schema) for that operation.
3. **Marking which aspects are variable** (parameterized, e.g., `{id}` in a path) vs. **concrete** (literal values, e.g., `GET`, `application/json`).
4. **Recording the operation's name/identity** (operationId if present, or a derived identifier).

#### 3.3.2 Request Matching Algorithm

To match an HTTP request to an operation:

1. **Collect the request's aspects**: method, request URI, Content-Type (if present), header values, and body payload (if present).
2. **Filter operations** whose method and URI template *can* match the request (i.e., the request method and path conform to one or more operation's declared signature aspects).
3. **Apply additional filters** in order of decreasing specificity:
   - Content-Type exact match (if the request has a Content-Type and the operation declares one).
   - Header value matches (if the operation's signature includes header aspects and the request includes those headers with matching values).
   - Request body shape: if a schema is declared and a cheap, deterministic schema-overlap check succeeds, match; otherwise, flag as **runtime-dependent** (see §3.4.2).
4. **Return**: the zero or one operation matched. If multiple operations remain after filtering, return a collision verdict (§3.4).

#### 3.3.3 Precedence: Concrete Over Variable (Runtime Only)

OpenAPI 3.x establishes a precedence rule: **concrete (literal) path segments take precedence over variable (parameterized) segments** (e.g., `GET /users/me` matches before `GET /users/{id}`). The Candidate v4.0 specification **carries this precedence forward as a runtime-resolution behavior only**, not as a static-detection primitive or a collision-resolution policy.

- **Scope**: param-vs-param specificity (one variable path segment more specific than another) and bidirectional overlap (e.g., `{id}` matching an integer constraint, or a path segment matching both `/items/{itemId}` and `/items/{itemType}`) remain **undefined** in 3.x and are not resolved in v4.0.
- **Application**: concrete-over-variable is applied during request matching (step 3.3.2, filter), not during static collision analysis (§3.4).
- **Justification**: the rule is inherited, not contested, but its scope is bounded to avoid false certainty in ambiguous cases.

### 3.4 Collision Analysis & Detection

#### 3.4.1 Three-Valued Verdict

The ADA MUST expose, for each operation, a collision verdict relative to all other operations. The verdict is **three-valued**:

| Verdict | Meaning | Example |
|---------|---------|---------|
| **provably-disjoint** | No possible HTTP request can match two or more operations. Signatures are statically distinct. | `GET /users` and `POST /users` (different methods); `GET /items/{id}` and `GET /items/count` (different path structure). |
| **provable-collision** | At least one HTTP request exists that would match two or more operations, and this overlap is statically verifiable. | `GET /users` and `GET /users` (identical signatures); `GET /items` with `Content-Type: application/json` and `GET /items` with `Content-Type: application/xml` when the only difference is schema (both GET /items, but schema discrimination fails—see below). |
| **not-statically-determinable** | The ADA cannot statically prove disjunction or collision. Overlap may exist at runtime, depending on request payload, header values, or other data-dependent factors. | `GET /items` with `Content-Type: application/json` constrained by `{"type": "object"}` vs. `GET /items` with `Content-Type: application/json` constrained by a different schema (JSON-Schema overlap is not generally computable); `POST /users` with a request body matching `oneOf` across schemas. |

#### 3.4.2 Bounded Scope & Limitations

The collision analysis is a **best-effort desideratum**, not a mandatory validation gate. Specifically:

- **JSON-Schema discrimination is demoted to runtime-only.** The specification does NOT guarantee static overlap analysis for JSON-Schema constraints. If an operation's signature includes body-shape aspects (parameterSchema constraints), the ADA MAY expose a collision verdict, but MUST flag it `schema-dependent / not-statically-collision-checked`. Tools MUST NOT assume that distinct schema constraints guarantee disjoint signatures at compile time.

- **Header-based collisions are prerequisite-gated.** Until RFC 8941 / RFC 9110 header-modeling semantics are fully integrated (issue #108), header-based signature aspects are admitted but may be flagged with a capability warning.

- **Templating system is open.** The analysis is bounded by the chosen URI template language (RFC 6570, extended-URI-Template, WHATWG URLPattern). Variable-vs-concrete pattern matching is defined only within the chosen language; inter-language comparison is out of scope.

#### 3.4.3 Collision Detection is *Not* a Validation Gate

The ADA's collision verdict is a **report, not a policy decision**. Specifically:

- **Surfacing a `provable-collision` verdict does NOT mandate that the API is invalid.** Multiple operations MAY have colliding signatures if the router/runtime implements a collision-resolution policy (see §3.4.4).

- **Surfacing a `not-statically-determinable` verdict does NOT mandate additional analysis.** Tools MAY choose to apply further heuristics, log a warning, or defer to runtime behavior. The specification does not prescribe a policy for indeterminate cases.

- **The mechanism is "detect-and-tolerate"**: the ADA exposes the verdict transparently so that tools and authors can make informed decisions about their API design. The *choice* of what to do (reject collisions, apply priority rules, use strict-mode, etc.) is left to the API author and the tooling layer, as resolved in frontier issue #187.

> ⚠ **Candidate @0.6**: Collision-resolution policy (invalid vs. specificity-order vs. priority-cascade vs. strict-mode) is **OPEN** and carried to the next frontier stage. The SIG's lean (frontier #186) is "priority-as-last-resort," recorded but not ratified. This section exposes the collision verdict; the policy choice is deferred.

#### 3.4.4 Runtime Precedence Strategies (Informative)

For guidance, the following strategies have been discussed in the SIG:

1. **Collision-Invalid**: Treat any collision (even `not-statically-determinable`) as a specification error. Require all operations to have provably-disjoint signatures.
2. **Specificity-Order**: When a request matches multiple operations, apply the concrete-over-variable rule transitively, selecting the "most specific" operation by path, method, and content-type.
3. **Priority-Cascade**: Assign an explicit priority ranking to operations; when a request matches multiple operations, select the highest-priority one. *(SIG's recorded lean.)*
4. **Strict-Mode**: Require that any collision verdict be explicitly resolved with a priority annotation; do not fall back to implicit specificity rules.

None of these strategies is standardized in the Candidate v4.0. Implementers SHOULD document their chosen policy.

### 3.5 operationId & Signature Coexistence

The operationId field (inherited from OpenAPI 3.x) **coexists** with the signature mechanism. Specifically:

- **operationId** is a string identifier assigned by the author for code generation, documentation, and API user convenience.
- **Signature** is the structured identity used for request matching.
- The two **do not replace one another**. An operation MAY have both an operationId and a signature.
- Whether operationId is used as a *component* of the signature (e.g., in RPC-style APIs) or as an independent artifact is **OPEN**. Frontier issue #16.1 is deferred.

> ⚠ **Candidate @0.8**: The fate of operationId—specifically, whether signatures *replace* operationId as the sole operation identifier, or whether the two coexist—is unresolved. This specification assumes coexistence.

### 3.6 Deferred: Templating System, Schema Split, Resource Orientation

The following design decisions are **explicitly deferred** to subsequent frontier resolutions:

- **Frontier #127 (Templating System)**: The concrete URI template language (RFC 6570 vs. extended-URI-Template vs. WHATWG URLPattern) is chosen *after* the ADA exposure is fixed. This affects the bounds of static collision analysis (§3.4.2).
- **Frontier #20 (Per-Location Schema Split)**: Whether parameters and request bodies use a unified `parameterSchema` or per-location schemas affects how body-shape aspects of signatures are expressed. This is a **critical dependency for D1** (JSON-Schema discrimination); if #20 ratifies JSON-Schema-in-the-matcher, D1's ceiling must be revisited.
- **Frontier #30 (Resource Orientation)**: Whether the signature's primary axis is path+method (RESTful) or decoupled resource identity is unresolved and affects the entire signature composition model.

### 3.7 Example: Multi-Aspect Signature

Below is a YAML illustration of a multi-aspect signature scenario, showing how the ADA would expose a collision verdict:

```yaml
paths:
  /items:
    get:
      summary: List all items
      operationId: listItems
      signature:
        method: GET
        uriTemplate: /items
        aspects:
          - method
          - uriTemplate
      collisionVerdict:
        status: provably-disjoint
        reason: Only GET /items without further path segments
        
    post:
      summary: Create item
      operationId: createItem
      signature:
        method: POST
        uriTemplate: /items
        requestContentType: application/json
        aspects:
          - method
          - uriTemplate
          - requestContentType
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name: { type: string }
      collisionVerdict:
        status: provably-disjoint
        reason: POST vs. GET on same path

  /items/{itemId}:
    get:
      summary: Get item by ID
      operationId: getItem
      signature:
        method: GET
        uriTemplate: /items/{itemId}
        aspects:
          - method
          - uriTemplate
      collisionVerdict:
        status: provably-disjoint
        reason: Concrete path /items/{itemId} vs. /items (concrete-over-variable precedence)

  /items/recent:
    get:
      summary: Get recent items
      operationId: getRecentItems
      signature:
        method: GET
        uriTemplate: /items/recent
        aspects:
          - method
          - uriTemplate
      collisionVerdict:
        status: provably-disjoint
        reason: Concrete /items/recent matches before variable /items/{itemId}

  /notifications:
    post:
      summary: Send notification (content-type differentiation)
      operationId: notifyJson
      signature:
        method: POST
        uriTemplate: /notifications
        requestContentType: application/json
        aspects:
          - method
          - uriTemplate
          - requestContentType
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                text: { type: string }

    post:
      summary: Send notification (XML)
      operationId: notifyXml
      signature:
        method: POST
        uriTemplate: /notifications
        requestContentType: application/xml
        aspects:
          - method
          - uriTemplate
          - requestContentType
      requestBody:
        content:
          application/xml:
            schema:
              type: object
      collisionVerdict:
        status: provable-collision
        collisionResolution: content-type-discrimination
        warning: requires router support for content-type routing
```

---

## 4. Requests & Parameters

Requests in Suluk v4.0 define the structure and constraints of HTTP method invocations on operations. A request MUST specify the HTTP method, content type(s) it accepts, and — at runtime — the schema constraining its parameters and body. Requests are keyed by name in an ordered map at the operation level, enabling optional shorthand when a single request is present.

### 4.1 Request Object Model

A **request** is a named object carrying method context, content negotiation, and parameter/body schema slots. Each request is keyed by a stable NAME (string) in the request collection and resolved to a concrete invocation signature at runtime via per-location parameter schemas and the optional cross-cutting dependency construct.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `method` | string | YES | HTTP method (uppercase): `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, `TRACE`. Determines which request(s) are active on the pathItem. |
| `summary` | string | NO | Short human-readable label for this request variant. Useful when multiple requests exist on a single pathItem. |
| `description` | string | NO | Longer markdown description of intent, preconditions, or side effects. |
| `contentType` | string \| [string] | NO | IANA media type(s) acceptable in the request body. Single string or array. If absent, the request carries no body (or body is application-determined). |
| `parameterSchema` | [Schema object](#schema-object) | NO | Per-location schema slots constraining query, path, header, and cookie parameters. Keyed object with optional `query`, `path`, `header`, `cookie` sub-schemas, each a JSON Schema 2020-12 object. See §4.3. |
| `contentSchema` | [Schema object](#schema-object) | NO | JSON Schema 2020-12 governing the request body. Present only if a body is expected. Applied after Content-Type negotiation. |
| `crossCuttingDependencies` | [Cross-Cutting Construct](#cross-cutting-construct) | NO | Optional envelope for rare value-equality or presence dependencies spanning multiple parameter locations or body. Opt-in; see §4.4. |

### 4.2 Request Collections & Shorthand

**Requests are collected in a name-keyed map** at the operation level. Each request NAME is a stable identifier (e.g., `"application/json"`, `"create-json"`, `"streaming"`) that tools use to disambiguate and reference the request.

**Shorthand (@0.6):**

> ⚠ **Candidate @0.6**: Shorthand `"post /path"` key syntax is permitted as optional sugar at the DOM level; tools MUST desugar it to a standard named request before entering the ADA (abstract description surface). This enables authoring ergonomics in flat keys while preserving the stable, named-map canonical form in interchange. Desugaring rules are deferred to the tooling section.

When a pathItem has exactly one request, tools MAY offer shorthand notation (e.g., a bare `"post /users"` key instead of a nested requests map), which desugars to `{ requests: { "post": { method: "POST", ... } } }` at the ADA boundary. Authoring tooling MUST NOT rely on shorthand in normative examples or as part of the core DOM->ADA correlation contract.

### 4.3 Per-Location Parameter Schema Slots

Parameter schemas are expressed as **separate JSON Schema objects, one per location**, avoiding reserved-name collision in query/path/header/cookie parameter namespaces.

**Structure:**

The `parameterSchema` object (if present) contains these optional keys:

```yaml
parameterSchema:
  query:      # JSON Schema 2020-12; constrains query parameters
    type: object
    properties:
      limit: { type: integer, minimum: 1 }
      offset: { type: integer, minimum: 0 }
    additionalProperties: false
  
  path:       # JSON Schema 2020-12; constrains path parameters
    type: object
    properties:
      userId: { type: string, pattern: '^[a-zA-Z0-9]{8}$' }
    required: [ userId ]
  
  header:     # JSON Schema 2020-12; constrains HTTP headers
    type: object
    properties:
      X-Request-ID: { type: string, format: uuid }
      Accept-Language: { type: string }
    additionalProperties: true  # Headers often include x-* extensions
  
  cookie:     # JSON Schema 2020-12; constrains HTTP cookies
    type: object
    properties:
      session: { type: string }
```

**Defaults:**

- If a location (query/path/header/cookie) is **absent** from `parameterSchema`, the runtime behavior is implementation-defined (tools may enforce strict-no-params or permissive-allow-all); tools SHOULD document their choice.
- **Header and cookie defaults** default to `additionalProperties: true` per C004 §23 (headers and cookies often carry implementation-specific extensions; filtering is conservative).
- **Query and path defaults** follow standard JSON Schema defaults (`additionalProperties: false` is typical for explicit parameter control).

> ⚠ **Candidate @0.55**: The exact per-location DEFAULT for `additionalProperties` behavior when a schema-slot is absent, and the priority of explicit vs. implicit schema-application at runtime, are deferred to implementation profiles and the #127 concrete-templating-system ADR. C004 establishes the DIRECTION (separate slots, no mandatory wrapper); the precise validation-algebra is refinement-deferred.

**Relationship to path parameters:**

Path parameters are ALWAYS known statically (RFC 6570 uriTemplate). The `path` slot in `parameterSchema` MUST constrain only parameters expressed in the operation's uriTemplate; tools SHOULD validate that all path parameters mentioned in the schema are declared in the template, and vice versa.

### 4.4 Optional Cross-Cutting Dependency Construct

**When needed** (rare): if a request expresses a constraint that spans multiple locations — e.g., "the `id` in the path MUST equal the `id` in the body" — an optional `crossCuttingDependencies` object MAY be used. This is **NOT** the authoring root; it is only invoked when a single-location schema is insufficient.

**Structure:**

```yaml
crossCuttingDependencies:
  # Presence dependencies (supported in standard JSON Schema 2020-12)
  if:
    required: [ "X-Custom-Header" ]
  then:
    required: [ "bodyId" ]
  
  # Value-equality dependencies (DEFERRED to #73)
  # Example (not currently valid; requires Relative JSON Pointer):
  # - path.id MUST equal body.id
  # - Requires custom vocabulary pending #73 resolution
```

**Scope & constraints:**

- The tooling materializes a envelope `{ parameters: {...}, headers: {...}, body: {...} }` from the parsed request instance and evaluates the cross-cutting schema over it.
- **Presence dependencies** (if/then, required, etc.) work in standard JSON Schema 2020-12 today.
- **Value-equality dependencies** (path ID == body ID) require a Relative JSON Pointer vocabulary and are **deferred to #73**.

> ⚠ **Candidate @0.55 (deferral)**: Cross-type value-equality constraints cannot be expressed normatively without the Relative-JSON-Pointer vocabulary (ADR #73). The construct is PRESENT to avoid inventing syntax at authoring time; at validation time, no working value-equality expression exists in the corpus. This deferral is identical to C004's treatment (§2.3) and is a known limitation of the current schema ecosystem, not a Suluk design flaw.

**Why optional and opt-in:**

- The common case (95%+) is satisfied by per-location slots; no overhead for simple requests.
- The rare case (cross-type deps) is handled without forcing a unified wrapper as the authoring root, preserving C004's per-location ergonomic win (no mandatory nesting for simple queries).
- This honors the binding prior C003/D1 (runtime validation only; not compiled into the static signature matcher).

### 4.5 Parameter Schema Composition & Inheritance

**C012 #116 (@0.55):**

> ⚠ **Candidate @0.55**: Inheritance of parameters via a per-level optional `shared` map is permitted and MUST honor override-vs-accumulate merge semantics (e.g., `query` parameters in a request override path-level `query` definitions; `header` parameters accumulate additively unless shadowed by request-level name). The concrete per-property merge table is deferred; the direction (single optional `shared` container, resolved before the C003 matcher) is settled at ceiling 0.55. Response-level reach is explicitly deferred.

When a pathItem defines shared parameters across multiple requests, tools MAY support optional per-level `shared` maps (path level, request level, etc.):

```yaml
paths:
  /users/{userId}:
    shared:
      parameter-schema:
        query:
          limit: { type: integer, default: 10 }
    
    requests:
      get:
        # Inherits path-level parameter-schema.query.limit
        method: GET
      
      post:
        # Inherits path-level parameter-schema.query.limit
        # Can override or add parameters
        method: POST
```

**Merge semantics:**

- A request's `parameterSchema` MUST be merged (allOf) with any inherited path-level `parameterSchema` before runtime validation.
- Override rule: request-level properties shadow path-level properties of the same name.
- Accumulation rule: path-level and request-level schemas can co-exist for different properties; tools compose them additively (via JSON Schema allOf semantics).
- Tools MUST NOT compile the merged result into the C003 static matcher; inheritance is resolved at runtime.

### 4.6 Content Type Negotiation

**`contentType` field (optional):**

If a request body is expected, `contentType` specifies the IANA media type(s) the server accepts:

```yaml
contentType: "application/json"
# or
contentType:
  - "application/json"
  - "application/x-msgpack"
```

- Single string is the default (preferred) type.
- Array lists alternatives; the first is preferred.
- If absent, no body is expected (GET, HEAD, DELETE often omit this).

**Relationship to `contentSchema`:**

The `contentSchema` (JSON Schema) is applied **after** Content-Type negotiation. Tools MAY bind a schema to a specific content type via headers or media-type parameters (deferred to #127 templating). For now, `contentSchema` is location-agnostic and applies to any accepted content type.

### 4.7 Normative Grammar

1. **Every operation MUST have at least one request.**
2. **Every request MUST specify a method** (GET, POST, etc.).
3. **Every pathItem/request combination MUST have a unique C003 signature** (method → content-type → static-detect result). Collisions are runtime-validated and most-specific wins (deferred to C003 collision policy in §5).
4. **Parameter schemas MUST be valid JSON Schema 2020-12 objects.**
5. **Reserved keywords** (none enforced at the request level; no `$schema`, `$id` required in parameter slots, per C004's reserved-name elimination).
6. **D1 Consistency**: Cross-cutting dependencies are evaluated at RUNTIME only; they MUST NOT be compiled into the C003 static signature matcher.

---

## Example: A multi-request pathItem with inheritance and per-location parameters

```yaml
paths:
  /api/orders/{orderId}:
    shared:
      parameterSchema:
        path:
          orderId:
            type: string
            pattern: '^ORD-[0-9]{6}$'
        header:
          X-Request-ID:
            type: string
            format: uuid

    requests:
      get:
        method: GET
        summary: Retrieve order by ID
        description: Fetch full order details including line items and shipping.
        parameterSchema:
          query:
            includeItems:
              type: boolean
              default: true
            includeShipping:
              type: boolean
              default: true
        # Inherits path.orderId and header.X-Request-ID from shared

      post:
        method: POST
        summary: Update order (JSON payload)
        description: Modify order details, partial updates allowed.
        contentType: application/json
        contentSchema:
          type: object
          properties:
            status:
              type: string
              enum: [ pending, shipped, delivered, cancelled ]
            shippingAddress:
              type: object
              properties:
                street: { type: string }
                city: { type: string }
          additionalProperties: false
        
        parameterSchema:
          query:
            dryRun:
              type: boolean
              default: false
            sendNotification:
              type: boolean
              default: true
          # Inherits path.orderId and header.X-Request-ID from shared

      put:
        method: PUT
        summary: Replace order entirely (with cross-location constraint)
        description: Full replacement; existing order is destroyed and reconstructed.
        contentType: application/json
        contentSchema:
          type: object
          properties:
            id:
              type: string
            items: { type: array }
          required: [ id, items ]
        
        parameterSchema:
          path:
            orderId:
              type: string
              pattern: '^ORD-[0-9]{6}$'
          # (overrides shared if explicit; typically inherited)
        
        crossCuttingDependencies:
          # Rare case: path ID must match body ID
          description: >
            The orderId in the path must match the id in the request body.
            Currently validates presence; value-equality requires #73.
          if:
            type: object
            properties:
              body: { type: object, required: [ id ] }
          then:
            # Deferred: relative JSON pointer reference to equate path.orderId === body.id
            description: "Value-equality constraint pending #73 relative JSON pointer"
```

---

## Deferred & Low-Ceiling Markers (Section 4)

- **#127 — Concrete templating system** (C004 deferral): query/path instance→data-model mapping, deserialization rules (query.x vs x), media-type-specific schema binding.
- **#73 — Relative JSON Pointer vocabulary** (C004/C012 deferral): value-equality cross-type/cross-location dependencies (path ID == body ID).
- **#108 — Header model** (C004 prerequisite, OPEN 2026-03): cookies/trailers placement, header normalization, case-sensitivity.
- **Shorthand desugaring rules** (@0.6): DOM→ADA tooling protocol for `"post /path"` key syntax and merge algebra.
- **#116 response-level inheritance** (C012 deferral): the `shared` merge algorithm applies at pathItem and request; response-level reach is deferred.
- **Per-property merge semantics table** (C012 @0.55): exact override-vs-accumulate rules per parameter type; algorithm formalism deferred to tooling section.

---

## 5. Responses

A **response** describes an HTTP response message that may result from a request. Responses model the status code, content type, and schema of the response body. Responses are NAME-KEYED MAPS at three scopes: per-request (request-level responses), per-pathItem (pathResponses), and global (apiResponses). The mechanism composes additively across scopes by inheritance, with explicit runtime precedence rules for status/content-type specificity.

### 5.1 Response Scope and Precedence

Responses may be defined at three levels:

1. **Request-level responses** — named map keyed inside a `request` object, binding specific to that method+contentType pairing.
2. **pathResponses** — named map keyed inside a `pathItem`, applying to all requests on that path UNLESS overridden by request-level definitions.
3. **apiResponses** — named map at document root, available to all paths and requests UNLESS overridden by path-level or request-level definitions.

**Resolution rule (most-specific-wins):** At runtime, a response search follows: request-level → pathResponses → apiResponses. The FIRST response matching the HTTP status code and content-type of the actual response is selected. If multiple responses have the same status at the same scope-depth, they MUST differ by content-type to be unambiguous; if they do not, the tooling-resolution behavior is UNDEFINED (see ⚠ below).

> ⚠ **Candidate @0.62**: The runtime status/content-type tiebreak and the scope-depth precedence rank are partially deferred to C003 (the correlation/collision policy). Current prose describes an **additive-union + most-specific-match model**, but the SIG's live #44 thread (darrelmiller) proposes **status-code-scoped precedence** as an alternative. The dominant load-bearing piece (additive composition for **distinct** responses across scopes) is high-confidence; the tiebreak ordering is low-confidence. Source: C012 #17b @0.62.

### 5.2 Named-Map Structure

Each response is a name-keyed entry in the map. The `name` is the map key and serves as a stable identifier for reference and tooling presentation. The response object itself carries these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | MUST | HTTP status code or status pattern (e.g., `200`, `404`, `5XX`). Literal numeric codes and wildcard patterns per HTTP semantics are both valid. |
| `contentType` | string | MAY | Media type of the response body (e.g., `application/json`, `text/plain`). Absence implies no response body. |
| `contentSchema` | JSON Schema | MAY | JSON Schema (2020-12 dialect) describing the structure of the response body, keyed to the `contentType`. Only valid if `contentType` is present. |
| `description` | string | MAY | Human-readable description of this response (e.g., "Resource created successfully"). |
| `headers` | object | MAY | Map of named header definitions. *Deferred pending #108 (header model); indicative shape only.* |
| `order` | integer | MAY | Optional presentation order hint for tooling display. Absence implies insertion order is not significant (C009 hybrid, lowered ceiling). |

**Example:**
```yaml
request:
  method: POST
  contentType: application/json
  contentSchema: { $ref: "#/schemas/Speaker" }
  responses:
    created:
      status: 201
      contentType: application/json
      contentSchema: { $ref: "#/schemas/SpeakerWithId" }
    badRequest:
      status: 400
      contentType: application/problem+json
      contentSchema: { $ref: "#/schemas/ProblemDetail" }

pathResponses:
  notFound:
    status: 404
    contentType: application/problem+json
    contentSchema: { $ref: "#/schemas/ProblemDetail" }

apiResponses:
  serverError:
    status: 5XX
    contentType: application/problem+json
    contentSchema: { $ref: "#/schemas/ProblemDetail" }
```

### 5.3 Response-Level parameterSchema Composition

> ⚠ **Candidate @0.62**: Response-level `parameterSchema` inheritance is **deferred** to the per-location parameterSchema work (C012 #17b, the second half). The field table and composition rules below are INDICATIVE only; the final normative resolution waits on C004 cross-type dependency work (#73). Source: C012 #17b @0.62.

When responses are composed across scope-depth, the `parameterSchema` (if present at the pathItem or request level per C004) is inherited and composed using JSON Schema `allOf`:

- A request-level `parameterSchema` is allOf'd with any pathItem-level `parameterSchema`.
- The composed schema is evaluated against the HTTP request parameters BEFORE response matching.
- This composition is ADDITIVE; contradictory constraints between levels are not auto-resolved and result in a schema that is unsatisfiable (a tooling validation error).

**Example (pathItem-level + request-level composition):**
```yaml
pathItem:
  uriTemplate: "/speakers/{speakerId}"
  parameterSchema:
    type: object
    properties:
      speakerId: { type: string }
    required: [speakerId]

  requests:
    getSpeaker:
      method: GET
      parameterSchema:
        type: object
        properties:
          include: { enum: [metadata, history] }
        # composed with pathItem parameterSchema via allOf
      responses:
        ok: { status: 200, contentSchema: { $ref: "#/schemas/Speaker" } }
```

In this example, the effective request schema is:
```json
{
  "allOf": [
    { "type": "object", "properties": { "speakerId": { "type": "string" } }, "required": ["speakerId"] },
    { "type": "object", "properties": { "include": { "enum": ["metadata", "history"] } } }
  ]
}
```

### 5.4 Referencing Responses

Responses are referenced by their stable NAME, never by array index or map-insertion order. A reference to a response in `apiResponses` might be expressed as:

```
#/apiResponses/serverError
```

Or, if a shorthand reference syntax is adopted (C012 #60/61, deferred), a tool might resolve:
```
#apiResponses.serverError
```

The exact reference syntax (JSON Pointer vs. shorthand dot-notation) is DEFERRED to the identification/referencing redesign (#26/#49/#72/#73 per C009). **The by-name resolution rule is DECIDED now; the wire syntax is deferred.**

> ⚠ **Candidate @0.6**: Shorthand reference syntax is proposed as sugar (deferred at #60/61); all normative tooling MUST resolve references by name at the DOM→ADA boundary. Source: C012 #60/61 @0.6.

### 5.5 Open Deferred Items

- **#17b / response-scope inheritance:** The precise precedence rank and status/content-type tiebreak for responses across apiResponses/pathResponses/request-level are DEFERRED to the C003 correlation/collision policy. Current text assumes **additive-union + most-specific-match**; the SIG's #44 thread proposes alternatives.
- **#17b / parameterSchema response-level reach:** Whether `parameterSchema` composes at the response level (not just request level) awaits the full #17b/#108 resolution. Current text is indicative only.
- **#108 (header model):** The `headers` field definition is pending a full header modeling ADR.
- **#26/#49/#72/#73 (identification/referencing):** The concrete reference syntax (JSON Pointer fragments, shorthand forms, namespace scoping) is deferred; only the by-name rule is locked.
- **#73 (JSON Schema dialect + vocabulary):** The JSON Schema version and any custom keywords (e.g., Relative-JSON-Pointer for value-equality cross-type dependencies) await this frontier.

---

## 6. Schemas, Content & Data Modeling

### 6.1 JSON Schema Dialect and Declaration

OpenAPI v4.0 uses **JSON Schema 2020-12** as its sole normative schema language for describing structured data. This choice is fixed at the document level and applies to all Schema Objects embedded within the specification.

**6.1.1 Dialect Declaration**

The JSON Schema dialect MUST be declared explicitly at the document level via the OAS `schema` keyword (in the root object's metadata). A specification document MAY override the dialect on a per-schema-component basis using the JSON Schema `$schema` keyword inside an individual Schema Object (e.g., within a component definition), provided the override is static and locally decidable at the DOM-to-ADA boundary.

- **Document-level default:** 2020-12 (no ambiguity if unspecified)
- **Per-component override:** via the Schema Object's `$schema` field (supported for forward-compatibility; discouraged for simplicity)

The specific version pin and formalized serialization syntax are DEFERRED (see C013 Consequences).

> ⚠ **Candidate @0.70**: The exact byte-grammar for the dialect declaration, JSON-Pointer tolerance semantics, and string-vs-object polymorphism for inline restrictions are deferred to the fragment grammar filing (#73).

**6.1.2 Dialect Scope**

The declared dialect applies uniformly across:
- All Schema Objects in the `components/schemas` collection
- All per-location `parameterSchema` slots (query, path, header, cookie, body)
- All request and response `content` definitions
- All inline and deferred schema compositions

No parallel dialect selector (e.g., an `x-schema-dialect` property) is permitted.

---

### 6.2 Component Identity and Referencing

Schema components (reusable definitions) are housed in a map keyed by **stable typed names**. The map key IS the canonical single-valued identity of that component and implicitly produces a location-independent anchor.

**6.2.1 Typed-Component-Name Identity**

Each schema component in the `components/schemas` map is identified by its **key**. This key:

- MUST be stable across document versions (immutable within a version)
- MUST be unique within the `components/schemas` collection
- MUST NOT be aliased by positional array index
- Implicitly anchors the component for use in `$ref` and other referencing mechanisms

**Example:**

```yaml
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
    ErrorResponse:
      type: object
      properties:
        code:
          type: integer
        message:
          type: string
```

The `User` and `ErrorResponse` keys ARE the component identities; they are never disambiguated by insertion order or array position.

**6.2.2 Reconciliation of Anchors**

An authored `$anchor` inside a Schema Object (per JSON Schema 2020-12) names an intra-schema fragment target and MUST NOT contradict the component key. If a schema author includes an anchor, it applies only within that schema's boundary; the component key remains the public identity.

> ⚠ **Candidate @0.70**: The byte-grammar for anchor syntax and inline-restriction coexistence with the component key are deferred (#73).

---

### 6.3 Imports and Reuse Across Documents

OpenAPI v4.0 supports explicit document import via an **Imports Object**, enabling multi-file specifications while maintaining local, DOM-to-ADA resolution.

**6.3.1 Imports Object Structure**

The root-level `imports` field contains a map of namespace identifiers to import directives:

```yaml
imports:
  common: "https://example.org/schemas/common.json"
  auth:   "./auth/schemas.yaml"
  self:   "#"
```

Each import entry specifies:
- **key** (namespace identifier): a stable name used to qualify references
- **value** (href): a URL, relative path, or implicit self-reference (`#`)

**6.3.2 Import Resolution and Binding**

The IMPORTS OBJECT MUST be resolved at the DOM-to-ADA boundary via a single resolution function. The function:

1. Accepts self-IRI-match (`#`), external retrieval URLs, and external-base-IRI relative paths (all three MUST be supported)
2. Binds the import identifier to a location only (no mandatory wrapper)
3. Does NOT require I/O for local imports (self-reference)
4. Does NOT mandate a remote-fetch if the location is already in-memory

Single-file OAS documents (no external imports) need NOT declare an `imports` section.

> ⚠ **Candidate @0.70**: The formalization of the three-method mandate (IRI-match, retrieval-URL, external-base) is marked as soft-strength pending cross-voice consensus verification. The byte-grammar and serialization form are deferred (#73).

---

### 6.4 References and the $ref Divorce

JSON Schema `$ref` is retained as the in-schema reference mechanism, fenced inside Schema Objects under the declared JSON Schema 2020-12 dialect. A complementary OAS-level reference mechanism (e.g., for referencing components by name without JSON-Pointer syntax) is NOT introduced in this version.

**6.4.1 Parsed Distinguishability**

The two reference kinds (JSON-Schema `$ref` and future OAS-level reference, if added) MUST be parse-time-distinguishable by token-plus-slot, not by tree position alone. When a Schema Object includes `$ref`, the reference is schema-level and uses standard JSON Schema semantics.

**Example:**

```yaml
components:
  schemas:
    OrderItem:
      $ref: "#/components/schemas/Product"
    Order:
      type: object
      properties:
        items:
          type: array
          items:
            $ref: "#/components/schemas/OrderItem"
```

---

### 6.5 Parameter Interdependencies and Relational Semantics

Parameter interdependencies are resolved via a **three-way split**:

1. **Same-location simple and complex dependencies:** expressed in pure JSON Schema 2020-12 inside the C004 per-location slots (query, path, header, cookie, body)
2. **Cross-location VALUE-EQUALITY dependencies** (e.g., path ID == body ID): declared via a Moonwalk relational EXTENSION vocabulary (grammar and exact keyword home deferred; see 6.5.1)
3. **DSL or high-level constraints:** NOT included in core; an optional translating DSL outside core is left OPEN (not foreclosed)

**6.5.1 Same-Location Dependencies (JSON Schema 2020-12)**

All dependencies within a single parameter location are expressed using standard JSON Schema keywords:

- `dependentSchemas` — conditionally apply schema constraints based on property presence
- `dependentRequired` — conditionally require fields based on other fields
- `if`/`then`/`else` — condition-based schema variants
- `allOf`, `oneOf`, `anyOf` — composition and constraints

**Example (query parameters with interdependencies):**

```yaml
parameters:
  - name: searchQuery
    in: query
    parameterSchema:
      type: object
      properties:
        q:
          type: string
        filter:
          type: string
        sortBy:
          type: string
      dependentRequired:
        filter: ["q"]   # filter requires q to be present
      if:
        properties:
          sortBy: { const: "date" }
      then:
        required: ["q"]
```

**6.5.2 Cross-Location Value-Equality (Relational Extension)**

Dependencies that span locations (e.g., ensuring a path parameter matches a body field) are expressed via a Moonwalk relational EXTENSION vocabulary under the C013 declared dialect frame.

- **Runtime scope:** cross-location value-equality is a RUNTIME-ONLY semantic (not a static signature component; D1-safe)
- **Identity:** relationships are declared by-stable-name, never by array index or tree position
- **Deserialization:** query-string and header value matching requires upstream definition of the query-parameter data model (deferred to #127/#108)

> ⚠ **Candidate @0.58**: The exact relational keyword grammar, the parameter-to-instance-data-model deserialization mapping, and query-value reconciliation are deferred to the fragment-grammar filing and the #127 query data-model proposal. Runtime implementations MUST NOT assume deserialization semantics until these details are finalized.

**Example (illustrative; syntax not yet finalized):**

```yaml
# Hypothetical relational value-equality declaration (deferred grammar)
operations:
  updateOrder:
    parameters:
      - name: orderId
        in: path
        parameterSchema:
          type: string
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              id:
                type: string
    # Deferred: exact syntax for declaring path.orderId == body.id
    x-relational-constraints:  # PLACEHOLDER — grammar TBD
      - equals: ["path/orderId", "body/id"]
```

---

### 6.6 Discriminator and Variant Selection

The discriminator serves a **limited, non-normative role**: it is retained as an optional advisory hint for code generation but removed as a load-bearing validation keyword.

**6.6.1 Discriminator as a Codegen Hint**

A Schema Object MAY include a deprecated `discriminator` field (kept for migration only) naming the dispatch property. This field is purely advisory and carries NO normative force:

- It does NOT enforce validation
- It does NOT govern schema selection at runtime
- Code generators MAY use it as a hint for switch-statement generation

**6.6.2 Variant Selection at Runtime**

One-of-N schema selection (previously governed by discriminator) is achieved using standard JSON Schema 2020-12 keywords at RUNTIME only:

- Use `oneOf` + `const` constraints on the dispatch property (per-branch):

```yaml
Animal:
  oneOf:
    - type: object
      properties:
        type: { const: "dog" }
        breed: { type: string }
    - type: object
      properties:
        type: { const: "cat" }
        claws: { type: boolean }
```

- Alternative native keywords (`propertyDependencies`, `if`/`then`/`else`) are noted as candidate mechanisms and deferred to #73 for canonical standardization.

**6.6.3 Discriminator Mapping Removal**

The `discriminator.mapping` object (a manual enumeration of discriminator values to schema URIs) is **removed entirely**. Prefer the C009 by-name reference model: reference variants by their stable component name, not by a manual string-to-URI mapping.

> ⚠ **Candidate @0.6**: The canonical native keyword for variant dispatch (replacing const-per-branch) is deferred to #73. The advisory `discriminator` field itself is retained at @0.55 as a migration aid, making this a reversible, low-confidence soft signal; the core variant-selection verdict is stable at @0.62.

---

### 6.7 Default Values and Defaults Handling

Default values are authored inside the **schema home** — within the JSON Schema 2020-12 `default` keyword inside each per-location parameterSchema slot — NOT as a separate OAS-level parameter control field.

**6.7.1 Schema-Home Defaults**

For each parameter (query, path, header, cookie, body), a default value is declared using the JSON Schema `default` keyword within the parameter's `parameterSchema`:

```yaml
parameters:
  - name: limit
    in: query
    parameterSchema:
      type: integer
      default: 10
      minimum: 1
      maximum: 100
```

**6.7.2 Parameter-Level Default Field (Deferred)**

The Parameter Object's `default` FIELD (a separate top-level field in the parameter definition) is **deferred and left OPEN**. Future adoption depends on:

1. Resolution of the JSON-Schema upstream missing/defaultProperties/itemDefaults proposal (json-schema-org#867)
2. Integration as a thin reflection of that upstream keyword or as a C013 extension vocabulary
3. Never as a bespoke OAS control keyword

Tooling and implementations SHOULD handle intra-location defaults (inside `parameterSchema`) as the normative source.

> ⚠ **Candidate @0.64**: The parameter-level `default` field remains unspecified. Authors are directed to use JSON-Schema `default` inside `parameterSchema`. If upstream JSON Schema develops a distinct default-application keyword, this section will be updated by reference.

---

### 6.8 Alternative Schemas and Extension Vocabulary

Requests and responses MAY declare multiple alternative schema languages or validation rules via an opt-in **alternative-schema EXTENSION vocabulary** (not a core mechanism).

**6.8.1 Single Source of Truth per Slot**

JSON Schema 2020-12 is the sole **core** schema language. Within each per-location slot (query, path, header, cookie, body, response), a single `parameterSchema` or response `content` schema definition is the source of truth:

```yaml
parameters:
  - name: filter
    in: query
    parameterSchema:
      type: object
      properties:
        name:
          type: string
      # Single schema home; no inline mix-within-slot
```

**6.8.2 Alternative Schema Expression (Extension)**

Specifications MAY declare alternative schema representations (e.g., Protobuf, GraphQL SDL, WSDL) via a C013 extension vocabulary (the host-spec `$vocabulary` frame; not a parallel OAS dialect selector):

- Alternative languages are OPT-IN and non-normative
- They live outside the core schema slot and are labeled as extension content
- The JSON Schema 2020-12 definition remains the canonical surface for validation

> ⚠ **Candidate @0.74**: The alternative-schema extension vocabulary is ADOPTED in direction but its registry, slot naming, conformance language, and exact mechanism are deferred. Whether the mechanism will be built at all remains subject to a YAGNI review (mechanism may be unused at maturity). The single-source-of-truth per-slot principle is high-confidence (@0.7); the extension framing is contingent (@0.74).

---

### 6.9 Content Model and Media-Type Parameters

Request and response content is declared via the **content object**, which maps media types to schemas. Media-type parameters (e.g., charset, boundary) are expressed via a **registry-keyed content model** (inherited from the #108 header-model decision).

**6.9.1 Content Structure**

```yaml
requestBody:
  content:
    application/json:
      schema: { $ref: "#/components/schemas/User" }
    application/xml:
      schema: { $ref: "#/components/schemas/User" }
responses:
  "200":
    content:
      application/json; charset=utf-8:
        schema: { $ref: "#/components/schemas/User" }
      text/plain:
        schema: { type: string }
```

**6.9.2 Media-Type Parameters (RFC 6838)**

Media-type parameters (charset, boundary, etc.) are expressed via the same **content-model registry approach** established for header field-models (#108):

- Parameters are keyed by the registry name (not a bespoke OAS parameter object)
- The exact hook (e.g., a new `fieldModel` key or extension slot) is deferred to the content model detailing (#108)
- Implementations MUST support RFC 9110 §5.6 (media-type syntax) and RFC 8941 (structured field-values)

> ⚠ **Candidate @0.7**: The exact mechanism for expressing media-type parameters within the content model is deferred. The registry approach is adopted; the slot naming and content-model integration are contingent on #108's detailed design.

---

### 6.10 Headers and Field Models

Response and request headers are modeled via a **dedicated header-model reference key** (not content-type-style), allowing explicit decoupling of header syntax from content negotiation.

**6.10.1 Header Definition**

Headers are defined in the response object and referenced by stable name:

```yaml
responses:
  "200":
    description: Success
    headers:
      X-Rate-Limit-Remaining:
        description: Remaining API calls
        schema:
          type: integer
      X-Custom-Header:
        description: Custom metadata
        schema:
          type: string
```

**6.10.2 Header Field Models (Registry)**

Headers MAY reference a **registry of standardized field models** for common headers (e.g., RFC 9110 fields, RateLimit headers per IETF draft-ietf-httpapi-ratelimit-headers):

- A new dedicated property (e.g., `fieldModel`) MAY be added alongside the C004 per-location header slot
- The value is a registry key (e.g., `"rfc9110/rateLimit"`)
- The `style: automatic` sugar is deprecated in favor of explicit model reference

> ⚠ **Candidate @0.6**: The exact property name (`fieldModel`, `headerModel`, or similar), the registry URL structure, and the runtime normalization semantics are deferred. Header trailers (RFC 7230 §4.1.2) and cookie placement are surfaced as design considerations but not hardened (@0.42).

---

### 6.11 Composition and Inheritance

Schemas compose via standard JSON Schema mechanisms (`allOf`, `oneOf`, `anyOf`) at the RUNTIME level. Path-item and operation-level inheritance uses an optional **per-level `shared` map** carrying name-based merge inheritance down the keyed spine.

**6.11.1 Schema Composition (allOf, oneOf, anyOf)**

```yaml
components:
  schemas:
    Named:
      type: object
      properties:
        name: { type: string }
    Timestamped:
      type: object
      properties:
        createdAt: { type: string, format: date-time }
    Document:
      allOf:
        - $ref: "#/components/schemas/Named"
        - $ref: "#/components/schemas/Timestamped"
        - type: object
          properties:
            content: { type: string }
```

**6.11.2 Path and Operation-Level Inheritance (Optional `shared`)**

An optional `shared` map at the pathItem or operation level carries reusable parameter definitions and other constraints down the keyed spine (path-collection -> pathItem -> operation):

```yaml
paths:
  /users/{userId}:
    shared:
      parameters:
        - name: userId
          in: path
          parameterSchema:
            type: string
    get:
      # userId parameter inherited
      responses:
        "200":
          description: User details
    patch:
      # userId parameter inherited
      requestBody:
        content:
          application/json:
            schema: { type: object }
```

**6.11.3 Merge Resolution**

The `shared` wrapper:

- MUST NOT be mandatory (flat-key inheritance remains co-valid as a migration default)
- Merge semantics are resolved BEFORE the C003 matcher (i.e., parameters are flattened at the DOM-to-ADA boundary)
- Override-vs-accumulate semantics are declared explicitly per-property in a normative resolution algorithm (not left implicit)

> ⚠ **Candidate @0.55**: The concrete per-property merge table (which properties override, which accumulate, which are forbidden), response-level reach, tag-inheritance, the reserved key name, and the one-surface-vs-two authoring question are deferred. The @0.55 ceiling reflects contested refutation bites; the no-mandatory-wrapper sub-decision is high-confidence.

---

### 6.12 Field Tables

| **Aspect** | **Field** | **Type** | **Required** | **Notes** |
|---|---|---|---|---|
| Schema declaration | `schema` | string | NO | Document-level dialect; default = "2020-12" |
| Component identity | `components/schemas/<key>` | object | YES | Key IS identity; no index-based aliasing |
| Imports | `imports` | object | NO | Namespace → href map; optional for single-file specs |
| Per-location schema | `parameterSchema` | Schema Object | YES (per location) | Houses all same-location dependencies + defaults |
| Default value | `parameterSchema/default` | any | NO | JSON-Schema default keyword; parameter-level field deferred |
| Discriminator hint | `discriminator` | string | NO | Advisory only; runtime variant selection uses `oneOf`+`const` |
| Content media-type | `content/<mediaType>/schema` | Schema Object | YES | One schema per media-type |
| Shared inheritance | `shared` | object | NO | Per-pathItem or operation; flat-key remains co-valid |
| Header definition | `headers/<headerName>` | object | NO | Standard JSON Schema inside; `fieldModel` key deferred |
| Relational constraint | *deferred* | *deferred* | — | Cross-location value-equality; grammar TBD (#24/#100) |

---

### 6.13 Example: Multi-Location Schema with Interdependencies

```yaml
paths:
  /orders/{orderId}:
    shared:
      parameters:
        - name: orderId
          in: path
          parameterSchema:
            type: string
            pattern: "^ORD-\\d{6}$"
    patch:
      parameters:
        - name: includeDetails
          in: query
          parameterSchema:
            type: boolean
            default: false
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
                  type: string
                  pattern: "^ORD-\\d{6}$"
                status:
                  type: string
                  enum: [pending, processing, delivered]
                items:
                  type: array
                  items:
                    $ref: "#/components/schemas/OrderItem"
              required: ["status"]
              # Same-location dependency: if status is 'processing', require items
              if:
                properties:
                  status: { const: "processing" }
              then:
                required: ["items"]
      responses:
        "200":
          description: Order updated
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/Order"
                  - type: object
                    properties:
                      updatedAt: { type: string, format: date-time }
        "404":
          description: Order not found
        "409":
          description: Conflict
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"

components:
  schemas:
    OrderItem:
      type: object
      properties:
        productId: { type: string }
        quantity:
          type: integer
          minimum: 1
      required: ["productId", "quantity"]
    
    Order:
      type: object
      properties:
        id: { type: string }
        status: { type: string }
        items: { type: array, items: { $ref: "#/components/schemas/OrderItem" } }
      required: ["id", "status"]
    
    ErrorResponse:
      type: object
      properties:
        code: { type: integer }
        message: { type: string }
      required: ["code", "message"]
```

---

### 6.14 Conformance and Deferred Items

**6.14.1 Normative Conformance**

Specifications conforming to OpenAPI v4.0:

- MUST use JSON Schema 2020-12 as the declared dialect
- MUST identify schema components by stable, unique keys (not by insertion order or array index)
- MUST use the `parameterSchema` per-location slots for all parameter and body schemas
- MUST express same-location interdependencies using standard JSON Schema keywords
- SHOULD use the optional `shared` wrapper for path-item-level inheritance (if supported by tooling)

**6.14.2 Deferred Mechanisms**

The following aspects remain OPEN and are deferred to future waves:

| **Item** | **Deferral Reason** | **Related ADR** |
|---|---|---|
| Fragment byte-grammar and JSON-Pointer syntax | Upstream dependency; needs formalization pass | C013 #73 |
| Relational value-equality vocabulary (cross-location) | Grammar and deserialization model TBD | C014 #24/#100 |
| Parameter-level `default` field | Awaits JSON-Schema upstream proposal | C015 #113 |
| Alternative-schema extension registry | Contingent on YAGNI review | C014 #122 |
| Media-type parameter slot naming | Depends on #108 content-model detailing | C016 #163 |
| Header field-model registry structure | Registry design and RFC citation TBD | C015 #108 |
| Canonical variant-dispatch keyword | Chooses between propertyDependencies, if/then/else, const | C012 #57 |
| Response-level inheritance and precedence | Distinct from pathItem; deferred separately | C012 #17b |

---

## 7. HTTP Fields (Headers, Cookies, Trailers)

### 7.1 Overview

HTTP fields (headers, cookies, and trailers) are the primary mechanism for carrying metadata, authentication, content negotiation, and request/response directives in HTTP messages. This section defines how Suluk v4.0 represents field schemas, field models, and field-specific constraints.

Per [C004](../doc/architecture/decisions/C004-parameter-schema.md) (§5.2), headers and cookies are modeled as **per-location schema slots** in the request (`headerSchema`, `cookieSchema`) and as **named Header Objects** in responses. Per [C015 #108](../doc/architecture/decisions/C015-contested-batch-waveC1.md) (§#108), the specification introduces a **dedicated `fieldModel` registry key** to resolve the header-field semantics beyond schema alone.

**Confidence note:** Core header/cookie/trailer structure is high-confidence; the `fieldModel` reference mechanism sits at @0.6, and trailer placement is deferred.

### 7.2 Field Model Registry

HTTP field *models* describe the syntax, semantics, and validation rules for a specific field. The registry is indexed by **lowercase-normalized field name** (per RFC 9110 §5.1) and may reference:

1. **IANA HTTP Field Name Registry** (RFC 9110 §5.6)
2. **Structured Field Values** (RFC 8941) serialization and parsing rules
3. **Custom field models** declared via extension registry entries

The registry is **read-only at runtime** and serves as the ground truth for evaluating field presence, syntax, and multiplicity constraints. Tooling MUST normalize field names to lowercase before lookup.

> **Example:** `content-type`, `accept`, `x-request-id` are all looked up in lowercase form; the registry entry describes the field's syntax (media-type, list-of-values, single-value, etc.) and any multiplicity rules.

### 7.3 Headers in Requests

Headers in requests are expressed in two ways, depending on the use case:

#### 7.3.1 Per-Location Header Slot (Common Case)

The per-location **`headerSchema`** slot (per C004) is a **plain JSON Schema 2020-12** object applied at runtime to the parsed request headers (as an object with lowercase keys). This is the **common case** for simple field constraints.

```yaml
request:
  method: GET
  # Per-location header slot — simple schema over already-typed slice
  headerSchema:
    type: object
    additionalProperties: true           # default: allow implicit headers (#224)
    properties:
      if-match:       { type: string }
      accept:         { type: string, enum: ["application/json", "application/xml"] }
      x-request-id:   { type: string, pattern: "^[a-f0-9]{8}$" }
    required: ["x-request-id"]
```

**Key constraints:**

- **Field names MUST be lowercase** in the schema `properties` object. Tooling MUST normalize incoming headers to lowercase before validation.
- **`additionalProperties: true` is the default** (C004 #224). Implicit headers (e.g. `Host`, `User-Agent`) MUST NOT falsely reject valid requests.
- The schema validates the **parsed, deserialized instance** — not the wire syntax. (Wire syntax is ruled by the field's `fieldModel` entry.)

#### 7.3.2 Field Model Reference (Schema + Semantics)

A **dedicated `fieldModel` key** (C015 #108 @0.6) MAY be added to a header property to reference the field's registered model and enforce field-specific semantics beyond schema.

```yaml
request:
  headerSchema:
    type: object
    properties:
      content-type:
        type: string
        fieldModel: "content-type"        # reference to registry entry
      set-cookie:
        type: string
        fieldModel: "set-cookie"          # note: Set-Cookie in requests (RFC 6265)
      accept:
        type: string
        fieldModel: "accept"              # structured field: comma-separated media-types
```

**Semantics of `fieldModel`:**

- `fieldModel` is a **string value** (not a schema keyword) that names an entry in the field-model registry.
- It is **optional**; absent `fieldModel` means the schema alone governs validation.
- It is **evaluated at runtime**, not statically compiled into the signature mechanism (C003 D1).
- The field model MAY impose additional constraints (e.g. multiplicity, parsing rules, structured-field serialization) that the schema does not express.

> **⚠ Candidate @0.6:** The `fieldModel` reference mechanism is contested and sits at lower confidence than the per-location slot structure. The exact registry entry schema, serialization rules for structured fields, and interaction with JSON Schema 2020-12 are provisional. Expect refinement.

#### 7.3.3 Style: Automatic (DOM → ADA sugar)

The optional `style: automatic` keyword (per C015 #108) is **DOM → ADA sugar only**, applying only to the abstract description surface (ADA) that tools consume, not to the on-the-wire format. It indicates that the field's serialization is automatic (determined by the field model) and does not require special deserialization logic.

```yaml
request:
  headerSchema:
    type: object
    properties:
      accept:
        type: string
        fieldModel: "accept"
        style: automatic                  # ADA sugar: field serialization is automatic
```

- `style: automatic` is **optional**; it provides a hint to ADA consumers but does NOT change validation semantics.
- The **actual wire serialization** is governed by the `fieldModel` entry, not by `style`.
- Tooling MUST NOT use `style` as a runtime dispatch mechanism; it is informational only.

> **Note:** This differs from OAS 3.x `style` (e.g. `simple`, `form`), which was a deserialization contract. Here, `style: automatic` is a metadata tag for the ADA, independent of runtime validation.

### 7.4 Headers in Responses

Response headers are modeled as a **named map of Header Objects**, each keyed by **lowercase field name**.

```yaml
responses:
  "200":
    description: Success
    headers:
      content-type:
        description: "Content media type"
        schema:
          type: string
          enum: ["application/json"]
      x-rate-limit:
        description: "Requests remaining"
        schema:
          type: integer
        fieldModel: "x-rate-limit"
      cache-control:
        description: "Cache directives"
        schema:
          type: string
        fieldModel: "cache-control"       # structured field: comma-separated directives
```

**Header Object structure:**

| Field | Type | Constraint | Notes |
|-------|------|-----------|-------|
| `description` | string | OPTIONAL | Describes the header's purpose. |
| `schema` | JSON Schema | REQUIRED | Plain JSON Schema 2020-12 for the field value. |
| `fieldModel` | string | OPTIONAL | Registry key for field-specific semantics. |
| `style` | string | OPTIONAL | DOM → ADA sugar; `automatic` is the only defined value. |
| `deprecated` | boolean | OPTIONAL | Marks the header as deprecated. |
| `required` | boolean | OPTIONAL | Declares whether the header MUST be present. Default: `false`. |

**Semantics:**

- Response headers use the **same Header Object** as OAS 3.2 for continuity (C011 #209 @0.75–0.85).
- The `fieldModel` key follows the same registry-lookup semantics as request headers (§7.3.2).
- All field names MUST be lowercase in the headers map; tooling MUST normalize inbound headers to lowercase before matching.

### 7.5 Cookies

Cookies are **first-class per-location parameters** in requests (per C004 #224) and appear in responses via the standard `Set-Cookie` response header (§7.6).

#### 7.5.1 Request Cookies

Request cookies are modeled in the request's **`cookieSchema`** per-location slot, as a plain JSON Schema 2020-12 object.

```yaml
request:
  method: GET
  cookieSchema:
    type: object
    additionalProperties: true
    properties:
      session-id:
        type: string
        pattern: "^[a-f0-9]{32}$"
      user-prefs:
        type: string
    required: ["session-id"]
```

**Key constraints:**

- **Lowercase cookie names** are RECOMMENDED but not required by the schema (RFC 6265 is case-sensitive).
- **`additionalProperties: true` is the default**, allowing arbitrary cookie values.
- The schema applies at runtime to the **deserialized cookie object** (not the wire `Cookie` header syntax).

> **⚠ Candidate (deferred):** The exact placement of cookies within the signature mechanism (C003) and the interaction with session/correlation tracking are deferred pending resolution of frontier #127 (templating) and #224 refinements.

#### 7.5.2 Response Cookies (Set-Cookie Header)

Response cookies are modeled as **`Set-Cookie` response headers**, per OAS 3.2 and RFC 6265.

```yaml
responses:
  "200":
    description: Login successful
    headers:
      set-cookie:
        description: "Session cookie"
        schema:
          type: string
        fieldModel: "set-cookie"
```

The `Set-Cookie` field model enforces RFC 6265 parsing and the constraint that `Set-Cookie` headers are **never multiplexed** (only one per response; multiple cookies require multiple `Set-Cookie` headers, which are not merged in the `headers` map).

> **Note:** Modeling multiple cookies in a single response requires **multiple response objects** (one per status code) or an explicit out-of-band annotation; the headers map is keyed by field name, so `set-cookie` can only appear once. This is a known limitation inherited from OAS 3.2 and deferred for future refinement.

### 7.6 Trailers

Trailers (per RFC 7230 §4.1.2) are HTTP fields transmitted AFTER the message body in chunked-transfer encoding. Their representation in Suluk v4.0 is **deferred** pending clarification of:

1. **Placement:** Do trailers appear in a separate `trailerSchema` slot, or in the request/response `headerSchema`?
2. **Evaluation order:** Trailers are parsed last (after the body); does this change the signature mechanism or validation order?
3. **Multiplicity:** Can a trailer have multiple values? Does multiplicity differ from headers?

> **⚠ Candidate (deferred @0.42):** Trailer semantics and placement are explicitly deferred to a future wave. For now, trailers MAY be documented as headers with `x-trailer` annotations, or tooling MAY extend the per-location slot model with a dedicated `trailerSchema` slot. This is an open point pending frontend validation and RFC 7230 §4.1.2 alignment.

### 7.7 Cross-Field Dependencies (Opt-In)

When a field's presence or value depends on another field (e.g., `If-Match` requires `ETag` in the prior response, or `Authorization` type depends on the value of a custom `X-Auth-Scheme` header), the opt-in **cross-cutting dependency construct** (per C004 §1.2) MAY be used.

```yaml
request:
  method: PUT
  headerSchema:
    type: object
    properties:
      if-match:        { type: string }
      x-auth-scheme:   { enum: ["bearer", "basic", "digest"] }
  crossDependencies:
    # If If-Match is present, x-auth-scheme MUST be bearer (presence-based, standard 2020-12)
    allOf:
      - if:   { properties: { headers: { required: ["if-match"] } } }
        then: { properties: { headers: { properties: { x-auth-scheme: { const: "bearer" } } } } }
```

- Cross-field dependencies are **rare** and **optional**.
- **PRESENCE-based** dependencies work in standard JSON Schema 2020-12 (the common case).
- **VALUE-EQUALITY** cross-field deps (e.g., two fields must have the same value) require a Relative-JSON-Pointer vocabulary and are **deferred to frontier #73** (not available today).

> **Note:** This construct is **separate from the per-location slot structure** and is used only when true cross-field constraints cannot be expressed within a single `headerSchema`. Absent `crossDependencies`, all field constraints are independent.

### 7.8 Normalization and Lowercasing

Per RFC 9110 §5.1, HTTP field names are **case-insensitive**. The specification requires:

- **Authoring:** Field names in schema `properties` MUST be lowercase.
- **Runtime validation:** Tooling MUST normalize incoming field names to lowercase before schema validation.
- **Registry lookup:** Field model references (e.g. `fieldModel: "content-type"`) MUST use lowercase names.

This normalization is **NOT optional** and applies to all HTTP fields (headers, cookies, trailers, Set-Cookie).

```yaml
request:
  headerSchema:
    type: object
    properties:
      content-type:      # lowercase (required)
      accept-language:   # lowercase (required)
      # NOT: Content-Type, Accept-Language
```

### 7.9 Summary: Object Model

| Object | Location | Parent | Key Constraint |
|--------|----------|--------|-----------------|
| `headerSchema` | Request | `request` | Plain JSON Schema 2020-12; lowercase field names; `additionalProperties: true` default. |
| `cookieSchema` | Request | `request` | Plain JSON Schema 2020-12; lowercase cookie names. |
| `Header Object` | Response | `responses[status].headers[field-name]` | `schema` (required), `fieldModel` (optional), `description`, `required`. |
| `Set-Cookie Header` | Response | `responses[status].headers["set-cookie"]` | Per RFC 6265; serialized as `Set-Cookie` header (not multiplexed in headers map). |
| `fieldModel` | Request/Response | Field property | String registry key; optional; evaluated at runtime. |
| `crossDependencies` | Request | `request` | Optional JSON Schema with materialized `{headers, body, ...}` envelope. |

### 7.10 Deferred and Candidate Items

The following are explicitly marked for future refinement or are candidate-level (confidence ceiling noted):

| Item | Ceiling | Status | Notes |
|------|---------|--------|-------|
| `fieldModel` reference mechanism | 0.6 | Candidate | Registry entry schema, structured-field serialization, and JSON Schema 2020-12 interaction are provisional. |
| Trailer placement and semantics | 0.42 | Deferred | Whether trailers use a separate `trailerSchema` slot, evaluation order, and multiplicity rules are open. |
| Set-Cookie multiplicity in responses | — | Inherited Limitation | Multiple cookies in one response require multiple response objects; inherits OAS 3.2 limitation. |
| Cookie placement in signature mechanism | — | Deferred | Interaction with frontier #127 (templating) and #224 (dynamic-transport-keys) refinements pending. |
| Structured field vocabulary for value-equality | — | Deferred to #73 | Relative-JSON-Pointer relational keywords not yet standardized; blocks cross-field value-equality deps. |

### 7.11 Example: Full Request with Headers and Cookies

```yaml
components:
  requestBodies:
    UserCreate:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              name: { type: string }
              email: { type: string, format: email }
            required: [name, email]

paths:
  /users:
    post:
      summary: "Create a new user"
      operationId: createUser
      request:
        method: POST
        contentType: application/json
        # Per-location schema slots
        headerSchema:
          type: object
          additionalProperties: true
          properties:
            authorization:
              type: string
              pattern: "^Bearer [a-zA-Z0-9._-]+$"
            x-request-id:
              type: string
              pattern: "^[a-f0-9]{8}$"
            accept:
              type: string
              enum: ["application/json"]
              fieldModel: "accept"        # reference field model
          required: [authorization, x-request-id]
        cookieSchema:
          type: object
          additionalProperties: true
          properties:
            session-id:
              type: string
              pattern: "^[a-f0-9]{32}$"
            user-prefs:
              type: string
          required: [session-id]
        pathParamSchema:
          type: object
        parameterSchema:
          type: object
        contentSchema:
          type: object
          properties:
            name: { type: string, minLength: 1 }
            email: { type: string, format: email }
          required: [name, email]
      responses:
        "201":
          description: "User created"
          headers:
            content-type:
              description: "Response content type"
              schema: { type: string, const: "application/json" }
              fieldModel: "content-type"
            x-user-id:
              description: "ID of created user"
              schema: { type: string, pattern: "^[a-f0-9]{8}$" }
            set-cookie:
              description: "Session cookie (httpOnly, secure)"
              schema: { type: string }
              fieldModel: "set-cookie"
          content:
            application/json:
              schema:
                type: object
                properties:
                  id: { type: string }
                  name: { type: string }
                  email: { type: string }
                required: [id, name, email]
```

---

### 7.12 Appendix: Field Model Registry Shape

The field model registry is an **opaque mapping** from field name (lowercase) to model metadata. The precise schema and registry contents are deferred (C015 #108 @0.6). The canonical sources are:

- **IANA HTTP Field Name Registry** (RFC 9110 §5.6): canonical field names, multiplicity, and semantics.
- **Structured Field Values (RFC 8941):** serialization rules for field values (lists, dictionaries, integers, strings, byte sequences).
- **Custom extensions:** tools MAY extend the registry via the extension mechanism (C013).

Example registry entries (illustrative, not normative):

```yaml
# Illustrative structure (NOT normative)
_field_models:
  content-type:
    iana_ref: https://www.iana.org/assignments/http-fields/http-fields.xhtml
    multiplicity: "single"              # max 1 per message
    structured_field: false
    syntax: "media-type / charset"
  accept:
    iana_ref: https://www.iana.org/assignments/http-fields/http-fields.xhtml
    multiplicity: "multiple"             # may repeat
    structured_field: true               # RFC 8941 list
    syntax: "list of media-ranges"
  set-cookie:
    iana_ref: https://tools.ietf.org/html/rfc6265
    multiplicity: "single"
    structured_field: false
    syntax: "name=value; path=...; domain=...; ..."
```

This registry is **not authored in Suluk documents**; it is provided by tooling, RFC-alignment standards, and the extension registry (C013).

---

## 8. Components, References & Imports

> Status: **frame-level candidate (Suluk fork)** · resolved under C013; reconciles C009 (identification-first routing). Deferred: fragment byte-grammar, dialect version pin, JSON-Pointer tolerance, string-vs-object polymorphism UX. Resolves frontier #73/#72/#49/#26 (referencing cluster); does NOT ratify SIG outcomes.

### Concept

**Components** is a dynamic-key map of reusable schema and metadata objects. **References** are links to components and other locatable symbols, split into two independent families:

1. **JSON-Schema refs** (`$ref` keyword), confined to Schema Objects under a declared dialect.
2. **OpenAPI refs** (the "Candidate reference"), used in operation descriptions, request/response bindings, and other non-schema contexts to reach components by stable name.

**Imports** enable cross-document symbol resolution without requiring the parser to perform I/O; a document may declare the namespace and URI of external symbol sources.

The referencing model is **identification-first** (per C009): components are identified by their **canonical name** (the map key), never by array index or insertion order. The exact fragment syntax (`#schemas.Foo`, `#72:Schema`, etc.) is deferred; this section specifies the underlying identity and resolution frame.

### Components Object

#### Structure

```yaml
components:
  <component-family-name>:
    <component-name>: <schema-or-metadata-object>
```

**Map key structure:**
- `<component-family-name>` is a fixed vocabulary of collections (e.g., `schemas`, `requestBodies`, `responses`, etc.); exact roster deferred.
- `<component-name>` is a user-supplied string, the **canonical stable identity** for that component. It MUST be unique within its family within a single OAD (OpenAPI Document).

#### Identity and Anchoring

The component key is the **primary identity**. Under the OpenAPI Candidate v4.0 framework:

- The component key **auto-produces an implicit location-independent anchor** carrying both the family and the component name (e.g., a schema named `Speaker` in the `schemas` family is anchored at an implicit location independent of document structure).
- An authored anchor **inside** a component (if allowed by the dialect) MUST NOT contradict the key. For example, a schema's internal `$id` or `$anchor` MUST NOT assign a different identity to the component as a whole.
- Tools **MUST resolve references to components by their canonical name**, never by insertion order or positional pointer, even if the underlying wire format is an array or a positional structure.

> ⚠ **Candidate @0.70**: The byte-grammar for canonical anchors (whether `#schemas.Speaker`, `#72:Speaker`, `#/$defs/Speaker#Speaker`, or another form) is not yet finalized. This section mandates name-based identity semantics; the syntax is deferred to the identification/referencing redesign (#26/#49/#73).

#### Dialect Declaration

The JSON Schema dialect used **within Schema Objects** is declared at the document level:

```yaml
openapi: 4.0
jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema"  # [or override per-schema]
```

- The dialect MUST be **statically/locally decidable** at the DOM-to-ADA boundary; no context-dependent or runtime selection is permitted.
- **Explicitly declared** with a single document-level default; may be overridden per schema (e.g., a schema-level `$schema` keyword under 2020-12).
- Reuses the OpenAPI host-spec schema/vocabulary hook (no parallel OAS dialect-selector mechanism).

> ⚠ **Candidate @DEFERRED**: The specific version pin (e.g., 2020-12 vs 2024-01 vs a future revision) and the per-schema override policy are deferred to wave B formalization. The frame commits only that dialect is explicitly declared and locally decidable.

#### JSON-Schema Refs (Fenced)

Refs inside Schema Objects follow the declared dialect:

```yaml
components:
  schemas:
    User:
      type: object
      properties:
        id: { type: string }
        role: { $ref: "#/$defs/Role" }  # 2020-12 dialect: relative ref within the schema
    Role:
      enum: [admin, user, guest]
```

**Normative constraints:**
- Schema refs are **parse-time-distinguishable** from OpenAPI refs by their token (the `$ref` keyword, a reserved word in the dialect) and their slot (inside a Schema Object).
- Schema refs MUST NOT be interpreted as pointers to the component map or the broader OAD structure. They are confined to schema-internal resolution per the declared dialect.
- Tools MUST NOT apply OpenAPI component identity resolution (by-name routing) to JSON-Schema refs; the dialect handles them.

### OpenAPI References (Candidate Reference Family)

#### Structure and Resolution

An **OpenAPI reference** (distinct from `$ref`) is a link to a component identified by its canonical name. Its exact syntax is deferred; the semantics are:

```
<openapi-ref> ::= <component-family-name> ':' <component-name> | absolute-uri
```

(Exact syntax deferred; illustration only.)

**Examples (illustrative):**

```yaml
request:
  contentSchema: schemas:Speaker  # [or #schemas.Speaker or another form]

response:
  default:
    contentSchema: schemas:ServerError
    links:
      nextPage:
        target: paths:"{id}/next"  # [or #paths.{id}/next, illustration]

pathResponses:
  notFound:
    $ref: responses:NotFound       # [or #responses.NotFound, illustration]
```

#### Resolution Rule

- **Must resolve by stable component name, never by positional index.**
- If the reference names a component in the same document, resolution is **local** (no I/O required).
- If the reference names a component in an external document, resolution depends on the **Imports Object** (see below).
- Unresolvable references are an error (malformed document or missing import).

> ⚠ **Candidate @0.50–0.55**: Whether OpenAPI refs coexist with a URI-based component alias surface (per the 2025-10-29 OAS-3.2 outcome) is **not hardened**. The name-keyed primary identity is mandatory; a URI surface is optional and deferred.

### Imports Object

#### Structure

An **Imports Object** declares external symbol sources, enabling cross-document references without requiring the parser to perform I/O:

```yaml
imports:
  commonSchemas:                         # namespace (user-supplied key)
    href: "https://api.example.com/schemas.json"  # [or relative URI, or local file path]
    # or:
    # href: "file:///local/schemas.json"
```

**Map key structure:**
- Each entry is a user-supplied **namespace** (e.g., `commonSchemas`, `auth`, `domains`).
- The key identifies the import **within the current document**; references use this namespace as a prefix.

#### Href Resolution

- `href` MAY be an absolute IRI, a relative URI (resolved relative to the document's base), or a file path.
- **I/O is not mandatory.** A conformant tool MAY accept a self-IRI match (import `href` matches the current document's own IRI) OR perform retrieval, but MUST NOT *require* network/file I/O to accept the declaration.
- **Self-imports** (`import:` entry with `href` pointing to the document itself) are implicitly valid and useful for documenting internal symbol namespaces.
- A single-file OAD (everything in one document) **requires no Imports Object**; local references suffice.

#### Reference Resolution with Imports

```yaml
imports:
  standard:
    href: "https://spec.example.org/common.json"

components:
  schemas:
    CustomError:
      type: object
      properties:
        detail: { $ref: "standard:Error" }  # [or #standard:Error or another form, illustration]
```

In this example:
- `standard:Error` resolves to the component named `Error` in the `schemas` family of the document at the import `href`.
- If the import `href` is the current document, no cross-file lookup is needed.
- If the `href` is external and retrieval succeeds, the `Error` component from that document is used.
- If retrieval fails or the import is configured as "accept without I/O," the reference is left unresolved and tooling decides how to handle it (validate-on-retrieval, skip, error, etc.).

#### Reserved Namespaces

- The namespace `self` is implicitly reserved and refers to the current document's own components.
- Overriding `self` is **NOT permitted**.
- An authored Imports entry with namespace `self` is malformed.

### DOM → ADA Boundary: Reference Resolution

At the **DOM-to-ADA boundary**, a single resolution function processes all references:

1. **Identify the reference kind** (JSON-Schema `$ref` vs. OpenAPI ref) by token and slot.
2. **For JSON-Schema refs:** pass to the dialect resolver (defined by the declared `jsonSchemaDialect`).
3. **For OpenAPI refs:** 
   - Extract the component family and name.
   - Check the Imports Object for a matching namespace.
   - Resolve to the named component in the target document (same document or imported).
   - Return the resolved component or an unresolved-reference marker.

This boundary operation is **required** for conformant ADA production; it is **optional** for tooling that works only with the DOM. Single-file OADs (no imports) MUST still support local OpenAPI references by name.

> ⚠ **Candidate @0.50–0.55**: Whether the ADA boundary is hard-required or optional, and the exact error/recovery semantics for unresolved imports, are not yet formalized. This section describes the frame; SIG vote will determine enforcement level.

### Validation and Constraints

**Normative rules:**

- Component keys within a family MUST be **unique per family, per document** (MUST fail validation if two components share an identity within the same family).
- An OpenAPI reference MUST **resolve to exactly one component**, or fail validation.
- A JSON-Schema ref MUST be interpreted **under the declared dialect only**, never as an OpenAPI component pointer.
- The `self` namespace is reserved; explicit Imports entries claiming `self` are forbidden.

**At lowered confidence (@0.50–0.55):**
- Whether URIs may coexist as aliases for components (dual identity) is deferred; name-keyed primary identity is mandatory.
- Whether refs are composable (e.g., `schemas:Foo` + `responses:Bar` in a single ref token) is deferred.
- The inline-restriction regime (whether a component MUST NOT appear inline *and* in the map, or whether both are permitted) is deferred.

### Example: Multi-Family Components with Imports and Mixed Refs

```yaml
openapi: 4.0
jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema"

imports:
  common:
    href: "https://api.example.org/v1/schemas.json"

components:
  schemas:
    Speaker:                           # canonical name: Speaker
      type: object
      properties:
        id: { type: string }
        name: { type: string }
        errors: { $ref: "#/$defs/ValidationErrors" }  # JSON-Schema ref (dialect-governed)
      $defs:
        ValidationErrors:
          type: array
          items: { $ref: "common:Error" }  # [illustration] OpenAPI ref to imported schema

    ConferenceProblem:
      type: object
      properties:
        status: { type: integer }
        detail: { $ref: "common:ProblemDetail" }  # OpenAPI ref to imported schema

  responses:
    SpeakerCreated:                    # canonical name: SpeakerCreated
      status: 201
      contentType: application/json
      contentSchema: { $ref: "schemas:Speaker" }  # [illustration] OpenAPI ref to local schema

    Conflict:
      status: 409
      contentType: application/json
      contentSchema: { $ref: "schemas:ConferenceProblem" }

paths:
  "conferences/{confId}/speakers":
    requests:
      create:
        method: POST
        contentType: application/json
        contentSchema: { $ref: "schemas:Speaker" }
        responses:
          created: { $ref: "responses:SpeakerCreated" }  # [illustration] by-name ref
          conflict: { $ref: "responses:Conflict" }
```

### Deferred & Open Ends

Per C013, the following are **explicitly deferred to SIG vote or wave B formalization:**

- **Fragment byte-grammar (#26/#49):** Whether refs use `#schemas.Foo`, `#/$defs/Foo`, `#72:Foo`, or another syntax.
- **Dialect version pin (#73):** The specific JSON Schema version (2020-12 vs 2024-01 vs future); per-schema override rules.
- **JSON-Pointer tolerance (#49):** Whether legacy JSON Pointers (`#/components/schemas/Foo`) remain valid or are retired.
- **Relational value-equality vocabulary (#24/#100):** How cross-type dependencies (e.g., "path ID equals body ID") are expressed in schema.
- **String-vs-object polymorphism UX:** Whether `contentSchema: "schemas:Speaker"` (string) is allowed alongside object form.
- **Whole-document form (#72):** Whether an OAD may reference another OAD as a whole (vs. picking specific components).
- **Must-match-import manifest:** Whether an import MUST exist in the retrieved document, or whether tooling may be resilient to missing imports.
- **Coexisting URI surfaces:** Whether components may also be addressable by absolute URI (3.2 OAS outcome), dual to the canonical name.

The **identification-first principle** (resolve by name, never by index) is **non-deferrable and decided now**. The wire shape (array vs. map, syntax, order semantics) is **latent and revisable** based on future SIG decisions.

---

## 9. Security

Security metadata in Suluk v4.0 is **externalized by default**, with operations referencing security requirements by stable NAME (not by index). This design enforces loose coupling between API operations and their authorization contexts, deferring fine-grained parameter/body-dependent authz decisions to Area-4 detailed design.

### 9.1 Security Schemes

Security schemes inherit the OpenAPI 3.2 model: a map of named scheme definitions, each specifying type, flows, and location. Suluk does **not** extend the 3.2 security-scheme surface.

| Field | Type | Normative | Notes |
|-------|------|-----------|-------|
| `schemes` | `Map<string, SecurityScheme>` | MUST | Top-level component; keyed by stable NAME (C009 by-name-never-index). Each scheme follows OAS 3.2 structure (http, apiKey, oauth2, openIdConnect, mutualTLS). |

**Example:**

```yaml
components:
  securitySchemes:
    api_key_auth:
      type: apiKey
      name: X-API-Key
      in: header
      description: Stable-name API key reference.
    oauth2_implicit:
      type: oauth2
      flows:
        implicit:
          authorizationUrl: https://example.com/oauth/authorize
          scopes:
            read:profile: Read user profile
            write:profile: Modify user profile
```

### 9.2 Security Requirements and Operation-Level Binding

Operations reference security schemes **by stable NAME**, stored in a `security` ARRAY at the operation level. Each element is a map pairing scheme NAME to an array of scopes (for OAuth2/OpenIdConnect) or an empty array for non-scoped schemes.

| Field | Type | Normative | Notes |
|-------|------|-----------|-------|
| `security` (operation) | `Array<Map<string, Array<string>>>` | MAY | List of alternative security requirements; all alternatives apply (AND). Absence means no security required. By-name reference per C009. |

**Normative Language:**

- An operation with `security: [ { api_key_auth: [] } ]` MUST include the named scheme's header/query/cookie/path parameter.
- An operation with `security: [ { oauth2_implicit: ["read:profile"] } ]` MUST validate the OAuth2 token against at least the listed scopes.
- If multiple schemes appear in one array element, ALL MUST be satisfied (AND logic).
- If multiple array elements exist, ANY element's requirements satisfy the operation (OR logic across alternatives).

### 9.3 Externalized Security (Default Posture)

**Canonical Location:** Security definitions live in a separate functional area (C011 #141 seven-area decomposition), **not embedded in operation definitions**. This enforces separation of concerns and allows shared security contexts across operations.

**Adoption Pattern:**

Operations inherit security from:
1. **Root-level `security`** (applies to all operations unless overridden, per OAS 3.0/3.2 convention).
2. **Operation-level `security`** (overrides root; MAY be empty to make an operation public).

```yaml
# Root-level security (applies to all operations)
security:
  - api_key_auth: []

paths:
  /public-data:
    get:
      summary: Public endpoint
      security: []  # Override: no authentication required
      responses:
        '200':
          description: Public data
  
  /protected-data:
    get:
      summary: Protected endpoint
      # Inherits root security: api_key_auth
      responses:
        '200':
          description: Protected data (API key required)
```

### 9.4 Local Security Binding (Opt-In Escape Hatch)

For the rare case where an operation's authorization depends on **runtime values** (e.g., a path parameter that selects a tenant, a body field that determines scope eligibility), Suluk permits an **operation-local security pointer** under the extension vocabulary.

> ⚠ **Candidate @0.68**: Fine-grained parameter/body-dependent authz and scope-value reconciliation are **not finalized**. Hudlow's signature-as-authz-carrier position (which he flags unfinished himself) and scope-term/value-equality vocabulary both defer to Area-4 detailed design and the #24/#100 relational-extension cluster.

**Extension Framework:**

Implementations MAY define vendor-specific extensions (e.g., `x-moonwalk-conditional-authz`) to express dependencies, but such extensions are **outside core v4.0** and are not portable across tool ecosystems.

### 9.5 Scope Reconciliation and Parameter Binding

The OAS 3.2 security model defines scopes as opaque strings, without a formal grammar for scope-value binding to API parameters or body fields.

> ⚠ **Candidate @0.68**: Scope reconciliation across OAuth2/OpenIdConnect schemes and parameter-equality checks (e.g., path ID equals request body ID, both required for authz) **are deferred**. The #24/#100 ADR panel defers the relational-extension vocabulary (single declared Moonwalk extension keyword for value-equality) to a future fragment-grammar filing. Runtime scope validation remains implementation-defined.

### 9.6 Functional Area: Security as a Standalone Concern

Per C011 #141, security is one of seven modular functional areas. A conforming API specification **SHOULD** dedicate a separate section or document fragment to:

- Named security schemes.
- Scope definitions and their semantics.
- Tenant/user/team isolation rules (if applicable).
- Any custom authorization logic.

This separation ensures that security engineers can review and maintain authz constraints independently from endpoint definitions.

**Example (Conceptual):**

```yaml
# security.yml (standalone functional area)
components:
  securitySchemes:
    oauth2_code:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://auth.example.com/authorize
          tokenUrl: https://auth.example.com/token
          scopes:
            'admin:all': Full admin access
            'org:manage': Manage organization
            'data:read': Read data
            'data:write': Write data
            
  x-authz-rules:
    tenant_isolation:
      rule: "Request's tenant_id header MUST match token's org_id claim."
    data_scope_binding:
      rule: "write scope requires body.org_id == token.org_id; read scope requires read permissions."
```

Operations then reference this by name:

```yaml
paths:
  /orgs/{org_id}/data:
    post:
      security:
        - oauth2_code: [ 'data:write', 'org:manage' ]
      parameters:
        - name: org_id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        # ... org_id also in body for validation
      responses:
        '201':
          description: Data created
        '403':
          description: Insufficient scope or tenant mismatch
```

### 9.7 Conformance and Tooling

A **conforming Suluk v4.0 document**:

- MUST define all referenced security schemes in `components.securitySchemes`.
- MUST use stable scheme NAMEs (per C009); tooling MUST resolve schemes by NAME, not index.
- SHOULD provide operation-level `security` overrides for any endpoint that deviates from the root policy.
- MAY include extension vocabulary (outside core) for conditional authz, scope binding, or other vendor logic.
- SHOULD NOT embed authorization logic inline with parameter/response schemas (enforce separation of concerns).

Tooling (code generators, validators, documentation renderers) **SHOULD**:

- Extract security requirements by operation and present them prominently.
- Warn if an operation references a scheme that is not defined in `components.securitySchemes`.
- Support scope scoping (validation that requested scopes are declared in the scheme definition).
- If implementing extensions, validate against the extension's own schema.

---

## 10. Servers & Deployment

### 10.1 Server Identity

A **Server** object represents a named, stable deployment target. The Candidate v4.0 specification treats servers as thin identity handles—named references that tools and users invoke consistently across environments and time, independent of the runtime URL configuration.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | **REQUIRED**. A unique, case-sensitive identifier for this server. MUST be a valid JSON object key. Server references in [Paths Object](#paths-object) link-by-name, never by index (per [C009](../../decisions/C009-collections-are-maps.md)). |
| `description` | string | OPTIONAL. Human-readable purpose and context. Example: "Production API cluster in US-East." |
| `tags` | [string] | OPTIONAL. Array of tag strings for grouping or filtering (e.g., `["production", "verified"]`). |
| `extensions` | map[string, any] | OPTIONAL. Specification extensions (keys starting with `x-`); see [§13 Extensions](#extensions). |

**Normative Language:**

- Servers are **keyed collections** in a Servers Map (see [§10.3](#servers-map)). Tools MUST resolve server references by name, never by positional index. (@0.74 — *per C015 #55*)
- A server name MUST be globally unique within a Suluk Document. Duplicate names are an authoring error; validators MUST flag them.
- Server identity is stable across versions and environments. Adding, removing, or renaming a server is a breaking change from the authoring perspective; deployment-layer composition (e.g., adding new runtime URLs) is NOT a server rename.

### 10.2 Servers Map

The **Servers Map** is a JSON object keyed by server name, with Server objects as values. Paths, Requests, and other objects MAY reference a server by name using the `servers` field (a reference—typically a single server name string or an array of names).

```json
{
  "servers": {
    "prod-us": {
      "name": "prod-us",
      "description": "Production US region"
    },
    "staging": {
      "name": "staging",
      "description": "Staging environment"
    }
  }
}
```

**Scope:**

- A Servers Map MAY appear at the **Document level** (top-level `servers` field) and at **Path-Item level** or **Request level** (narrowing the scope for that path or request). Lower scopes override higher scopes.
- If no servers are declared at Document level, tooling MAY assume a default server (usually `localhost` or a synthetic fallback). Explicit declaration is RECOMMENDED for clarity.

### 10.3 Deployment Layer (URL Configuration)

> ⚠ **Candidate @0.74** (C015 #55): Environment URL configuration—mapping server names to concrete runtime URLs, including per-environment variations (e.g., `prod-us` → `https://api-us.example.com`, `staging` → `https://staging-api.example.com`)—is a **deployment-layer responsibility**, out of scope for the core Suluk Document. 

The Suluk specification defines server **identity** (a named handle). The mapping from identity to **runtime URL** is a deployment concern, resolved by:

1. **Deployments Object** (if defined by this specification or a companion spec): a per-deployment `location` field or object that associates server names with concrete URLs.
2. **Overlay Specification**: multi-file composition and environment-specific overlays may layer URL bindings atop the core Suluk Document.
3. **Tooling and CI/CD**: environment-aware configuration, templating (e.g., `$ENV`, substitution), or dynamic discovery.

**Consequence:** A Suluk Document is environment-agnostic; its server names are stable references. Tooling consuming the document is responsible for binding names to environment-specific URLs at runtime.

### 10.4 Well-Known URI Discovery

Suluk Documents MAY be discoverable via the **well-known URI** defined in RFC 8615. Deployments SHOULD register Suluk Documents at the following locations:

| Location | Semantics |
|----------|-----------|
| `/.well-known/openapi.json` | Default Suluk Document location (JSON format). |
| `/.well-known/openapi.yaml` or `/.well-known/openapi.yml` | OPTIONAL. YAML representation of the same document. |

**Normative Language:**

- HTTP servers exposing an API described by a Suluk Document SHOULD serve the document (or a summary/link) at `/.well-known/openapi` to enable tooling discovery. (@0.75–0.85 — *per C011 #19*)
- If multiple Suluk Documents are published (e.g., different API versions), the well-known location SHOULD direct to the primary document or provide a registry (out of scope for this specification).
- The well-known resource SHOULD be served with `Content-Type: application/json` (or `application/yaml` for YAML variants) and SHOULD be publicly readable (no authentication required) to maximize discoverability.

### 10.5 Multi-File Composition & Merge

> ⚠ **Candidate @proposal** (C008): Document merge and multi-file composition—layering or combining multiple Suluk Documents (e.g., "merge down" a manifest of partial specs) into a single consolidated document—is **out of scope** for the core Suluk specification.

**Rationale:** The OpenAPI record (2022–2025) converges on routing composition to:

1. **The Overlay Specification**: a separate OAI specification covering merge order, precedence, and layering semantics.
2. **Community tooling and CI/CD**: existing merge tools (of modest adoption) and bespoke composition pipelines.

Multi-file authoring (splitting an API definition across files for organization) is **NOT** merge; it is a tooling/repository-organization concern independent of the spec. Recursive inclusion (e.g., `$ref` to a path definition in another file) is already supported via JSON Schema `$ref` and the Suluk reference model.

**Revisability:** This decision is held to be reversible. If community tooling consensus coalesces around a specific merge pattern, the spec may adopt it in a future wave. For now, the core remains focused on single-document semantics.

### 10.6 YAML Example

```yaml
servers:
  prod-us:
    name: prod-us
    description: |
      Production API cluster (US-East region).
      Runtime URL bound at deploy time via environment overlay or CI/CD substitution.
    tags:
      - production
      - verified
  staging:
    name: staging
    description: |
      Staging environment. Used for pre-release validation.
    tags:
      - staging
  dev:
    name: dev
    description: Developer sandbox (localhost).
    tags:
      - development

paths:
  /items:
    servers:
      - prod-us
      - staging
    get:
      operationId: listItems
      summary: List all items (production & staging only)
      responses:
        200:
          description: Success
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Item'
```

**Interpretation:**
- The Document declares three named servers: `prod-us`, `staging`, `dev`.
- The `/items` path is available only on `prod-us` and `staging` servers (overriding the document-level scope if one were specified).
- Concrete runtime URLs for each server name are supplied by the deployment layer (environment config, Deployments Object, or overlay tooling) at publish/deploy time.

### 10.7 Specification Extensions

Servers support specification extensions (keys prefixed with `x-`) to accommodate tool-specific or domain-specific metadata. Common extensions include:

- `x-region`: Cloud region identifier.
- `x-availability`: SLA or availability tier.
- `x-deprecated`: Mark a server as deprecated.

Extensions are vendor-specific and are not validated by the core Suluk specification.

---

**Cross-References:**
- [C015 #55 (servers-environments)](../../decisions/C015-contested-batch-waveC1.md) — Server identity vs. environment URL config.
- [C008 (merge out of scope)](../../decisions/C008-merge-out-of-scope.md) — Deference to Overlay Specification.
- [C011 #19 (discovery)](../../decisions/C011-convergent-batch-1.md) — RFC 8615 well-known URI.
- [C009 (collections-as-maps)](../../decisions/C009-collections-are-maps.md) — Name-keyed server references.
- [RFC 8615](https://tools.ietf.org/html/rfc8615) — Well-Known Uniform Resource Identifiers.

---

## 11. Tags, Functional Areas & Annotations

### 11.1 Tags Overview

Tags are metadata labels attached to operations, used for grouping, categorization, and referencing. In Candidate v4.0, the tags collection is a **named map keyed by tag name**, allowing tools to reference tags by stable identifier and enabling fine-grained tag definition.

> ⚠ **Candidate @0.68**: The deeper tag charset/multi-purpose model and documentation capability are deferred. This section defines the identification and extension mechanism; full tag semantics (format constraints, documentation rendering) remain in a future wave.

#### 11.1.1 Root-Level Tags Map

The `tags` object at the root level of an OAS document is a **map keyed by the tag name** (string). Each key is a unique tag identifier; each value is a Tag Object.

```
tags: {string -> Tag Object}
```

**Why Map, Not Array:** Per C009 (array-vs-map), user-keyed collections in v4 resolve identity **by stable name, never by index or insertion order**. Tags are referenced by name in operation `tags` arrays and in the annotation vocabulary (§11.3); a map keyed by tag name makes the reference graph explicit and prevents identity collisions that occur with array-of-named-objects under v4's feature scope (multiple semantic tags per operation, per C009 refutation).

#### 11.1.2 Tag Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | MUST | The tag's identifier (matches the map key; MUST be unique and non-empty). |
| `description` | string | no | Human-readable description of the tag. Supports CommonMark syntax per §11.2. |
| `externalDocs` | External Documentation Object | no | Link to external documentation for this tag. |
| `extension` | map{string -> *} | no | Reserved for extension vocabularies (§11.3). Keys follow the `x-` prefix convention. |

**Normative language:**
- The `name` MUST be identical to its map key.
- A name MUST be unique within the `tags` map.
- The `description` field MAY use Markdown (CommonMark 0.30); rendering is tool-dependent.

#### 11.1.3 Tag Reference in Operations

An operation's `tags` field is a **string array**, listing the tag names (map keys) that categorize that operation. Each string MUST correspond to a key in the root `tags` map OR be an undefined tag (for forward compatibility, some tools permit undefined tags; specs SHOULD define all tags upfront).

```yaml
openapi: 4.0.0
paths:
  /pets:
    get:
      tags:
        - "catalog"  # references tags["catalog"]
        - "read"     # references tags["read"]
```

---

### 11.2 Functional Areas

Candidate v4.0 adopts **seven functional areas** as the normative modular decomposition of an API specification, per C011 frontier item #141. These areas organize the specification structure and provide a mental model for API designers and tooling.

#### 11.2.1 The Seven Functional Areas

1. **Metadata** — root-level machine-readable information (title, version, contact, license, terms of service).
2. **Paths & Operations** — HTTP method + path binding, operation definitions, and request/response signatures.
3. **Request Models** — the `requests` map (per-operation request schemas, keyed by friendly name).
4. **Response Models** — the `responses` map (per-operation response schemas, keyed by status or friendly name, per C009).
5. **Schema Components** — the `components` object, housing reusable schema definitions, security schemes, and other referential anchors (C001: identification-first).
6. **Security & Authentication** — root-level and operation-level security requirement specifications, tied to reusable security schemes in `components`.
7. **Webhooks & Callbacks** — webhook subscriptions and event callback definitions (mirrored structure to paths/operations).

**Use & Audience:**
- API designers use these areas to organize their specification narrative.
- Documentation generators use them to structure generated output (e.g., "Security" section, "Data Models" section, "Endpoints" section).
- Linting and validation tools may enforce functional-area coverage checks.
- Tool chains may apply area-specific transformations (e.g., security analysis, model extraction, doc generation per area).

#### 11.2.2 Rich-Text Configuration

Per C011 frontier item #128, text fields (description, summary, documentation) support **configurable rich-text format**.

**Normative:**
- The root OAS object MAY include an optional `textFormat` field (string, deferred; candidates: `"markdown"`, `"html"`, `"adoc"` or other).
- If unspecified, rendering is tool-dependent; CommonMark 0.30 is the *de facto* baseline.
- **Format definitions are deferred to extension registry** (C013 extension vocabulary); no mandated format parsing is required by the core spec.

> ⚠ **Candidate @0.72**: Explicit `textFormat` root field and format-handler registry are deferred to C013 extensions. The section documents the design *slot* and defers enforcement.

---

### 11.3 Annotations & Context-Dependent Property Semantics

Per C015 frontier item #56 (@0.70), context-dependent property semantics are modeled as **object-level annotation keywords** delivered via the JSON Schema 2020-12 extension vocabulary.

#### 11.3.1 Annotation Object Model

An annotation is a metadata facet attached to a **schema object** (in any per-location slot: query, path, header, cookie, body), expressing context-specific constraints or behavioral notes that are independent of the schema's own type validation.

Annotations are **authored as unknown keywords in JSON Schema 2020-12 objects** and are surfaced by validators implementing the annotation-aware dialect. They are grouped by field name when they apply to specific object properties.

**Example:**
```json
{
  "type": "object",
  "properties": {
    "email": {
      "type": "string",
      "format": "email",
      "x-annotation:required-in-POST": true,
      "x-annotation:read-only-in-GET": true
    }
  }
}
```

Here, `x-annotation:required-in-POST` and `x-annotation:read-only-in-GET` are context-specific notes; the property is always a string, but its operational constraint depends on the HTTP method.

#### 11.3.2 Validation & Interpretation

Annotations are validated in **two passes**:

1. **Pass 1: Schema Validation + Annotation Emission**  
   A conformant JSON Schema 2020-12 validator emits annotations and JSON Pointer paths for unknown keywords it encounters, treating them as metadata, not errors. Output: validated instance + annotation map (per RFC 7396 or similar).

2. **Pass 2: Context-Sensitive Enforcement**  
   A second, HTTP-aware validator consumes the annotation map and applies context rules (e.g., "required-in-POST" enforced only when the operation method is POST). This validator MAY reject instances that fail context-sensitive checks, even if Pass 1 succeeded.

> ⚠ **Candidate @0.70**: The context-annotation keyword namespace, scope binding (which fields apply), and enforcement semantics are open to refinement. The section defines the *mechanism* (unknown-keyword-as-annotation); the full vocabulary is deferred to C013 extension work and community-driven adoption.

#### 11.3.3 Extension Vocabulary Slot

Context annotations are **hosted in the C013 extension vocabulary** and are registered under the declared JSON Schema 2020-12 dialect. OAS tools that consume annotations declare explicit support; conformance MUST acknowledge that unknown annotations are silently ignored by base 2020-12 validators.

**Normative:**
- Annotations MUST NOT alter the schema's inherent type validity.
- Tools MAY publish a registry of recognized annotation keywords for interoperability.
- Absent a registry entry, annotation keywords follow the `x-annotation:*` naming convention to signal OAS extension status.

---

### 11.4 Examples

#### 11.4.1 Tags Map & Operation Usage

```yaml
openapi: 4.0.0
info:
  title: Pet Store
  version: 1.0.0

tags:
  catalog:
    name: "catalog"
    description: "Operations for browsing the pet catalog"
    externalDocs:
      url: "https://example.com/docs/catalog"
  write:
    name: "write"
    description: "Operations that modify data"

paths:
  /pets:
    get:
      summary: "List pets"
      tags:
        - "catalog"
      responses:
        "200":
          description: "Success"

    post:
      summary: "Create a pet"
      tags:
        - "write"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/Pet"
      responses:
        "201":
          description: "Pet created"
```

#### 11.4.2 Functional Areas Illustrated

```yaml
openapi: 4.0.0

# === Metadata Functional Area ===
info:
  title: Payment API
  version: 2.0.0
  contact:
    name: "Support"
    url: "https://support.example.com"

# === Paths & Operations Functional Area ===
paths:
  /payments:
    post:
      summary: "Create a payment"
      tags: ["transactions"]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/PaymentRequest"

# === Schema Components Functional Area ===
components:
  schemas:
    PaymentRequest:
      type: object
      properties:
        amount:
          type: number
          minimum: 0.01
        currency:
          type: string
          enum: ["USD", "EUR"]

# === Security Functional Area ===
  securitySchemes:
    api_key:
      type: apiKey
      name: X-API-Key
      in: header
```

#### 11.4.3 Annotations Example

```yaml
paths:
  /users:
    post:
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  format: email
                  x-annotation:required-in-POST: true
                  x-annotation:updatable: false
                password:
                  type: string
                  minLength: 8
                  x-annotation:write-only: true
                  x-annotation:required-in-POST: true

    get:
      responses:
        "200":
          content:
            application/json:
              schema:
                type: object
                properties:
                  email:
                    type: string
                    format: email
                    x-annotation:read-only: true
                  password:
                    x-annotation:hidden-from-GET: true
```

---

### 11.5 Deferred & Candidate Ceilings

- **Tags charset / multi-purpose semantics** (name validation, special characters): Deferred to C013 extension; candidate only specifies the name-keyed map structure.
- **Rich-text `textFormat` field & format-handler registry** (@0.72): Deferred to C013 extensions; no mandated parsing.
- **Annotation vocabulary scope & enforcement** (@0.70): The unknown-keyword-as-annotation mechanism is settled; the *full* vocabulary (keywords, context-binding rules, cross-field annotations) rides the C013 extension process.
- **Functional areas as normative structure**: Adopted from handrews' brainstorm (C011 #141); not yet formalized in an ADR vote, so modest confidence ceiling.

---

## 12. Mechanical Upgrade from OpenAPI 3.x

**Scope:** This section specifies a semi-automated **transformer U: 3.x-DOM → (4.0-DOM, ReviewLedger)** that is mechanical where an earlier Candidate ADR pins a 4.0 target, and systematically FLAGS (never silently drops) where it does not. The transformer resolves **Principle 6** ("An automated upgrade process from 3.x to 4.0 will be developed") as a CONFORMANT-PARTIAL upgrader: a deterministic green path PLUS a machine-readable audit ledger citing the governing ADR per lossy construct or deferred decision. Full automation is foreclosed; the honest unit of work is a **semi-automated transformer with human-review gates**.

### 12.1 Confidence and Scope

> **Candidate @0.55**: This entire resolution is ORIGINATED (sole-witness), inherits the full revisability of every ADR it rests on (C003–C016), and is capped at Originated ceilings (0.5–0.6). No SIG vote exists for the upgrade mechanism. Several target shapes are explicitly DEFERRED (C013 fragment byte-grammar; C005 query-placement; C004 query→data-model deserialization), so the transformer's exact emitted syntax cannot be finalized until those land.

**Honest Coverage:** The semi-automated transformer achieves ~55–70% **mechanical-and-lossless** coverage for OpenAPI 3.1, and ~45–60% for OpenAPI 3.0.x. The remainder is **flagged lossy or human-assisted** via the ReviewLedger. This headline is audit-corrected downward from naive 70–80% estimates; see **Consequences (§12.7)**.

### 12.2 Transformer Architecture: Three-Stage Processing + ReviewLedger

The transformer operates in four stages, each with an explicit output form:

#### Stage 0: Normalization (3.0.x prep)
- **Input:** OpenAPI 3.0.x or 3.1 document in canonical serialization.
- **Scope:** JSON Schema subset upgrade from draft-00/3-1 to JSON Schema 2020-12 (structural only; native vocabulary promotion deferred to Stage 2).
- **Bundling:** Multi-file references resolved to a single 3.x-canonical DOM.
- **Output:** Normalized 3.x-DOM, ready for Stage 1.

#### Stage 1: Structural Core (lossless where possible)
- **Scope:** The backbone constructs already settled by C003–C009: paths, requests, responses, parameters, schemas, components.
- **Precision:** Mechanical, deterministic key synthesis (see **Per-Construct Mapping**, §12.4) for each settled container.
- **Output:** 4.0-DOM with all on-target structures populated; unresolved slots left as safe-form inline defaults (see § 12.4).

#### Stage 2: Serialization & Metadata (flagged lossy)
- **Scope:** OpenAPI 3.x serialization metadata (parameter `style`, `explode`, `allowReserved`), `discriminator.mapping`, `parameter.content`, header `.content`, schema `.xml`.
- **Handling:** NEVER silently dropped. Each construct produces a ReviewLedger entry `{pointer, flag, adrRef, rationale}`.
- **Output:** ReviewLedger (JSON Pointer → audit entry).

#### Stage 3: Human Input (requires external decision)
- **Scope:** Multi-environment server management, collisions in request-name synthesis, operationId→name hoisting strategy, callback/webhook modeling.
- **Handling:** The transformer emits a CHECKLIST with required human decisions, keyed by JSON Pointer.
- **Output:** Checklist manifest (inputs required to complete 4.0 upgrade).

### 12.3 ReviewLedger Format

Each non-finalizable construct or lossy case produces a ReviewLedger entry:

```json
{
  "pointer": "#/paths/~1pets~1{petId}/requests/listByStatus",
  "construct": "style+explode",
  "flag": "lossy",
  "adrRef": "C005",
  "rationale": "parameter style=form, explode=true is FORBIDDEN in path-identity by C005 (multi-segment injection); dropped with receipt; alternation must be manual",
  "sourceValue": { "style": "form", "explode": true },
  "severity": "warning"
}
```

**Fields:**
- `pointer` — JSON Pointer (RFC 6901) to the source 3.x location.
- `construct` — human label (e.g., "discriminator.mapping", "parameter.content").
- `flag` — one of: `lossy`, `deferred`, `human_required`, `collision_candidate`.
- `adrRef` — governing Candidate ADR (e.g., "C005", "C013").
- `rationale` — human-readable reason why this construct cannot be auto-emitted.
- `sourceValue` — the 3.x value (for human review).
- `severity` — `error` (transformation fails), `warning` (lossy but emitted), `info` (advisory).

### 12.4 Per-Construct Mechanical Mapping

#### 12.4.1 Paths and pathItems

**3.x:** Keyed by path string (e.g., `"/pets/{petId}"`), may include `parameters` array.

**4.0 Mapping:**

| 3.x Construct | 4.0 Target | Status | Rationale |
|---|---|---|---|
| `paths["/pets/{petId}"]` | `paths["{petId}"]` (uriTemplate) | Lossless (Tier-M) | C005 Tier-M identity function: OAS 3.x single-segment vars, literal text. Reverse-parse algorithm (C005) inverts the template. |
| `paths.parameters` | `pathItem.parameterSchema` + per-location slots | Partial lossy | C004: per-location schema slots are the target; path-level `parameters` array is FLATTENED into a single `pathItem.parameterSchema` (allOf union of all path-level params). Style/explode **flagged** (see §12.4.7). |
| Multi-segment var (e.g., `{id*}`) | (forbidden) | Lossy | C005: multi-segment explode is FORBIDDEN in path-identity. Emit flag; human must decide: rewrite path or promote to query. |
| Reserved char (e.g., `{id:+}`) | (forbidden) | Lossy | C005: reserved-operator vars are forbidden. Emit flag (§12.5.2). |
| Full RFC6570 operators | Tier-M subset only | Lossy/Identity | C005: only literal text + single-segment simple vars + matrix (corrected) + Tier-Q form-query in query component are permitted. All others flagged. |

> **Candidate @0.55**: The uriTemplate REVERSE-PARSE ("URL to template") is mechanically decided by C005's match-safe operator profile only when Tier-M is used. If the 3.x path uses forbidden operators (e.g., prefix truncation), the 4.0 uriTemplate cannot represent it and must be manually rewritten. This is the structural root of URL-to-uriTemplate ambiguity (C005 §1.4).

#### 12.4.2 Requests and Operations

**3.x:** `paths[path][method]` is an `Operation` object; `requestBody` nests media types.

**4.0 Mapping:**

| 3.x Construct | 4.0 Target | Status | Rationale |
|---|---|---|---|
| `operation` | `request` (by method + content-type) | **Lossy** (name synthesis) | C003: request is keyed by friendly NAME (not operationId). Name is SYNTHESIZED from operationId or method+contentType combo. If operationId absent (common in 3.x), synthesis is deterministic but friendly-name is fabricated. Ceiling lowered @0.55. |
| `operationId` | `request.name` (optional, informational) | Lossy | operationId is GLOBAL in 3.x; `request.name` is per-pathItem. If operationId is reused across pathItems (non-unique), hoisting to a single global slot requires COLLISION POLICY (C003, open). Conservative: INLINE the operationId as a request field; human decides hoisting. |
| `requestBody.content["application/json"].schema` | `request.contentSchema` | Lossless | C004: single content type per request. If multiple media types map to one request (content negotiation), each gets its own request entry. |
| `requestBody.content` (multiple types) | Multiple `request` entries (fan-out) | Partial lossy (name collision) | If 3.x has `POST /pets` with both `application/json` and `application/xml` in the same `requestBody`, 4.0 emits TWO named requests. Name collision RISK: if both should be named "createPet", manual disambiguation required. Flagged (§12.5.3). |
| `requestBody.encoding` | (not preserved) | Lossy | OpenAPI 3.x `encoding` object controls serialization of multipart/form-data. 4.0 defers wire-protocol serialization to #108 (header model, query-string-is-not-JSON). Flagged lossy. |

> **Candidate @0.55**: Operations→named-requests is LOSSY because the friendly-name synthesis (operationId or derived) fabricates a humanly-readable identifier that may not exist in 3.x, violating the name-must-be-authored principle in some readers. Ceiling is lowered to @0.55 to reflect this tension.

#### 12.4.3 Parameters

**3.x:** Parameters are an array; each has `in`, `style`, `explode`, `allowReserved`.

**4.0 Mapping:**

| 3.x Construct | 4.0 Target | Status | Rationale |
|---|---|---|---|
| `parameter` (in=query) | `pathItem.parameterSchema.properties[name]` OR `request.parameterSchema` | Lossless (Tier-M) | C004: per-location schema slots. Query params are flattened into JSON Schema; `required` array → schema-level `required`. |
| `parameter` (in=path) | `pathItem.parameterSchema` (allOf with uriTemplate vars) | Lossless | C005 + C004: path params extracted from the uriTemplate reverse-parse + merged with any path-level parameterSchema. |
| `parameter` (in=header) | `pathItem.parameterSchema.properties` (under a reserved `headers` key OR a C004 cross-type envelope if value-equality needed) | Conditional lossy | C004: header params live in the optional per-location `header` slot. If header-param is cross-type (e.g., equals a body field), the optional C004 cross-cutting envelope is used (requires Relative JSON Pointer, deferred to #73). Standard headers like `Content-Type` are handled separately (§12.4.5). Flagged if envelope needed. |
| `parameter` (in=cookie) | `pathItem.parameterSchema` (under reserved `cookies` key OR envelope) | Conditional lossy | C004: cookies are a closed-vocabulary location. Flagged if envelope needed. |
| `style`, `explode`, `allowReserved` | (not preserved) | Lossy | C005: serialization metadata is omitted from the wire-format path/query. Replacement: constrain parameters to C005 Tier-M (single-segment, no explode, no reserved). If 3.x uses forbidden operators, FLAG (§12.5.2). |

> **Candidate @0.55**: Parameter `style=form, explode=true` on a path parameter is EXPRESSIBLE in RFC6570 (multi-segment explode) but FORBIDDEN in C005 path-identity. The transformer must FLAG this and let a human decide whether to rewrite the path or move the param to query.

#### 12.4.4 Responses

**3.x:** `responses` keyed by status code (string, e.g., "200", "4XX"); each can have multiple media types.

**4.0 Mapping:**

| 3.x Construct | 4.0 Target | Status | Rationale |
|---|---|---|---|
| `response` (by status) | `response` (by FRIENDLY NAME) | **Lossy** (name synthesis) | C009: responses are keyed by user-friendly NAME, not status. Name is synthesized: "ok" for 200, "notFound" for 404, etc. If status is a pattern (e.g., "4XX"), synthesized name is "clientError". Non-deterministic collisions (e.g., two 404 responses with different contents) require human-given names. Flagged collision candidate (§12.5.3). Ceiling @0.55 (same as request-name lossy). |
| `responses.content` (multiple media types) | Multiple `response` entries (fan-out) | Conditional lossy (name collision) | If 3.x has `200: {content: {application/json: {...}, application/xml: {...}}}`, 4.0 emits two named responses: e.g., "okJson" and "okXml". Same collision risk as requests (§12.4.2); flagged. Alternatively, emit a SINGLE response with multiple `contentType` slots (C016 equivalent-media-types affordance, §12.4.5). |
| `response.default` | `apiResponses` or `pathResponses` (with status="default") | Lossless | The C004 query-slot model includes an optional DEFAULT slot for error responses. Status="default" is synthesized. Flagged advisory (scope TBD). |
| `response.headers` | Optional per-location `header` slot (C004) OR cross-cutting envelope (C004) | Partial lossy | Response headers are a lower-priority modeling element (C008 out-of-scope for core). Flagged deferred (@#108). |
| `response.links` | (preserved as optional advisory) | Conditional lossy | C012 #58 resolves links as operation-orchestration hints, kept but optional. Removed completely only by human choice (@C012 L35: "removal pole explicitly weighed and rejected"). Flagged advisory. |

> **Candidate @0.55**: The `responses` map keying by status is LOSSY because identical multiple responses per status (e.g., two different 404 schemas for different content types or request contexts) collide in the friendly-name synthesis and require manual disambiguation.

#### 12.4.5 Content-Type and Media Type

**3.x:** Content-Type is nested in `requestBody.content[mediaType]` and `response.content[mediaType]`.

**4.0 Mapping:**

| 3.x Construct | 4.0 Target | Status | Rationale |
|---|---|---|---|
| `requestBody.content[mediaType].schema` | `request.contentType` + `request.contentSchema` | Lossless | C004: each request flattens content-type + schema to top-level fields. If 3.x has multiple content types in a single `requestBody`, FAN-OUT to multiple requests (collision candidate). |
| `response.content[mediaType]` | `response.contentType` + `response.contentSchema` | Lossless | Same as request. Multiple media types fan-out or use C016 equivalent-media-types affordance. |
| Media-type parameters (e.g., `application/json; charset=utf-8`) | (delegated to content/media-type registry) | Deferred | C016: media-type parameters (charset, etc., RFC 6838) are expressed via the C004 content model's registry approach. Exact mechanism deferred to the content model. Flagged advisory. |
| `content[mediaType].encoding` (multipart/form-data) | (not preserved) | Lossy | Serialization metadata (encoding rules) is deferred to #108 (header model) or dropped. Flagged lossy. |

> **Candidate @0.6**: The fan-out of multiple equivalent content types (`text/json` vs `application/json`) is optional. C016 allows emitting multiple `contentType` values in a single response/request to avoid duplication, but this affordance is lower-priority and flagged informational.

#### 12.4.6 Schema and Components

**3.x:** `components.schemas` is a map of JSON Schema objects (Draft 7 or 2020-12 in 3.1).

**4.0 Mapping:**

| 3.x Construct | 4.0 Target | Status | Rationale |
|---|---|---|---|
| `components.schemas[name]` | `components.schemas[name]` (by identity) | Lossless | C009: component identity is the map key (stable NAME). Schema objects are preserved as-is (Stage 0 upgrades dialect if 3.0.x). |
| `schema.xml` | (not preserved) | Lossy | OpenAPI 3.x `xml` object controls XML serialization (element name, namespace, etc.). 13 instances in petstore corpus, ZERO ADR target → likely lossy, no 4.0 equivalent. Flagged lossy. Ceiling @0.5 (genuine gap). |
| `$ref` (internal, e.g., `#/components/schemas/Pet`) | `$ref` (by C013 typed-component-name rule) | Lossless | C013: typed-component-name identity (the map key is the canonical anchor). Refs resolve by stable component NAME. Fragment syntax deferred to C013 byte-grammar. |
| `$ref` (external) | (import/bundle, or $ref+imported) | Partial lossy | C013: imports are optional. Single-file 3.x documents upgrade cleanly. Multi-file documents require Stage 3 human decision: inline, import, or bundle. Flagged human-required. |
| `discriminator` (object with `propertyName` + optional `mapping`) | (stripped to advisory hint) | Lossy | C012 #57: discriminator is REMOVED as a load-bearing validation keyword. The `propertyName` hint is retained optionally for advisory purposes; `mapping` is DROPPED (not preserved). Runtime validation uses standard JSON Schema 2020-12 (const per branch, or if/then/else, or deferred to #73 replacement vocabulary). Flagged lossy. |
| `discriminator.mapping` | (not preserved) | Lossy | Stripped, not emitted. Flagged lossy. |
| `oneOf` / `anyOf` / `allOf` | (preserved as-is) | Lossless | JSON Schema composition keywords are canonical in 2020-12. |

#### 12.4.7 Serialization Metadata (Comprehensive Flagging)

| 3.x Construct | Status | Flag | Rationale |
|---|---|---|---|
| `parameter.style` | Lossy | warning | C005: style is non-emittable in 4.0. Query params use form (key-value); path params are single-segment literals or simple vars. Forbidden styles (matrix, label, reserved, etc.) are flagged. |
| `parameter.explode` | Lossy | warning | C005: explode=true on multi-valued params is forbidden in path-identity. Flagged. |
| `parameter.allowReserved` | Lossy | info | C005: reserved chars are forbidden in Tier-M. Flagged advisory. |
| `header.content` (media-type nested in header param) | Lossy | warning | OpenAPI 3.0.x allows `header.content[mediaType].schema` (nested). No 4.0 equivalent. Flagged lossy. |
| `parameter.content` | Lossy | warning | OpenAPI 3.0.x allows `parameter.content[mediaType].schema`. No 4.0 equivalent (C004 handles single schema per location). Flagged lossy. |
| `requestBody.required` | Lossless | — | Preserved as `request.bodyRequired` (optional field, defaults false). |

### 12.5 ReviewLedger Examples and Severity Calibration

#### 12.5.1 Example: petstore Path with style=form

**3.x Input:**
```yaml
paths:
  "/pets":
    parameters:
      - name: status
        in: query
        style: form
        explode: true
        schema:
          type: array
          items:
            type: string
```

**4.0 Output (Stage 1):**
```yaml
paths:
  "":  # root path, uriTemplate identity
    parameterSchema:
      type: object
      properties:
        status:
          type: array
          items:
            type: string
      required: [status]
```

**ReviewLedger Entry (Stage 2):**
```json
{
  "pointer": "#/paths/~1pets/parameters/0",
  "construct": "parameter.style",
  "flag": "lossy",
  "adrRef": "C005",
  "rationale": "style=form, explode=true on array param is form-query-permitted but omitted from 4.0 wire syntax; C005 assumes form for query, honoring the serialization intent",
  "sourceValue": { "style": "form", "explode": true },
  "severity": "info"
}
```

#### 12.5.2 Example: Multi-Segment Path Parameter (Forbidden)

**3.x Input:**
```yaml
paths:
  "/files/{path*}":
    parameters:
      - name: path
        in: path
        style: matrix
        explode: true
```

**ReviewLedger Entry (Stage 2):**
```json
{
  "pointer": "#/paths/~1files~1{path*}",
  "construct": "uriTemplate + parameter.style=matrix",
  "flag": "lossy",
  "adrRef": "C005",
  "rationale": "multi-segment explode (path*) is FORBIDDEN in C005 Tier-M path-identity; injective reverse-parse not guaranteed; human must rewrite as separate path segments or move to query",
  "sourceValue": { "operator": "explode", "name": "path" },
  "severity": "error"
}
```

**Stage 3 (Human Decision Required):**
Option A: Rewrite path to `/files/{dir}/{file}` (two separate single-segment params).  
Option B: Move to query: `/files?path=...` (loses path-semantic identity).

#### 12.5.3 Example: Multiple Requests per Method + Content-Type Collision

**3.x Input:**
```yaml
paths:
  "/pets":
    post:
      operationId: createPetJson
      requestBody:
        content:
          application/json:
            schema: { ... }
      responses:
        201: { ... }
    post:
      operationId: createPetXml
      requestBody:
        content:
          application/xml:
            schema: { ... }
```

**4.0 Output (Stage 1 - Fan-out):**
```yaml
paths:
  "":
    requests:
      createPetJson:
        method: post
        contentType: application/json
        contentSchema: { ... }
      createPetXml:
        method: post
        contentType: application/xml
        contentSchema: { ... }
```

**ReviewLedger Entry:**
```json
{
  "pointer": "#/paths/~1pets/post/operationId",
  "construct": "operationId_collision_candidate",
  "flag": "collision_candidate",
  "adrRef": "C003",
  "rationale": "Two requests with method=post at the same path differ only by contentType; synthesized names createPetJson / createPetXml assume operationId suffix convention; C003 matcher would collide on method+path; human verify request-naming strategy",
  "sourceValue": ["createPetJson", "createPetXml"],
  "severity": "warning"
}
```

#### 12.5.4 Example: Discriminator Removal

**3.x Input:**
```yaml
components:
  schemas:
    Pet:
      oneOf:
        - $ref: "#/components/schemas/Dog"
        - $ref: "#/components/schemas/Cat"
      discriminator:
        propertyName: petType
        mapping:
          dog: "#/components/schemas/Dog"
          cat: "#/components/schemas/Cat"
```

**4.0 Output (Stage 1):**
```yaml
components:
  schemas:
    Pet:
      oneOf:
        - $ref: "#/components/schemas/Dog"
        - $ref: "#/components/schemas/Cat"
      # discriminator removed; no mapping preserved
```

**ReviewLedger Entry:**
```json
{
  "pointer": "#/components/schemas/Pet/discriminator",
  "construct": "discriminator",
  "flag": "lossy",
  "adrRef": "C012",
  "rationale": "C012 #57 removes discriminator as a load-bearing keyword; mapping is dropped; runtime validation uses JSON Schema 2020-12 const per branch; human verify discriminator hint needed as advisory",
  "sourceValue": { "propertyName": "petType", "mapping": { "dog": "...", "cat": "..." } },
  "severity": "warning"
}
```

### 12.6 Deferred Constructs & Genuine Gaps

#### 12.6.1 Callbacks and Webhooks

**Status: OPEN GAP**

> **Candidate @0.6**: OpenAPI 3.x `callbacks` and 3.1 `webhooks` are **UNRESOLVED by any ADR** and absent from the 4.0 example corpus. This is a genuine frontier gap, not silently dropped.

**Transformer Handling:**
- Stage 2 produces a flag: `{construct: "callbacks", flag: "deferred", adrRef: "none", rationale: "No ADR target; gap in the Candidate; routes to a separate Wave-D frontier decision"}`
- Stage 3 Checklist includes: "Webhook/callback modeling strategy (deferred to frontier Wave D)."

#### 12.6.2 Query-String Deserialization (C005 Boundary)

> **Candidate @0.55**: C005 resolves the uriTemplate PARSING grammar but **DEFERS** the query-string-is-not-JSON deserialization detail (C005 §5 / C004 §8). The transformer **does not emit** query-to-slot mapping detail beyond flattening 3.x parameter.query to the 4.0 per-location `query` slot.

**Transformer Handling:**
- Query params are mechanically flattened to `parameterSchema.properties[name]`.
- No serialization metadata (style, explode) is preserved; all emit an `info`-level flag.
- Stage 3 Checklist: "Query-string deserialization mapping (deferred to #108; if using C016 equivalent-media-types affordance, verify multiple `contentType` values in a single response/request do not require type-specific query mapping)."

#### 12.6.3 Dialect Version Pin (C013 Open)

> **Candidate @0.6**: C013 **DEFERS** the exact JSON Schema dialect version pin (2020-12 vs. next-draft). The transformer **EMITS** the dialect slot but does **NOT** hard-code 2020-12.

**Transformer Handling:**
- Stage 1 emits: `{jsonSchemaDialect: "urn:placeholder"}` with a Stage 3 checklist: "Set jsonSchemaDialect version per C013 decision (currently deferred; default to 2020-12 as a conservative interim)."

#### 12.6.4 Reference Byte-Grammar (C013 Deferred)

> **Candidate @0.55**: C013 **DEFERS** the exact fragment-pointer syntax for references (#/components/schemas/Pet vs. pet vs. urn:path). The transformer **emits the name-based rule** (C013 identity = map key) but **does NOT finalize the fragment syntax**.

**Transformer Handling:**
- 3.x refs are preserved as-is (e.g., `#/components/schemas/Pet`).
- Stage 3 Checklist: "Reference syntax migration (if C013 lands on a URI-style anchor, re-emit all refs; if on JSON Pointer, current refs are valid)."

### 12.7 Consequences and Honest Coverage

#### 12.7.1 Honest Coverage: Down-Audited

The naive estimate of "70–80% automation" is **audit-corrected downward**:

- **3.1 coverage:** ~55–70% mechanical-and-lossless (structural backbone + responses/requests with synthesized names + path/query flattening). Remainder: style/explode flagged (lossy), callbacks deferred, discriminator/mapping flagged (lossy), header/cookie cross-type deps conditional (deferred).
- **3.0.x coverage:** ~45–60% (same as 3.1, plus schema-dialect downgrade overhead; xml element serialization unfound → lossy).

#### 12.7.2 Deviations from Naive Mapping (with ADR Receipts)

Five over-claimed lossless rows are downgraded to **lossy-with-receipt**:

1. **Operations → requests:** Friendly-NAME synthesis is lossy (operationId may be absent or globally duplicated). Ceiling @0.55 (C003).
2. **Path-templating:** Only Tier-M (single-segment, no explode, reserved-operator forbidden) is the identity function; richer RFC6570 ops require rewrite. Ceiling @0.55 (C005).
3. **Responses → responses:** Status-to-NAME synthesis collides on multiple-same-status responses. Ceiling @0.55 (C009).
4. **Discriminator.mapping:** Dropped entirely (C012 #57 removed the keyword). Ceiling @0.6 (C012).
5. **serialization metadata (style, explode, allowReserved):** Omitted entirely (C005 forbids non-Tier-M operators). Ceiling @0.55 (C005).

#### 12.7.3 The Transformer is CONFORMANT-PARTIAL

**Definition:** A conformant-partial upgrader produces a valid 4.0 document that conforms to all Candidate ADRs where they have decided. Where an ADR defers (byte-grammar, dialect version, collision policy, wire-serialization), the transformer emits a SAFE FORM (inline default, no hoisting, no hard-coded version) and flags the slot for human decision.

**Benefits:**
- No silent loss of information; every lossy case is receipt-tagged.
- Mechanical green path handles ~55–70% of real documents with zero human input.
- ReviewLedger is machine-readable; tooling can surface warnings in an IDE or CI.
- Auditable: every flag cites the governing ADR.

**Costs:**
- Remaining ~30–55% requires human review, but is bounded and explicit.
- Hoisting (e.g., operationId → global request-name slot) is optional, gated on C003 collision policy (still open).
- Multi-environment server management (separate 4.0 documents per env, or overlay) is a Stage 3 human decision.

### 12.8 Example: Complete Upgrade Walkthrough

**3.x Input (simplified petstore):**

```yaml
openapi: 3.1.0
info:
  title: Swagger Petstore
  version: 1.0.0
paths:
  /pets:
    parameters:
      - name: status
        in: query
        schema:
          type: string
        style: form
    get:
      operationId: listPets
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Pet"
  /pets/{petId}:
    parameters:
      - name: petId
        in: path
        required: true
        schema:
          type: string
    get:
      operationId: getPet
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Pet"
        "404":
          description: Not Found
components:
  schemas:
    Pet:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
      required: [id, name]
```

**4.0 Output (Stage 1 + 2):**

```yaml
openapi: 4.0.0
info:
  title: Swagger Petstore
  version: 1.0.0
paths:
  "{status}":  # query-in-uriTemplate (C005 Tier-Q form-query)
    parameterSchema:
      type: object
      properties:
        status:
          type: string
    requests:
      listPets:
        method: get
        responses:
          ok:
            status: 200
            contentType: application/json
            contentSchema:
              type: array
              items:
                $ref: "#/components/schemas/Pet"
  "{petId}":
    parameterSchema:
      type: object
      properties:
        petId:
          type: string
      required: [petId]
    requests:
      getPet:
        method: get
        responses:
          ok:
            status: 200
            contentType: application/json
            contentSchema:
              $ref: "#/components/schemas/Pet"
          notFound:
            status: 404
components:
  schemas:
    Pet:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
      required: [id, name]
```

**ReviewLedger (Stage 2):**

```json
[
  {
    "pointer": "#/paths/~1pets/parameters/0",
    "construct": "parameter.style",
    "flag": "info",
    "adrRef": "C005",
    "rationale": "Query parameter style=form is preserved as the C005 Tier-Q form-query default; info-level advisory",
    "sourceValue": { "style": "form" },
    "severity": "info"
  }
]
```

**Stage 3 Checklist:**

None (all parameters Tier-M, no callbacks, no discriminators, no forbidden operators).

**Result:** Valid 4.0 document, upgraded from 3.1 with zero human intervention (because this example contains only canonical patterns).

### 12.9 Configuration and Tooling Notes

#### 12.9.1 Transformer Invocation

**Pseudo-code interface:**

```
function transform3xTo4(doc3x, options = {}) {
  const stage0 = normalize(doc3x, options.dialectDefault || "2020-12");
  const [stage1, ledger2] = transformStructural(stage0);
  const stage3Checklist = detectHumanRequired(stage1, ledger2);
  
  return {
    doc4: stage1,
    reviewLedger: ledger2,
    stage3Checklist: stage3Checklist,
    honestCoverage: stage1 ? stage2Ledger.length == 0 ? "100%" : "partial" : "failed"
  };
}
```

#### 12.9.2 Ledger Output Formats

- **JSON:** Machine-readable for CI integration, IDE plugins.
- **HTML:** Human-readable summary report with links to ADRs.
- **SARIF:** Security Analysis Results Format integration (if used in a scanning pipeline).

#### 12.9.3 Collision Policy Configuration (Stage 3)

If the user provides a collision-policy option:

```yaml
transform:
  collisionPolicy: "prefix-by-contentType"  # Alternative: "manual-name-required"
```

The transformer auto-completes Stage 3 for multi-content-type cases, using the supplied policy (but only if that policy has been ratified by the SIG; Candidate policies are not auto-applied).

### 12.10 Honest Disclaimers and Revisability

1. **Full automation is foreclosed.** The transformer is a SEMI-AUTOMATED tool; the name "automated" in Principle 6 is re-scoped to mean "deterministic mechanical green-path + auditable lossy-case flagging," not one-click full automation.

2. **Ceilings are Originated.** Every claim in this section inherits the full revisability of its source ADRs (C003–C016). A single new SIG witness (a ratification, or a contradicting ADR) should trigger re-verification.

3. **Deferred items gate finalization.** The exact emitted reference syntax, query→data-model deserialization, and the collision/precedence policy are all open (C005, C004, C003). Until those land, the transformer's exact wire-syntax output cannot be finalized; Stage 3 human review is the honest surface area.

4. **Callbacks/webhooks are a genuine gap.** Not silently dropped; explicitly flagged as out-of-scope for this resolution and routed to a future Wave-D frontier decision.

5. **Invocations inherit candidate-fork constraints.** This transformer is NOT a SIG-ratified tool; it is a Candidate-fork artifact. Deployment should include a disclaimer and route users to the SIG for production guidance.

---

## 13. Conformance: DOM, ADA & Tooling Interface

### 13.1 Overview

This section defines the relationship between the **Document Object Model (DOM)**, the **Abstract Description Surface (ADA)**, and the conformance model that tooling consumes. The DOM is the parsed, in-memory structure of a Candidate v4.0 document—one instantiation of the declarative schema. The ADA is the abstract layer that tools inspect to determine operation identity, collision status, and request-response binding; it is **not mandatory** for either specification authors or tools to produce or consume explicitly, but when tools do perform signature analysis or request routing, they operate on ADA-shaped data.

The Candidate v4.0 spec does **not** define normative conformance tiers (e.g., Strict/Acceptable/Open); instead, it defines a flat specification with optional constructs. Feature breadth and validation depth are routed to overlays, extensions, and profiles.

---

### 13.2 Document Object Model (DOM)

The DOM is the in-memory tree produced by parsing a Candidate v4.0 YAML or JSON document. It follows the collection-as-maps structuring model (C009):

| Layer | Structure | Notes |
|-------|-----------|-------|
| **Root** | `Document` | Contains `openapi`, `info`, `servers`, `paths`, `components`, etc. |
| **PathItem** | `PathItem` (keyed by RFC 6570 uriTemplate string) | Children: pathItem-level `parameters`, `servers`, per-HTTP-method operations |
| **Operation** | `Operation` (keyed by HTTP method: GET, POST, DELETE, etc.) | Children: `parameters`, `requestBody`, `responses`, `security`, `tags`, etc. |
| **Parameter Slot** | Per-location map (query, path, header, cookie) within pathItem or Operation | Parameters keyed by name; collected by location per C004 |
| **Request Body** | `RequestBody` | Contains media-type-keyed schema and encoding; participates in signature analysis (C003) |
| **Response** | `Response` (keyed by status code or default) | Contains media-type-keyed schema; scope precedence resolved at runtime per C003/C011 |

**Optional Inheritance (`shared` wrapper):**
A pathItem or Operation MAY declare an optional `shared` map that carries name-based map-merge inheritance down its children (C012 #116 @0.55). Merge semantics (override vs. accumulate) are declared explicitly; inheritance does not apply to the `responses` field per this Candidate (response-level inheritance deferred to C012 #17b @0.62).

```yaml
paths:
  /users/{id}:
    shared:
      parameters:
        - name: api-version
          in: query
          required: true
    get:
      operationId: getUser
      parameters:
        - name: fields
          in: query
    delete:
      operationId: deleteUser
```

Above, both `get` and `delete` inherit the `api-version` parameter.

---

### 13.3 Abstract Description Surface (ADA)

The ADA is the layer tools inspect to resolve operation identity and collision status. It is **not a serialized format**; tools construct it from the DOM when needed. The ADA exposes:

#### 13.3.1 Signature Composition (C003)

A **signature** identifies an operation by composing zero or more of these aspects:

| Aspect | Type | Participation | Notes |
|--------|------|----------------|-------|
| `method` | HTTP verb | Always | GET, POST, DELETE, etc. |
| `uriTemplate` | RFC 6570 template string | Always | Path from pathItem key; variable parts treated distinctly from literals |
| `queryAspect` | Query parameters & literal values | Optional | Variables vs. literals distinguished; affects signature uniqueness (C005) |
| `contentTypeAspect` | Request Content-Type | Optional | From `requestBody` mediaTypes; used only if operation is POST/PUT/PATCH |
| `headerAspect` | Specified request headers | Optional | Deferred: full header signature model depends on C012 #108 (contested) |
| `bodyShapeAspect` | JSON Schema discriminant properties | Optional | Demoted to runtime last-resort (D1 from C003); not guaranteed statically determinable |

**Confidence ceilings:**
- Method + uriTemplate participation: **@>=0.85** (C003 #b)
- Body-shape discrimination: **@>=0.5–0.6** (D1, contested; demoted to runtime)
- Header-aspect signatures: **DEFERRED** (gated on C012 #108)

#### 13.3.2 Collision Analysis

When two operations share a method and uriTemplate path (but differ in content-type, headers, or body shape), the ADA computes a **collision verdict**:

```typescript
type CollisionVerdict
  = "provably-disjoint"        // Operations are statically distinguishable
  | "provable-collision"         // Operations definitely overlap (ambiguous)
  | "not-statically-determinable"; // Runtime dispatch required (D1 case)
```

The verdict is a **best-effort exposure**; it is **not** a validation gate. The ADA MUST surface the verdict so tools can decide whether to:
- Accept the collision and rely on request-time dispatch (most common)
- Reject the document as ambiguous
- Apply a tiebreaker (e.g., priority field, specificity ranking—left to the tool and deployment)

What to do about a collision (invalid vs. precedence vs. priority vs. strict-mode) is left **OPEN** and deferred to C003 resolution step (#20) and the per-operation collision-resolution policy (C003 #c, @>=0.5).

> ⚠ **Candidate @0.5–0.6**: Collision analysis and the tiebreaker policy are contested. The frame-level decision (detect-and-tolerate as a reporting mechanism) is high-confidence; the choice of what tooling does with a collision is OPEN.

#### 13.3.3 Matching and Correlating (Separated)

The ADA distinguishes two concerns:

1. **Matching** (request → operation): Given an HTTP request (method, path, headers, body), identify which operation(s) it corresponds to. The signature aspects guide this. Collision analysis reports ambiguity.

2. **Correlating** (request ↔ response): Given an operation and a request, determine which response schema applies (status code + content-type). Status-code specificity and media-type specificity use runtime tiebreakers.

These are **not unified**. The signature (C003) resolves matching; response scoping and precedence (C012 #17b @0.62) resolve correlating.

---

### 13.4 Signature Exposure: Schema & Example

When tools construct the ADA, they extract signatures as follows:

#### 13.4.1 Schema

```typescript
interface Signature {
  // Literal and variable path components
  method: string; // "GET", "POST", etc.
  uriTemplate: string; // "/users/{id}" (RFC 6570 syntax)
  
  // Optional aspects
  queryVariables?: string[]; // Names of distinguishing query params (not values)
  contentType?: string; // e.g., "application/json"
  headerNames?: string[]; // Header names used for dispatch (DEFERRED)
  bodyDiscriminant?: {
    propertyName: string;
    possibleValues?: string[]; // If statically determinable
  };
}

interface OperationIdentity {
  operationId?: string; // From the Operation object (optional in 4.0)
  signature: Signature;
  collisionVerdict: CollisionVerdict;
}
```

#### 13.4.2 Example

Given two POST operations with overlapping paths:

```yaml
paths:
  /users/{id}/emails:
    post:
      operationId: addUserEmail
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                action: { enum: ["add"] }
  /users/{id}/emails:
    post:
      operationId: removeUserEmail
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                action: { enum: ["remove"] }
```

The ADA produces:

```json
{
  "operations": [
    {
      "operationId": "addUserEmail",
      "signature": {
        "method": "POST",
        "uriTemplate": "/users/{id}/emails",
        "contentType": "application/json",
        "bodyDiscriminant": {
          "propertyName": "action",
          "possibleValues": ["add"]
        }
      },
      "collisionVerdict": "provable-collision"
    },
    {
      "operationId": "removeUserEmail",
      "signature": {
        "method": "POST",
        "uriTemplate": "/users/{id}/emails",
        "contentType": "application/json",
        "bodyDiscriminant": {
          "propertyName": "action",
          "possibleValues": ["remove"]
        }
      },
      "collisionVerdict": "provable-collision"
    }
  ]
}
```

The `collisionVerdict` is `"provable-collision"` for both because they share method, path, and content-type; distinguishing them requires runtime inspection of the `action` property. Tools MAY route requests using the `action` value or reject this document as ambiguous.

---

### 13.5 Conformance Model (Flat Spec, Optional Constructs)

The Candidate v4.0 does **not** define normative conformance tiers (Strict / Acceptable / Open). Instead:

#### 13.5.1 Mandatory Baseline

A conformant Candidate v4.0 **document** MUST:

- Use RFC 6570 uriTemplate strings for all paths (C005)
- Organize parameters by location (query, path, header, cookie) in per-location maps (C004)
- Assign a `name` to each parameter and reference it consistently within a scope (C009)
- If inheritance is used, declare merge semantics explicitly in the `shared` wrapper's resolution algorithm
- If response scopes are declared, apply additive composition for distinct responses (C012 #17b)

#### 13.5.2 Optional Constructs

The following are **optional**:

- `operationId` (coexists in Candidate v4.0; fate deferred to C003 step #20)
- Request-level schema inheritance via pathItem-level `shared` parameters (C012 #116 @0.55)
- Response-level inheritance via `shared` (DEFERRED to C012 #17b)
- Declared `signature` enumeration per operation (D2 from C003: optional authoring affordance only; normalized away by ADA)

> ⚠ **Candidate @0.55**: The `shared` inheritance wrapper is optional; migration-default remains flat-dict per-parameter. Merge semantics must be declared per-property; the general algorithm is defined normatively, but the specific merge behavior (override vs. accumulate per field) is part of the optional feature and tool-dependent.

#### 13.5.3 Profile and Labeling (Non-Normative)

Tools and communities MAY define **non-normative profiles** (e.g., "AsyncAPI Lite", "GraphQL-Interop Profile") that recommend or require specific subsets of optional constructs. Profiles are labeled via `x-profile` or similar extensions and serve as authoring guidance, not validation rules.

> ⚠ **Candidate @0.6**: Completeness levels (#18) and profile vocabulary are deferred to a future step (C012 #76). This Candidate does not specify a labeling vocabulary; communities may adopt their own.

---

### 13.6 Tooling Conformance (ADA Interface)

A **tool** that claims to conform to Candidate v4.0 (e.g., code generator, API gateway, client library) SHOULD:

1. **Parse** the DOM from the input YAML/JSON document.
2. **Construct** the ADA by extracting signatures, computing collision verdicts, and resolving inheritance (`shared` maps if present).
3. **Report** the collision verdict to the operator (whether the tool accepts, rejects, or applies a tiebreaker).
4. **Match** incoming HTTP requests to operations using the signature aspects.
5. **Correlate** request+operation pairs to the appropriate response schema (status code + content-type specificity).

Tools are **not required** to surface the ADA explicitly; internal ADA-like representation is sufficient. However, tools that **do** expose an ADA-shaped interface (e.g., programmatically queried operation identity or collision analysis) MUST follow the schema defined in §13.4.1.

> ⚠ **Candidate @>=0.85 (ADA concept) / @>=0.5–0.6 (collision tiebreaker policy)**: The ADA shape is high-confidence. The *action* a tool takes upon a collision is left OPEN and DEFERRED (C003 #c). This spec defines what the ADA must *expose*; deployment and tool design decide what to *do* with the collision verdict.

---

### 13.7 Deferred & Revisable Items

The following are explicitly left **OPEN** and DEFERRED pending future work:

| Item | Gated By | Notes |
|------|----------|-------|
| **Collision-resolution policy** | C003 step #20 | What to do (invalid vs. precedence vs. priority vs. strict-mode) is a separate decision, not part of this ADA exposure. |
| **Header-aspect signatures** | C012 #108 (contested) | Full header-model for routing/matching is deferred; currently only path/method/content-type are mature. |
| **Response-level inheritance** | C012 #17b @0.62 | The `shared` map does not yet reach responses; response-scope composition is partially deferred. |
| **Profile vocabulary & labeling** | C012 #76 @0.6 | Non-normative profiles and their naming scheme are DEFERRED. |
| **Completeness authoring guidance** | C011 #18 (deferred) | Authoring boilerplate, required-minimum-schema fields, and hand-author ergonomics are a separate axis (distinct from tiers) and deferred. |
| **operationId fate** | C003 step #20 | Whether operationId is mandatory, optional, or deprecated in 4.0 is OPEN; it coexists for now. |
| **Declared `signature` array** | C003 D2 @0.5–0.6 | Optional authoring affordance; normalization happens at the DOM→ADA boundary. |
| **JSON-Schema body discrimination** | C003 D1 @0.5–0.6 | Demoted to runtime last-resort; static guarantees are not made (flagged as contested). |

---

### 13.8 Serialization (DOM→ADA Boundary)

Serialization and deserialization of the ADA is **not** part of this specification. Tools construct the ADA from the DOM in memory. The DOM itself is serialized as YAML or JSON per the document rules (C001); the ADA remains an internal/API-level construct.

**Desugaring rule:** If a document uses optional shorthand (C012 #60/61 @0.6), the DOM parser MUST desugar it into the normative expanded form *before* constructing the ADA. Example:

```yaml
# Shorthand (optional)
parameters:
  - name: id
    in: path

# Desugared (normative)
parameters:
  path:
    id:
      name: id
      in: path
```

---

### 13.9 Worked Example: DOM → ADA → Request Routing

**Input document snippet:**

```yaml
openapi: "4.0-candidate"
info:
  title: Order API
  version: "1.0"
paths:
  /orders/{orderId}/items:
    get:
      operationId: listOrderItems
      parameters:
        path:
          orderId:
            name: orderId
            required: true
        query:
          includeDetails:
            name: includeDetails
            schema:
              type: boolean
    post:
      operationId: addOrderItem
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                productId: { type: string }
                quantity: { type: integer }
```

**Resulting ADA (simplified):**

```json
{
  "operations": [
    {
      "operationId": "listOrderItems",
      "signature": {
        "method": "GET",
        "uriTemplate": "/orders/{orderId}/items",
        "queryVariables": ["includeDetails"]
      },
      "collisionVerdict": "provably-disjoint"
    },
    {
      "operationId": "addOrderItem",
      "signature": {
        "method": "POST",
        "uriTemplate": "/orders/{orderId}/items",
        "contentType": "application/json"
      },
      "collisionVerdict": "provably-disjoint"
    }
  ]
}
```

**Request routing:**

- `GET /orders/42/items?includeDetails=true` → matches `listOrderItems` (method + path + query-variable presence)
- `POST /orders/42/items` with JSON body → matches `addOrderItem` (method + path + content-type)

Neither collision verdict fires because the methods differ; a tool can deterministically route both requests.

---

### 13.10 Notes on Future Extensions

- **Validation tiers** (Strict/Acceptable/Open) are not part of Candidate v4.0. Future work may adopt a profile system if the need is validated by real-world use.
- **Completeness guidance** for hand authors is deferred. Communities may document boilerplate patterns via overlays.
- **Header-signature aspects** will mature once the header model (#108) is settled in the SIG.
- **Response-level inheritance** will be added once the response-scope precedence model (#17b) is finalized.

---

## 14. Callbacks & Webhooks

*(Logically extends §4 Requests and §5 Responses. Resolves the gap surfaced by the upgrade capstone — see [C018].)*

> ⚠ **Candidate @0.55–0.6**: Originated — the SIG never designed this; it is a clean-room extension of the existing machinery. Provisional.

### 14.1 Webhooks

A **webhook** is an *incoming* operation the described API receives but does not host at one of its own paths (the sender owns the URL). Webhooks are a top-level `webhooks` map keyed by a friendly **name** (§1, C009), each entry a Request/Response shape (§4–5) carrying a signature (§3).

| Field | Type | Required | Description |
|---|---|---|---|
| `webhooks` | Map[name → Webhook Object] | MAY | Incoming operations not bound to a server uriTemplate. |

A Webhook Object reuses the Operation shape (§1.4) — `method`, `parameterSchema`, `contentType`/`contentSchema`, `responses` — but has no uriTemplate key (the recipient does not own the URL).

```yaml
webhooks:
  newSpeaker:
    method: post
    contentType: application/json
    contentSchema: { $ref: "#/components/schemas/speaker" }
    responses:
      ok: { status: 200 }
```

### 14.2 Callbacks

A **callback** is an out-of-band request the API *sends* in response to an operation, to a URL supplied at runtime. Each operation MAY carry a `callbacks` map keyed by a friendly **name**; each callback is keyed internally by a **runtime expression** (e.g. `{$request.body#/callbackUrl}`) whose value is a pathItem-shaped definition (§1.3). The runtime-expression key is resolved at runtime from request/response data — it is **not** part of the static signature matcher (§3; D1-consistent).

```yaml
operations:
  createSubscription:
    method: post
    callbacks:
      onEvent:
        "{$request.body#/callbackUrl}":
          requests:
            event: { method: post, contentSchema: { $ref: "#/components/schemas/event" } }
```

> ⚠ **Deferred**: the exact runtime-expression grammar (3.x used `{$request.body#/x}`); and the broader async/event-driven/streaming space (AsyncAPI overlap) is **out of scope** for this candidate's HTTP core.

---

---

## A. Tooling Profile (provisional buildable defaults)

> ⚠ **Candidate @0.55–0.62 — PROVISIONAL BUILDABLE DEFAULTS, NOT RATIFIED GRAMMARS.** This appendix pins concrete, implementable defaults for four surfaces that C003/C005/C013 deferred at the byte-grammar level but that tool authors need to build interoperable tooling. They do NOT override those deferrals; they are the default the spec RECOMMENDS until a ratified grammar lands (#26/#49/#72/#73, #100/#108, signature-key residual #7). Each is fully revisable. Source: ADR C019.
>
> **Base-document reconciliation prerequisites** (this appendix assumes these are applied to the normative body): (1) one canonical OpenAPI reference emitter `#/components/<type>/<name>` — the no-prefix `#/schemas/...` and dot/colon forms in §5/§8 are illustrative only; (2) §6.4's "an OAS-level reference mechanism is NOT introduced" clause is struck (§8 introduces it, per C013 #49); (3) per-location slots are named `parameterSchema.{query,path,header,cookie,body}` (the §7 `headerSchema`/`cookieSchema` spelling is an alias to be reconciled); (4) §2.4's URL input is split on unescaped `/` BEFORE percent-decoding each segment.

### A.1 Reference resolution (write + resolve)

Two reference surfaces, disjoint by host context, distinguished by **token + slot** (never tree-depth, C013 #49):

| Surface | Where it appears | Token | Canonical emitter form | Resolution |
|---|---|---|---|---|
| **OpenAPI Reference Object** | non-Schema reuse: responses, requests, links, parameters, securitySchemes, tags, examples | `{$ref: ...}` (+ optional `summary`/`description`) | `#/components/<type>/<name>`, `#/paths/<esc-uriTemplate>/...`, `#/tags/<name>` | same-document JSON-Pointer, by **NAME** (C009) |
| **JSON-Schema `$ref`** | inside any Schema Object: `contentSchema`/`body`, `parameterSchema.*`, `components/schemas/*`, `$defs`/`items`/`properties`/`allOf`/… | `$ref` (2020-12 keyword) | `#/components/schemas/<name>` **or** `#<name>` (implicit anchor) | the declared 2020-12 dialect evaluator |

**Tie-break (the `body`/`contentSchema` ambiguity):** a `$ref` in any slot whose declared type *includes* Schema Object is **always** the JSON-Schema keyword, regardless of companion keys — never the Reference Object.

**Pointer escaping:** tokens are RFC6901-escaped ONLY (`~0`=>`~`, `~1`=>`/`); the `#/...` is a JSON Pointer and is **NOT** re-percent-encoded as a URI fragment — braces stay literal. Worked example: pathItem key `/pets/{petId}` is referenced as `#/paths/~1pets~1{petId}` (not `…~1%7BpetId%7D`).

```
RESOLVE(ref, host, doc):
  SCHEMA_OBJECT_SLOTS = { contentSchema, body, parameterSchema.{query,path,header,cookie,body},
                          components.schemas.*, and anything transitively inside one }
  kind = host ∈ SCHEMA_OBJECT_SLOTS ? JSON_SCHEMA_REF
       : host has "$ref" (+ only summary/description) ? REFERENCE_OBJECT : error
  ABNF: ref = [import-ns ":"] [doc-uri] "#" json-pointer ; json-pointer per RFC6901
        import-ns = 1*(ALPHA/DIGIT/"-"/"_")             ; C013 #72, byte-grammar DEFERRED
  if import-ns present: doc = resolve_import(import-ns)  // location only; no mandatory I/O
  if JSON_SCHEMA_REF and ref == "#<name>": return schema whose implicit anchor == <name>
  unescape tokens (~1->'/', then ~0->'~')
  if pointer == /components/<type>/<name>:
     t = doc.components[type][name]; if absent: error(missing)   // by KEY; MUST NOT fall back to positional
     return t
  if pointer == /paths/<tmpl>/...: return walk(doc.paths[unescape(tmpl)], rest)
  if pointer == /tags/<name>:      return doc.tags[name]
  if JSON_SCHEMA_REF: return dialect.resolve(ref, host)
```

### A.2 Canonical signature key + collision predicate

The ADA computes a tooling-internal **matcher/dedup/collision key** (not a DOM field, C003(a)). Fixed aspect order `(method, path, queryKS, ctypeSet, headerAS, bodyId)`:

```
CANONICAL-SIGNATURE(request, pathItem):
  method   = uppercase(request.method)
  path     = pathItem.key                             // LITERAL uriTemplate (C009 map key) — NOT var-name-erased
  queryKS  = sorted_dedup(Tier-Q query var-names)      // key-set, values excluded (C005 D3)
  ctypeSet = sorted_dedup(map(strip_params∘lowercase, asArray(request.contentType))) or ['*']  // params stripped (C016)
  headerAS = sorted_dedup(lowercase(name) for identity-participating headers) or ['*']  // C015/#224; best-effort #108
  bodyId   = $ref ? canonical_ref_string : inline ? '#inline' : '*'   // SENTINEL, never a structural hash
  key = 'M='+method+'|P='+path+'|Q='+join(',',queryKS)+'|C='+join(',',ctypeSet)+'|H='+join(',',headerAS)+'|B='+bodyId
```

Normalization (byte-identical across emitters): sets sorted by Unicode code point + deduped; non-participating aspect => `'*'`; path preserves var spelling (name-erasure is overlap-test-only).

```
COLLISION(a,b):  // C003 three-valued verdict, report-not-gate
  ctypeSet:  MEDIA-DISJOINT(no a∈A,b∈B co-satisfy; ranges & C016-equivalents are NON-disjoint) ? provably-disjoint : UNDECIDED
  bodyId:    a or b == '#inline' -> UNDECIDED        // D1: JSON-Schema discrimination is runtime last-resort
  headerAS:  #108 incomplete    -> UNDECIDED
  other:     both concrete & cannot co-satisfy -> provably-disjoint
  any UNDECIDED -> not-statically-determinable ; else provable-collision
```

Collision **policy** (invalid vs precedence vs priority vs strict-mode) stays OPEN (C003).

### A.3 Query / header / cookie evaluative deserialization

Deserialize the raw request into the JSON instances the `parameterSchema.{query,header,cookie}` slots validate. Coercion is **slot-driven, type-category** (integer+number => JSON number; integer-ness left to validation).

```
QUERY  (form-style):  strip '?'; split on '&'; split each pair on FIRST '='; DECODE AFTER splitting ('+' -> SP)
        repeated key -> array (wire order); single key -> scalar string
        bare key '?flag' (no '=') -> true iff slot type boolean, else ''
        absent slot -> all-strings instance, NO coercion
HEADER: lowercase names (C015/#224 MUST); comma-split/combine ONLY for fields the §7.2 fieldModel registry
        marks list-of-values (RFC9110 §5.6.1) — non-list fields (date, user-agent, quoted commas) preserved VERBATIM
COOKIE: parse 'cookie' header (RFC6265) into name->string; coerce if slot present
UNKNOWN keys (additionalProperties:true is the C004 default): included in wire form, uncoerced
COERCE: numeric -> Number(v) if JSON-number; boolean -> true/false from true|1 / false|0; array -> wrap singleton;
        union/oneOf/anyOf -> coerce iff a branch permits numeric/boolean, else leave string
DETERMINISM: identical raw input + slot schema + fieldModel registry => identical JSON instance
```

> ⚠ Only **form-style** is pinned here; `deepObject`/`spaceDelimited`/`pipeDelimited` are left for the ratified #100/#108 grammar.

### A.4 uriTemplate match / reverse-parse profile

Three operator tiers (C005) + validate/compile/reverse-parse:

| Tier | Operators | Use |
|---|---|---|
| **1 MATCH-SAFE** | literal; `{id}` (one segment, excl. `/ ? #`); `{+path}` = CAPTURE_REST (terminal, multi-segment); `;name={id}` (matrix) | path identity |
| **2 QUERY-ONLY** | `{?a,b}`, `{&x,y}` | query, parsed as order/repetition-insensitive key-set |
| **3 FORBIDDEN** | `{x*}`, `{+x*}`, non-boundary `{+x}`, `{#x}`, `{.x}`, `{x:2}`, regex, list/comma-scalar var | author error / `not-statically-determinable` |

```
VALIDATE-PROFILE: '{+var}' is Tier-1 IFF it is the entire final segment AND terminal AND single scalar
   '/files/{+path}' -> Tier1 ; '/files/prefix{+path}' -> Tier3 ; '/a/{+path}/b' -> Tier3
REVERSE-PARSE(urlPath, Paths):
   urlSegs = split(urlPath, unescaped '/').map(pctDecodeSegment)   // SPLIT first, decode each segment
   // '%2F' stays inside a segment -> '/files/a%2Fb' is 2 segments, not 3
   candidates = templates whose COMPILE matches urlSegs (CAPTURE_REST consumes the tail)
   if 0 -> (null,{}); if 1 -> it; else sort by specificity DESC -> top  (+ emit C003 verdict)
specificity (over the TEMPLATE, not the matched portion):
   CAPTURE_REST always ranks LAST; else count LITERAL segments, tie-break per-segment literal>var left-to-right
```

Worked: URL `/files/readme.txt` against `{/files/{+path}, /files/{id}/versions, /files/readme.txt}` routes to the literal (CAPTURE_REST loses); `/files/a/b` routes to `/files/{+path}` (path=`a/b`). Overlap (`/users/me` vs `/users/{id}`) is a C003 verdict + runtime concrete-over-variable tiebreak, never document order (C009).

> ⚠ Slash-bearing single-value path params remain INEXPRESSIBLE in this profile (the price of deterministic reverse-parse, C005).
