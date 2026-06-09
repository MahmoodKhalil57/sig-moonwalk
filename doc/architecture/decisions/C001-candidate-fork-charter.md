# C1. Candidate-fork charter: build a monolithic v4.0 candidate under priors-with-ceilings

> **Provenance:** Candidate-fork ADR — a decision of *this fork effort*, **not** of the OpenAPI Moonwalk SIG. SIG-accepted ADRs are numbered `0001`, `0002`, …; candidate-fork ADRs are numbered `C001`, `C002`, …. "Accepted" below means accepted by the fork, never by the SIG.

Date: 2026-06-09

## Status

Accepted (candidate-fork)

## Context

The OpenAPI Moonwalk SIG develops OpenAPI v4.0 by multi-stakeholder consensus (discussions → weekly-call consensus → ADRs → eventual formal spec). In its multi-year history it has produced exactly one substantive technical ADR ([0002, IRIs](./0002-support-for-iris.md)); the formal spec has not begun. The bottleneck is social agreement, not reasoning throughput — so a single contributor cannot "complete the SIG." A single contributor *can*, however, author a complete candidate document. We are doing the latter, grounded in the Adam substrate (burhan reasoning / daftar memory / mizan gates), having read the full SIG record (166 discussions, 22 issues, 20 PRs exported under [github-export/](../../../github-export/)).

## Decision

1. **Deliverable** — a complete, internally-consistent **Candidate v4.0** specification document we author end-to-end. Honestly labelled a candidate/proposal, never a claim to close the SIG or to ratify on its behalf.
2. **Posture toward priors** — *adopt-by-default, deviate-by-receipt.* Every SIG prior (accepted ADR, initial proposal, strong discussion consensus) is adopted unchanged unless burhan contests it, and any Deviation requires a recorded daftar receipt: the contested claim, its cite-chain, why the prior was insufficient, and the new confidence ceiling. No silent divergence.
3. **Scope** — monolithic: one document covering every Concern (API shapes, content schema formats, deployment configuration, foundational interfaces, mechanical upgrade). No per-module finish line; Completion is whole-document coherence.
4. **Location** — in-place in this clone. Our spec extends [specification/](../../../specification/); our ADRs are `Cxxx` files in this directory; the official `doc/` and `specification/` SIG content is treated as read-only priors. `origin` is to be demoted to read-only `upstream` so nothing can be pushed to OAI by accident.

## Consequences

- Large regions of the document (deployment, upgrade, foundational interfaces) have no strong priors and are **Originated sections** carrying inherently low confidence ceilings. The recursive state MUST track confidence/witness-density per section so a "complete" document never disguises thin invention as settled fact.
- Because scope is monolithic, progress cannot be measured in shipped modules; the context-preservation mechanism (the recursive state) is therefore load-bearing, not a convenience.
- Mixing `Cxxx` ADRs with SIG `000x` ADRs in one directory is deliberate (in-place), made safe by the provenance marker and the numbering namespace.
