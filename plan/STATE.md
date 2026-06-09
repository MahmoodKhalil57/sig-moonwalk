# STATE — the spine (read this FIRST, every step)

> This is the thin, always-loaded digest of the OpenAPI v4.0 Candidate walk.
> It **holds** the small active set and **indexes** everything else. Detail is
> reconstructed on demand (`daftar query`, burhan over `plan/facts/`), never carried.
> Mechanism: [C002](../doc/architecture/decisions/C002-recursive-state-mechanism.md). Charter: [C001](../doc/architecture/decisions/C001-candidate-fork-charter.md).

_Last checkpoint: 2026-06-09 — **32 resolved** (6 panels + #59 + 17 batch + 9 Wave-A); 24 open. Next: #60/61 + Wave B._

## ✓ C010 Wave-2A → C012 (8 contested items, compact panels)

Workflow `wf_806e7b7b-df3`: 8 of 9 contested items resolved via compact per-item panels (read-poles → resolve-with-council → adversarial-refute-and-finalize), post-refutation ceilings 0.5–0.74 → [`batch2-waveA.bn`](./facts/batch2-waveA.bn) + [C012](../doc/architecture/decisions/C012-contested-batch-waveA.md): **#116** inheritance (optional `shared` map + override/accumulate algo @0.55) · **#57** discriminator (retain as codegen hint + propertyDependencies @0.6) · **#45** HTTP-versions (version-agnostic @0.74) · **#43** rate-limits (out-of-scope @0.74) · **#82** versioning (permit-don't-mandate @0.74) · **#76** tiers (decline @0.6) · **#17b** precedence (most-specific-wins + allOf-compose @0.62) · **#58** links (scoped baseline @0.5). converge clean (149). #60/61 resolved directly post-limit (permit-desugar @0.6) — **Wave A 9/9**.

## ✓ C010 Wave-1 batch → C011 (17 convergent items, one wave)

Triage (`wf_550dd30c-fa6`, 42 isolated agents) → 17 convergent / 24 contested / 0 originated; operator-approved. The **17 convergent** resolved directly (inherit / out-of-scope / thin) in one batched ledger [`batch1-convergent.bn`](./facts/batch1-convergent.bn) + [C011](../doc/architecture/decisions/C011-convergent-batch-1.md): #119 #224 #172 #79 #209 #54 #124 #141 #128 #63 #42/202 #130 #19 #120 #102 #75/84/50 #18. **converge backstop clean** (141 claims). 3 items (#209→#108, #63→#72, #18→#76) resolved self-contained part only, dep flagged. First C010 batch — 17 in one wave vs 17 sequential Steps. **24 contested still need panels** (dependency waves below).

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

## Frontier head — 16 contested left, in dependency waves (full list in [frontier.md](./frontier.md))

- **Wave A — DONE 9/9** (#116/#57/#45/#43/#82/#76/#17b/#58/#60-61 → C012).
- **Wave B** (chain on #73): **#73** dialect → **#31/#100** param-interdeps · **#24** relational · **#49/#26** references · **#72** imports · **#69** auth-coupling · **#122** alt-schemas
- **Wave C** (gated on header model): **#108** → **#163** media-type-params · **#23/#30** paths/resource-orientation · **#56** annotations · **#113** defaults · **#55** servers · **#upgrade** mechanism

## Decisions so far

- Frontier resolved: **31** (6 panels + #59 + 17 batch-C011 + 8 Wave-A-C012) · Deviations: **17** · ADRs: C001–C012 (+ `0002`).
- Last: **C010 Wave-1 batch → C011** (17 convergent direct-resolved). Before that: #83/#32 → C009 (+ first live council hit).

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

Waves 1 (17 convergent) and 2A (8 contested) are done. **Next:**
1. **#60/61 shorthand** — the Wave-A session-limit casualty; re-run its compact panel or resolve directly. (Read `github-export/discussions/0060.md`, `0061.md`.)
2. **Wave B** (chain on #73): resolve **#73** dialect first, then #31/#100, #24, #49/#26, #72, #69, #122 as compact panels.
3. **Wave C** (gated on #108 header model): #108 → #163, #23/#30, #56, #113, #55, #upgrade.
`burhan-converge` backstop after each wave. One workflow at a time. **NOTE: session limit was hit ~5:00pm — heavy workflows may fail until ~6:10pm London.**

## Index (pointers — load on demand)

- Open questions → [plan/frontier.md](./frontier.md)
- Horizon plan → [plan/HORIZONS.md](./HORIZONS.md)
- Burhan ledger → [plan/facts/](./facts/) · spine claims → [plan/MAIN.bn](./MAIN.bn)
- Narrative receipts → `daftar query "<topic>" --project=/home/mk/apps/sig-moonwalk`
- SIG record (priors) → [github-export/](../github-export/) · official ADRs → [doc/architecture/decisions/](../doc/architecture/decisions/)
- Our ADRs → `doc/architecture/decisions/Cxxx-*.md` (frontier: [C003](../doc/architecture/decisions/C003-signature-mechanism.md) [C004](../doc/architecture/decisions/C004-parameter-schema.md) [C005](../doc/architecture/decisions/C005-templating-system.md) [C008](../doc/architecture/decisions/C008-merge-out-of-scope.md) [C009](../doc/architecture/decisions/C009-array-vs-map.md) **[C011 batch×17](../doc/architecture/decisions/C011-convergent-batch-1.md) [C012 waveA×8](../doc/architecture/decisions/C012-contested-batch-waveA.md)**; meta C001/C002/C006/C007/C010) · glossary → [CONTEXT.md](../CONTEXT.md)
- Spec projections → [specification/candidate-v4/](../specification/candidate-v4/) (signature, parameter-schema, templating, [collections](../specification/candidate-v4/collections-array-vs-map.md))
- Council (guides, not prophets) → [plan/council/](./council/) ([calibration](./council/CALIBRATION.md))
