# C8. Frontier #17: document merge / multi-file composition is out of scope — defer to the Overlay Specification + tooling

> **Provenance:** Candidate-fork ADR — a decision of *this fork effort* (Suluk), not of the OpenAPI Moonwalk SIG. Resolves frontier **#17**. Ledger: [`plan/facts/0017-merge-scope.bn`](../../../plan/facts/0017-merge-scope.bn).

Date: 2026-06-09

## Status

Accepted (candidate-fork). An **inherited prior** (we adopt the SIG's convergent lean) at a candidate ceiling — no SIG ADR, but a clear 2022→2025 convergence. Right-sized: resolved directly, no adversarial workflow (atom-0011 cheapest-next-move), because the record is not contested.

## Context

Discussion #17 ("Allow authors to define the merge order and precedence", earth2marsh 2022) proposes a **document-level merge / layering** mechanism — "like layers in Photoshop", an optional `manifest`/`layers` in `info`, "merge down" to a self-contained doc — for multi-file composition (combining APIs from different teams). It is **not** about response/parameter precedence across request/path/global levels; the spine had conflated the two (correction recorded — see Consequences).

The record converges on *out of scope*: handrews was skeptical from the start ("why are we back to merges?"; `$merge`/`$ref` lazy-evaluation complexity) and in 2025-10 asked whether the **Overlay Specification** already covers it; darrelmiller (2023) concluded "no clear obvious wins... we will revisit if [community] tooling coalesces"; MikeRalphson catalogued existing merge tools, all low-traction; lornajane (2025-10-30, most recent word) said it's "out of scope how people manage and compose their files." A real need was named (darrelmiller: "combine APIs from different internal teams"), but routed elsewhere, not met in core.

## Decision

The Candidate adds **no core merge/layering mechanism.** Multi-file composition and merge are deferred to the **Overlay Specification** (a separate OAI spec) and **community merge tooling**. Revisitable if/when tooling coalesces around a pattern a spec change could help (darrelmiller's condition). The enterprise need (combining team APIs) is **acknowledged and routed**, not denied.

## Council cross-check (C006/C007 — guides, not prophets)

- **[handrews](../../plan/council/handrews.md)** (A, @0.70): align — and corroborated by the record itself (he asked "does Overlay cover this?"). His "separate concerns / bucket 3.x-vs-4.0" disposition treats merge as a distinct concern, not core 4.0.
- **pragmatist** (B, useful): align — existing merge tools have low traction, so don't spec ahead of tooling consensus (matches darrelmiller's "revisit if tooling coalesces").
- **minimalist** (B, *marginal on structural Steps* — but on-point here): align — push composition to a separate spec/tooling, keep core small. A nice confirmation of the USEFULNESS.md note that marginal lenses earn their keep on a *fitting* Step (this scope Step is theirs).
- **[enterprise-integrator](../../plan/council/roles.md)** (C, useful): **principled dissent** — it has a real need to combine team APIs. Recorded honestly; the need is routed to Overlay + tooling, the dissent is not suppressed.

## Consequences

- **Conflation corrected:** the spine/frontier mislabel of #17 as "response/param precedence" is fixed. The genuine **response-level precedence** question (apiResponses vs pathResponses vs request-level responses; `parameterSchema` `allOf` composition across pathItem+request) is split out as a **new, distinct frontier item**, left OPEN.
- Out-of-scope is revisable by construction (the SIG itself left the door open) — a low-cost decision to reverse if tooling consensus emerges.
- The Candidate stays smaller; the cost is that multi-file users depend on a second spec (Overlay) + tooling rather than a built-in mechanism.
