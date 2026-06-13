# C29. `x-suluk-agents` thinking bound — declare the envelope, never the loop

> **Provenance:** Candidate-fork ADR (Suluk), **not** a SIG decision. ORIGINATED. Operator-surfaced; resolved by a persona council ([C006](./C006-backtested-persona-council.md)/[C007](./C007-council-persona-classes.md)) run as workflow `wf_5aa6a747-cbe` (2026-06-13): **UNANIMOUS 11/11 bound-only** across all three classes — zero votes for full in-protocol, zero for pure runtime-only. Ledger: [`plan/facts/0thinking-bound.bn`](../../../plan/facts/0thinking-bound.bn) + [`0thinking-bound-witness.bn`](../../../plan/facts/0thinking-bound-witness.bn). Honest ceiling **~0.52** (Originated; one real cowpath = Conin's 6-round cap, zero second looped agent; leans on D1's 0.139 floor).

Date: 2026-06-13

## Status

**Accepted (candidate-fork)** at an Originated ceiling **~0.52**. D1-gated: `d1_thinking_bound_safe` authored, `mizan_verify_claim` returned **no bcmea violation**, recommended cap **0.55 = declared** and **above** the 0.139 floor; the executable witness ([`test/agents-d1-invariance.test.ts`](../../../tooling/ts/packages/core/test/agents-d1-invariance.test.ts), now carrying a thinking-bearing block) proves the matcher is invariant. `burhan-converge` clean (238 claims).

## Context

The operator asked whether a "thinking" — bounded internal multi-step processing (reason→tool→reason in the *same* completion, until a response) — should be a first-class protocol construct on a suluk agent, or stay inline in the server route / runtime LLM loop. Conin already runs a hand-rolled **6-round** loop; the C027 expansionist "iterative-loop (maxRounds + stopCondition)" axis was parked as forkable. All three reference frameworks (Strands, the Claude Agent SDK, OpenAI Agents) run the think/act loop in the **runtime**, not a manifest.

The decisive, in-repo argument: the shipped **context-intelligence** analyzer computes load **single-shot** — so a runtime-opaque loop is **invisible** to it; it silently under-counts an agent that thinks 6 rounds. That is a concrete interoperability defect one static integer fixes.

## Decision

Add an **OPTIONAL** static **`thinking`** cap to `SulukAgent` (sibling of `contextBudget`/`maxDepth`, riding the `x-suluk-agents` vendor map — no new normative kind):

```yaml
thinking:
  maxRounds: 6                          # static int >= 1; REQUIRED when `thinking` present
  budget: { tokens: 40000, basis: estimate }   # OPTIONAL; reuses the contextBudget/C024 vocab verbatim
```

- **DECLARED (static, in the contract):** the **cap only** — `maxRounds` (a ceiling on internal rounds) and `budget` (a cost ceiling). Document facts, locally decidable, read by the **context analyzer** + the **linter**, never by `buildAda`/`matchRequest`/`computeSignature`.
- **LEFT TO RUNTIME (opaque, never modeled):** the loop **itself** — when/why each round stops, the reason→tool→reason sequencing, intermediate state, termination behaviour.
- **FORBIDDEN outright:** any `stopCondition`/`stopConditionKind` enum or loop-process descriptor — those model runtime control flow a generator can only echo (the #20 `parameterSchema` tripwire in an enum costume); a blocking lint (`thinking-process-declared`) rejects them. The bound is a number a tool *acts on*; the process is a runtime predicate.

**Consumed, not decorative:** the analyzer folds **round-accretion** into the load — `peakTokens = base + (budget.tokens ?? (maxRounds−1) × residentToolTokens)` — so `no-fitting-model` / `context-over-budget` / `model-too-small` fire honestly on multi-round agents, and `thinking-context-growth` reports the peak. A lint enforces `maxRounds` present-and-positive.

## Consequences — adversarial self-check (none fires)

- **Statically decidable** (hudlow @0.78): `maxRounds`/`budget` are pure literals; the matcher is invariant to a thinking block (test-witnessed). Declaring the *bound* is static like `maxDepth`; declaring the *process* is not — and is forbidden.
- **Whose job** (handrews @0.70): the loop is the runtime's; the *envelope* is the contract's. `core` gains only a structural field; the loop trajectory stays runtime-opaque, matching all three SDKs.
- **NOT redundant with recursion** (the contrarian/purist point, resolved as a category error): a self-delegating sub-agent + `maxDepth` is delegation-**down** (a new completion, scope intersected, context **reset**, bounds nesting **depth**, and would trip the cycle-linter); thinking is the **inverse** (the *same* completion, context **accretes**, bounds iteration **breadth** at fixed depth — Conin's 6 rounds are at depth 0). Orthogonal bounds, like depth vs fan-out.
- **Declared, not enforced** (sibling to C028 `costCeiling{enforcedBy}` + C027 `guarantee`): `maxRounds` caps re-entries; it does **not** enforce termination or determinism. Only the serving adapter (Conin's existing loop) clamps to it; `budget.basis: estimate` is never laundered as a bill.

## Deferred

- The **`stopCondition` vocabulary** — reopens only when a **second, non-Conin** agent has a real internal loop that terminates on something *other* than a round/budget count (a witnessed non-budget terminator). Until then it is unwitnessed decoration.
- A **terminate-at-round enforcement** kill-switch — reserved (built-by-nobody), same trigger class as C028 `costCeiling` enforcement: a real fleet operator running ≥2 third-party-authored looping agents.
