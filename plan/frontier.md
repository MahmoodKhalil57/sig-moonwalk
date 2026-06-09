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
- OPEN #127 — Path templating: URI Template vs WHATWG URLPattern
- OPEN #17 — Author-defined merge order and precedence
- OPEN #83 — Responses should be an array, not a map
- OPEN #116 — Inheritance on paths and sublevels
- OPEN #119 — Allow recursive paths
- OPEN #30 — Resource-oriented modeling
- OPEN #31 / #100 — Validation / interdependencies across parameters
- OPEN #24 — Arithmetic & relational inter-parameter dependencies (readability)
- OPEN #32 — Objects → arrays
- OPEN #57 — Replace or remove discriminator
- OPEN #60 / #61 — Shorthand for requests & responses; `post /foos/{id}` form
- OPEN #79 — `archetype` field for paths
- OPEN #108 — Modeling HTTP fields (headers/trailers)
- OPEN #163 — Media type parameters
- OPEN #209 — Describing the `Set-Cookie` header
- OPEN #224 — `patternProperties` in signatures (dynamic transport keys)
- OPEN #58 — Improvements for links
- OPEN #56 — Context property annotations
- OPEN #49 / #26 — Rename `$ref`; references as JSON pointers not names
- OPEN #54 — Inline schemas vs client codegen
- OPEN #42 / #202 — Examples for whole operation; examples encoded as strings
- OPEN #113 — Schema/parameter default value
- OPEN #45 — Newer HTTP versions (2/3)
- **URL→uriTemplate ambiguity** — initial-proposal's explicit named open problem
- **Equivalent media types** (`text/json` vs `application/json`) — initial-proposal noted as cumbersome

## Content schema formats — MEDIUM prior (medium horizon)

- OPEN #120 — SHACL as alternative to JSON Schema
- OPEN #122 — Implementor feedback on Alternative Schemas draft
- OPEN #124 — Import datatype declarations from XSD
- OPEN #73 — Handling JSON Schema referencing in Moonwalk
- OPEN #163 — Media type parameters (overlaps API shapes)

## Deployment configuration — LOW prior → Originated (long horizon)

- OPEN #55 — Multiple servers across environments
- OPEN #19 — Well-known URI for discovery
- OPEN #43 — Rate limits
- OPEN #102 — Retry policy & timeout per operation
- OPEN #69 — Separation of concerns: Auth
- OPEN #75 / #84 / #50 — Deprecate security schemes; OAuth scope docs; template paths in security

## Foundational interfaces — LOW prior → Originated (long horizon)

- OPEN #18 — Levels of completeness
- OPEN #76 — Organize spec into tiers
- OPEN #141 — Functional areas
- OPEN #72 — Imports proposal
- OPEN #128 — Modularity: rich text formatting
- OPEN #172 — Native rule-suppression mechanism
- OPEN #82 — Versioning not always at API granularity
- OPEN #63 — Consumer-optimized form of OpenAPI descriptions
- OPEN #130 — Use cases for OpenAPI

## Mechanical upgrade (3.x→4.0) — LOWEST prior → fully Originated (long horizon)

- OPEN — automated upgrade process (Principle 6); no dedicated discussion yet — clean-room.

## Resolved

- RESOLVED #59 — IRI support → Inherited from SIG ADR 0002 → `plan/facts/0002-iri-inherited.bn`
- RESOLVED #16 — Signature mechanism → Deviation set (C003) → `plan/facts/0016-signature-mechanism.bn`
- RESOLVED #20 — parameterSchema split → per-location slots + opt-in (C004) → `plan/facts/0020-parameter-schema.bn`

> Full discussion text for any `#N` is in [github-export/discussions/](../github-export/discussions/).
