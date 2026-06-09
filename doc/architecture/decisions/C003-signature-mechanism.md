# C3. Signature mechanism: a uniform ADA-exposed multi-aspect matcher with bounded, best-effort collision analysis

> **Provenance:** Candidate-fork ADR — a decision of *this fork effort* (Suluk), not of the OpenAPI Moonwalk SIG. Resolves frontier **#16**. Ledger: [`plan/facts/0016-signature-mechanism.bn`](../../../plan/facts/0016-signature-mechanism.bn).

Date: 2026-06-09

## Status

Accepted (candidate-fork) · **confidence-capped** — every load-bearing claim is SOLE-WITNESS (one fact-file), so mizan caps frame-level claims at @>=0.85 and the contested sub-decisions sit at @>=0.5–0.6. Revisit when a second independent witness or a real SIG ratification lands.

## Context

A *signature* (Principle 2) is what makes an operation identifiable. In OAS 3.x it is path+method; Moonwalk relaxes path uniqueness, so a signature may draw on any HTTP aspect. The SIG record on this is **unsettled**: no ADR, zero spec text, PR #183 (a declared `signature` array) is OPEN with two empty reviews. The substantive thinking lives in discussion #16 (earth2marsh's 2022 "signature style" stub; captainsafia's operationId question; **handrews' 2025-04 reframe**) and the 2025 calls (#185–#194: hudlow's ADA strawperson, detect-and-tolerate `hasOverlappingSignatures()`, the router user-story, priority-as-last-resort). Resolved here via workflow `wf_bebee5d2-131` (6 readers → prior-map → 4 candidate frames → 12 adversarial verdicts → synthesis). Winning frame: **ADA-first** (handrews-aligned), grafting detect-and-tolerate (#190) and the four-strategy collision menu (#187); the maximalist-MUST and inclusion-as-mandate frames were killed by fatal/major refutations.

## Decision

Resolve only the **framing** (#16's four sub-questions); defer composition (#20) and templating (#127).

1. **(a) Uniform, not declared.** No required per-API "signature style" indicator. The mechanism is a uniform/implicit **ADA contract**; a declared `signature` enumeration (PR #183) is *optional-at-most*, normalized away by the ADA. *(Riskiest claim — overrides earth2marsh's own hedged stub on a never-reconciled question — @>=0.5.)*
2. **(b) Aspect menu.** A signature may compose: `method | uri-template (incl. query) | content-type | headers | request-body shape`. *(@>=0.85.)*
3. **(c) Collision analysis is a bounded desideratum, not a gate.** Static ambiguity detection is *detect-and-tolerate*: the ADA surfaces a three-valued verdict (`provably-disjoint | provable-collision | not-statically-determinable`); it is **not** a mandatory validation gate. The 2025-04 floated "MUST be statically detectable" was contested in-note and never ADR'd. What to *do* about a collision (invalid vs precedence vs priority vs strict-mode) is left OPEN; priority-as-last-resort is the SIG's recorded lean.
4. **(d) Signatures live at the DOM→ADA layer** (both non-mandatory for tooling). Concrete-over-variable precedence is inherited from 3.x but is **runtime-resolution behavior only** — not a static-detection primitive, not the chosen collision policy — and bounded (param-vs-param superset is undefined in 3.x). **Matching** (request→operation) and **correlating** (request↔response schema) are separated; #16 resolves matching only.

**Three deviations** (each with receipt in the ledger): **D1** — JSON-Schema parameter discrimination demoted from the guaranteed static contract to a runtime last-resort tier the ADA flags "not-statically-collision-checked" (contested by handrews/hudlow). **D2** — PR #183's declared array demoted to an optional authoring affordance (PR is thin/open). **D3** — collision analysis adopted as best-effort exposure, not the floated hard MUST.

## Consequences

- **Deferred, not decided:** #20 (per-location schema split — **D1's falsifier fires if it ratifies JSON-Schema-in-the-matcher**), #127 (templating system, chosen after ADA exposure), operationId's fate (coexists for now), the collision-resolution policy (four rivals: invalid #185 / specificity / priority #186 / strict-mode — ADA *reports*, policy is separate), matching-vs-correlating (#194, correlating pursued separately), resource-orientation (#30, bears on the signature's primary axis), security-as-signature-motivator (#46/#50/#194, one voice; SIG leans to externalizing security), and header-aspect signatures (gated on the #22/#108 header-modeling prerequisite, not yet delivered).
- **Held out (consensus discipline):** patternProperties dynamic-key blocks (#224, one voice), differentiability-matrix/path-formats (#185/#190), resource-type decoupling (#30), and any *required* declared mechanism — none adopted at the frame.
- **Full adversarial provenance** (frame graft/kill rationale, all 10 sub-decisions, verdicts): [`plan/facts/0016-signature-mechanism.synthesis.md`](../../../plan/facts/0016-signature-mechanism.synthesis.md).
- The ADA fixes only the *shape* of the exposure (aspects-participating, literal-vs-variable, collision-verdict); per-segment detail and the templating choice are chosen *after* the ADA exposure is fixed (handrews' ordering).
- All ceilings are sole-witness-capped; this ADR is the most revisable kind — a single new witness (a SIG ratification, or an independent corroboration) should trigger re-verification.
