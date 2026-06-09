# STATE — the spine (read this FIRST, every step)

> This is the thin, always-loaded digest of the OpenAPI v4.0 Candidate walk.
> It **holds** the small active set and **indexes** everything else. Detail is
> reconstructed on demand (`daftar query`, burhan over `plan/facts/`), never carried.
> Mechanism: [C002](../doc/architecture/decisions/C002-recursive-state-mechanism.md). Charter: [C001](../doc/architecture/decisions/C001-candidate-fork-charter.md).

_Last checkpoint: 2026-06-09 — **#16→C003, #20→C004, #127→C005** done & committed; council live (C006/C007). Next: #17._

## ✓ #127 resolved → C005

Workflow `wf_dc8e3394-6d2` (resumed past a rate limit). **RFC6570 parseable profile:** keep the `{var}` surface (3.x continuity), restrict to an injective operator subset in path-identity position, and *add the two artifacts RFC6570 omits* — a normative observable-behavior grammar (handrews' #127 c2 demand) + a normative reverse-parse algorithm. Full-RFC6570 and bare-URLPattern both refuted; EMT's grammar+algorithm grafted; matrix correction (name-bearing matrix is match-safe). **D1-safe** (routes on segment structure, not JSON-Schema). Resolves the named URL→template ambiguity by splitting parse-ambiguity (eliminated) from collision (routed to #16). Honest cost: slash-bearing path params inexpressible. 4 deviations; verdict @0.62. **First council cross-check** (C006): hudlow strong-align, handrews align-with-one-predicted-objection (expressiveness loss — already surfaced in C005). Evidence: [`0127-templating-system.synthesis.md`](./facts/0127-templating-system.synthesis.md).

## ⏳ Pending workflows (one at a time)

1. **Usefulness-replay** — IN FLIGHT `wf_657443b8-854`: validating 8 dispositions + 8 roles (C007) blind against #16/#20. On done: write useful|marginal|drop verdicts into roster files + C007 status.
2. **Council resume** — 4 rate-limited voices (earth2marsh, darrelmiller, karenetheridge, arno-di-loreto).

## ✓ #20 resolved → C004

Workflow `wf_643fa7fa-215` (17 agents, ~1.1M tokens). **The panel overturned the going-in prediction:** handrews' unified `{body,headers,parameters}` wrapper was *refuted as the authoring root* (cookies/trailers unplaced; path+query wrongly merged; default on the wrong axis). Winner = **per-location schema slots (query/path/header/cookie + body) for the common case + an opt-in cross-cutting construct** for the rare cross-type dep; late-record #224 (2026-03) independently converged on those per-location keys. **D1-SAFE** (runtime-only; the unified-vs-separate axis is orthogonal to D1's static-vs-runtime axis). The `in`-dialect candidate was killed (the verifier caught a *miscitation* + body-not-in-namespace). Evidence: [`0020-parameter-schema.synthesis.md`](./facts/0020-parameter-schema.synthesis.md).

## ✓ #16 resolved → C003

Workflow `wf_bebee5d2-131` (24 agents). ADA-first frame; mizan sole-witness caps (0.85) kept over the agent's optimistic self-report; precedence is runtime-only. Evidence: [`0016-signature-mechanism.synthesis.md`](./facts/0016-signature-mechanism.synthesis.md).

## Frontier head (next ~5 — full list in [frontier.md](./frontier.md))

1. **#17 Merge order & precedence** — response/param resolution across request/path/global levels. **Do next.** (First Step to fully use the council A+B+C up front.)
2. **#83 Responses: array vs map** — structural shape of the response collection.
3. **#116 Inheritance on paths** — structural reuse across path sublevels.
4. **#73 JSON Schema dialect + relational vocab** — gates #20's cross-type value-equality (path-ID==body-ID); hard dependency.
5. **#108 Header model** — RFC9110/8941; gates header-aspect signatures (#16) + #20 header slot + #127 request-grammar completion.

## Decisions so far

- Frontier resolved: **4** (#59 IRI, #16 signature, #20 parameter-schema, #127 templating) · Deviations recorded: **9** (#16 ×3, #20 ×2, #127 ×4) · ADRs: C001–C007 (+ `0002-iri-inherited`).
- Last decision: **#127 templating → C005** (RFC6570 parseable profile + normative grammar/reverse-algorithm; D1-safe; verdict @0.62).

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

Run `mizan_recommend_next_experiment(plan/)`, else default: resolve **#17 (merge order & precedence)** — how response/param resolution composes across request/path/global levels (the proposal lets `response` objects live at request, path, or global scope). Read `github-export/discussions/0017.md` first. **This is the first Step to consult the council up front** (A: predict handrews/hudlow; B: pessimist/minimalist on layering complexity; C: hand-author dev on precedence-readability).

## Index (pointers — load on demand)

- Open questions → [plan/frontier.md](./frontier.md)
- Horizon plan → [plan/HORIZONS.md](./HORIZONS.md)
- Burhan ledger → [plan/facts/](./facts/) · spine claims → [plan/MAIN.bn](./MAIN.bn)
- Narrative receipts → `daftar query "<topic>" --project=/home/mk/apps/sig-moonwalk`
- SIG record (priors) → [github-export/](../github-export/) · official ADRs → [doc/architecture/decisions/](../doc/architecture/decisions/)
- Our ADRs → `doc/architecture/decisions/Cxxx-*.md` ([C003](../doc/architecture/decisions/C003-signature-mechanism.md), [C004](../doc/architecture/decisions/C004-parameter-schema.md), [C005 templating](../doc/architecture/decisions/C005-templating-system.md)) · glossary → [CONTEXT.md](../CONTEXT.md)
- Spec projections → [specification/candidate-v4/](../specification/candidate-v4/) ([signature](../specification/candidate-v4/signature-mechanism.md), [parameter-schema](../specification/candidate-v4/parameter-schema.md), [templating](../specification/candidate-v4/templating-system.md))
- Council (guides, not prophets) → [plan/council/](./council/) ([calibration](./council/CALIBRATION.md))
