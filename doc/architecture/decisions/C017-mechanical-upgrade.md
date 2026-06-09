# C17. Mechanical 3.x→4.0 upgrade (Principle 6) — a semi-automated transformer

> **Provenance:** Candidate-fork ADR (Suluk), not a SIG decision. The frontier **capstone** — synthesizes ADRs C003–C016 into a 3.x→4.0 transformation. Ledger: [`plan/facts/0upgrade-mechanical.bn`](../../../plan/facts/0upgrade-mechanical.bn). Workflow `wf_57153929-d7c`.

Date: 2026-06-09

## Status

Accepted (candidate-fork) at **low Originated ceilings (0.5–0.6)** — no SIG witness, inherits the full revisability of every ADR it rests on. Honest by construction: it is a *semi-automated* transformer with a human-review ledger, **not** a claim of full automation (the bcmea trap Principle 6's wording invites). converge clean.

> **Provenance:** Candidate-fork ADR (Suluk), not a SIG decision. ORIGINATED/constructive resolution of Moonwalk **Principle 6** ("An automated upgrade process from 3.x to 4.0 will be developed as part of the Moonwalk effort"). Synthesizes resolved decisions C003-C016 into a 3.x->4.0 transformer specification. No SIG debate exists for the upgrade mechanism; this is the lowest-witness class of decision and ceilings are capped (<=0.6). Ledger: `plan/facts/` (referenced ADRs).

Date: 2026-06-09

## Status

CANDIDATE (Originated, priors-with-ceilings). Principle 6 names the upgrade as in-scope but supplies no mechanism; this ADR constructs one from the resolved frame. NOT a SIG outcome. Every binding ADR it composes is candidate-fork sole-witness (mizan caps 0.5-0.85), and several target shapes are explicitly DEFERRED (C013 fragment byte-grammar + dialect version pin; C005 query-placement + collision policy; C004 query->data-model deserialization), so the transformer's exact emitted syntax cannot be finalized until those land. Headline frame held @0.55.

## Context

Principle 6 promises an "automated" upgrade. The failure mode (bcmea) is over-claiming full automation - silently dropping or mis-emitting constructs the ADRs leave lossy, deferred, or unresolved. The honest unit of work is a SEMI-AUTOMATED transformer: a deterministic green path PLUS a machine-readable review ledger of everything needing human judgment. This ADR was produced by synthesizing a candidate mapping and running it through an adversarial audit against the actual ADR text and the canonical example corpus. The audit found (a) ~5 rows mislabeled lossless that are lossy against the ADRs' own text, (b) ~6 genuinely-missed 3.x constructs, and (c) 2 factual contradictions of the ADRs. All findings were verified against source and are incorporated.

## Decision

Specify a two-stage transformer **U: 3.x-DOM -> (4.0-DOM, ReviewLedger)** that is mechanical where an ADR pins a target and FLAGS (never silently emits) where it does not. Mechanism detail is in the `mechanism` field; the corrections that distinguish this from the naive mapping:

1. **Downgrade 5 over-claimed lossless rows to lossy.** Operations->requests and responses->responses are LOSSY: the map KEY synthesizes mechanically (injective in the upgrade direction) but the friendly NAME value (README L61/L68) is fabricated, and `operationId` is absent from every 4.0 example (verified across all six example files). Path-templating is CONDITIONALLY lossy: only the strict C005 Tier-M subset is the identity function; `style=matrix/label`, `explode`, multi-segment, list-typed, and slash-bearing values are FORBIDDEN/INEXPRESSIBLE (C005 L57). Tags-array->map loses observable doc-render ORDER unless the optional, non-positional C009 `order` field is emitted.

2. **Fix two factual contradictions of the ADRs.** (a) The dialect is NOT pinned to 2020-12 - C013 L20/L34 DEFERS the version pin; emit the dialect slot with a flagged config default. (b) Query is DUAL-PLACED, not either/or - the petstore (`pet/findByStatus?status={status}` key + `parameterSchema.status`, L53/L58) populates BOTH the uriTemplate key and the C004 query slot; the transformer must too.

3. **Add 6 missed-construct rows.** schema.xml (13x in petstore, no target -> likely lossy); the 3.0.x->2020-12 schema-subset transform as a first-class Stage-0 step; parameter.content/Header.content (no slot); the `default` response keyword (no target, corpus uses 5XX); the EQUIVALENT-contentType non-fan-out affordance (C016 L15 - corrects the over-stated fan-out loss; only genuinely-distinct schemas fan out).

4. **Three-stage output discipline.** Stage 0 normalizes (3.0 subset + bundle). Stage 1 is the lossless structural core. Stage 2 drops-with-receipt the serialization/discriminator/content metadata. Stage 3 is REQUIRES-HUMAN-INPUT. The transformer ALWAYS emits the inline-per-request safe form; hoisting is optional, gated on the open C003 collision policy.

## Rejected

- **One-click full-automation tool.** The bcmea failure mode Principle 6 warns against; deferred wire-syntax (C013/C005/C004) makes literal emission non-finalizable.
- **Array-flip of responses/requests.** C009 keeps user-keyed collections as MAPs; refs resolve by-name.
- **Silent drop of serialization metadata or `default`.** Silent-emit is the exact failure C005 warns against.
- **Hard-pinning the dialect to 2020-12.** Contradicts C013's explicit deferral.

## Consequences

- Net honest coverage is LOWER than the naive 70-80% headline: ~55-70% for 3.1, ~45-60% for 3.0.x. The remainder is flagged lossy or human-assisted.
- The transformer is a CONFORMANT-PARTIAL upgrader: deterministic green path + a JSON-Pointer-keyed ReviewLedger citing the governing ADR per flag. The ledger IS the honest surface area.
- This resolution inherits the full revisability of its inputs. If the SIG ratifies arrays-over-maps (#32), a declared signature array (PR #183), or a different dialect pin, large parts change. Re-verify on any new witness.

## Open questions (gating)

Exact emitted reference syntax (C013 byte-grammar DEFERRED); the query->data-model deserialization boundary (C005/#108/#127); the collision/precedence POLICY (C003/C005 open); leading-slash stripping vs verbatim (interacts with server-anchoring); the tool-policy for deferred targets (drop-with-warning vs x-* park vs block). None is resolvable without the upstream deferrals landing.