# STATE — the spine (read this FIRST, every step)

> This is the thin, always-loaded digest of the OpenAPI v4.0 Candidate walk.
> It **holds** the small active set and **indexes** everything else. Detail is
> reconstructed on demand (`daftar query`, burhan over `plan/facts/`), never carried.
> Mechanism: [C002](../doc/architecture/decisions/C002-recursive-state-mechanism.md). Charter: [C001](../doc/architecture/decisions/C001-candidate-fork-charter.md).

_Last checkpoint: 2026-06-12 — **TOOLING-READY + extended**: candidate decided (C001–C019) + tooling shipped (the @suluk/* ecosystem, saastarter-parity Phases 0–2). Latest spec Step: **C027 suluk-agents** (operator-surfaced, council-resolved, D1-gated) — a composition standard layered on the candidate. Before that: C024/C025/C026 cost-on-event. Ready to continue._

## ✓ C027 — suluk-agent composition standard (operator-surfaced; build-scoped-pilot @0.52)

Operator surfaced a real cowpath: **Conin** (Construction Intelligence) is already a *suluk agent* (skills + deterministic routes + an intelligent tier) shipped as one Claude plugin + servable by OpenRouter — but with NO standard describing the composition. Council panel (`wf_9e8712c7-871`, 14 voices: **11 support-with-conditions, 3 reframe, 0 oppose**; 3 SDKs — Strands / Claude Agent SDK / OpenAI Agents — corroborate the shape). **[C027](../doc/architecture/decisions/C027-suluk-agents-composition-map.md)** (@0.52, [`0agents-d1.bn`](./facts/0agents-d1.bn) + [`0agents-d1-witness.bn`](./facts/0agents-d1-witness.bn), converge clean 226): an OPTIONAL top-level **`x-suluk-agents`** name-keyed map of **`SulukAgent`**, riding the **C025 `x-suluk-jobs` precedent EXACTLY** (no new normative kind, no meta-schema change). A SulukAgent = **skills** (model-bearing; provenance pointer `source`+`contentHash`+`version`, SKILL.md GENERATED not inlined) + **routes** (by-name `operationRef` `$ref`s into EXISTING ops, **no `model`** — that absence is the hard route-vs-skill discriminator) + optional **agents** (by-name sub-refs; cycle-linted + REQUIRED `maxDepth`; built-by-nobody until a 2nd real nested agent). Selection/tiering **runtime-advisory only**; determinism **DECLARED not enforced**. Types added to `core/src/types.ts` (`SulukAgent`/`SulukSkillRef`/`SulukRouteRef`/`SulukAgentRef`, structural-only, mirrors SulukJob). **D1 GATE PASSED** (the council's hard pre-landing gate): claim `d1_agent_selector_safe` — `mizan_verify_claim` no-bcmea, cap 0.55 = declared and **above the 0.139 D1 floor**; independent maintained witness [`test/agents-d1-invariance.test.ts`](../tooling/ts/packages/core/test/agents-d1-invariance.test.ts) (3 pass) proves `buildAda`/`matchRequest` are **invariant** to an `x-suluk-agents` block, even a cyclic one. **Honesty (council-forced):** the operator's "tiering SOLVES the context problem" was adversarially **REFUTED** (tiering relocates+duplicates context; Conin's public MCP `tools/list` ships the FULL catalog → 0 context saved in the served path today) and **reframed** to "makes allocation EXPLICIT + per-tier cost AUDITABLE — a CONDITIONAL reduction a conforming adapter must deliver"; Conin is non-conformant day-one (named conformance-failure fixtures). Receipt `burhan.segment` C027. **DEFERRED:** the `@suluk/agents` projector (flat-first → Claude plugin + OpenRouter manifest), recursion machinery, tier-trim-serving mandate, runtime determinism gate, enterprise `x-suluk-policy` overlay, expansionist static axes (streaming/loop/human-gate/memory).

## ✓ C024/C025/C026 — background-event cost (operator-surfaced; topic COMPLETE)

Operator surfaced a real gap: cost is often incurred when a BACKGROUND EVENT fires (a Stripe webhook charges you; cron; queue; a callback completes), not when a route runs — and `x-suluk-cost` was request-relative only. Council panel (`wf_026469fd-1f3`, C006/C007 classes + C010 pattern): A = hudlow .78 / handrews .70 / rafalkrupinski .70 + B/C lenses; 8/10 voices → candidate-b (split form). **[C024](../doc/architecture/decisions/C024-cost-trigger-and-attribution.md)** (@0.58, [`0cost-trigger.bn`](./facts/0cost-trigger.bn), converge clean 213): three ORTHOGONAL axes on `x-suluk-cost` — **basis** (HOW it meters; UNCHANGED — no `per-event`, rejecting the double-duty) · **trigger** (WHEN it fires; NEW static closed enum `synchronous`|`webhook-received`|`scheduled`|`queue-consumed`|`callback-completed`, default `synchronous` zero-migration, + `triggerRef`; locally decidable — passes hudlow) · **attribution** (WHO pays; NEW runtime-only strategy modeled on `SulukRateLimit.key`, the `event-expression` kept OUT of the static matcher exactly as C018 walls callback keys; no-session gated on Open-Dec #5). Fail-loud `@unattributed` + `unattributed-background-cost`/`unverified-attribution` audit findings; `costAudit`/`annotateCosts`/`costTable` now walk webhooks. **Does NOT reopen C018's async scope** (a vendor-ext dimension, orthogonal — same move as x-suluk-ratelimit vs C012/#43). Reference UI: `costRollup` walks webhooks + a `.deferred` count + a `↯ charged on: <trigger>` badge. Receipt `seg-3dc4e01757`. **C025 follow-on** ([ADR](../doc/architecture/decisions/C025-jobs-vendor-map.md), convergent — C024-pre-blessed, [`0cost-jobs.bn`](./facts/0cost-jobs.bn), converge 216): a top-level `x-suluk-jobs` name-keyed map of `SulukJob` (non-HTTP cron/queue work, no Request) so cron/queue cost has a first-class home; `@suluk/cost` `eachJob`/`costLoci` walk it, reference rolls it in. **C026** ([ADR](../doc/architecture/decisions/C026-cost-reconciliation.md), convergent — C024-council-proposed, [`0cost-reconciliation.bn`](./facts/0cost-reconciliation.bn), converge 218): a 4th orthogonal axis `reconciliationBasis: declared-estimate|payload-reconciled` — a payload-reconciled cost reads the ACTUAL charge from the event (amountExpression+amountUnit, runtime-only) so the recorded total is the real invoice line. **Topic COMPLETE** (webhooks+cron/queue · trigger+attribution+reconciliation · facet+runtime+docs UI).

## ✓ C010 Wave-2B1 → C013 (referencing cluster, 4 facets, one panel)

Council-integrated panel `wf_b4344a37-dcd` resolved #73/#72/#49/#26 as one: **adopt JSON Schema 2020-12 + defer-the-grammar.** Dialect EXPLICITLY DECLARED + statically/locally decidable at DOM→ADA (@0.85); **typed-component-name is the primary identity** (map key = canonical, by-name-never-index per C009; @0.62); OpenAPI Reference Object INDEPENDENT of JSON-Schema `$ref` (#49, near-unanimous @0.62); **Imports Object** = namespace+href pairs, absolute-IRI no-fragment (#72 @0.6); resolve by-stable-name default (#26 @0.7). 2 deviations (identity-mechanism, json-pointer policy). **2nd live council hit:** handrews persona predicted the holistic frame + the #49 divorce + that he'd *defer the grammar* — matched his real comment verbatim; its pre-registered valence-inversion risk caught the over-normative ADOPT candidate. Deferred: exact fragment byte-grammar, version pin, relational value-equality vocab (#24/#100).

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
- **C027 follow-on (agent track) — ✓ projector + marketplace-signing + scope-intersection SHIPPED.** [`@suluk/agents`](../tooling/ts/packages/agents/) (separate pkg; `core`-never-imports invariant test-enforced): `lintAgents` (cycle/maxDepth/dangling-ref/**D1 selector-rejection**/route-has-model/**scope-escalation**), the **twin projection** `projectClaudePlugin` (`plugin.json`+`.mcp.json` host-side-OAuth-no-creds+`SKILL.md` w/ sha256 `contentHash`+`version` stamp) + `projectOpenRouter` — both PURE/deterministic/fail-loud; `reachableSurface`/`assertServedSubset` (over-serve auditor) + `verifySkillFreshness`; **scope-intersection** (`analyzeScopes` — child effective = INTERSECTION(child, caller), escalation = error); and the **signable `agentManifest`** (carries every skill `contentHash` + effective scope) signed via @suluk/builder's existing ECDSA-P256 `signRegistry` so the C021 signature **covers preprompt drift** (council open-Q #8: `verifyAgentFreshness` catches a served preprompt that drifts after mint; structural tamper breaks the signature). Conin + its day-one gaps (dangling `run_core_primitive`, over-serve, scope-escalation) are NAMED failure fixtures. **31 tests pass (7 files), tsc clean; core 34 pass.** Plus the **cockpit OBSERVE surface** ([`@suluk/cockpit` `agentsView`/`agentsSummary`](../tooling/ts/packages/cockpit/src/agents.ts)): the tier tree + effective scope + gate findings + reachable surface + a names-only projection preview — strictly read-only (no execution/creds, C020 seam); 6 tests, full cockpit suite 121 pass. **All shipped to the fork** (commits `4b372c2`/`7e60f3b`/`5be6861`; npm publish needs the release token, not present in-env). STILL DEFERRED behind contested-decision reopen-triggers: recursion machinery beyond one hop, the tier-trim-serving mandate, the runtime determinism gate, the enterprise `x-suluk-policy` overlay, and the expansionist static axes (streaming/loop/human-gate/memory).

## Frontier head — ~10 left, dependency waves (full list in [frontier.md](./frontier.md))

- **Wave A — DONE 9/9** (→ C012). **Wave B — DONE** (B1 referencing → C013; B2 dependents → C014).
- **Wave C1 — DONE** (#108 header-model · #23/#30 · #56 · #113 · #55 → C015). #108 unblocks the #16 header-aspect.
- **Wave C2** (after C1): **#163** media-type-params (needs #108) · **#upgrade** mechanical 3.x→4.0 (capstone — consults all ADRs).

## Decisions so far

- Frontier resolved: **51** — all ~56 seeded questions resolved or accounted-for · Deviations: **27+** · ADRs: **C001–C027** (+ `0002`). callbacks/webhooks closed (C018); cost-on-event closed (C024/C025/C026); **suluk-agent composition standard added (C027, D1-gated, scoped pilot)**.
- Last: **C027 suluk-agents** (operator-surfaced; council `wf_9e8712c7-871` → build-scoped-pilot @0.52; D1 gate `d1_agent_selector_safe` PASSED + test-witnessed). Before that: C024/C025/C026 cost-on-event; C010 Wave-1 batch → C011.

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
- **Product track** (the extension as cockpit + modules + marketplace) → [plan/EXTENSION-ROADMAP.md](./EXTENSION-ROADMAP.md) — decided 2026-06-10 by a 6-lens council ([C020](../doc/architecture/decisions/C020-extension-cockpit-charter.md) charter, [C021](../doc/architecture/decisions/C021-modules-contract-merge-marketplace.md) modules). **COMPLETE — nothing left.** S1·S2·M2·M1·M3·L1 + signed-registries·L2·converge·D2(ext/app/docs)·component-confidence·L3 ship-readiness·**live role-preview** all built, adversarially reviewed (72 findings fixed), and shipped (npm + Marketplace; vscode `0.1.14`). The originated L3 AND the last optional item (role-preview) are both done.
- Burhan ledger → [plan/facts/](./facts/) · spine claims → [plan/MAIN.bn](./MAIN.bn)
- Narrative receipts → `daftar query "<topic>" --project=/home/mk/apps/suluk`
- SIG record (priors) → [github-export/](../github-export/) · official ADRs → [doc/architecture/decisions/](../doc/architecture/decisions/)
- Our ADRs → `doc/architecture/decisions/Cxxx-*.md` (frontier: [C003](../doc/architecture/decisions/C003-signature-mechanism.md) [C004](../doc/architecture/decisions/C004-parameter-schema.md) [C005](../doc/architecture/decisions/C005-templating-system.md) [C008](../doc/architecture/decisions/C008-merge-out-of-scope.md) [C009](../doc/architecture/decisions/C009-array-vs-map.md) **[C011 batch×17](../doc/architecture/decisions/C011-convergent-batch-1.md) [C012 waveA×8](../doc/architecture/decisions/C012-contested-batch-waveA.md) [C013 referencing×4](../doc/architecture/decisions/C013-referencing-cluster.md) [C014 waveB2×5](../doc/architecture/decisions/C014-contested-batch-waveB2.md) [C015 waveC1×6](../doc/architecture/decisions/C015-contested-batch-waveC1.md)**; meta C001/C002/C006/C007/C010) · glossary → [CONTEXT.md](../CONTEXT.md)
- **Tooling substrate** → [v4-meta-schema.json](../specification/candidate-v4/v4-meta-schema.json) (validates docs) · [v4-types.ts](../specification/candidate-v4/v4-types.ts) (TS model) · [conformance/](../specification/candidate-v4/conformance/) (corpus + ADA contract) · [CONFIDENCE.md](../specification/candidate-v4/CONFIDENCE.md) (soft points) · SPEC Appendix A (grammars)
- Worked example → [examples/petstore.suluk.yaml](../specification/candidate-v4/examples/petstore.suluk.yaml) (validates the candidate)
- **Candidate spec document → [specification/candidate-v4/SPEC.md](../specification/candidate-v4/SPEC.md)** (Completion v1, ~27k words, 91 flagged-provisional points) · section stubs in the same dir
- Council (guides, not prophets) → [plan/council/](./council/) ([calibration](./council/CALIBRATION.md))
