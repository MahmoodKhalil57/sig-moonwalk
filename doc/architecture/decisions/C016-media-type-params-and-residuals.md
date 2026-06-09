# C16. Media-type parameters (#163) + two residual frontier notes — resolved directly

> **Provenance:** Candidate-fork ADR (Suluk), not a SIG decision. Resolves #163 + two initial-proposal residual notes, directly (thin/convergent post-#108). Ledger: [`plan/facts/batch5-waveC2residuals.bn`](../../../plan/facts/batch5-waveC2residuals.bn).

Date: 2026-06-09

## Status

Accepted (candidate-fork), ceilings 0.6–0.78. Right-sized: resolved directly (no panel) — the record is thin and the mechanisms are inherited from resolved ADRs.

## Decision

- **#163 media-type parameters** (charset etc., RFC 6838) — expressed via the **content/media-type model** using the same registry approach #108 established for header field-models; inherit the OAS 3.3 direction (handrews 0163 c1: "on the list for 3.3", points to #108). Exact mechanism deferred to the content model. @0.7
- **Residual — URL→uriTemplate ambiguity** (the initial proposal's named open problem) — **resolved by C005**: the parseable profile forbids non-injective operators in path-identity, so URL→template is single-valued and the named problem is dissolved. @0.78
- **Residual — equivalent media types** (`text/json` vs `application/json`, noted cumbersome) — addressable by the C004 content model allowing a request/response to list multiple equivalent `contentType` values (or a media-type range), rather than duplicating the request. Low-priority affordance. @0.6

## Consequences

- The media-type-parameter question rides the same registry/model machinery as #108 — no new mechanism.
- The initial proposal's two named pain points (URL ambiguity, equivalent media types) are now accounted for.
