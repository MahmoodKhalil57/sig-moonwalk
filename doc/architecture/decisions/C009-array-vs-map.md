# C9. Frontier #83/#32: user-keyed collections stay map/struct by identification-first routing

> **Provenance:** Candidate-fork ADR — a decision of *this fork effort* (Suluk), not of the OpenAPI Moonwalk SIG. Resolves frontier **#83** (a dup of #25 → the live umbrella **#32**). Ledger: [`plan/facts/0083-array-vs-map.bn`](../../../plan/facts/0083-array-vs-map.bn) · evidence: [`0083-array-vs-map.synthesis.md`](../../../plan/facts/0083-array-vs-map.synthesis.md). Workflow `wf_72360ada-66c` (council-integrated); ceilings mizan-gated.

Date: 2026-06-09

## Status

Accepted as a Suluk candidate (priors-with-ceilings) at a deliberately lowered ceiling. Frontier #83 ("Responses should be an array, not a map") was closed by handrews as a duplicate of #25 and redirected to the live umbrella #32 ("Consideration for moving from objects to arrays"), which remains OPEN with no SIG vote and no ADR. This resolution is therefore a CANDIDATE, not a ratification.

## Context

The operative question is whether OAS v4 user-keyed collections (responses, requests, paths, and the #20 per-location slots) should be JSON ARRAYS-of-named-objects or JSON MAPS with dynamic keys. The SIG initial-proposal models all four as named MAPS (`doc/initial-proposals/README.md:57-113`), so MAP is the inherited prior.

handrews' most-developed comment (#32 c10, 2024-07-29, verified verbatim at `discussions/0032.md:413-452`) REFRAMES the question: array-vs-map "falls out of" how an OAD identifies things. He decomposes the tangle into five sub-questions (identification model, tags, mandatory/optional names, mandatory/optional ordering, reuse-includes-name) and closes: "Choosing objects or arrays should be about solving some sort of problem... figure out whether there are already better alternatives." This reframe is the most load-bearing structural insight in the corpus and is a DEFERRAL device, not a verdict.

## Decision

**Adopt the IDENTIFICATION-FIRST frame and keep the MAP default for the open collections at a lowered ceiling — do NOT flip to arrays, do NOT harden the map into a permanent verdict.**

1. **Non-deferrable rule, decided now:** references into user-keyed collections resolve **by stable NAME, never by array index and never by map-insertion order**. Under name-based identity an array-of-named-objects and a map-of-named-objects are referentially equivalent, so this rule does not pre-commit the wire shape. The fragment SYNTAX is deferred.
2. **paths** stay a MAP keyed by the RFC6570 uriTemplate (C005 — the key is the reverse-parse matcher input; a uriTemplate is not a component-name charset id).
3. **requests / responses / pathResponses / apiResponses** stay NAMED MAPS keyed by friendly name with status as a field. The #16 matcher keys on the signature tuple and never consumed the name, so the container is matcher-irrelevant. Responses carry the lowest ceiling (the literal #83; thread tilts pro-list); the array door is left open on the reuse residual.
4. **#20 per-location slots** {query, path, header, cookie, body} stay a FIXED-KEY STRUCT unconditionally (C004 — closed 5-member vocabulary; single body stays `body: <schema>`).
5. **components** stay a dynamic-key MAP (referencing anchor; schema-bearing).
6. **root tags** FLIP array→map for $ref-to-tag (the single container deviation; receipted by arno-di-loreto `discussions/0026.md:91-96`; lowered ceiling because the deeper tag model is unresolved).

### handrews' five sub-questions, answered just enough

- **Q1 identification:** decide the by-name rule now; defer the syntax (#26/#49/#72/#73).
- **Q2 tags:** become keyed for referenceability; charset/multi-purpose model deferred.
- **Q3 names:** mandatory-and-unique via the map KEY; bare/sugar form for the genuinely-anonymous single case; optional-anonymous names rejected for multi-entry.
- **Q4 ordering:** optional, absent-by-default `order` field on map entries (handrews' own hybrid), at a lowered ceiling — not positional semantics.
- **Q5 reuse:** identity is the component name and travels via name-based refs; the #83 keyless-inline-$ref residual is genuinely unpaid by maps and recorded OPEN.

## Why not BLANKET-ARRAYS

Killed by two fatal refutations. (a) Its spec-defined name-derivation (status→response name, method→request name) is **non-injective on v4's own headline feature** — multiple responses per status / multiple requests per method (`README:61,66`; handrews `0032.md:438`) — so two migrators collide on the derived name and violate the candidate's own MUST-unique rule, precisely where v4 added expressiveness. (b) Its "paths must be arrays because first-match-wins needs key-order" mandate is **fabricated**: the #16/#127 matcher resolves overlap by concrete-over-variable specificity at runtime, never by document/key order (`plan/facts/0016-signature-mechanism.bn:45-46`; `0127`). The C003 "order-significant ⇒ array" caveat is a guard that fires vacuously here.

## Consequences

- The model stays MIXED (as 3.x already is) but principled: map for open user name-spaces, struct for the closed slot vocabulary, map for the JSON-Schema-referencing component store; the tags flip reduces idiom-divergence.
- Migration is lossless for the collections that are already maps; the $ref graph (`#/components/responses/NotFound`, `#/paths/~1pets`) is preserved.
- The full verdict is GATED on the deferred identification/referencing redesign; the wire shape is not hard-committed. If the SIG later picks an order-based collision policy, the affected collection would flip to array (latent, not active).
- The genuine pro-array residual (the #83 keyless-$ref reuse) is the explicit reason the responses ceiling stays low and the door stays open.

## Provenance

Inherited from the SIG map default and binding priors C003/C004/C005; deviations (tags flip, name-mandatory-via-key, optional order field) each carry a receipt and a lowered ceiling. Ledger: `plan/facts/0083-array-vs-map.bn`.