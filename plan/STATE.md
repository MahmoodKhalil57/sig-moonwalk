# STATE — the spine (read this FIRST, every step)

> This is the thin, always-loaded digest of the OpenAPI v4.0 Candidate walk.
> It **holds** the small active set and **indexes** everything else. Detail is
> reconstructed on demand (`daftar query`, burhan over `plan/ledger/`), never carried.
> Mechanism: [C002](../doc/architecture/decisions/C002-recursive-state-mechanism.md). Charter: [C001](../doc/architecture/decisions/C001-candidate-fork-charter.md).

_Last checkpoint: 2026-06-09 — bootstrap done; **Step #16 in flight**._

## ⏳ In-flight (do not lose)

**#16 signature mechanism** is mid-resolution via workflow `wf_bebee5d2-131` (ultracode: 6 readers → prior-map → 4 candidate designs → 12 adversarial verdicts → synthesis). The synthesis agent's **draft** lives at [`plan/ledger/0016-signature-mechanism.bn`](./ledger/0016-signature-mechanism.bn) (provisional **C003**; parses ✓). Winning frame: **ADA-first**; declared-style-indicator rejected (uniform/implicit ADA contract); static collision-analysis is a bounded desideratum (detect-and-tolerate, three-valued verdict), **not** a mandatory gate; three deviations (D1 JSON-Schema discrimination → runtime last-resort, D2 PR#183 array → optional, D3 floated "MUST detect" → best-effort) each with receipt; #20 and #127 deferred.

**Remaining to close #16 (next session if interrupted):** (1) read the workflow's final structured return, reconcile vs the on-disk draft; (2) `mizan_verify_claim` the riskiest claims (`declared_indicator_verdict` @0.5, the three deviation conclusions); (3) author ADR **C003**; (4) write the projection stub into `specification/`; (5) fire the daftar receipt; (6) bump the tally below (Resolved 2→3, Deviations 0→3) and pop #16 off the frontier head.

## Frontier head (next ~5 — full list in [frontier.md](./frontier.md))

1. **#16 Signature mechanism** — how is an operation's identity declared? (foundational; gates request-selection). Richest-prior, do first.
2. **#20 One parameterSchema or one per location** (URL/header/body)? Core API-shapes split.
3. **#23 / #127 Path templating** — URI Template vs WHATWG URLPattern; URL→template ambiguity (initial-proposal's named open problem).
4. **#17 Merge order & precedence** — response/param resolution across request/path/global levels.
5. **#83 Responses: array vs map** — structural shape of the response collection.

## Decisions so far

- Resolved: **2** · Inherited priors: **1** · Deviations: **0**
- Last decision: `0002-iri-inherited` — adopt IRI support unchanged from SIG ADR 0002 (@>=0.95).

## Per-Concern confidence map

| Concern | Prior richness | Sections drafted | Aggregate ceiling |
|---|---|---|---|
| API shapes | HIGH (richest discussion energy) | 0 | — |
| Content schema formats | MEDIUM (SHACL/XSD/JSON-Schema threads) | 0 | — |
| Deployment configuration | LOW → mostly Originated | 0 | — |
| Foundational interfaces | LOW → mostly Originated | 0 | — |
| Mechanical upgrade (3.x→4.0) | LOWEST → fully Originated | 0 | — |

## Active contradictions

_None recorded yet._ (Hunt with `burhan-converge` / `burhan-perturb` over `plan/ledger/`.)

## Cheapest-next-move

Run `mizan_recommend_next_experiment(plan/)`, else default: ingest+classify the frontier (Concern + prior-richness) for the API-shapes block, then resolve **#16 Signature mechanism** first.

## Index (pointers — load on demand)

- Open questions → [plan/frontier.md](./frontier.md)
- Horizon plan → [plan/HORIZONS.md](./HORIZONS.md)
- Burhan ledger → [plan/ledger/](./ledger/) · spine claims → [plan/MAIN.bn](./MAIN.bn)
- Narrative receipts → `daftar query "<topic>" --project=/home/mk/apps/sig-moonwalk`
- SIG record (priors) → [github-export/](../github-export/) · official ADRs → [doc/architecture/decisions/](../doc/architecture/decisions/)
- Our ADRs → `doc/architecture/decisions/Cxxx-*.md` · glossary → [CONTEXT.md](../CONTEXT.md)
