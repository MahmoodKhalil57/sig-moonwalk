# C18. Callbacks & webhooks — reuse the existing machinery (closes the capstone gap)

> **Provenance:** Candidate-fork ADR (Suluk), not a SIG decision. Closes the gap the C017 capstone surfaced (callbacks/webhooks unresolved by any ADR). ORIGINATED — no SIG design exists. Ledger: [`plan/facts/0callbacks-webhooks.bn`](../../../plan/facts/0callbacks-webhooks.bn).

Date: 2026-06-10

## Status

Accepted (candidate-fork) at **low Originated ceilings (0.55–0.6)** — clean-room, no SIG witness. converge clean.

## Context

The C017 upgrade capstone flagged that callbacks (3.x) and webhooks (3.1) are unaddressed by any Suluk ADR and absent from the 4.0 corpus. The SIG record is near-empty (one callback mention, a handful of procedural webhook mentions; nothing in the initial proposal). Rather than invent new object kinds, the Candidate extends its existing machinery.

## Decision

- **Webhooks** — a top-level `webhooks` **name-keyed map** (C009) of *incoming* operations the API receives but does not host at its own paths (the sender owns the URL). Each entry reuses the Request/Response machinery and carries a signature (C003); it is a pathItem-shaped structure **not** keyed by a uriTemplate.
- **Callbacks** — a per-operation `callbacks` **name-keyed map**; each callback is a **runtime-expression-keyed** collection of pathItem-shaped definitions (the operation triggers an out-of-band request to a URL derived at runtime, e.g. `{$request.body#/callbackUrl}`). Reuses pathItem/requests/responses; the C005 uriTemplate applies to the callback URL's path-portion. The runtime-expression key is resolved at runtime, **not** in the static matcher (D1-consistent).
- **No new core object kinds** — both are consistent with C009/C003/C004/C005.

## Consequences

- Deferred: the exact runtime-expression grammar for callback URLs; the broader async/event-driven/streaming space (AsyncAPI overlap) is **out of scope** for this candidate's HTTP core.
- The frontier is now complete with no known unaddressed 3.x/3.1 construct.
