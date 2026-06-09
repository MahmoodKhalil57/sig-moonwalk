<!--
  PROJECTION — generated from the ledger, not hand-maintained as source of truth.
  Source of truth: plan/facts/0020-parameter-schema.bn + ADR C004.
  Candidate-fork artifact, NOT official OpenAPI text. Confidence noted per claim.
-->

# #20 Projection stub — parameter/header/body schema expression (per-location slots + opt-in cross-cutting)

> Indicative shapes; final key spelling, deserialization details, and dialect deferred to the SIG (#73/#127). RUNTIME validation only — NOT a static matcher.

## Common case — per-location slots over already-typed slices
```yaml
request:
  method: POST
  contentType: application/json
  # URL/query params — plain JSON Schema over the query slice (default location)
  parameterSchema:        # a.k.a. query slot; flat top-level props as today
    type: object
    properties:
      promote:     { type: boolean }
      answerCount: { type: integer }
    anyOf:                # same-location dep — standard JSON Schema, no unification needed
      - not: { required: [promote] }
      - required: [answerCount]
  # path params — own slot (parsed against the uriTemplate, #127)
  pathParamSchema:
    type: object
    properties: { speakerId: { type: string } }
  # headers — own slot; values massaged per #108 registry; tooling MUST lowercase keys (#224)
  headerSchema:
    type: object
    additionalProperties: true     # default true so implicit Host/User-Agent don't falsely reject (#224)
    properties:
      if-match: { type: string }
  # cookies — own slot (first-class per #224)
  cookieSchema:
    type: object
    additionalProperties: true
  # body — the existing slot, unchanged
  contentSchema:
    type: object
    properties: { id: { type: string } }
```
A real URL query param literally named `body` or `headers` lives at `parameterSchema/properties/body` — **no collision** with any region.

## Rare case — opt-in cross-cutting construct (handrews envelope SHAPE, grafted only here)
```yaml
request:
  # ... per-location slots as above ...
  crossDependencies:               # OPTIONAL; absent => no cross-type constraint (the common case)
    # tooling materializes a synthetic {parameters, headers, body} envelope ONLY to evaluate this
    allOf:
      # (a) PRESENCE-based cross-type dep — standard JSON Schema 2020-12, works today:
      - if:   { properties: { parameters: { required: [id] } } }
        then: { properties: { body:       { required: [id] } } }
      # (b) VALUE-EQUALITY cross-type dep (PUT path-ID == body-ID) — the forcing case.
      #     NOT standard vocab; needs a Relative-JSON-Pointer 'equals' keyword. DEFERRED to #73.
      - properties:
          body:
            properties:
              id: { equals: "2/parameters/id" }   # relative JSON pointer; vocabulary = #73
```

## D1 boundary (binding)
- All of the above is RUNTIME validation, scoped "once filtered by method and content-type" (README L63). It is NOT compiled as the guaranteed static disambiguation contract. The static matcher remains C003's method → content-type → three-valued detect-and-tolerate.
- Cross-type value-equality is instance-data-dependent (Relative JSON Pointer evaluates the live instance) — it is the canonical "schema-dependent / not-statically-collision-checked" last-resort and cannot be a static gate even in principle.

## Open / deferred before ratification
- Evaluative mapping: query-string→object (Hudlow), header model (#108), cookies placement, `query.x` vs `x` deserialization (karenetheridge #100 c5).
- #127 templating; #73 dialect + Relative-JSON-Pointer vocabulary.
- Final slot-key names and whether query gets a sub-grouping level.