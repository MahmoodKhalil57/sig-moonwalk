# C4. Frontier #20: per-location schema slots + an opt-in cross-cutting dependency construct

> **Provenance:** Candidate-fork ADR — a decision of *this fork effort* (Suluk), not of the OpenAPI Moonwalk SIG. Resolves frontier **#20**. Ledger: [`plan/facts/0020-parameter-schema.bn`](../../../plan/facts/0020-parameter-schema.bn) · evidence: [`0020-parameter-schema.synthesis.md`](../../../plan/facts/0020-parameter-schema.synthesis.md). Synthesized by workflow `wf_643fa7fa-215` (17 agents); ceilings are mizan-gated.

Date: 2026-06-09

## Status
CANDIDATE (priors-with-ceilings posture). No SIG ADR/vote exists for #20; the 2022 thread went dormant 2022-10-05. Ceiling lowered accordingly. Pairs with the #20 ledger `plan/facts/0020-parameter-schema.bn`. Binding prior: ADR C003 / `plan/facts/0016-signature-mechanism.bn` (Deviation D1).

## Context
Frontier #20 asks how request parameters/headers/body are SCHEMA-EXPRESSED: ONE unified `parameterSchema` vs SEPARATE per-location schemas. Under binding prior #16/C003/D1, #20 decides only RUNTIME VALIDATION + CROSS-TYPE DEPENDENCY expression; it must NOT re-insert JSON Schema into the guaranteed static matcher (D1's falsifier).

The 2022 thread (darrelmiller OP, mkistler, AML14, handrews) reached ONE durable directional consensus — keep cross-TYPE dependencies expressible, reject full per-location separation (Position 4, which nobody advocates) — but did NOT converge on a mechanism. Three unified candidates: (1) reserved property names `headers`/`body`; (2) mkistler's `in`-dialect keyword; (3) handrews' 3-field `{parameters,headers,body}` wrapper. The forcing argument is cross-type deps, "extremely rare but real", single canonical case (PUT path-ID == body-ID), one research witness (AML14).

## Decision
Adopt **PER-LOCATION SCHEMA SLOTS** for the common case + an **OPT-IN cross-cutting dependency construct** for the rare cross-type case.

1. **Common case (per-location slots).** Each location gets its own plain JSON Schema over its already-typed slice: query/path/header/cookie params + body (`contentSchema`). No reserved real-parameter namespace; no mandatory wrapper. A simple query-constraining request writes one flat schema.
2. **Rare case (opt-in cross-cutting construct).** A genuine cross-TYPE dependency is written in an OPTIONAL construct evaluated over a tooling-materialized `{parameters, headers, body}` envelope — handrews' Position-3 SHAPE grafted ONLY here, only when needed. PRESENCE-based cross-type deps work in standard JSON Schema 2020-12 today; VALUE-EQUALITY deps (path-ID == body-ID) need a Relative-JSON-Pointer vocabulary, DEFERRED to #73.
3. **Reject** the unified 3-field wrapper AS the authoring root, mkistler's `in`-dialect, and full separation (Position 4).

### Why per-location slots over the leading unified wrapper (handrews Position 3)
- Position 3 SURVIVES adversarial verify only as a DIRECTION (unified-over-separate, runtime, no-reserved-names), at ceilings 0.45/0.42/0.32. Its EXACT 3-field shape is refuted: (i) cookies/trailers unplaced (arno #22 L61); (ii) path+query merged into one `parameters` bucket contradicts karenetheridge #100 c5 and cannot distinguish a path id from a query id; (iii) `absent => anything-allowed` is the wrong axis — the real default question is `additionalProperties` WITHIN a present region (#224: MUST default true for headers/cookies), which handrews himself abstained on (#20 L56).
- The most-developed concrete design — **#224 (2026-03)** — independently converged on SEPARATE per-location keys (`pathParams`/`headers`/`query`/`cookies`/`body`) over pure-data `$defs`, with mandatory lowercase header normalization and `additionalProperties: true` defaults. This is direct late-record evidence for the per-location-slots direction.
- Per-location slots are multi-source-floated: rpc.yaml L13 ("first class `headerSchema` property"), arno #22 L45-47 ("the better idea of a dedicated property"). The SIG itself REOPENED toward this shape: mikekistler #100 c3 L254 relayed Darrel's "leave the parameters array in place, use JSON schema only for the interdependencies."

### Why mkistler IN-DIALECT (Position 2) is killed
Two FATAL refutations verified against source: the candidate's headline "avoids the need to augment JSON Schema" citation is **mkistler's in #100 Body L28, NOT arno's in #22** (arno #22 argued the opposite — a fixed structure/wrapper). mkistler's actual #100 proposal is a FLAT dotted-key `[<in>.]name` over **query/header/path/cookie only — body is NOT in the namespace**, so it cannot express the forcing path-ID==body-ID dep without importing a body-in-schema mechanism it claims to avoid.

## D1 (#16/C003) consistency — D1-SAFE, runtime-only
The #20 unified-vs-separate axis is ORTHOGONAL to D1's static-vs-runtime axis. ALL constructs here (per-location slots + opt-in cross-cutting) are RUNTIME validation over a parsed instance; NONE is compiled into the load-time disambiguation contract. The static matcher stays the exact C003 staged form (method → content-type → three-valued detect-and-tolerate). Cross-type value-equality is inherently instance-data-dependent (Relative JSON Pointer resolves against the live instance), so it REINFORCES the "not-statically-collision-checked" last-resort D1 contemplates.

**Tripwire surfaced (not silently assumed):** the #20/README source frames `parameterSchema` as a request-SELECTION step (README L63/L170; rpc.yaml's share-method requests disambiguate ONLY by their schema, pressuring toward promotion). We scope all slots to runtime validation and do NOT mandate compiling them as the guaranteed static matcher. If a future refinement mandates that compilation, THAT contests D1 (a Deviation-on-a-Deviation) and needs its own receipt.

**Caveat:** D1 is weakly witnessed (mizan cap 0.139 vs declared 0.55, 2 co-located L1 witnesses, bcmea-clean). "Stay out of the static matcher" is a SOFT honor-by-default guardrail, not a hard SIG-ratified fact.

## Deferred
- **#73** — JSON Schema dialect/version + Relative-JSON-Pointer relational/value-equality vocabulary (the forcing case is not demonstrable without it; identical dependency under any shape).
- **#127** — concrete templating system (gates the query/path instance→data-model mapping).
- **Evaluative mapping prerequisites** — query-string-is-not-JSON (Hudlow #100), header model (#108, OPEN 2026-03), cookies/trailers placement, query.x-vs-x deserialization (karenetheridge #100 c5). HARD pre-ratification dependencies; not solved here.

## Consequences
- Reserved-name collision structurally eliminated (dominates Position 1, ties 2/3).
- Simple-case ergonomics preserved (darrelmiller's never-conceded no-mandatory-wrapper objection, #20 L54).
- Cross-type capability preserved at parity with unification (same #73 dependency); the value-equality forcing case has ZERO working schema in the corpus today.
- Cost: more slot keys than one schema (mild tension with the simplification goal); two mapping surfaces (per-slot + the opt-in envelope, but the latter is lazy/opt-in).
- This is a receipted Deviation from the consensus SHAPE ("one unified root"); honored in intent, ceiling lowered, single-voice-reopened and never re-ratified.