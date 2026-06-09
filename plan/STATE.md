# STATE — the spine (read this FIRST, every step)

> This is the thin, always-loaded digest of the OpenAPI v4.0 Candidate walk.
> It **holds** the small active set and **indexes** everything else. Detail is
> reconstructed on demand (`daftar query`, burhan over `plan/facts/`), never carried.
> Mechanism: [C002](../doc/architecture/decisions/C002-recursive-state-mechanism.md). Charter: [C001](../doc/architecture/decisions/C001-candidate-fork-charter.md).

_Last checkpoint: 2026-06-09 — **#16 resolved → C003** (mizan-capped, committed). One reconcile item open._

## ⏳ Reconcile pending (do not lose)

Workflow `wf_bebee5d2-131` (the #16 synthesis agent) was still finalizing its structured return when #16 was committed from its on-disk draft. **When it lands:** diff its `decision` return against [ADR C003](../doc/architecture/decisions/C003-signature-mechanism.md) + [`plan/facts/0016-signature-mechanism.bn`](./facts/0016-signature-mechanism.bn); graft any superior nuance, else mark reconciled. No blocker — the substantive resolution is already committed.

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

_None recorded yet._ (Hunt with `burhan-converge` / `burhan-perturb` over `plan/facts/`.)

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
