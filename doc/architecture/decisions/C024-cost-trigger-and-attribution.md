# C24. Background-event cost — a static `trigger` + a runtime `attribution` on `x-suluk-cost`

> **Provenance:** Candidate-fork ADR (Suluk), not a SIG decision. Operator-surfaced: cost is often incurred not when a route runs, but when a BACKGROUND EVENT fires (a Stripe webhook charges you; a cron/scheduled job; a queue consumer; a callback completes). Resolved by a council panel (C006/C007 classes, C010 read-poles → resolve-with-council → adversarial-refute-and-finalize; run `wf_026469fd-1f3`): A = hudlow @0.78 / handrews @0.70 / rafalkrupinski @0.70 + B dispositions + C roles. Ledger: [`plan/facts/0cost-trigger.bn`](../../../plan/facts/0cost-trigger.bn). Daftar receipt: see below.

Date: 2026-06-11

## Status

Accepted (candidate-fork) at an **honestly-low Originated ceiling (0.58)** — clean-room, no SIG witness. Reuses C018 webhook machinery + the `SulukRateLimit.key` strategy precedent. burhan-converge clean (213 claims).

## Context

`x-suluk-cost` (a `CostModel` on a `Request`) was **request-relative**: every `CostBasis` member (`per-call`, `per-token`, `per-second`, …) presumes a synchronous handler that runs and reports usage. But the common real case is a cost that accrues **after the response, on an external event** — Stripe fires `payment_intent.succeeded` and charges you; a scheduled job runs; a queue consumer processes. The facet could not declare *when* the cost fires (decoupled from the declaring op) nor *who* is charged when a third party fires the event with **no live session**. C018 deliberately scoped the broader async/event-driven space **out** of the HTTP core — so the fix must solve this **without** adding a normative async construct.

## Decision

Three **orthogonal axes** on the existing `x-suluk-cost` vendor facet (handrews' double-duty objection — never overload one axis):

- **`basis` — HOW it meters. UNCHANGED.** No `per-event` member is added (rejecting candidate-a, which would conflate metering with firing).
- **`trigger` — WHEN/WHAT fires it. NEW, STATIC.** A closed string enum on `CostModel`: `synchronous` (default → zero migration) | `webhook-received` | `scheduled` | `queue-consumed` | `callback-completed`, plus an optional `triggerRef` (a C009 by-name handle to the webhook/callback/op whose firing accrues the cost). Strictly **descriptive** — it names *where* cost accrues and asserts **no** event-channel/delivery-protocol semantics. **Locally decidable from the document alone** (passes hudlow @0.78): a linter / docs-renderer / `costAudit` decides "this cost is non-synchronous" + "what fires it" with no request issued. A **C018 webhook IS already a `Request`**, so it carries `x-suluk-cost` with the trigger at **zero new object kind**.
- **`attribution` — WHO pays. NEW, RUNTIME-ONLY.** Modeled on `SulukRateLimit.key`: a declared `strategy` (`session` | `event-expression` | `job-stamped`) the runtime resolves a concrete principal from. The `event-expression` (a C018 runtime-expression, e.g. `{$event.body#/customer}`) is **runtime-resolved and NEVER enters the static matcher** (D1-consistent — exactly as C018 walls callback runtime-expression keys). No-session strategies sit at a lower ceiling pending the Principal-model (Open-Decision #5).

**Fail-loud disciplines** (pessimist + security-reviewer + platform-architect): a deferred cost that resolves no principal bills to the `@unattributed` sentinel and raises `costAudit` `unattributed-background-cost` (never a silent zero); an `event-expression` read off an **unverified** payload is attacker-controllable → `unverified-attribution` (authoritative only behind a verified signature). `costAudit`/`annotateCosts`/`costTable` now iterate `doc.webhooks` (not just `doc.paths`); `CostEvent` gains a `dedupeKey` for at-least-once delivery.

**Reference-docs propagation is free** — everything rides the `Request`-attached `x-suluk-cost` facet Scalar/Swagger already render (and that survives the 3.1 downgrade). The renderer walks webhooks alongside paths, rolls deferred costs into the total (`costRollup.deferred`), and shows a `↯ charged on: <trigger>` badge.

## Consequences

- **Does NOT reopen C018's deferred async scope:** a cost-facet *dimension* on a vendor extension is orthogonal to the normative HTTP core (same move as `x-suluk-ratelimit` reconciled with C012/#43-out-of-scope). No normative jobs/events object kind is added (rejecting candidate-d).
- **Deviations (receipted, low ceiling):** the `trigger` dimension is clean-room (no SIG design); it reuses the C018 callback runtime-expression *grammar* (listed deferred) but only as a runtime **value**, never promoted into the static matcher.
- **Deferred, declared not silently filled:** cron/queue ops with no inbound `Request` have no host to hang the facet on — their first-class home (a thin `x-suluk-jobs` vendor map, **not** a normative kind) is a future Step; and reconciliation (declared-estimate vs the third party's actual invoice, with proration/tax/refund/chargeback) is a future `reconciliationBasis` extension, out of scope here.
