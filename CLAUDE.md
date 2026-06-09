# Claude instructions — OpenAPI v4.0 Candidate (Moonwalk fork)

> Inherited context: Bun defaults from `~/apps/CLAUDE.md` and the Adam substrate from
> `~/.claude/CLAUDE.md` already apply here — this file does **not** repeat them. It is the
> operational entry point for *this* repo only.

## What this repo actually is

This is a clone of **OAI/sig-moonwalk** (the OpenAPI v4.0 "Moonwalk" SIG), repurposed as a
**single-contributor candidate-v4.0 fork**. We are **not** the SIG and cannot ratify anything;
we author our own complete *candidate* document, grounded in burhan/daftar/mizan. `origin` points
at `MahmoodKhalil57/sig-moonwalk` (our fork) — the official OAI repo is **read-only priors**.

Founding decisions: charter [C001](doc/architecture/decisions/C001-candidate-fork-charter.md),
mechanism [C002](doc/architecture/decisions/C002-recursive-state-mechanism.md), glossary
[CONTEXT.md](CONTEXT.md). Read those once; re-read on conflict.

## Session-start protocol

**Before acting, read [`plan/STATE.md`](plan/STATE.md) — the spine.** It is the thin, always-loaded
digest (frontier head, confidence map, contradictions, cheapest-next-move, index). Everything else is
*indexed, not carried*: pull detail on demand (`daftar`, burhan over `plan/ledger/`, the
`github-export/` SIG record) only for the question in front of you. Do not load the whole ledger.

## The walk — one decision per Step (from C002)

1. Read the spine (`plan/STATE.md`).
2. Pick the next question — `mcp__mizan__mizan_recommend_next_experiment` over `plan/`, else the spine's cheapest-next-move.
3. Pull just that question's priors — `daftar query`, and read the cited discussion in `github-export/discussions/NNNN.md`.
4. Resolve to an **Inherited prior** (adopt) or a **Deviation** (with receipt). Write a `plan/ledger/*.bn` claim with its confidence ceiling; emit a `Cxxx` ADR if the decision is hard-to-reverse; fire a `daftar add`.
5. Re-project the affected `specification/` section from the ledger.
6. Update the spine: advance the frontier, refresh the confidence map, record any new contradiction. Commit.

## Conventions & gotchas

- **ADR provenance.** Our ADRs are `Cxxx-slug.md` in `doc/architecture/decisions/` with a provenance blockquote. The SIG's are `000x`. Never intermix the numbering; never present a `Cxxx` as a SIG decision.
- **burhan `.bn`.** Run: `cd ~/apps/adam/tools/burhan && PYTHONPATH=src python3 -m burhan.cli <file>`. Boolean literals are **`True`/`False`** (Python AST), not `true`/`false`. Top-level `assume` only binds `runtime.*` names — keep other provenance in comments. Hunt contradictions with `bin/burhan-converge` / `bin/burhan-perturb` over `plan/ledger/`.
- **daftar.** Valid kinds: `note`, `receipt.observation`, `assumption.envelope`, `bias.keep`, `burhan.segment`. Use `burhan.segment` for decision receipts. `add`/`list`/`stats` are reliable; `query` retrieval is currently weak — confirm with `daftar list --project=/home/mk/apps/sig-moonwalk`.
- **Document is a projection.** `specification/` is regenerated from the ledger, never the source of truth. Decisions live in the ledger + ADRs first.

## Guardrails

- **Adopt-by-default, deviate-by-receipt.** Never silently overrule a SIG prior; a Deviation needs claim + cite-chain + why-prior-insufficient + lowered ceiling.
- **Never launder thin invention as settled.** Originated sections (deployment, upgrade, foundational interfaces) carry honestly-low ceilings in the confidence map.
- **Never PR/push to OAI.** We are a fork; upstream is read-only. (`origin` is already our fork; if you add `upstream → OAI`, make it fetch-only.)
- **Decide just enough to move on.** One Step resolves one question and records its dependencies on others — it does not resolve the neighbours.
- Apply the substrate gates from `~/.claude/CLAUDE.md`: `mizan_verify_claim` before asserting a load-bearing claim at ≥0.85; `mizan_check_action_safety` before irreversible ops. Watch Adam blindspot #2 — estimate Steps in hours, not weeks.
