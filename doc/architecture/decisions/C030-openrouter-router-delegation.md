# C30. Delegate the per-request model PICK to OpenRouter; keep the governance+audit moat

> **Provenance:** Candidate-fork ADR (Suluk), **not** a SIG decision. ORIGINATED. Operator-surfaced (OpenRouter ships
> built-in routers). Resolved by **two** persona councils: strategy `wf_75f87ab6-b1b` (**unanimous 10/10 HYBRID**,
> Class-A 0.70–0.78) + the catalog-keying micro-panel `wf_27de1bec-a42` (7/8 model-keyed HYBRID @0.6). Ledger:
> [`plan/facts/0delegation.bn`](../../../plan/facts/0delegation.bn). Honest ceiling **~0.76** — the unverified
> `auto`+`provider`-preference combination and the declared-not-verified governance facts are the caps.

Date: 2026-06-13

## Status

Accepted (candidate-fork) at ~0.76. No D1 gate: `modelResolve` is skill metadata, never read by the matcher.
`burhan-converge` clean. core 36 · models 16 · agents 71 · cockpit 125 tests pass.

## Context

OpenRouter ships 6 **runtime** routers (you POST to a magic model id): `openrouter/auto` (NotDiamond per-request pick;
`cost_quality_tradeoff` 0–10; a `allowed_models` allowlist that accepts **explicit slugs**, verified), `pareto-code`
(coding-only), `fusion` (multi-model deliberation — an *ensemble*, not selection), `~…-latest` (version alias),
`bodybuilder` (NL→body), `free`. Our shipped `@suluk/models` selector is **static, contract-time**: it filters a
337-model catalog (governance FAIL-CLOSED + the C028 `modelAllowlist` terminal MEET + the analyzer `minWindowRequired`
+ caps) to a **survivor set**, then RANKS it. The councils found the ranker is a **prompt-blind re-implementation** of
what `auto-router` does with live prompt signal — and our `intel.*` tiers are mostly `UNKNOWN` (scored 1.5), i.e.
mediocre-middle noise. We pay weekly tier-curation for a worse ranker.

## Decision

**Hybrid (pave-the-cowpath): keep the SET (ours), delegate the POINT (theirs).**

- **KEEP (the moat, all contract-time):** `checkFilters` — governance FAIL-CLOSED, the C028 `modelAllowlist` terminal
  MEET, the analyzer `minWindowRequired` gate, caps; the OpenRouter **facts** catalog + `normalizeOpenRouter` weekly
  pull (the filters + pin need price/context/caps); the `snapshotHash` pin + the "why this model / filter-trace"
  explainer; the fail-loud empty-set path; the single author surface (`modelProfile`/`modelPrefer`/`modelRequire`).
- **DELEGATE (strictly better runtime):** the per-request cost/quality/capability **pick** within our fenced survivor
  set → `openrouter/auto` + `allowed_models = the ENUMERATED survivor ids` (never a wildcard — the MEET stays
  terminal, widening is inadmissible) + `cost_quality_tradeoff = deriveCQT(profile)` (set explicitly; do NOT inherit
  OpenRouter's cost-leaning default of 7).
- **RETIRE (superseded):** the benchmark-TIER **ranker** treadmill (`BUCKETING_RULES`/`applyTierOverlay`/the weekly
  Class-B leaderboard review **as ranker inputs**). Keep tiers only as optional coarse **filter floors**. **Do NOT
  delete** `normalizeOpenRouter`/`fetch`/`snapshotHash`/the governance-fact columns — the filters and the pin depend on
  the facts.

**The switch is GOVERNANCE-GATED and mechanical** (`modelResolve?: "pinned" | "router" | "latest"`, default `pinned`):
- **`pinned` (default):** `target = { kind:"pinned", model: ranked[0].id }`, `pickPinned: true` — a reproducible,
  bisectable, endpoint-bindable served id. Required for agent loops, forced-tool-choice, and any governed skill.
- **`router` (opt-in, UNGOVERNED only):** `target = { kind:"router", model:"openrouter/auto", allowedModels: survivors,
  costQualityTradeoff }`, `pickPinned: false`. **A governed skill (any operator policy) declaring `router` FAILS LOUD
  at contract time** — a runtime pick cannot bind an endpoint region/retention and is non-reproducible across dates.
- **`latest`:** a best-effort `~author/family-latest` alias — defers the version to request time; **not reproducible**
  (recorded in the explainer); never the default.

**Reproducibility is honestly DOWNGRADED on the router/latest path:** `snapshotHash` pins the survivor SET + the CQT
knob; `pickPinned: false` marks the served id as logged-not-pinned. Never launder "auditable fence" as "reproducible
selection" — for a region-residency / SOC2 audit ("which concrete model on date X?") the answer is **pin**.

**The other routers:** `fusion` is IGNORED for selection (an ensemble adjacent to suluk sub-agents + C029 thinking —
link out, do not absorb). `latest-resolution` is the opt-in above. `pareto` is a future router target only for
`taskShape==='coding'` + empty-policy (it is governance-blind). `free`/`bodybuilder` are link-out niche.

## Consequences — adversarial self-check (verification @0.76)

- **No reinvention + moat kept** (holds-with-caveat @0.78): we delegate the runtime pick; we keep the survivor set +
  pin + audit OpenRouter cannot compute. Caveat: say "reproducible SET pin (served-id reproducible only on the pinned
  path)".
- **Governance soundness** (the verifier REFUTED the strong form → folded in): region has **no** OpenRouter endpoint
  knob (one id fans out to many endpoints) and `allowed_models` fences the model id, not the endpoint; and the
  `provider.zdr`+`auto` combination is **unverified**. So **ANY operator-governed skill force-pins** — we do not ship a
  governed-router path. (Reopen when OpenRouter confirms provider-prefs combine with `openrouter/auto`.)
- **Endpoint-vs-model-id is the real governance limit** (keying micro-panel, vindicated): per-endpoint governance wants
  the model-keyed `endpoints[]` shape — **RESERVED, not built** (OpenRouter routes endpoints + ZDR today; zero fleets).
  A misleading "representative" `gov.region` is **forbidden** (it degrades fail-closed → fail-OPEN; the `types.ts`
  header is corrected).

## Deferred / reopen-triggers

- The **`endpoints[]`** sub-list — build when a real fleet needs per-endpoint **region** governance OpenRouter can't
  express, AND we have endpoint gov data.
- The **governed-router path** (`provider.zdr` for retention) — reopen when OpenRouter docs confirm provider-prefs
  combine with `openrouter/auto`.
- The full **Class-B tier curation** — superseded as a *ranker* input; revisit only if tiers are wanted as filter
  floors at scale.
