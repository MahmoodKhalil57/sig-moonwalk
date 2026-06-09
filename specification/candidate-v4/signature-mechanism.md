<!--
  PROJECTION — generated from the ledger, not hand-maintained as source of truth.
  Source of truth: plan/facts/0016-signature-mechanism.bn + ADR C003.
  This is a candidate-fork artifact, NOT official OpenAPI text. Confidence is noted per claim.
-->

# Signature Mechanism (Candidate v4.0 — §[API shapes])

> Status: **frame-level draft** · sole-witness-capped (≤0.85 frame, 0.5–0.6 on contested points). Resolves frontier #16; defers #20, #127.

## Concept

An **operation signature** is what lets a tool route a concrete HTTP request to at most one
described operation. It generalises the 3.x `path + method` into a **multi-aspect tuple** over:

```
signature ⊆ { method, uri-template (incl. query), content-type, headers, request-body shape }
```

The mechanism is **uniform and implicit** across an API — there is no required per-API
"signature style" declaration. *(@0.5 — overrides an early unreconciled proposal; the riskiest
claim here.)*

## Where signatures live: the ADA

Signatures are exposed at the **ADA** (the abstract description surface a tool consumes), produced
by a **DOM → ADA** mapping. Both the DOM and the ADA are **non-mandatory** for tooling. The spec
defines the signature mechanism by *what the ADA must expose* — working backward from the
"request → operation" matcher a router needs — and bakes in only analysis whose cost is reasonable
for the vast majority of APIs.

Per operation, the ADA exposes a **normalised signature view** (which aspects participate;
literal vs variable structure). Across operations, the ADA exposes a **three-valued collision
verdict**:

```
provably-disjoint | provable-collision | not-statically-determinable
```

## Collision analysis: detect-and-tolerate

Static ambiguity detection is a **desideratum under explicit feasibility limits, not a guarantee
and not a validation gate.** 3.x templating may not permit full analysis; JSON Schema is not
analyzable in the general case. The ADA therefore **surfaces** overlap (the three-valued verdict);
it does not forbid it. Concrete-over-variable (specificity) precedence carries forward from 3.x,
but is **bounded** — 3.x leaves param-vs-param superset and bidirectional overlap undefined.

What a tool should *do* about a detected collision (treat as invalid · apply precedence · honour an
authored priority · strict-mode error) is **left open** (frontier, not resolved here). The recorded
SIG lean is *priority-as-last-resort*.

## Matching vs correlating

This section defines **matching** (route a request to zero-or-one operation) only.
**Correlating** (which response schema pairs with which request) is a separate concern.

## Deliberately deferred

- **#20** — whether parameters use one unified `parameterSchema` or one schema per location (URL/header/body). The ADA fixes only the *shape* of exposure; this split is chosen afterward.
- **#127** — the concrete templating system (extended URI Template vs RFC 6570 vs WHATWG URLPattern). Chosen by which system best supports the ADA exposure above.
- **operationId** — coexists with any declared signature for now; its fate is open.
- **Header-based aspects** depend on the header-modeling prerequisite (#22/#108), not yet delivered; admitted at the frame, flagged prerequisite-dependent.
