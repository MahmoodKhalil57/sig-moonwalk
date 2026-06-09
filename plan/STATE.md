# STATE — the spine (read this FIRST, every step)

> This is the thin, always-loaded digest of the OpenAPI v4.0 Candidate walk.
> It **holds** the small active set and **indexes** everything else. Detail is
> reconstructed on demand (`daftar query`, burhan over `plan/facts/`), never carried.
> Mechanism: [C002](../doc/architecture/decisions/C002-recursive-state-mechanism.md). Charter: [C001](../doc/architecture/decisions/C001-candidate-fork-charter.md).

_Last checkpoint: 2026-06-09 — **#16 → C003** and **#20 → C004** both resolved, committed, mizan-gated. Next: #127._

## ✓ #20 resolved → C004

Workflow `wf_643fa7fa-215` (17 agents, ~1.1M tokens). **The panel overturned the going-in prediction:** handrews' unified `{body,headers,parameters}` wrapper was *refuted as the authoring root* (cookies/trailers unplaced; path+query wrongly merged; default on the wrong axis). Winner = **per-location schema slots (query/path/header/cookie + body) for the common case + an opt-in cross-cutting construct** for the rare cross-type dep; late-record #224 (2026-03) independently converged on those per-location keys. **D1-SAFE** (runtime-only; the unified-vs-separate axis is orthogonal to D1's static-vs-runtime axis). The `in`-dialect candidate was killed (the verifier caught a *miscitation* + body-not-in-namespace). Evidence: [`0020-parameter-schema.synthesis.md`](./facts/0020-parameter-schema.synthesis.md).

## ✓ #16 resolved → C003

Workflow `wf_bebee5d2-131` (24 agents). ADA-first frame; mizan sole-witness caps (0.85) kept over the agent's optimistic self-report; precedence is runtime-only. Evidence: [`0016-signature-mechanism.synthesis.md`](./facts/0016-signature-mechanism.synthesis.md).

## Frontier head (next ~5 — full list in [frontier.md](./frontier.md))

1. **#127 / #23 Path templating** — extended URI Template vs RFC6570 vs WHATWG URLPattern. **Now the critical path:** it gates both #16's ADA literal-vs-variable exposure AND #20's query/path instance→data-model mapping into the per-location slots. Do next.
2. **#17 Merge order & precedence** — response/param resolution across request/path/global levels.
3. **#83 Responses: array vs map** — structural shape of the response collection.
4. **#116 Inheritance on paths** — structural reuse across path sublevels.
5. **#73 JSON Schema dialect + relational vocab** — gates #20's cross-type value-equality (path-ID==body-ID); hard dependency.

## Decisions so far

- Frontier resolved: **3** (#59 IRI, #16 signature, #20 parameter-schema) · Deviations recorded: **5** (#16 D1/D2/D3, #20 D1-20/D2-20) · ADRs: C001–C004 (+ `0002-iri-inherited`).
- Last decision: **#20 parameter-schema → C004** (per-location slots + opt-in cross-cutting; D1-safe runtime-only; verdict @0.55, directional core @0.85).

## Per-Concern confidence map

| Concern | Prior richness | Sections drafted | Aggregate ceiling |
|---|---|---|---|
| API shapes | HIGH (richest discussion energy) | 2 (signature mechanism, parameter schema) | 0.85 directional / **0.5–0.6** on contested shapes (declared-indicator, #20 slots, D1–D3, D1-20/D2-20) |
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

Run `mizan_recommend_next_experiment(plan/)`, else default: resolve **#127 (templating system)** — now the critical path, gating both #16's literal-vs-variable ADA exposure and #20's query/path instance→data-model mapping. Read `github-export/discussions/0127.md` first (extended URI Template vs RFC6570 vs WHATWG URLPattern; darrelmiller's "URI Templates not designed for parsing").

## Index (pointers — load on demand)

- Open questions → [plan/frontier.md](./frontier.md)
- Horizon plan → [plan/HORIZONS.md](./HORIZONS.md)
- Burhan ledger → [plan/facts/](./facts/) · spine claims → [plan/MAIN.bn](./MAIN.bn)
- Narrative receipts → `daftar query "<topic>" --project=/home/mk/apps/sig-moonwalk`
- SIG record (priors) → [github-export/](../github-export/) · official ADRs → [doc/architecture/decisions/](../doc/architecture/decisions/)
- Our ADRs → `doc/architecture/decisions/Cxxx-*.md` ([C003 signature](../doc/architecture/decisions/C003-signature-mechanism.md), [C004 parameter-schema](../doc/architecture/decisions/C004-parameter-schema.md)) · glossary → [CONTEXT.md](../CONTEXT.md)
- Spec projections → [specification/candidate-v4/](../specification/candidate-v4/) ([signature-mechanism](../specification/candidate-v4/signature-mechanism.md), [parameter-schema](../specification/candidate-v4/parameter-schema.md))
