# #83/#32 array-vs-map — workflow synthesis (evidence behind C009)

> Durable record behind [C009](../../doc/architecture/decisions/C009-array-vs-map.md) + [`0083-array-vs-map.bn`](./0083-array-vs-map.bn).
> Source: workflow `wf_72360ada-66c` (31 agents) — **first council-integrated Step**: council consulted up front (A predict blind, B/C lenses) → readers → prior-map → 4 candidates → 12 verdicts → synthesis.

## Frame chosen — identification-first (handrews c10)

Array-vs-map is **downstream of how an OAD identifies things**, so the container is *derived per-collection from the identity rule*, not chosen by ergonomics. Decide the by-name-never-by-index referencing rule now; defer the fragment-syntax redesign (#26/#49/#72/#73). Coincides with keep-maps (the inherited prior) but supplies the load-bearing reason — **identity, not ergonomics** — and downgrades whitlockjc's index-fragility objection from decisive to conditional. Verify-lens ceilings 0.74/0.70/0.62/0.60.

## Sub-decisions (per-collection routing)

| Decision | Prov. | Ceiling |
|---|---|---|
| References into user-keyed collections resolve **by stable name, never by array index/order** | deviation | 0.70 |
| **paths** stay a MAP keyed by the RFC6570 uriTemplate (#127) | inherited | 0.85 |
| **requests** stay a named MAP (friendly request name) | inherited | 0.70 |
| **responses / pathResponses / apiResponses** stay named MAPS | inherited | 0.55 |
| **#20 per-location slots** {query,path,header,cookie,body} stay a FIXED-KEY struct | inherited | 0.70 |
| **components** stay a dynamic-key MAP (JSON-Pointer / JSON-Schema referencing anchor) | inherited | 0.85 |
| **root tags** FLIP array→MAP/object in v4 — the single container deviation | deviation | 0.50 |
| names: effectively mandatory-and-unique via the map KEY (+ bare/sugar form) | deviation | 0.60 |
| ordering: an OPTIONAL, absent-by-default, non-negative-integer order field | deviation | 0.50 |
| reuse: identity-on-reuse is the COMPONENT NAME, travels with the element | inherited | 0.55 |

## Council scorecard — the live test (the reason this Step mattered)

**handrews persona (@0.70) — STRONG HIT, in the wild.** Predicted *blind* (without reading #32): "refuses array-vs-map as posed; reframes to *how do we identify things in an OAD*; container falls out of identity; splits into orthogonal sub-axes (names, ordering, reuse-carries-name, tags); leans map-by-identity but would accept arrays-of-named-objects if names are mandatory+stable; decide holistically with #26/#49." His real c10 opens *"How do we identify things within OADs?"*, enumerates the identification mechanisms, and breaks out **exactly those sub-axes** — a near-verbatim match of the predicted *move and decomposition*. The one miss was **pre-registered**: the persona predicted a firmer map-lean than the real (studiously non-committal) c10 — and it had *flagged that exact valence risk and told us to discount it*. So the council confirmed its own central hypothesis **and** correctly bounded its own unreliability.

**The discipline held:** hudlow/rafalkrupinski predictions were corroboration-by-convergence, treated as guide not evidence. The **file-grounded findings, not the council, carried the verdict** — the council just told us where to look and what to discount.

**B/C red-lines that proved real:** codegen-author's "index-based identity is poison → refs by name not position" became the committed non-deferrable rule; conservative's "don't detonate the `$ref` graph" (map-stays-map preserves `#/components/responses/...` by-key pointers); tech-writer's pro-array lean (ordering-for-free + reuse-renders-labels) was the **sole** array-leaning voice — preserved as the reason the map default is **not hardened** (the array door stays open).

## Deferred

The deep identification/referencing redesign (#26 refs-as-pointers, #49 rename `$ref`, #72 imports, #73 dialect) — the fragment *syntax* is chosen there; #83 fixes only the by-name routing rule. Tags' new map *shape* interacts with the tags-upgrade proposal (#67).
