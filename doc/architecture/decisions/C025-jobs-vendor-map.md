# C25. `x-suluk-jobs` — a first-class home for cron/queue background work

> **Provenance:** Candidate-fork ADR (Suluk), not a SIG decision. CONVERGENT follow-on to [C024](./C024-cost-trigger-and-attribution.md): C024's council already blessed the direction ("their first-class home — a thin `x-suluk-jobs` vendor map, **not** a normative kind — is a future Step"). Resolved DIRECTLY (no new panel; the contested decision was already made), with the adversarial self-check in the ledger + the `burhan-converge` backstop. Ledger: [`plan/facts/0cost-jobs.bn`](../../../plan/facts/0cost-jobs.bn).

Date: 2026-06-11

## Status

Accepted (candidate-fork) at the C024-tracking Originated ceiling (~0.58). burhan-converge clean (216 claims).

## Context

C024 declared a static `trigger` on `x-suluk-cost` covering `scheduled` / `queue-consumed` — but flagged a coverage gap: a cron job or a queue consumer has **no inbound `Request`**, so there was nowhere to *hang* the cost facet. `paths` entries need a uriTemplate; `webhooks` entries are *incoming HTTP operations* (they have a `Request`). A cron tick / queue drain is neither.

## Decision

Add a top-level **`x-suluk-jobs`** name-keyed map (C009) of **`SulukJob`** entries — non-HTTP background work. A `SulukJob` carries its **static** trigger (`scheduled` | `queue-consumed`) + a `schedule` (cron string) / `queue` name, plus the same advisory `x-suluk-*` facets an operation does — notably `x-suluk-cost` (with a matching trigger) and `x-suluk-source`. It has **no Request/Response** (there is no HTTP exchange).

- **`@suluk/cost`** walks it: `eachJob` + a unified `costLoci` (paths + webhooks + jobs) feed `costAudit` / `costTable`, so a job's cost is declared, audited (the same fail-loud `unattributed-background-cost` discipline), and tabled like any other.
- **`@suluk/reference`** rolls a job's (deferred) cost into `costRollup` — it counts toward the total + the `deferred` tally.

## Consequences — adversarial self-check (the council's lenses; none fires)

- **Does NOT reopen the async scope** (conservative / C018): `x-suluk-jobs` is a **vendor map** (the `x-suluk-*` namespace), explicitly **not** a normative async object kind — it describes *where background work costs*, asserting no event channel / stream / delivery protocol. Exactly what C024 pre-blessed (same move as `x-suluk-ratelimit` vs C012/#43-out-of-scope).
- **Does NOT duplicate webhooks** (contrarian): a webhook is an *incoming HTTP operation* (`Request`, in `webhooks`); a job is *non-HTTP* (cron/queue, no `Request`). Disjoint loci.
- **Statically decidable** (hudlow @0.78): the static fields (trigger enum + cron string + queue name) are locally decidable from the document alone; cost *attribution* stays runtime-only (inherited from C024), never in the matcher.
- **Whose job** (handrews @0.70): cost + jobs stay a vendor extension; `core` gains only a **structural** `SulukJob` shape — no new normative control keyword — reusing C009 named maps + the `x-suluk-*` namespace.

**Still deferred:** reconciliation (declared-estimate vs the third party's actual invoice, with proration/tax/refund/chargeback) remains a future `reconciliationBasis` extension.
