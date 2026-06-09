# C5. Frontier #127: RFC6570 parseable profile — var surface + normative matching profile, grammar, and reverse-parse algorithm

> **Provenance:** Candidate-fork ADR — a decision of *this fork effort* (Suluk), not of the OpenAPI Moonwalk SIG. Resolves frontier **#127**. Ledger: [`plan/facts/0127-templating-system.bn`](../../../plan/facts/0127-templating-system.bn) · evidence: [`0127-templating-system.synthesis.md`](../../../plan/facts/0127-templating-system.synthesis.md). Synthesized by workflow `wf_dc8e3394-6d2` (resumed); ceilings mizan-gated.


Date: 2026-06-09

## Status
CANDIDATE (priors-with-ceilings posture). No SIG ADR/vote exists for #127; discussion #127 is an Ideas-category question that went dormant 2024-07-26 (2 handrews comments plus 1 AMorgaut reply; #125 closed as a duplicate). Ceiling lowered accordingly. Pairs with the #127 ledger plan/facts/0127-templating-system.bn. Binding priors: ADR C003 / 0016-signature-mechanism.bn (the ADA recognition contract plus three-valued verdict plus D3) and ADR C004 / 0020-parameter-schema.bn (per-location slots plus the evaluative URL-to-slot mapping). mizan_verify_claim on defers_127_templating (2026-06-09) returned sole-witness, recommended cap 0.85, bcmea-clean — #127 is genuinely OPEN and ours to resolve.

## Context
Frontier #127 asks WHICH templating system the Candidate pathItem/uriTemplate keys use: full RFC6570 URI Templates (the documented default, README L53/L172-175), WHATWG URLPattern, support-both-plus-translation, do-nothing, or handrews' latent extended-URI-Template-ish own system (#16 c4).

Two already-resolved binding priors collapse #127 onto a single load-bearing axis. #16/C003 requires the language to be PARSEABLE in the recognition direction (given a URL, route to zero-or-one operation) and to feed a three-valued literal-vs-variable collision verdict where the language permits. #20/C004 requires the language to support the evaluative parse (a real URL into per-location schema slots). Both are the REVERSE of what RFC6570 specifies: RFC6570 is an EXPANSION spec, and its own Section 1.4/1.5 disclaim reverse matching (regular expression languages are better suited for variable matching, verified against datatracker 2026-06-09). That self-disclaimer is the structural cause of the proposal's own named-but-unsolved problem, URL to uriTemplate mapping where there is ambiguity (README:175).

The crux (darrelmiller, recurring) is that RFC6570 richer operators — explode, multi-segment, reserved, fragment, label, matrix, prefix — make parsing ambiguous or non-injective. WHATWG URLPattern is matching-native (path-to-regexp lineage) but is specified as imperative browser pseudocode compiling to an ECMAScript RegExp (handrews could not extract a grammar, #127 c2), and breaks 3.x var continuity.

## Decision
Adopt the RFC6570 PARSEABLE PROFILE: keep the RFC6570 curly-brace var SURFACE, constrain it by a normative MATCHING PROFILE (an injective operator subset usable in path-identity position), and REQUIRE two artifacts both named endpoints omit for a description spec — a normative observable-behavior grammar and a normative reverse-parse algorithm.

Operator tiering. (1) MATCH-SAFE (permitted in path-identity, injective): literal text; single-segment var (matching the OAS-3.x charset that forbids unescaped slash, question-mark, hash); leading single-var slash-form; and name-bearing matrix (the matrix correction below). (2) QUERY-ONLY (query component only, parsed order/repetition-insensitive as a key-set): form-query operators. (3) FORBIDDEN-in-identity (authoring error in path-identity, or forces the op verdict to not-statically-determinable and drops it from the static matcher): explode, multi-segment explode, reserved, fragment, label, lossy prefix-truncation, arbitrary regex as a matching primitive, and list/composite-typed or comma-bearing-scalar simple var (its comma-join collides with a scalar value, RFC6570 3.2.2).

Reject full RFC6570 wholesale (the operator set, not the surface), bare/un-profiled URLPattern, a from-scratch own grammar AS the language, and support-both-plus-translation.

### Why the parseable profile over the named endpoints
- The documented full-RFC6570 default was REFUTED on all three verify lenses (parseability 0.30, expressiveness 0.35, standards-alignment 0.18), with fatal mechanism defects: prefix-truncation silently mis-extracts a truncated value (RFC6570 2.4.1 irreversibly lossy); reserved/fragment greedy recognizers are unsound beyond an adjacency net (they pass slash, question-mark, hash unencoded); the fiat canonicalizations amputate the very multi-segment expressiveness the default advertises; and a total precedence order is contradicted by the profile own inherited 0187 bound (bidirectional overlap is UNDEFINED in 3.x).
- URLPattern survived parseability (0.55) but was refuted on standards-alignment (0.18): it fabricates a cross-pattern precedence URLPattern does not define (the spec is strictly single-pattern), and its normative matching is defined as compile to an ECMAScript RegExp and exec — which IS handrews' grammar objection, not a fix, and is not portable for non-JS description tooling. It also breaks 3.x var continuity.
- The constrained curly-brace profile is the only region in the constraint intersection that satisfies REQ-1/REQ-2 parseability AND continuity AND a clean grammar.

### Grafts (surviving cores)
- EMT two artifacts become requirements. The extended-Moonwalk-template own-grammar candidate survived only as an artifact-design at low ceiling (zero installed base, originated-section risk). Rather than invent a language, we GRAFT its two mandatory artifacts — the normative observable-behavior grammar (answers handrews #127 c2) and the normative reverse-parse algorithm (the mechanism RFC6570 names-but-omits) — atop the inherited var surface.
- URLPattern four-part-type taxonomy. fixed-text, segment-wildcard, multi-segment-wildcard, opaque-regex-as-not-statically-determinable is the family-agnostic literal-vs-variable structure #16 REQ-3 consumes.
- The matrix correction. Two adversaries independently showed name-bearing matrix is fully delimited, injective, and self-disambiguating (nschejtman #105: the param NAME is serialized into the path, so two name-bearing-matrix keys never collide). Forbidding it removed a named inclusion target and decidability #16 wants; it is admitted to MATCH-SAFE at zero parseability cost. Unbounded matrix-list stays forbidden.

### Discards (corrections folded in)
The charset CONFLATION (Tier-M stated two incompatible ways) is fixed by pinning Tier-M to the OAS-3.x charset and DROPPING the strict-RFC6570-subset / zero-generator-changes overclaim — the surface is inherited, the matching semantics are Candidate-defined. List/composite-typed var is forbidden in Tier-M. The dissolves-the-ambiguity rhetoric is reworded to within-template parse-injectivity; cross-template collision routed to #16.

## How it serves #16 matching and #20 evaluative parsing, and resolves the URL-to-template ambiguity
- #16 matching (REQ-1). A profile-valid template compiles to a segment-aligned deterministic matcher (split the path on slash, match literal-for-literal with single-segment captures), yielding route-to-zero-or-one. No forbidden operator can enter the path matcher, so which-operation is never undecidable. This is exactly #16 ada_work_backward_method plus matching_vs_correlating_separate. The segment lattice feeds the three-valued verdict decidably on the path component, honoring D3 (best-effort, not a gate).
- #20 evaluative parsing (REQ-2). The same compiled matcher capture groups ARE #20/C004 per-location PATH slots (var into the path slot; Tier-Q into the query slot). The PATH half of the evaluative URL-to-data-model parse is closed by construction. The FULL mapping — query-string-is-not-JSON and the header model — stays gated on #108/#20 and is NOT re-opened here.
- The named ambiguity (README:175). SPLIT into (a) parse-ambiguity, ELIMINATED by the operator restriction, because every path is segment-aligned and URL-to-template is a single-valued function; and (b) operation-collision (e.g. /users/{name} vs /users/me), EXPOSED via #16 three-valued verdict plus the inherited concrete-over-variable RUNTIME tiebreak, NOT a parse failure. The collision POLICY stays open exactly as #16 leaves it.

## Consistency with #16/C003 and #20/C004
- D1(#16)-SAFE. The reverse-parse matcher routes on literal-vs-variable segment structure — it is NOT a JSON-Schema-in-the-static-matcher promotion. JSON-Schema parameter discrimination stays the runtime last-resort D1 demotes it to. The three-valued verdict and the runtime tiebreak are adopted UNCHANGED from C003; #127 supplies the language that makes the path-component verdict decidable.
- C004-consistent. Capture groups populate the #20 per-location PATH slot; #20 deepest open technical risk (the query/header evaluative mapping) is not path injectivity — that is now closed — but the deferred #108 sub-problems.

## Deferred
- #73 — JSON Schema dialect/version plus Relative-JSON-Pointer vocabulary (gates cross-TYPE value-equality deps, not path parseability; inherited from C004).
- Per-segment literal-vs-variable EXPOSURE detail plus recursive/nested path modeling (#16 c4 / #119 / #23) — the profile guarantees the segment structure is COMPUTABLE; the surfaced per-segment shape is that slice call.
- #108 query/header evaluative mapping — query-string-is-not-JSON (Hudlow #100) plus header data model (#108, OPEN 2026-03, lowercase-normalize MUST per #224). #127 closes the PATH grammar; the request-grammar is incomplete until #108 lands.
- Query-PLACEMENT — query in the uriTemplate (README:53) vs a separate signature.query slot (karenetheridge #100). Owned by #20-adjacent; surfaced, not decided.
- Collision POLICY — collision-invalid vs precedence vs priority vs strict-mode; #16 leaves it open.

## Consequences
- The named URL-to-uriTemplate ambiguity gets a concrete mechanism (operator restriction plus reverse algorithm), which the proposal named but never supplied.
- 3.x var single-segment path keys upgrade by the identity function (the lowest-receipt continuity option); a URLPattern colon-name surface break is avoided.
- Honest costs (bounded-out, not hidden): slash-bearing single-value path params (need the forbidden reserved operator) are INEXPRESSIBLE — the concrete expressiveness regression vs full RFC6570, the price of parseability. Arbitrary alternating-name recursive paths stay bounded-out (#119; not RFC6570-expressible either, so not a regression). The full evaluative mapping for query/header is incomplete until #108.
- This is a receipted DEVIATION set (D1-127 forbid richer operators; D2-127 add grammar+reverse algorithm; D3-127 query order-insensitive; D4-127 matrix correction), each at a lowered ceiling; the headline verdict is held @0.62 (three verify lenses), with the inherited recognition/expansion facts at 0.85 and the runtime tiebreak at 0.80.