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
- [x] **Class-A facts transform + LIVE RUN** — `normalizeOpenRouter` (`normalize.ts`) + `fetchOpenRouterCatalog`
  (`fetch.ts`) + `scripts/refresh.ts`. **Ran it live: committed `src/openrouter-catalog.json` = 337 real OpenRouter
  models** (real price/context/caps; benchmark tiers UNKNOWN), exported as `OPENROUTER_CATALOG` (747K compact,
  content-addressed `sha256-d2e7d94f…`). _(Remaining: a weekly CI cron to re-run + the snapshot-diff
  `priceVolatile`/deprecation-delta — currently stubbed.)_
- [x] **`BUCKETING_RULES` + `applyBucketing`** (`bucketing.ts`) — the documented, committed, cited tier-boundary rule
  per INTEL axis (the red-line). Unit-tested. _(Boundaries are tunable at review; the value is the explicit mapping.)_
- [x] **Class-B tier overlay (mechanism + bootstrap)** — `applyTierOverlay` + `KNOWN_TIERS` (`overlay.ts`): patches
  CITED coarse `intel.*` tiers onto the facts catalog (`snapshotHash` now covers tiers). Bootstrapped **9 frontier
  models** from public-consensus standings (source-stamped, low ceiling); the long tail stays `unknown`. _(The full
  weekly curation is **SUPERSEDED as a RANKER input by C030** — our coarse-tier ranker is a prompt-blind worse copy of
  `openrouter/auto`; tiers are kept only as optional filter floors + the bootstrap. Do NOT build the Class-B treadmill.)_
- [x] **Real catalog committed** — `OPENROUTER_CATALOG` (337 rows) replaces the need to grow the seed; `SEED_CATALOG`
  is retained as the small illustrative fixture for tests. (The Class-B tier overlay still fills `intel.*`.)
- [x] **Cockpit OBSERVE surface for model selection** — `agentsView(doc, { catalog })` folds a per-skill
  `modelSelection` (declared vs selected, top ids, deciding preference, UNKNOWN-coverage gaps) so an operator can
  audit "why this model". Read-only (C020). _(Remaining polish: surface staleness/`asOf` once the fetcher stamps it.)_
- [x] **Keying micro-panel — RESOLVED** (`wf_27de1bec-a42`, 7/8 @0.6): **model-keyed HYBRID** — per-endpoint axes
  (price/region/retention/latency) belong in a future optional `endpoints[]` sub-list, **RESERVED not built**
  (OpenRouter routes endpoints + honors ZDR at runtime; zero fleets). Caught + fixed a real bug: a "representative"
  `gov.region` would degrade fail-closed→fail-OPEN (the `types.ts` header is corrected; no representative region). See C030.

### G. OpenRouter routers (C030 — strategic, RESOLVED + shipped)
- [x] **Delegate the per-request PICK to OpenRouter, keep the moat** — strategy council `wf_75f87ab6-b1b` (**unanimous
  10/10 hybrid** @0.76). ADR [C030](../doc/architecture/decisions/C030-openrouter-router-delegation.md);
  [`0delegation.bn`](./facts/0delegation.bn). `SulukSkillRef.modelResolve` (`pinned`|`router`|`latest`, default
  `pinned`); `skillModels` emits a `ResolvedTarget` (pin / `openrouter/auto`+enumerated `allowed_models`+`deriveCQT` /
  `~-latest`); **governance-gated** (a policied skill declaring `router` fails loud); `pickPinned` marks set-pinned-but-
  pick-not-pinned; manifest + cockpit fold it. `fusion`→sub-agent/C029 docs, `pareto`→future coding target,
  `free`/`bodybuilder`→link-out. Verified: core 36 / models 16 / agents 71 / cockpit 125 tests, tsc clean.
- [ ] _Reopen-gated:_ the governed-router `provider.zdr` path — VERIFIED 2026-06-13: ZDR field exists but NO region field + the auto+zdr combination is undocumented + no API key to test → stays gated on a LIVE test (region-governed pins permanently). (orig: verify OpenRouter combines provider-prefs with
  `openrouter/auto`); the `endpoints[]` build (a fleet needing per-endpoint region governance).

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
- [x] **npm publish** — token is `NPM_SULUK_TOKEN` in `.env` (Bun auto-loads it; for `npm`, `set -a; . ./.env; set +a`).
  Published this session: **`@suluk/models@0.1.0`** + **`@suluk/agents@0.1.0`** (new) + **`@suluk/core@0.1.8`** +
  **`@suluk/cockpit@0.1.16`** (bumped). Use `bun publish` (converts `workspace:^`); publish in dep order
  models→core→agents→cockpit. _(Gotcha: `bun install` AFTER a version bump before publishing, else the converted
  caret floor lags — agents shipped `@suluk/core: ^0.1.7`, harmless since it resolves to 0.1.8.)_ `@suluk/seo` +
  `@suluk/panel` are the concurrent session's to publish.
- [x] **`@suluk/agents` → vscode extension SHELL wiring** — `suluk.agents` command + `agentsHtml` host-rendered webview
  (`tooling/ts/packages/vscode`, v0.1.15): tier tree · scope · context/right-sizing · gate findings · per-skill model
  selection (resolve mode: pin/router/latest), against `OPENROUTER_CATALOG`. tsc-clean. _(Publish step: VS Code
  Marketplace via `vsce publish` — a separate token from npm; committed but not Marketplace-published from here.)_
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
