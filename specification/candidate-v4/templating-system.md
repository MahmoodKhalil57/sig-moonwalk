<!--
  PROJECTION — generated from the ledger, not hand-maintained. Source of truth:
  plan/facts/0127-templating-system.bn + ADR C005. Candidate-fork artifact, NOT official OpenAPI text.
-->

PROJECTION — generated from the ledger, not hand-maintained as source of truth. Source of truth: plan/facts/0127-templating-system.bn plus ADR C005. Candidate-fork artifact, NOT official OpenAPI text. Confidence noted per claim.

# #127 Projection stub — path/URI templating (RFC6570 parseable profile)

Indicative shapes; the normative grammar plus reverse-parse algorithm are REQUIRED artifacts (not yet written). The query/header evaluative mapping is gated on #108. RUNTIME matching/extraction — fed into #16 ADA and #20 per-location slots.

## Surface — RFC6570 var curly-brace keys, constrained
- MATCH-SAFE: literal plus single-segment var (3.x charset) — the 3.x identity case, e.g. key speakers-slash-speakerId.
- MATCH-SAFE: name-bearing matrix — self-disambiguating (the param NAME is in the path), e.g. key pets with a name-bearing-matrix petId.
- QUERY-ONLY: form-query in the query component, parsed order/repetition-insensitive, e.g. key search with a form-query q and page.

## Forbidden in path-identity (authoring error, or to not-statically-determinable)
- explode — non-injective.
- multi-segment explode — non-injective (greedy arity).
- reserved — passes slash/question/hash unencoded, undecidable right boundary.
- fragment — same.
- label — delimiter collides with adjacent literal.
- prefix-truncation — irreversibly lossy (RFC6570 2.4.1).
- arbitrary regex group — regex-intersection footgun (opaque runtime refinement only).
- list/composite var — comma-join collides with a scalar value (RFC6570 3.2.2).

## Recognition (REQ-1) and extraction (REQ-2 path half)
For URL /speakers/42: split on slash into speakers and 42; match the literal speakers; bind the var speakerId to 42 into the #20 path slot; route to exactly one operation (or zero) per #16 route-to-zero-or-one.

## Ambiguity to split, not patched
PARSE-ambiguity is ELIMINATED — every path is segment-aligned, so URL-to-template is single-valued. OPERATION-collision is EXPOSED to #16 — /users/{name} vs /users/me is a three-valued verdict (here provable-collision), resolved at RUNTIME by concrete-over-variable; NOT a parse failure; collision POLICY stays open per #16.

## Required normative artifacts (NOT yet written)
- An observable-behavior GRAMMAR of the profile (answers handrews #127 c2; not browser pseudocode).
- A normative REVERSE-PARSE algorithm (segment-split; per-segment capture; Tier-Q as an order-insensitive key-set).

Deferred: #73 dialect, per-segment exposure (#16/#119/#23), #108 query/header evaluative mapping, query-placement-in-template-vs-slot.