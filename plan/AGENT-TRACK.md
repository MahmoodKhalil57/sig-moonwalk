# AGENT-TRACK — the `x-suluk-agents` roadmap (start→finish, checkbox-driven)

> **Purpose.** A complete, resumable plan for the suluk-agent layer built across the 2026-06-12/13 session, so a
> reloaded context can finish everything without losing information. **On reload: read this + [`STATE.md`](./STATE.md)
> first.** Everything below is either ✅ shipped (committed/pushed to `origin/main`) or ☐ remaining (with its
> reopen-trigger / next step). Ceilings are honest-Originated (~0.52 for the agent ADRs, 0.55 for the model catalog).

## Orientation (the arc, one paragraph)

A "suluk agent" = an optional top-level `x-suluk-agents` name-keyed map of `SulukAgent` (skills + deterministic
routes + by-name sub-agents), riding the C025 `x-suluk-jobs` vendor-map precedent. On top of it we shipped: operator
**governance** (C028 `x-suluk-policy`), **tier-trim serving**, a **context-intelligence** analyzer (load,
flatten/unflatten right-sizing, model-fit), a **thinking** bound (C029), and a public-data **model catalog +
selector** (`@suluk/models`). The whole thing composes: the analyzer computes an agent's `minWindowRequired` →
becomes a hard filter the model selector uses → an agent declares *needs*, not a model id.

## The discipline (rules EVERY step follows — do not skip)

- **D1 gate before any new agent field lands.** Recipe (used by C027/C028/C029): (1) extend
  [`core/test/agents-d1-invariance.test.ts`](../tooling/ts/packages/core/test/agents-d1-invariance.test.ts) so the
  block carries the new field and assert `buildAda`/`matchRequest` are byte-identical with vs without it; (2) author
  `plan/facts/0<topic>-d1.bn` + a `-witness.bn` (claim `d1_<topic>_safe`); (3) `mizan_verify_claim(d1_<topic>_safe, plan/)`
  — require **no bcmea**, cap ≥ 0.139 floor; (4) `burhan-converge plan/facts/`. The matcher (`core/src/ada.ts`) must
  NEVER read an agent field.
- **Declared-not-enforced honesty** (C026→C029). `guarantee`, `costCeiling{enforcedBy}`, `thinking.maxRounds`,
  catalog capability cells — all DECLARED; only a runtime adapter enforces. Never launder a declaration as enforced.
- **Module boundary.** `@suluk/core` must never import `@suluk/agents` (test-enforced:
  `agents/test/core-boundary.test.ts`). `@suluk/models` is standalone (no deps).
- **Council for contested decisions** (4 panels run this session: `wf_9e8712c7-871` agent design, `wf_b2f1fd82-7a7`
  policy, `wf_5aa6a747-cbe` thinking, `wf_729cde52-cc7` model metrics). Build-ahead-of-a-decision is forbidden.
- **Concurrent writer warning.** A second session also commits to `main` (shipped `@suluk/seo`, `@suluk/panel`, and
  the C028 commits). Always stage ONLY your own files; `git pull --rebase` fallback on push.

---

## ✅ DONE (shipped to origin/main)

- [x] **C027 — `x-suluk-agents` composition standard.** ADR
  [`C027`](../doc/architecture/decisions/C027-suluk-agents-composition-map.md); core types
  `SulukAgent`/`SulukSkillRef`/`SulukRouteRef`/`SulukAgentRef`; D1 gate `d1_agent_selector_safe`
  ([`0agents-d1.bn`](./facts/0agents-d1.bn) + witness). Commit `4b372c2`.
- [x] **`@suluk/agents` projector + lint + conformance + signed manifests.** lint (cycle, maxDepth, dangling-ref,
  D1 selector-rejection, route-has-model, scope-escalation, thinking maxRounds); `projectClaudePlugin` +
  `projectOpenRouter` (pure, deterministic, fail-loud); over-serve auditor + skill freshness; `analyzeScopes`
  (intersection); `agentManifest` (marketplace signature covers preprompt drift via skill contentHash). Commits
  `7e60f3b`, `9ad7633`.
- [x] **Cockpit OBSERVE view** (`@suluk/cockpit` `agentsView`/`agentsSummary`) — tier tree, effective scope, gate
  findings, reachable surface, projection preview, **C028 governance diff**, **context-budget + flatten/unflatten**.
  Commits `5be6861`, `95afceb`, `93d7c77`.
- [x] **C028 — `x-suluk-policy` operator governance overlay** (sibling-build, static subset). ADR
  [`C028`](../doc/architecture/decisions/C028-suluk-policy-governance-overlay.md); `policyConstrain` (monotone-narrowing
  MEET), `lintPolicy`, manifest fold, over-serve-governed; `costCeiling{enforcedBy}` declared-not-enforced. D1 gate
  `d1_policy_selector_safe`. Commits `dfea5ef`, `9ad7633`, `93d7c77`.
- [x] **Tier-trim serving.** `SulukRouteRef.tier` (resident|cold-tail); `projectOpenRouter` default = resident +
  `discover_tools`; `residentSurface`/`assertDefaultServedResident`. Commits `2fce912`, `ff571c7`.
- [x] **Context-intelligence analyzer** (`@suluk/agents/src/context.ts`): per-agent load, **flatten/unflatten**
  right-sizing (passthrough-agent, flattenable-layer), **model-fit** (6-source tiers, minWindowRequired). Commits
  `750cc53`, `95afceb`, `c003622`.
- [x] **C029 — thinking bound** (unanimous bound-only). ADR
  [`C029`](../doc/architecture/decisions/C029-thinking-bound.md); `thinking: { maxRounds, budget? }` on SulukAgent;
  stopCondition forbidden; analyzer consumes round-accretion (`peakTokens`). D1 gate `d1_thinking_bound_safe`. Commit
  `7fe5c19`.
- [x] **`@suluk/models` — catalog + selector (first cut).** schema (facts=numbers, benchmarks=coarse tiers w/
  {source,asOf}, UNKNOWN honest, no composite); intelligence split into 6 source-separated dims (agentic-tool-use #1);
  `selectModel` (filter→rank→why-explainer, C028 allowlist terminal MEET, fail-loud); 6 profiles + escape hatch;
  `deriveRequirements` seam; [`REFRESH.md`](../tooling/ts/packages/models/REFRESH.md) spec. Commit `61ec95b`.

---

## ☐ REMAINING (unchecked = not done; grouped + prioritized)

### A. The model-catalog seam — ✅ DONE (commit `59ed4fd`)
- [x] **`SulukSkillRef` declares NEEDS** — added `modelProfile` + `modelPrefer` + `modelRequire` (structural; `model[]`
  kept as the back-compat opt-out). `modelProfile` added to the invariance block (matcher still byte-identical).
- [x] **`DEFAULT_WINDOWS` DELETED** — `context.ts` `windowFor` now reads `context.maxWindow` from `opts.catalog`
  (precedence: `modelWindows` override → catalog → null/unknown, fail-closed). `@suluk/agents` deps `@suluk/models`.
- [x] **`resolveSkillModels` / `skillModels` seam** (`@suluk/agents/src/model-select.ts`) — derives requirements
  (`hasRoutes`⇒tool-calling, the analyzer's `minWindowRequired`, the skill's `modelRequire`) + the C028
  `modelAllowlist` MEET across governing policies, then runs `selectModel`. `agentManifest(doc, name, { catalog })`
  folds the per-skill `modelSelection` (ids + `snapshotHash`) into the signable manifest (reproducible pin).
- [x] **Allowlist MEET** — `effectiveAllowlist` intersects governing policies' allowlists; `selectModel`'s terminal
  filter applies it (widening is structurally impossible — a filter only narrows). _(Kept `@suluk/models` dep-free;
  did NOT route through `@suluk/agents` `intersectScope` — the inline intersection is equivalent + avoids a dep cycle.)_

### B. The weekly fetcher — the data-eng spine (specified in REFRESH.md)
- [x] **Class-A facts transform** — `normalizeOpenRouter` (`normalize.ts`): OpenRouter `/models` → cost/context/caps/
  modalities/recency cells, `snapshotHash`/`catalogFrom` (content-addressed). `fetchOpenRouterCatalog` (`fetch.ts`) is
  the thin live wrapper. Unit-tested. _(Remaining: RUN it weekly in CI + commit the ~200-row catalog; the snapshot-diff
  `priceVolatile`/deprecation-delta is stubbed.)_
- [x] **`BUCKETING_RULES` + `applyBucketing`** (`bucketing.ts`) — the documented, committed, cited tier-boundary rule
  per INTEL axis (the red-line). Unit-tested. _(Boundaries are tunable at review; the value is the explicit mapping.)_
- [ ] **Class-B periodic tier pass** (lower cadence, human-reviewable): BFCL/τ-bench, IFEval/LMArena, GPQA/AIME,
  SWE-bench-Verified, RULER, MMLU-Pro → coarse tiers; cross-witness frontier claims (≥2 sources). Most rows stay
  `unknown` on agentic + long-context — surface, never impute.
- [ ] **Grow the seed → ~200 rows** (via the fetcher; the seed in `catalog.ts` is illustrative only).
- [x] **Cockpit OBSERVE surface for model selection** — `agentsView(doc, { catalog })` folds a per-skill
  `modelSelection` (declared vs selected, top ids, deciding preference, UNKNOWN-coverage gaps) so an operator can
  audit "why this model". Read-only (C020). _(Remaining polish: surface staleness/`asOf` once the fetcher stamps it.)_
- [ ] **Micro-panel (contested):** key a catalog row by **model** vs **(model, provider-endpoint)** —
  governance/price attach to the endpoint (sounder) but 3–5× rows + author-UX cost. Resolve with a receipt + ceiling
  before hardening. (Seed currently keys by model.)

### C. C027 deferred items (each gated by a reopen-trigger — do NOT build ahead)
- [ ] **Recursion machinery beyond one hop.** Reopen-trigger: a **2nd real nested or non-Conin agent**. (Today:
  cycle-lint + depth-lint + schema slot only.)
- [ ] **Tier-trim-serving MANDATE.** The adapter *capability* is built; whether the standard MANDATES it is the open
  decision. Reopen-trigger: the `@suluk/agents` adapter demonstrably withholds cold-tail tools **AND Conin's
  server-side over-serve (`constructionIntelligence/app.ts:2585`, ships full catalog) is fixed**.
- [ ] **Runtime determinism gate** (a SOURCED figure may originate ONLY from a deterministic route). Open: mandated
  by the standard vs left to the implementer (enterprise/security want mandated; majority declare-only).
- [ ] **Expansionist static axes** still missing: **streaming/unary**, **human-gate** (`requiresHuman`/`resumable` —
  Conin's PROVISIONAL-review IS this shape), **memory scope/reset-boundary**. (iterative-loop = DONE via C029.)
  Reopen: the first non-Conin agent that needs each.
- [ ] **Conin day-one non-conformance** (named fixtures, not laundered): MCP-only `run_core_primitive` (dangling
  `operationRef`), **snake_case tool ids vs camelCase operationIds** (needs a name-derivation rule in the standard:
  map-key = wire id verbatim, operationId derived), full-catalog over-serve. Real fix is Conin-side + the derivation
  rule.

### D. C028 deferred
- [ ] **`costCeiling` ENFORCEMENT runtime** (terminate-at-spend kill-switch) — RESERVED, built-by-nobody.
  Reopen-trigger: a real fleet operator running **≥2 third-party-authored** agents the operator must override.

### E. C029 deferred
- [ ] **`stopCondition` vocabulary** — RESERVED. Reopen-trigger: a **2nd non-Conin agent** whose internal loop
  terminates on something OTHER than a round/budget count (a witnessed non-budget terminator).
- [ ] **terminate-at-round enforcement** — RESERVED (same class as C028 costCeiling enforcement).

### F. Cross-cutting / ops
- [ ] **npm publish** (blocked — `npm whoami` = ENEEDAUTH in this env). New first-publish packages: `@suluk/agents@0.1.0`,
  `@suluk/models@0.1.0` (+ concurrent `@suluk/seo`, `@suluk/panel`). `@suluk/core` needs a **version bump**
  (`0.1.7`→`0.1.8`) for the type additions (thinking, policy, route.tier, new exports). The repo's `release(suluk):
  publish all packages` flow handles it once a token is present.
- [ ] **`@suluk/agents` → vscode extension SHELL wiring.** The cockpit *core* (`agentsView` etc.) is ready; only the
  extension shell rendering (the webview/tree that displays it) is left.
- [ ] **Address remaining verification caveats** logged in the council outputs: the projection name-derivation rule
  (C-above), the tier-trim mandate (C-above); the two metrics reframes are already encoded in REFRESH.md.

---

## References (load on demand)

- **ADRs:** [C027](../doc/architecture/decisions/C027-suluk-agents-composition-map.md) ·
  [C028](../doc/architecture/decisions/C028-suluk-policy-governance-overlay.md) ·
  [C029](../doc/architecture/decisions/C029-thinking-bound.md) (parent precedents: C024 cost, C025 jobs-map, C026
  reconciliation, C020/C021 cockpit+marketplace).
- **Packages:** `tooling/ts/packages/{agents,models,cockpit,core}` — each: `src/`, `test/`, `bun test`,
  `bunx tsc --noEmit -p .`.
- **Ledger (D1 gates):** `plan/facts/0agents-d1.bn` (+witness), `0policy-d1.bn` (+witness), `0thinking-bound.bn`
  (+witness). Verify: `mizan_verify_claim`; hunt: `burhan-converge plan/facts/`.
- **Council workflows:** `wf_9e8712c7-871` (agent design), `wf_b2f1fd82-7a7` (policy), `wf_5aa6a747-cbe` (thinking),
  `wf_729cde52-cc7` (model metrics). Transcripts under the session `subagents/workflows/` dirs.
- **Test counts (last green):** core 36 · agents 62 · cockpit 124 · models 10 (all tsc-clean).
- **Real-world prototype:** Conin = `~/apps/constructionIntelligence` (app) + `~/apps/conin-plugin` (Claude plugin).
  The un-standardized cowpath this whole track paves.
