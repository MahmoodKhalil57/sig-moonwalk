# STATE — the spine (read this FIRST, every step)

> This is the thin, always-loaded digest of the OpenAPI v4.0 Candidate walk.
> It **holds** the small active set and **indexes** everything else. Detail is
> reconstructed on demand (`daftar query`, burhan over `plan/facts/`), never carried.
> Mechanism: [C002](../doc/architecture/decisions/C002-recursive-state-mechanism.md). Charter: [C001](../doc/architecture/decisions/C001-candidate-fork-charter.md).

_Last checkpoint: 2026-06-09 — **6 resolved** (#16,#20,#127,#17,#83/#32,+#59); council live & wild-validated. Next: #116._

## ✓ #83/#32 resolved → C009 (+ first live council hit)

**Identification-first** (handrews c10): user-keyed collections stay **map/struct** for the *identity* reason — references resolve **by stable name, never by array index** — not for ergonomics. paths/requests/responses/#20-slots/components stay maps; **root tags flip array→map** (the single container change); optional non-negative order field; names via keys. 4 deviations; verdict @0.5–0.7. **Council scorecard:** the handrews persona predicted his identification-first reframe **blind** and matched his real #32 c10 near-verbatim (valence over-firm, but pre-registered) — **first in-the-wild persona confirmation**. codegen-author's "index-identity is poison" became the committed rule; tech-writer was the sole array voice, so the map default is *not* hardened. Evidence: [`0083-array-vs-map.synthesis.md`](./facts/0083-array-vs-map.synthesis.md).

## ✓ Resolved log (detail in each ADR + `plan/facts/*.synthesis.md`)

- **#16 → [C003](../doc/architecture/decisions/C003-signature-mechanism.md)** — signature = uniform DOM→ADA multi-aspect matcher; detect-and-tolerate; matching-only. (24 agents)
- **#20 → [C004](../doc/architecture/decisions/C004-parameter-schema.md)** — per-location slots + opt-in cross-cutting; D1-safe. *Panel overturned the unified-wrapper prediction.* (17)
- **#127 → [C005](../doc/architecture/decisions/C005-templating-system.md)** — RFC6570 parseable profile + normative grammar/reverse-algorithm; D1-safe. (21)
- **#17 → [C008](../doc/architecture/decisions/C008-merge-out-of-scope.md)** — document-merge out-of-scope → Overlay Spec. *Right-sized, no workflow; conflation split → #17b.*
- **#59 → `0002`** — IRI support inherited from SIG ADR 0002.
- **Council** — A backtested (hudlow .78 / handrews .70 / rafalkrupinski .70), B/C replay-validated (13 useful / 3 marginal / 0 drop), + first wild hit on #83. [plan/council/](./council/)
- **Meta** — C002 recursive-state · C006/C007 council · **C010 batched execution** (scaling model).

## ⏳ Pending (optional · one workflow at a time)

- **Council resume** — 4 rate-limited Class-A voices (earth2marsh, darrelmiller, karenetheridge, arno-di-loreto).
- **C010 batch demo** — triage + batch the independent frontier tail (the speedup the operator asked for).

## Frontier head (next ~5 — full list in [frontier.md](./frontier.md))

1. **#116 Inheritance on paths** — structural reuse across path sublevels. **Do next** (or fold into the C010 batch). *Note: #83 just fixed collections as maps — inheritance interacts with the path map.*
2. **#17b Response-level precedence** *(split from #17)* — apiResponses vs pathResponses vs request-level; `parameterSchema` `allOf` composition. The genuine precedence question.
3. **#73 JSON Schema dialect + relational vocab** — gates #20's cross-type value-equality (path-ID==body-ID); hard dependency.
4. **#108 Header model** — RFC9110/8941; gates header-aspect signatures (#16) + #20 header slot + #127 request-grammar completion.
5. **#119 Recursive paths** · **#61 method+path shorthand** · **#57 discriminator** — remaining API-shapes.

## Decisions so far

- Frontier resolved: **6** (#59 IRI, #16, #20, #127, #17, #83/#32) · Deviations recorded: **13** (#16 ×3, #20 ×2, #127 ×4, #83 ×4; #17 inherited) · ADRs: C001–C010 (+ `0002-iri-inherited`).
- Last decision: **#83/#32 → C009** (collections stay map/struct; identification-first; refs by-name-not-index; first live council hit).

## Per-Concern confidence map

| Concern | Prior richness | Sections drafted | Aggregate ceiling |
|---|---|---|---|
| API shapes | HIGH (richest discussion energy) | 4 (signature, parameter schema, templating, collections) | 0.85 directional / **0.5–0.62** on contested shapes (declared-indicator, #20 slots, #127 profile, tags-flip, deviations) |
| Content schema formats | MEDIUM (SHACL/XSD/JSON-Schema threads) | 0 | — |
| Deployment configuration | LOW → mostly Originated | 0 | — |
| Foundational interfaces | LOW → mostly Originated | 0 | — |
| Mechanical upgrade (3.x→4.0) | LOWEST → fully Originated | 0 | — |

## Active contradictions

- **D1 ↔ #20: resolved (not fired).** #20 landed D1-safe — its per-location slots + opt-in construct are all runtime validation, orthogonal to D1's static-vs-runtime axis. No contradiction.
- **D1 is weakly witnessed (watch).** `mizan_verify_claim(d1_jsonschema_out_of_static_contract)` → recommended cap **0.139** vs declared 0.55 (2 co-located L1 witnesses). "Stay out of the static matcher" is a *soft* guardrail, not a hard fact — recorded as `d1_is_soft_guardrail_cap_0139`. An independent witness would lift it.
- **#20 static-matcher tripwire (live, not fired).** README L63/L170 + rpc.yaml share-method requests frame `parameterSchema` as request-*selection*, pressuring toward compiling the schema into the static matcher — which *would* contest D1. We decline; any future promotion is a deviation-on-a-deviation needing its own receipt.

(General hunt: `burhan-converge` / `burhan-perturb` over `plan/facts/`.)

## Cheapest-next-move

**Best move now: the C010 batch demo** (operator-requested speedup) — one triage sweep over the ~40 remaining frontier items (convergent→direct like #17, contested→panel, tag dependency edges), then a direct-batch wave of the independent convergent ones, then parallel-panel waves. One workflow at a time. If walking solo instead: **#116 (inheritance on paths)** — read `github-export/discussions/0116.md`; right-size first (check contention before a full workflow).

## Index (pointers — load on demand)

- Open questions → [plan/frontier.md](./frontier.md)
- Horizon plan → [plan/HORIZONS.md](./HORIZONS.md)
- Burhan ledger → [plan/facts/](./facts/) · spine claims → [plan/MAIN.bn](./MAIN.bn)
- Narrative receipts → `daftar query "<topic>" --project=/home/mk/apps/sig-moonwalk`
- SIG record (priors) → [github-export/](../github-export/) · official ADRs → [doc/architecture/decisions/](../doc/architecture/decisions/)
- Our ADRs → `doc/architecture/decisions/Cxxx-*.md` (frontier: [C003](../doc/architecture/decisions/C003-signature-mechanism.md) [C004](../doc/architecture/decisions/C004-parameter-schema.md) [C005](../doc/architecture/decisions/C005-templating-system.md) [C008](../doc/architecture/decisions/C008-merge-out-of-scope.md) [C009 collections](../doc/architecture/decisions/C009-array-vs-map.md); meta C001/C002/C006/C007/C010) · glossary → [CONTEXT.md](../CONTEXT.md)
- Spec projections → [specification/candidate-v4/](../specification/candidate-v4/) (signature, parameter-schema, templating, [collections](../specification/candidate-v4/collections-array-vs-map.md))
- Council (guides, not prophets) → [plan/council/](./council/) ([calibration](./council/CALIBRATION.md))
