# C13. The referencing cluster (#73/#72/#49/#26): dialect + identity + import frame

> **Provenance:** Candidate-fork ADR — a decision of *this fork effort* (Suluk), not of the OpenAPI Moonwalk SIG. Resolves the coupled cluster **#73** (dialect) + **#72** (imports) + **#49** ($ref keyword) + **#26** (pointer-vs-name) as one decision. Ledger: [`plan/facts/0073-referencing-cluster.bn`](../../../plan/facts/0073-referencing-cluster.bn). Council-integrated panel `wf_b4344a37-dcd`; ceilings mizan-gated.

Date: 2026-06-09


## Status

CANDIDATE resolution (Suluk fork, C001 charter). The cluster (#73/#72/#49/#26) is OPEN in the SIG — no vote, no maintainer ruling, no ratified ADR. This decides the FRAME at candidate ceilings; it is not a SIG outcome. Ledger: plan/facts/0073-referencing-cluster.bn (parses clean; burhan-converge backstop clean across 9 fact files).

## Context

#73 (JSON Schema dialect/referencing), #72 (imports), #49 (ref divorce), #26 (pointer-vs-name) are coupled: each fragment-grammar choice constrains the others. Binding prior C009 (#83/#32) already lands the cluster on resolve-by-stable-name, never by array index or map-insertion order (mizan-verified 2026-06-09, found=true, sole-witness, bcmea-clean, cap @0.70). The task was to decide just enough — the dialect-plus-identity-plus-import FRAME — and defer the exact fragment grammar (#32-c10) plus the relational value-equality vocabulary (#24/#100). Three candidates were designed and each given a 3-lens adversarial verify pass (mizan-gated).

## Decision

Winning frame: ADOPT-2020-12 plus DEFER-THE-GRAMMAR (the conservative sibling of the ADOPT candidate).

- #73 DIALECT — explicitly declared, statically/locally decidable at the DOM-to-ADA boundary; document-level default plus static schema-style override only; reuse the host-spec schema/vocabulary hook (no parallel OAS dialect-selector). The specific version pin is DEFERRED.
- #73 IDENTITY — typed-component-name PRIMARY: the component map key is the canonical single-valued identity and auto-produces an implicit location-independent anchor carrying section-plus-name (gregsdennis proposes, handrews ratifies-with-modification). Reconciliation: the component key IS the canonical anchor; an authored anchor inside a component names an intra-schema target and must not contradict the key. Byte-grammar DEFERRED.
- #72 IMPORTS — Imports Object of namespace-plus-href; self reserved-plus-implicit; I/O-decoupled (MUST accept self-IRI-match OR retrieval-URL OR external-base-IRI, MUST NOT require I/O); single-file OADs need none. One resolution function at the DOM-to-ADA boundary; import binds location only. No-mandatory-wrapper for the simple local ref. MUST-strength on the three-method mandate does not harden (single-voice).
- #49 ref — divorce ACCEPTED; finish it so the two ref kinds are parse-time-distinguishable by token-plus-slot, not tree-position alone. JSON-Schema ref fenced inside Schema Objects under the declared dialect.
- #26 POINTER-vs-NAME — by stable name (C009); components stay a dynamic-key map; name-default does NOT forbid a coexisting URI surface (the 2025-10-29 OAS-3.2 outcome shipped DUAL).

## Rejected

- ADOPT aggressive NORMATIVE-NOW variant (verify 0.50-0.55): promoting handrews section-dot-name suspicion to a normative MUST is a register-inversion; a normative pointer-disallow breaks the proposal own examples (README L84/L97); the synthetic anchor is not a valid 2020-12 plain-name fragment.
- MINIMAL tree-position decouple (verify 0.50-0.55): FATALLY refuted — the proposal corpus references components via a JSON-Schema ref to the components-schemas path inside a contentSchema Schema Object, reaching the components map by positional pointer, so the tree-position rule mislabels the dominant ref.
- CUSTOM Moonwalk-owned dialect (verify 0.18-0.27): strictly dominated; unwitnessed (mizan found=FALSE, anti-fab gate blocked); contradicts the calibrated elder past his one-vocabulary concession.

## Consequences

This FRAME is the head of Wave B; it gates #31/#100, #24, #49/#26 mechanics, #72 formalization. Deferred with explicit homes: the fragment byte-grammar, the dialect/version pin, the JSON-Pointer tolerance, the inline-restriction regime, the string-vs-object polymorphism UX, the whole-doc form, the must-match-import manifest, and the relational value-equality vocab. The wire shape must not be hard-committed to a not-yet-designed model.