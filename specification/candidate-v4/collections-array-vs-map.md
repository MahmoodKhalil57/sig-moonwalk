<!-- PROJECTION from plan/facts/0083-array-vs-map.bn + ADR C009. Candidate-fork, NOT official OpenAPI text. -->

# Projection stub — #83/#32 array-vs-map (wire-shape sketch, NON-NORMATIVE)

This is a sketch of the committed shape for downstream tooling, gated on the deferred identification redesign. Not a normative spec fragment.

## Open user-keyed collections stay MAPS (friendly-name keys, status as a field)

```yaml
paths:                       # MAP keyed by RFC6570 uriTemplate (C005)
  "speakers":
    requests:                # MAP keyed by friendly request name
      createSpeaker:
        method: post
        contentType: application/json
        contentSchema: { $ref: "#schemas.Speaker" }   # by-NAME ref, never by index
        responses:           # MAP keyed by friendly response name; status is a FIELD
          created:
            status: 201
          # optional presentation order, absent-by-default (lowered-ceiling hybrid):
          # created: { status: 201, order: 10 }
    pathResponses:
      notFound: { status: 404, contentType: application/http-problem }
apiResponses:
  serverError: { status: "5XX", contentType: application/http-problem }
```

## #20 per-location slots stay a FIXED-KEY STRUCT (C004)

```yaml
# closed 5-member vocabulary; single body needs no wrapper, no invented key
query:  { type: object, properties: { } }
path:   { type: object, properties: { } }
header: { }
cookie: { }
body:   { $ref: "#schemas.CreateSpeaker" }
```

## Root tags FLIP array -> keyed object (the one deviation)

```yaml
# 3.2 (array, #/tags/1 is reorder-fragile):
# tags: [ { name: speakers, description: ... } ]
# v4 (keyed, enables $ref-to-tag):
tags:
  speakers: { description: ..., kind: ... }
```

## Referencing rule (decided now)

- Refs resolve by stable NAME, never by array index, never by map-insertion order.
- `#/components/...` by-key JSON Pointers keep resolving (components stays a map).
- The fragment SYNTAX (`#schemas.Foo` type+name, #72 namespace:componentName, whether internal JSON Pointers survive) is DEFERRED to #26/#49/#72/#73 — the `#schemas.Speaker` form above is illustrative only.

## What is explicitly NOT decided here

- The deep identification/referencing redesign (gates the full verdict).
- The collision-resolution policy (if order-based, the affected collection flips to array).
- The deep tag model (charset, multi-purpose, namespacing).
- The exact spelling of name-carrying reuse for the #83 keyless-inline-$ref case.