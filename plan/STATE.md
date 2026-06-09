# STATE — the spine (read this FIRST, every step)

> This is the thin, always-loaded digest of the OpenAPI v4.0 Candidate walk.
> It **holds** the small active set and **indexes** everything else. Detail is
> reconstructed on demand (`daftar query`, burhan over `plan/facts/`), never carried.
> Mechanism: [C002](../doc/architecture/decisions/C002-recursive-state-mechanism.md). Charter: [C001](../doc/architecture/decisions/C001-candidate-fork-charter.md).

_Last checkpoint: 2026-06-09 — **#16 resolved → C003** (committed, reconciled); **#20 in flight** via `wf_643fa7fa-215`._

> **⏳ #20 in flight** — workflow resolving the parameterSchema split (unified vs per-location), scoped D1-safe (runtime-only). On completion: mizan-gate, ADR **C004**, projection, daftar, then pop #20 → next #127. Leading answer: handrews' unified HTTP-object `{body, headers, parameters}`. Watch the **D1↔#20** falsifier (below) — if #20 lands JSON-Schema-in-the-matcher, D1 fires.

## ✓ #16 reconciled

Workflow `wf_bebee5d2-131` completed (24 agents, ~2.0M tokens). Reconciled against C003: **(1)** kept mizan's sole-witness caps (0.85) over the workflow's optimistic 0.9/0.95 — the agent's "no uncapped single-witness claims" self-report was wrong; my direct `mizan_verify_claim` governs. **(2)** Grafted the adversarial-verify fix: concrete-over-variable precedence is now **runtime-only** (not a detection primitive). **(3)** Enriched C003's deferred list (#30, #46/#50, collision-policy, matching-vs-correlating). Full provenance: [`plan/facts/0016-signature-mechanism.synthesis.md`](./facts/0016-signature-mechanism.synthesis.md).

## Frontier head (next ~5 — full list in [frontier.md](./frontier.md))

1. **#20 One parameterSchema or one per location** (URL/header/body)? Core API-shapes split. **Directly downstream of #16's deferred composition.** Do next.
2. **#127 / #23 Path templating** — extended URI Template vs RFC6570 vs WHATWG URLPattern; chosen to best support #16's ADA exposure. URL→template ambiguity (initial-proposal's named open problem).
3. **#17 Merge order & precedence** — response/param resolution across request/path/global levels.
4. **#83 Responses: array vs map** — structural shape of the response collection.
5. **#116 Inheritance on paths** — structural reuse across path sublevels.

## Decisions so far

- Frontier resolved: **2** (#59 IRI, #16 signature) · Deviations recorded: **3** (#16 D1/D2/D3) · ADRs: C001–C003 (+ `0002-iri-inherited`).
- Last decision: **#16 signature mechanism → C003** (ADA-first frame; mizan sole-witness cap @0.85; reconcile-pending vs workflow return).

## Per-Concern confidence map

| Concern | Prior richness | Sections drafted | Aggregate ceiling |
|---|---|---|---|
| API shapes | HIGH (richest discussion energy) | 1 (signature mechanism) | 0.85 frame / **0.5** on contested (declared-indicator, D1–D3) |
| Content schema formats | MEDIUM (SHACL/XSD/JSON-Schema threads) | 0 | — |
| Deployment configuration | LOW → mostly Originated | 0 | — |
| Foundational interfaces | LOW → mostly Originated | 0 | — |
| Mechanical upgrade (3.x→4.0) | LOWEST → fully Originated | 0 | — |

## Active contradictions

- **D1 ↔ #20 tension (monitor):** #16's deviation D1 demotes JSON-Schema discrimination out of the static matcher, siding with the 2025 direction against the only *written* 2022 default (and a live user, Gary/CDMI). If **#20 ratifies JSON-Schema-in-the-matcher**, D1's `falsified_when` fires. Run `burhan-perturb` over `plan/facts/` when #20 resolves.

(General hunt: `burhan-converge` / `burhan-perturb` over `plan/facts/`.)

## Cheapest-next-move

Run `mizan_recommend_next_experiment(plan/)`, else default: resolve **#20 (parameterSchema split)** — it is the composition detail #16 explicitly deferred, so #16's ADA frame is its direct prior. Read `github-export/discussions/0020.md` first.

## Index (pointers — load on demand)

- Open questions → [plan/frontier.md](./frontier.md)
- Horizon plan → [plan/HORIZONS.md](./HORIZONS.md)
- Burhan ledger → [plan/facts/](./facts/) · spine claims → [plan/MAIN.bn](./MAIN.bn)
- Narrative receipts → `daftar query "<topic>" --project=/home/mk/apps/sig-moonwalk`
- SIG record (priors) → [github-export/](../github-export/) · official ADRs → [doc/architecture/decisions/](../doc/architecture/decisions/)
- Our ADRs → `doc/architecture/decisions/Cxxx-*.md` ([C003 signature](../doc/architecture/decisions/C003-signature-mechanism.md)) · glossary → [CONTEXT.md](../CONTEXT.md)
- Spec projections → [specification/candidate-v4/](../specification/candidate-v4/) ([signature-mechanism](../specification/candidate-v4/signature-mechanism.md))
