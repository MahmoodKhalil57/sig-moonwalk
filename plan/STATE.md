# STATE — the spine (read this FIRST, every step)

> This is the thin, always-loaded digest of the OpenAPI v4.0 Candidate walk.
> It **holds** the small active set and **indexes** everything else. Detail is
> reconstructed on demand (`daftar query`, burhan over `plan/facts/`), never carried.
> Mechanism: [C002](../doc/architecture/decisions/C002-recursive-state-mechanism.md). Charter: [C001](../doc/architecture/decisions/C001-candidate-fork-charter.md).

_Last checkpoint: 2026-06-09 — 5 resolved; **#83/#32 in flight** via `wf_72360ada-66c` (council-integrated)._

> **⏳ #83/#32 in flight** — user-keyed collections: array vs map. #83 was a dup → real debate is #32 (contested, 10 comments). FIRST council-integrated Step: A-personas (handrews/hudlow/rafalkrupinski) predict BLIND, B/C lenses give red-lines, then readers/prior-map/4-design/12-verify/synthesis. **Live persona test:** handrews has a real position (#32 c10, identification-reframe) → the synthesis scores his blind persona prediction vs reality. On done: mizan-gate → ADR **C009** → projection → next #116. Candidates: blanket-arrays / keep-maps / identification-first / hybrid-optional-names.

## ✓ #17 resolved → C008 (out-of-scope) + conflation fix

#17 turned out to be **document-merge / multi-file composition** (Photoshop-layers/manifest), **not** the response-precedence I'd mislabeled. Record converges out-of-scope (darrelmiller, handrews→Overlay, lornajane 2025-10 "out of scope"). **Inherited** that determination: defer to the **Overlay Specification + tooling**; enterprise need acknowledged+routed. **Right-sized — no workflow** (atom-0011; record uncontested). First proportionality call of the walk. The real **response-level precedence** question is split out as **#17b** (OPEN). Council cross-check: handrews/pragmatist/minimalist align, enterprise-integrator principled dissent (and the *marginal* minimalist was genuinely useful here — a scope Step is its turf).

## ✓ #127 resolved → C005

Workflow `wf_dc8e3394-6d2` (resumed past a rate limit). **RFC6570 parseable profile:** keep the `{var}` surface (3.x continuity), restrict to an injective operator subset in path-identity position, and *add the two artifacts RFC6570 omits* — a normative observable-behavior grammar (handrews' #127 c2 demand) + a normative reverse-parse algorithm. Full-RFC6570 and bare-URLPattern both refuted; EMT's grammar+algorithm grafted; matrix correction (name-bearing matrix is match-safe). **D1-safe** (routes on segment structure, not JSON-Schema). Resolves the named URL→template ambiguity by splitting parse-ambiguity (eliminated) from collision (routed to #16). Honest cost: slash-bearing path params inexpressible. 4 deviations; verdict @0.62. **First council cross-check** (C006): hudlow strong-align, handrews align-with-one-predicted-objection (expressiveness loss — already surfaced in C005). Evidence: [`0127-templating-system.synthesis.md`](./facts/0127-templating-system.synthesis.md).

## ✓ Council fully live (A backtested, B/C replay-validated)

Class B/C usefulness-replay done (`wf_657443b8-854`): **13 useful, 3 marginal, 0 drop** ([USEFULNESS.md](./council/USEFULNESS.md)). The council (A: hudlow/handrews/rafalkrupinski; B: 6 useful dispositions; C: 7 useful roles) is ready to use up-front on the next Step. Optimist flagged biased-to-refuted-pole.

## ⏳ Pending workflow

1. **Council resume** — 4 rate-limited Class-A voices (earth2marsh, darrelmiller, karenetheridge, arno-di-loreto). Optional; do before leaning harder on Class A.

## ✓ #20 resolved → C004

Workflow `wf_643fa7fa-215` (17 agents, ~1.1M tokens). **The panel overturned the going-in prediction:** handrews' unified `{body,headers,parameters}` wrapper was *refuted as the authoring root* (cookies/trailers unplaced; path+query wrongly merged; default on the wrong axis). Winner = **per-location schema slots (query/path/header/cookie + body) for the common case + an opt-in cross-cutting construct** for the rare cross-type dep; late-record #224 (2026-03) independently converged on those per-location keys. **D1-SAFE** (runtime-only; the unified-vs-separate axis is orthogonal to D1's static-vs-runtime axis). The `in`-dialect candidate was killed (the verifier caught a *miscitation* + body-not-in-namespace). Evidence: [`0020-parameter-schema.synthesis.md`](./facts/0020-parameter-schema.synthesis.md).

## ✓ #16 resolved → C003

Workflow `wf_bebee5d2-131` (24 agents). ADA-first frame; mizan sole-witness caps (0.85) kept over the agent's optimistic self-report; precedence is runtime-only. Evidence: [`0016-signature-mechanism.synthesis.md`](./facts/0016-signature-mechanism.synthesis.md).

## Frontier head (next ~5 — full list in [frontier.md](./frontier.md))

1. **#83 Responses: array vs map** — structural shape of the response collection. **Do next** (first Step to use the full validated council A+B+C up front).
2. **#17b Response-level precedence** *(split from #17)* — apiResponses vs pathResponses vs request-level; `parameterSchema` `allOf` composition. The genuine precedence question.
3. **#116 Inheritance on paths** — structural reuse across path sublevels.
4. **#73 JSON Schema dialect + relational vocab** — gates #20's cross-type value-equality (path-ID==body-ID); hard dependency.
5. **#108 Header model** — RFC9110/8941; gates header-aspect signatures (#16) + #20 header slot + #127 request-grammar completion.

## Decisions so far

- Frontier resolved: **5** (#59 IRI, #16 signature, #20 parameter-schema, #127 templating, #17 merge/out-of-scope) · Deviations recorded: **9** (#16 ×3, #20 ×2, #127 ×4; #17 none — inherited) · ADRs: C001–C008 (+ `0002-iri-inherited`).
- Last decision: **#17 → C008** (document-merge out-of-scope, defer to Overlay Spec; inherited prior; right-sized, no workflow).

## Per-Concern confidence map

| Concern | Prior richness | Sections drafted | Aggregate ceiling |
|---|---|---|---|
| API shapes | HIGH (richest discussion energy) | 3 (signature, parameter schema, templating) | 0.85 directional / **0.5–0.62** on contested shapes (declared-indicator, #20 slots, #127 profile, deviations) |
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

Run `mizan_recommend_next_experiment(plan/)`, else default: resolve **#83 (responses: array vs map)** — should the response collection be an array or a status-keyed map? Structural, with real prior energy. Read `github-export/discussions/0083.md` first. **First Step to use the full validated council up front** (A: predict handrews/hudlow/rafalkrupinski; B-useful: expansionist/purist/pessimist/pragmatist/contrarian/conservative; C-useful: codegen-author/platform/tech-writer/hand-author/security/enterprise/ai-llm). **Right-size first** (as #17 showed): check the record's contention level before launching a full workflow.

## Index (pointers — load on demand)

- Open questions → [plan/frontier.md](./frontier.md)
- Horizon plan → [plan/HORIZONS.md](./HORIZONS.md)
- Burhan ledger → [plan/facts/](./facts/) · spine claims → [plan/MAIN.bn](./MAIN.bn)
- Narrative receipts → `daftar query "<topic>" --project=/home/mk/apps/sig-moonwalk`
- SIG record (priors) → [github-export/](../github-export/) · official ADRs → [doc/architecture/decisions/](../doc/architecture/decisions/)
- Our ADRs → `doc/architecture/decisions/Cxxx-*.md` ([C003](../doc/architecture/decisions/C003-signature-mechanism.md), [C004](../doc/architecture/decisions/C004-parameter-schema.md), [C005](../doc/architecture/decisions/C005-templating-system.md), [C008 merge-out-of-scope](../doc/architecture/decisions/C008-merge-out-of-scope.md); meta C001/C002/C006/C007) · glossary → [CONTEXT.md](../CONTEXT.md)
- Spec projections → [specification/candidate-v4/](../specification/candidate-v4/) ([signature](../specification/candidate-v4/signature-mechanism.md), [parameter-schema](../specification/candidate-v4/parameter-schema.md), [templating](../specification/candidate-v4/templating-system.md))
- Council (guides, not prophets) → [plan/council/](./council/) ([calibration](./council/CALIBRATION.md))
