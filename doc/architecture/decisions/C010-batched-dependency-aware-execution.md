# C10. Batched, dependency-aware Step execution — parallel isolation, not shared-context multitasking

> **Provenance:** Candidate-fork ADR — a decision of *this fork effort* (Suluk), not of the OpenAPI Moonwalk SIG. Methodology/mechanism decision; refines [C002](./C002-recursive-state-mechanism.md) (one decision per Step) for throughput. (`C009` is reserved for the in-flight #83 resolution.)

Date: 2026-06-09

## Status

Accepted (candidate-fork). The scaling model for the walk; first batch demonstration pending (after the in-flight #83).

## Context

Resolving the Frontier one Step at a time (one ~20-min workflow each) is slow for ~45 remaining items. We want to greatly increase throughput **without losing per-decision intelligence and without context pollution**. The naïve speedup — one agent reasoning over several issues in a single context — is the exact failure mode: issue A anchors issue B, ordering bias degrades later issues, and coherence drops. That trades intelligence for speed.

## Decision

Separate the **unit of reasoning** from the **unit of scheduling**.

1. **Reasoning unit stays one (issue × concern) per agent.** Never put two issues in one agent's context. This is the hard rule that prevents context pollution; everything else is scheduling.
2. **Scheduling unit becomes a batch of mutually-independent issues**, run through the stages with `pipeline()` (per-item isolation, no barrier, harness-capped concurrency). Wall-clock collapses to the slowest single-issue chain, not the sum.
3. **Triage right-sizes the batch.** A cheap parallel sweep classifies each issue *convergent* (SIG record uncontested → resolve direct, like #17) vs *contested* (→ full adversarial panel). Most items are likely convergent; reserve the expensive panels for the genuinely contested few.
4. **Personas are stable priors, fanned out — not merged.** Apply a calibrated persona (C006/C007) to many issues via separate isolated parallel calls; reuse, not cross-talk. A persona's "recurring objections" checklist can also be pattern-matched against a batch cheaply during triage.
5. **The dependency graph governs batching.** Only mutually-independent issues batch together. Dependent chains (e.g. #16→#20→#127; #17→#17b; #108 gating header-aspects) serialize into topological **waves**: resolve a wave in parallel, then the next wave (which may consult the first's ledger). Resolving entangled issues blind to each other is forbidden — that is "losing intelligence."

## Consequences

- **Throughput:** a batch resolves K independent issues in ~one workflow's wall-clock. Triage front-loads the cheap wins (direct resolutions) and parallelizes the contested panels across independent items.
- **Pollution avoided by construction** — isolation per (issue × concern) agent; no shared scratchpad.
- **Intelligence preserved** — contested issues still get full adversarial treatment + mizan-gate; dependency-aware waves keep coherence.
- **Coherence backstop:** after a batch lands, run `burhan-converge` / `burhan-perturb` over the new ledgers to catch any latent cross-issue conflict the parallel isolation couldn't see.
- **Honest bounds (not unlimited):** parallelism is capped by (a) the dependency graph, (b) the ~16-wide per-workflow concurrency, and (c) one-big-workflow-at-a-time (the server-throttle lesson). "Batch" = many issues in one workflow's pipeline, not many concurrent workflows.
