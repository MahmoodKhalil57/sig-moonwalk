# C11. Convergent batch 1 — 17 frontier items resolved directly (C010 Wave 1)

> **Provenance:** Candidate-fork ADR — a decision of *this fork effort* (Suluk), not of the OpenAPI Moonwalk SIG. A C010 batch: 17 frontier items the Wave-0 triage classed *convergent* (no panel), resolved directly. Ledger: [`plan/facts/batch1-convergent.bn`](../../../plan/facts/batch1-convergent.bn).

Date: 2026-06-09

## Status

Accepted (candidate-fork) at candidate ceilings (0.75–0.85; convergent/inherited/out-of-scope). Triaged by workflow `wf_550dd30c-fa6` (one isolated agent per item), operator-approved, resolved as one batch with a `burhan-converge` cross-issue backstop. Any item is revisable if its single-voice/recent-comment basis shifts.

## Context

Most of the frontier tail is not contested: the SIG record is thin, a duplicate, a recent handrews/OAS-3.2 determination, or already absorbed by our resolved ADRs. Running a full adversarial panel on each (like #16/#20/#83) would be disproportionate (atom-0011). Per [C010](./C010-batched-dependency-aware-execution.md), the triage routed these 17 to direct resolution; the contested 24 keep their panels.

## Decision (17 determinations)

**Inherited from our resolved ADRs**
- **#119** recursive paths — bounded-out by C005 (forbidden operators preserve injectivity).
- **#224** dynamic transport keys — met by C004 per-location slots + `patternProperties` within a slot.
- **#172** rule-suppression — out-of-scope → linting tooling (handrews scope objection; same class as C008).

**Inherited from the SIG record (recent handrews / OAS 3.2)**
- **#79** archetype → companion spec / `x-archetype` (handrews 2025-10-30 out-of-scope).
- **#209** Set-Cookie → inherit the OAS 3.2 header answer *(self-contained stance; full modeling gated on contested #108 — flagged)*.
- **#54** inline-schema vs codegen → JSON Schema 2020-12 `$anchor` already suffices.
- **#124** XSD import → optional via extension registry (XML text+attr fixed upstream in 3.2).
- **#141** functional areas → adopt handrews' seven functional areas as the modular decomposition.
- **#128** rich text → configurable format; defer format defs to extensions; no mandated tables.
- **#63** consumer-optimized form → accept the `self` field as complete *(bundling detail leans on contested #72 — flagged)*.
- **#42/#202** examples → adopt the #90 naming-convention recommendation.
- **#130** use cases → adopt the brainstorm use-case taxonomy (meta-doc).
- **#19** discovery → adopt RFC 8615 `/.well-known/openapi`.

**Out-of-scope (decline from core; defer to overlays / extensions / tooling)**
- **#120** SHACL → alternative-schema extension mechanism, not core.
- **#102** retry/timeout → overlays / HTTP-standard resilience.
- **#75/#84/#50** security → #75 shipped in OAS 3.2; #84 → docs; #50 deferred (post-C005, low-priority).
- **#18** completeness levels → conflate with the contested #76 tiers concern *(dedup only; the tier mechanism is the #76 panel — flagged)*.

## Consequences

- 17 items resolved in one wave instead of 17 sequential Steps — the C010 speedup on the easy majority, while the contested 24 retain full rigor.
- Three items resolved only their self-contained part (#209→#108, #63→#72, #18→#76); the flagged dependency stays on the contested-panel track.
- All at modest ceilings; several rest on a single recent handrews comment — re-verify if that basis moves. `burhan-converge` confirmed no conflict with the existing ledger.
