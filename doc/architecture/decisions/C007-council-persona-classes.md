# C7. Council persona classes — individuals, dispositions, and roles, with class-specific epistemic gates

> **Provenance:** Candidate-fork ADR — a decision of *this fork effort* (Suluk), not of the OpenAPI Moonwalk SIG. Extends [C006](./C006-backtested-persona-council.md).

Date: 2026-06-09

## Status

Accepted (candidate-fork). Class A is validated (C006). Classes B and C are authored (`plan/council/dispositions.md`, `plan/council/roles.md`) — **pending usefulness-replay validation** against the resolved Steps (#16, #20).

## Context

[C006](./C006-backtested-persona-council.md) built backtested personas of *real* SIG voices. We want to widen the council with (a) **philosophical dispositions** (optimist, pessimist, expansionist, contrarian, …) and (b) **industry roles** affected by the standard (codegen author, platform architect, security reviewer, …). But neither is a real individual: a disposition predicts *no one*, and a role is a *synthetic stakeholder*. They cannot be predictively backtested. Letting them wear C006's "calibrated" badge would launder invented opinion as validated prediction — the exact failure C006 prevents.

## Decision

Three council **classes**, each with its own epistemic gate. No class may borrow another's gate.

- **Class A — Individual** (real named people; e.g. handrews, hudlow). Gate: **blind predictive backtest**; ceiling = out-of-sample hit-rate (C006). Use: predict a real person's likely objection.
- **Class B — Disposition** (archetypes; e.g. optimist · pessimist · expansionist · minimalist · contrarian · conservative/continuity · pragmatist · purist). Predicts no one. Gate: **none predictive** — a fixed "lens, not prediction" label, *plus* a **usefulness-replay**: does the lens surface considerations that genuinely mattered when replayed on resolved Steps? Use: dispositional stress-test (coverage of failure modes and desires), **never** "what person X will say."
- **Class C — Role** (synthetic stakeholders affected by the standard; e.g. SDK/codegen author · API platform/gateway architect · technical writer · hand-author backend dev · security reviewer · DevEx PM · enterprise integrator · AI/LLM consumer). Gate: usefulness-replay **+ grounding** where the SIG record or industry practice evidences the role's needs. Ceiling: moderate/capped, labeled "synthetic stakeholder."

**Usefulness-replay (the gate for B and C).** Before trusting a B/C lens, replay it against already-resolved Steps and score whether it surfaces considerations that *actually appeared* in the record or in our decision (true positives), versus noise. This is the honest analog of the predictive backtest: a lens earns its place by catching real issues on decided questions, not by predicting a person.

**Integration into a Step.** Class A predicts likely real objections (gated). Class B stress-tests candidates dispositionally. Class C asks "who does this help/hurt?". All feed a Step's prior-map as **considerations/hypotheses**, never ground truth, and never raise a decision's own ceiling.

## Consequences

- The council is now a coverage instrument, not just a prediction instrument. B/C reduce blind spots; A predicts real pushback.
- Strict labeling: B/C files carry no predictive ceiling and an explicit "lens / synthetic — not a real person's view" banner. A reader must never confuse a disposition with an individual.
- Risk: archetype noise. Mitigation: the usefulness-replay drops lenses that don't catch real issues; B/C findings are weighed, not counted.
- Candidate khazīna atom (with C006): *a tiered persona council with class-specific epistemic gates — predictive-backtest for individuals, usefulness-replay for dispositions and roles* — assess after B/C replay-validation lands.
