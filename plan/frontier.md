# Frontier — the open-question set

The walk's work-list, seeded from the **actual SIG record** (52 Ideas + open issues + the
initial-proposal's named open problems). Each step pops one question, resolves it to an
Inherited prior or a Deviation (receipt + `plan/facts/*.bn`), and updates the spine.

Status legend: `OPEN` · `INGESTED` (classified, prior-map written) · `RESOLVED` (ledger entry exists)
Prior-richness drives ordering: resolve HIGH-prior questions first (highest ceilings, cheapest),
push LOW-prior (Originated) questions to the long horizon.

## API shapes — HIGH prior (do first; short→medium horizon)

- RESOLVED #16 — Signature mechanism → **C003** (ADA-first frame; 3 deviations; #20/#127 deferred) → `plan/facts/0016-signature-mechanism.bn`
- RESOLVED #20 — One `parameterSchema`? → **C004** (per-location slots + opt-in cross-cutting; D1-safe) → `plan/facts/0020-parameter-schema.bn`
- OPEN #23 — Can we simplify paths further?
- RESOLVED #127 — Path templating → **C005** (RFC6570 parseable profile + normative grammar/reverse-algorithm; D1-safe) → `plan/facts/0127-templating-system.bn`
- RESOLVED #17 — *(document merge / multi-file composition)* → **C008** out-of-scope, defer to Overlay Spec + tooling → `plan/facts/0017-merge-scope.bn`
- RESOLVED(C012-waveA) **#17b (split-out)** — Response-level precedence: apiResponses vs pathResponses vs request-level responses; `parameterSchema` `allOf` composition across pathItem+request. *(The real precedence question, conflated with #17 in the original spine; now distinct.)*
- RESOLVED #83 / #32 — collections array-vs-map → **C009** keep map/struct (identification-first; refs by-name-not-index; tags flip array→map) → `plan/facts/0083-array-vs-map.bn`
- RESOLVED(C012-waveA) #116 — Inheritance on paths and sublevels
- RESOLVED(C011-batch) #119 — Allow recursive paths
- OPEN #30 — Resource-oriented modeling
- RESOLVED(C014) #31/100 — Validation / interdependencies across parameters
- RESOLVED(C014) #24 — Arithmetic & relational inter-parameter dependencies (readability)
- RESOLVED #32 — Objects → arrays *(umbrella for #83)* → kept map/struct (C009) → `plan/facts/0083-array-vs-map.bn`
- RESOLVED(C012-waveA) #57 — Replace or remove discriminator
- RESOLVED(C012-waveA) #60/61 / #61 — Shorthand for requests & responses; `post /foos/{id}` form
- RESOLVED(C011-batch) #79 — `archetype` field for paths
- OPEN #108 — Modeling HTTP fields (headers/trailers)
- OPEN #163 — Media type parameters
- RESOLVED(C011-batch) #209 — Describing the `Set-Cookie` header
- RESOLVED(C011-batch) #224 — `patternProperties` in signatures (dynamic transport keys)
- RESOLVED(C012-waveA) #58 — Improvements for links
- OPEN #56 — Context property annotations
- RESOLVED(C013) #49/#26 — Rename `$ref`; references as JSON pointers not names
- RESOLVED(C011-batch) #54 — Inline schemas vs client codegen
- RESOLVED(C011-batch) #42 / #202 — Examples for whole operation; examples encoded as strings
- OPEN #113 — Schema/parameter default value
- RESOLVED(C012-waveA) #45 — Newer HTTP versions (2/3)
- **URL→uriTemplate ambiguity** — initial-proposal's explicit named open problem
- **Equivalent media types** (`text/json` vs `application/json`) — initial-proposal noted as cumbersome

## Content schema formats — MEDIUM prior (medium horizon)

- RESOLVED(C011-batch) #120 — SHACL as alternative to JSON Schema
- RESOLVED(C014) #122 — Implementor feedback on Alternative Schemas draft
- RESOLVED(C011-batch) #124 — Import datatype declarations from XSD
- RESOLVED(C013) #73 — Handling JSON Schema referencing in Moonwalk
- OPEN #163 — Media type parameters (overlaps API shapes)

## Deployment configuration — LOW prior → Originated (long horizon)

- OPEN #55 — Multiple servers across environments
- RESOLVED(C011-batch) #19 — Well-known URI for discovery
- RESOLVED(C012-waveA) #43 — Rate limits
- RESOLVED(C011-batch) #102 — Retry policy & timeout per operation
- RESOLVED(C014) #69 — Separation of concerns: Auth
- RESOLVED(C011-batch) #75 / #84 / #50 — Deprecate security schemes; OAuth scope docs; template paths in security

## Foundational interfaces — LOW prior → Originated (long horizon)

- RESOLVED(C011-batch) #18 — Levels of completeness
- RESOLVED(C012-waveA) #76 — Organize spec into tiers
- RESOLVED(C011-batch) #141 — Functional areas
- RESOLVED(C013) #72 — Imports proposal
- RESOLVED(C011-batch) #128 — Modularity: rich text formatting
- RESOLVED(C011-batch) #172 — Native rule-suppression mechanism
- RESOLVED(C012-waveA) #82 — Versioning not always at API granularity
- RESOLVED(C011-batch) #63 — Consumer-optimized form of OpenAPI descriptions
- RESOLVED(C011-batch) #130 — Use cases for OpenAPI

## Mechanical upgrade (3.x→4.0) — LOWEST prior → fully Originated (long horizon)

- OPEN — automated upgrade process (Principle 6); no dedicated discussion yet — clean-room.

## Resolved

- RESOLVED #59 — IRI support → Inherited from SIG ADR 0002 → `plan/facts/0002-iri-inherited.bn`
- RESOLVED #16 — Signature mechanism → Deviation set (C003) → `plan/facts/0016-signature-mechanism.bn`
- RESOLVED #20 — parameterSchema split → per-location slots + opt-in (C004) → `plan/facts/0020-parameter-schema.bn`
- RESOLVED #127 — templating → RFC6570 parseable profile (C005) → `plan/facts/0127-templating-system.bn`
- RESOLVED #17 — document merge → out-of-scope, defer to Overlay Spec (C008) → `plan/facts/0017-merge-scope.bn`

> Full discussion text for any `#N` is in [github-export/discussions/](../github-export/discussions/).
