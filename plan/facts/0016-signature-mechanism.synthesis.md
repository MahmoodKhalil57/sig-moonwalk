# #16 signature mechanism — workflow synthesis (evidence behind C003)

> Durable record of the adversarial synthesis that produced [C003](../../doc/architecture/decisions/C003-signature-mechanism.md) + [`0016-signature-mechanism.bn`](./0016-signature-mechanism.bn).
> Source: workflow `wf_bebee5d2-131` (24 agents, ~2.0M tokens, 37 min: 6 readers → prior-map → 4 candidate frames → 12 adversarial verdicts → synthesis). This is provenance, not the source of truth — the ledger `.bn` + ADR are. Ceilings here are the workflow's; **the committed ledger uses mizan's lower sole-witness caps (0.85) where they differ.**

## Frame chosen — ADA-first (handrews-aligned)

Only frame that held `true` under all three adversarial lenses at ceiling 0.6, resting on the highest-consensus priors (0016 c4 ADA reframe + cost-cap; 0185/0186 DOM→ADA layer; 0194 matching-vs-correlating).

**Grafted from the maximalist frame's survivable core:** the ADA-exposed collision *verdict* + detect-and-tolerate (hudlow `hasOverlappingSignatures()` #190) + JSON-Schema-OUT-of-static-contract.
**Discarded its fatal core:** a normative "collision MUST be statically decidable / satisfiable-by-construction" — pre-decides #127, inverts detect-and-tolerate, mandates single-voice machinery.

**Grafted from the inclusion frame's survivable core:** expressive reach (RPC/action-header, content-shape, query-differentiated, matrix as instances of *which-aspects-participate*) + a resolvable-vs-runtime-only tag.
**Discarded its fatal core:** reading Principle 3 (a *neutrality* clause) as a non-REST-first mandate; "declared-required" is a non-sequitur since every inclusion case is expressible under the implicit algorithm.

**Grafted from the simplicity frame:** last-resort parameterSchema framing + 3.x continuity.

**Fixed inconsistency in the winner (adversarial catch):** concrete-over-variable precedence is **runtime resolution behavior only** — *not* a static-detection primitive and *not* the chosen collision policy; literal-vs-variable exposure is demoted to where the chosen #127 language permits, to avoid a framing-boundary leak.

## Sub-decisions (provenance · workflow-ceiling · falsified-when)

| Claim | Prov. | Ceil. | Falsified when |
|---|---|---|---|
| Multi-aspect tuple frame (method, uri-template incl. query, content-type, headers, body shape) | inherited | 0.9→**0.85*** | 3.x path+method-only identity re-imposed, or any of the five aspects forbidden at frame |
| Signatures at DOM→ADA layer; both non-mandatory | inherited | 0.85 | spec MANDATES DOM/ADA for conformance, or places mechanism below the DOM |
| Define by what ADA must expose; bounded-cost analysis only | inherited | 0.85 | SIG ratifies templating-first ordering or rejects the cost cap |
| (a) No declared style indicator; uniform/implicit; PR#183 optional-at-most | **deviation D2** | 0.5 | SIG ratifies a declared per-API/op mechanism, or a use case needs a per-API style switch |
| (b) Aspect menu; method present but subordinatable; method-non-mandatory rejected | inherited | 0.85 | an aspect outside the five is required, or SIG ratifies a methodless request |
| (c) Static analysis = bounded desideratum, detect-and-tolerate, three-valued verdict, not a gate | **deviation D3** | 0.6 | SIG ratifies detection as a hard MUST, or the three-valued verdict collapses |
| JSON-Schema discrimination → runtime last-resort (staged selection preserved) | **deviation D1** | 0.55 | SIG ratifies JSON-Schema-in-the-matcher, or a cheap general JSON-Schema-overlap procedure is shown |
| Concrete-over-variable precedence = **runtime-only**, bounded | inherited | 0.8 | SIG redefines precedence as a detection primitive, or specifies the undefined superset cases against it |
| #16 resolves MATCHING; correlating separable | inherited | 0.8 | SIG treats matching+correlating as inseparable |
| Defer #20 + #127; ADA fixes only exposure shape | inherited | 0.85 | resolution shown to pre-decide #20 or #127 |

\* committed ledger uses mizan's sole-witness cap 0.85 (workflow declared 0.9/0.95; mizan rejected — see [STATE.md](../STATE.md)).

## Deferred / open dependencies (carried to the frontier)

- **#127** templating system (extended-URI-Template vs RFC6570 vs WHATWG URLPattern; darrelmiller: URI Templates not designed for parsing) — chosen *after* ADA exposure.
- **#20** per-location schema split — determines how a composed signature is schema-expressed. **D1's falsifier fires if #20 ratifies JSON-Schema-in-the-matcher** (tension to monitor with `burhan-perturb`).
- **operationId fate** (#16 c1, captainsafia 2022): replace vs coexist — unresolved; C003 keeps coexistence as candidate posture.
- **Collision-resolution policy**: four rivals (collision-invalid #185 / specificity / priority-cascade #186 / strict-mode), none chosen. ADA *reports*; policy is separate.
- **Header modeling (#22/#108)**: RFC8941/9110 lack a media-type/JSON mapping; named a prerequisite to header-based signatures (#194). Blocks the header aspect, Accept (#204), media-type params (#163).
- **Matching-vs-correlating (#194)**: correlating pursued independently.
- **Resource-orientation (#30)**: path+method vs decoupled resource concept; no consensus; bears on the signature's primary axis.
- **Security signatures (#46/#50/#194)**: authorization-difference as a finer-grained-signature motivator (one voice); SIG leans to externalizing security. Future motivator, not a frame-level aspect.

## Held out (consensus discipline)

patternProperties transport blocks (#224, one voice); differentiability-matrix + path-formats (#185/#190 "love and hate"); resource-type decoupling (#30); declared-mechanism-as-required (both refuted frames). Only the dynamic-header-NAME gap (karenetheridge concession) is acknowledged as a genuine-but-unsolved 3.x gap.
