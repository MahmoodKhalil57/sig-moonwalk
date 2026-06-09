# C2. Recursive-state mechanism: a decision-centric walk with a thin spine over a burhan/daftar ledger

> **Provenance:** Candidate-fork ADR — a decision of *this fork effort*, not of the OpenAPI Moonwalk SIG.

Date: 2026-06-09

## Status

Accepted (candidate-fork)

## Context

[C001](./C001-candidate-fork-charter.md) commits us to a *monolithic* Candidate with no per-module finish line, so progress cannot be measured in shipped modules and the context-preservation mechanism is load-bearing. We need a way to walk the whole spec to Completion across many mortal sessions without (a) losing the important information or (b) blowing Claude's context by carrying an ever-growing history. The substrate provides the primitives: **daftar** (durable, token-budgeted receipts), **burhan** (a machine-interpretable claim language — `claim … @>=conf`, `cite`, `falsified_when`), and **mizan** (`recommend_next_experiment`, gates).

## Decision

**Unit of recursion = one decision.** Each step resolves exactly one open design question into either an *Inherited prior* or a *Deviation* (with receipt), emitting a `Cxxx` ADR when the decision is hard-to-reverse. The spec document is a **projection** of the accumulated ledger, not the source of truth.

**State is split into a thin spine and a fat, durable ledger:**

- **Spine** (`plan/STATE.md` + `plan/MAIN.bn`) — loaded at the *start of every step*. ~1 page: the frontier head (next ~5 questions), the last decision, the per-Concern confidence map, active contradictions, the cheapest-next-move, and a **complete index** of pointers into the ledger. Bounded in size forever.
- **Ledger** (`plan/ledger/*.bn` + daftar receipts) — append-only, grows without limit. Burhan files hold the machine-interpretable justification (claims, ceilings, cite-chains, `falsified_when`); daftar holds the narrative receipt of each decision, retrievable under a token budget.

**The invariant** that satisfies "never lose the main information": *indexed ≠ carried.* The spine always **holds** the small active set and always **indexes** everything else. Detail is reconstructed on demand by querying daftar / running burhan over the ledger — never by carrying it in context.

**The step function:**
1. Load the spine (`plan/STATE.md`).
2. Pick the next question via `mizan_recommend_next_experiment` over `plan/`.
3. Pull just the relevant priors (`daftar query`, read the cited discussion from `github-export/`).
4. Resolve → Inherited prior **or** Deviation receipt; write a `plan/ledger/*.bn` claim with its confidence ceiling; emit a `Cxxx` ADR if hard-to-reverse; fire a `daftar add`.
5. Re-project the affected document section from the ledger.
6. Update the spine: advance the frontier, refresh the confidence map, record any new contradiction. Checkpoint (commit).

## Consequences

- Resumption after session death needs only `plan/STATE.md` + the adam-tick's `adam-status.md` — both bounded. The full reasoning is recoverable but not resident.
- Contradiction-hunting is a first-class move: `burhan-converge` / `burhan-perturb` run over `plan/ledger/` surface conflicts between decisions before they reach the document.
- Per-section honesty is enforced: Originated sections carry low burhan ceilings that the confidence map exposes; the document can never silently launder thin invention as settled.
- Risk: the spine can drift from the ledger if a step skips its update. Mitigation: the spine update is step 6, and a `burhan-snapshot` checkpoint makes drift detectable.
