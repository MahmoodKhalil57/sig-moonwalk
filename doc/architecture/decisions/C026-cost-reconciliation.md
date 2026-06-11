# C26. Cost reconciliation — `declared-estimate` vs the third party's actual charge

> **Provenance:** Candidate-fork ADR (Suluk), not a SIG decision. CONVERGENT follow-on closing the LAST deferred piece of the cost-on-event topic ([C024](./C024-cost-trigger-and-attribution.md)/[C025](./C025-jobs-vendor-map.md)). The C024 council's enterprise-integrator voice literally proposed this discriminator (`reconciliationBasis` with `declared-estimate` / `payload-reconciled`), so resolved DIRECTLY — adversarial self-check in the ledger + `burhan-converge` backstop. Ledger: [`plan/facts/0cost-reconciliation.bn`](../../../plan/facts/0cost-reconciliation.bn).

Date: 2026-06-11

## Status

Accepted (candidate-fork) at the C024-tracking Originated ceiling (~0.58). burhan-converge clean (218 claims).

## Context

C024/C025 let a cost declare it accrues on a background event + who pays — but the recorded amount was still the operator's **declared estimate**. The real charge a third party makes when the event fires (Stripe's `payment_intent.succeeded`) differs: proration, tax, partial refunds, chargebacks. C024 flagged this as a deferred `reconciliationBasis` extension.

## Decision

A **fourth orthogonal axis** on `x-suluk-cost` (`basis` = how it meters · `trigger` = when it fires · `attribution` = who pays · **`reconciliationBasis`** = is the amount the real charge):

- **`reconciliationBasis: "declared-estimate"` (default) | `"payload-reconciled"`.** A `payload-reconciled` cost reads the **actual** charged amount from the event at runtime via **`amountExpression`** (a C018 runtime-expression, e.g. `{$event.body#/amount}`) in a declared **`amountUnit`** (`micro-usd` default | `cents` for Stripe | `usd`). The recorded `CostEvent.totalMicroUsd` becomes the real invoice line, with `CostEvent.reconciled = true`.
- The **static** part (`reconciliationBasis` enum + `amountUnit`) is locally decidable (hudlow); the **`amountExpression` is runtime-only** — never the static matcher, exactly as C024 walls `attribution.expression`.
- **`@suluk/cost`** runtime: `reconciledAmount` + `eventCostEvent` apply it (the actual charge replaces the estimate). **Audit**: a `payload-reconciled` cost with no `amountExpression` raises `reconciliation-incomplete` (fail-loud — it falls back to the estimate, surfaced not silent).

## Consequences

- Orthogonality (handrews): a distinct axis, not overloaded onto `basis`/`trigger`/`attribution`.
- Scope (conservative): still a vendor-extension dimension, orthogonal to the normative core; does **not** reopen C018's async scope. **Closes the reconciliation gap** C024/C025 declared deferred — the cost-on-event topic is now complete.
