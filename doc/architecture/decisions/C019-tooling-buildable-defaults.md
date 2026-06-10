# C19. Tooling-buildable provisional defaults — reference, signature, deserialization, uriTemplate grammars

> **Provenance:** Candidate-fork ADR (Suluk), not a SIG decision. Pins the deferred-but-tooling-critical grammars to concrete BUILDABLE defaults so validators/codegen/vscode/TS-libraries can be built. Ledger: [`plan/facts/0019-tooling-defaults.bn`](../../../plan/facts/0019-tooling-defaults.bn) · grammars in SPEC Appendix A. Workflow `wf_f1934338-467`.

Date: 2026-06-10

## Status

Accepted (candidate-fork) at **low ceilings (0.55–0.62)** — PROVISIONAL buildable defaults, NOT ratified grammars; fully revisable when the deferred grammars (#26/#49/#72 referencing, C003 signature, #100/#108 deserialization) ratify. The buildability audit also found and corrected real SPEC bugs (a §2.4 decode-then-split reverse-parse error, dual slot-name vocabularies, a reference-spelling contradiction) — Appendix A is now the authoritative tooling reference. converge clean.

## C19. Tooling-readiness defaults: concrete buildable provisional grammars for the deferred reference / signature / deserialization / templating surfaces

> **Provenance:** Candidate-fork ADR (Suluk), not a SIG decision. Pins four CONCRETE, BUILDABLE PROVISIONAL DEFAULTS for surfaces that prior ADRs (C003, C005, C013) deferred at the byte-grammar level but that tool authors (validators, codegen, $ref-resolvers, vscode extensions, TS libraries) need in order to build interoperable tooling. Binding priors: C003 (signature/ADA/D1), C004 (per-location slots), C005 (parseable profile), C009 (by-name identity), C013 (dialect/referencing), C015 (header fieldModel/#224 lowercase), C016 (media-type params). Ledger: `plan/facts/0019-tooling-readiness-defaults.bn` (to be created).

Date: 2026-06-10

### Status

CANDIDATE — **provisional buildable defaults, NOT ratified grammars.** Ceilings deliberately LOW (0.55–0.62). These do NOT override the deferrals in C003/C005/C013; they are the implementable default the spec RECOMMENDS until a ratified grammar lands, chosen so that two independent implementers produce interoperable tools. Every one is fully revisable when the corresponding frontier item (#26/#49/#72/#73, #100/#108, the signature-key residual #7) ratifies.

### Context

The frontier ADRs decided the FRAME and explicitly deferred the byte-grammars that block tooling: C013 deferred the fragment grammar + import manifest; C003 left the signature-key grammar OPEN (residual #7) and the collision policy OPEN; C004/C005 deferred the query/header evaluative mapping to #100/#108; C005 closed the path grammar but its reverse-parse algorithm is a Candidate-specific artifact. A tool author cannot build a resolver, a router/linter, a request-validator, or a path-matcher against a deferral. This ADR pins one concrete default per surface.

A pre-pin audit surfaced that the SPEC base document is itself **internally contradictory** on three of the four surfaces, so the defaults cannot be "buildable" until the base is reconciled. Those reconciliations are folded in below as prerequisites.

### Decision — four pinned defaults (each at a low, revisable ceiling)

1. **Reference syntax (@0.55).** Two surfaces, parse-time-distinguishable by TOKEN+SLOT (C013 #49): OpenAPI Reference Object `{$ref: "#/components/<type>/<name>"}` (same-document JSON-Pointer, by-NAME resolution per C009) for non-schema reuse; the 2020-12 `$ref` keyword (canonical `#/components/schemas/<name>` or implicit `#<name>` anchor) for schema-internal reuse. **Tie-break (audit):** a `$ref` in any slot whose type INCLUDES Schema Object (notably `body`/`contentSchema`) is ALWAYS the JSON-Schema keyword. **Escaping (audit):** pointer tokens are RFC6901-escaped ONLY; the `#/...` is a JSON Pointer, NOT re-percent-encoded — braces stay literal (`#/paths/~1pets~1{petId}`). Import-namespace prefix `<ns>:#/...` reserved (C013 #72), so a bare `#/...` is always same-document.

2. **Signature encoding (@0.55).** ADA computes a tooling-internal canonical tuple `(method, path, queryKS, ctypeSet, headerAS, bodyId)` + a fixed-order normalized key-string — a matcher/dedup/collision key, NOT a DOM field (C003(a)). **Audit fixes:** path key preserves the LITERAL uriTemplate (var-name erasure is overlap-test-only, never the key, so `/pets/{id}` and `/pets/{petId}` stay distinct per C009); content-type is a SET with params stripped (C016) and ranges/equivalents non-disjoint; inline body maps to sentinel `B=#inline` (no structural hash — the lost discrimination is by-construction `not-statically-determinable` under D1). Collision returns the verbatim three-valued verdict, report-not-gate; policy stays OPEN (C003).

3. **Query/header/cookie deserialization (@0.55).** Form-style query (decode AFTER split on `&` then first `=`; repeated key => array; bare `?flag` => `true` iff boolean-typed else `''`), lowercase-normalized headers (C015/#224), cookies from the `cookie` header. Coercion is SLOT-DRIVEN and type-CATEGORY (integer+number => JSON number; integer-ness deferred to validation). **Audit fixes:** absent slot => all-strings, no coercion; unknown keys (under `additionalProperties:true`, C004) included uncoerced in wire form; union types coerce iff a branch permits numeric/boolean else leave string; **header comma-splitting is gated on the §7.2 fieldModel registry list-ness (RFC9110 §5.6.1), NOT on `slot.type=='array'`** — non-list fields preserve commas verbatim.

4. **uriTemplate profile (@0.62).** C005's Tier-1/2/3 taxonomy + validate/compile/reverse-parse triple. **Audit fixes:** REVERSE-PARSE splits on unescaped `/` FIRST then decodes each segment (so `%2F` is not a boundary — preserves injectivity); `{+var}` is Tier-1 IFF it is the entire final segment AND terminal AND single-scalar (mechanical boundary test); CAPTURE_REST always ranks LAST and specificity is computed over the TEMPLATE not the matched portion (so overlap ranking is implementer-independent). Overlap is a C003 verdict + runtime concrete-over-variable tiebreak, never document order (C009).

### Prerequisite reconciliations (the SPEC base is contradictory; fix before "buildable")

- **Reference spelling:** SPEC uses ≥4 mutually-exclusive forms (`#schemas.Speaker`, no-prefix `#/schemas/...`, `#/$defs/...`, `#/components/schemas/...`, `schemas:...`). Pick `#/components/<type>/<name>` as the single OpenAPI canonical emitter; the no-prefix `#/schemas/...` form (§5.x examples) is NOT marked illustrative and must be converted or marked.
- **§6.4 vs §8:** L1487 ("an OAS-level reference mechanism is NOT introduced") contradicts §8 L2434 ("OpenAPI References (Candidate Reference Family)"). §8 is correct (C013 #49); strike the L1487 negative clause.
- **Slot names:** `parameterSchema.{query,path,header,cookie,body}` (§1.4/§1.6/§4) vs direct `headerSchema`/`cookieSchema` (§7). Pick `parameterSchema.*` (C004/C009-aligned); alias or strike the §7 spelling. Default #3 writes into `parameterSchema.*`.
- **§2.4 pseudocode:** L602/L608 decode-then-split bug; amend to split-then-decode-per-segment (matches default #4 P1).

### Consequences

- Two independent implementers converge on resolver, matcher-key, request-deserializer, and path-router behavior — the tooling-readiness goal — ONCE the four base-doc reconciliations land. Without them, the defaults rest on a contradictory base and implementers anchoring on different SPEC passages diverge.
- Each default is the most-revisable kind (sole-witness-capped ADR frames + base-doc contradiction). Ceilings 0.55–0.62 encode BOTH risks. A single ratified frontier grammar (#26/#49/#72/#73, #100/#108, signature-key #7) re-opens the corresponding default.
- Honest expressiveness costs are disclosed, not hidden: slash-bearing single-value path params remain INEXPRESSIBLE (C005); inline-body discrimination is intentionally `not-statically-determinable`; the import byte-grammar and string-vs-object ref polymorphism stay deferred.

### Provenance & honesty

This ADR uses "consistent with the FRAME of Cxxx" rather than "verbatim/exactly" — the frames are sole-witness-capped and the SPEC carries deferral banners, so an over-settled register would itself violate the C001 hard-honesty rule (SPEC §0). Each default carries a KNOWN BASE-DOC CONFLICT note pointing at the contradicting SPEC lines so implementers are warned, not misled.