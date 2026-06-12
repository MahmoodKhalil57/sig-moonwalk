# C27. `x-suluk-agents` — the Suluk Agent composition vendor map (flat two-tier first; recursion lint-only placeholder)

> **Provenance:** Candidate-fork ADR (Suluk), **not** a SIG decision. ORIGINATED — clean-room, witness-thin, with no SIG prior (the SIG never specified an agent layer). Operator-surfaced; resolved by a 15-voice persona council ([C006](./C006-backtested-persona-council.md)/[C007](./C007-council-persona-classes.md)) run as workflow `wf_9e8712c7-871` (2026-06-12): **near-unanimous** — 11 support-with-conditions, 3 reframe, **0 oppose**. The headline context-savings claim was adversarially **refuted** and reframed (see §Honesty). Ledger: [`plan/facts/0agents-d1.bn`](../../../plan/facts/0agents-d1.bn) + [`plan/facts/0agents-d1-witness.bn`](../../../plan/facts/0agents-d1-witness.bn). Honest ceiling **~0.52** (Originated, tracking [C024](./C024-cost-trigger-and-attribution.md)/[C025](./C025-jobs-vendor-map.md), and leaning on D1 which the ledger caps at 0.139 — so the burden is *higher*, not lower).

Date: 2026-06-12

## Status

**Accepted (candidate-fork), SCOPED PILOT** at an Originated ceiling **~0.52**. Gated: the D1-safety claim `d1_agent_selector_safe` was authored, `mizan_verify_claim` returned **no bcmea violation** with a recommended cap (0.55) **equal to** the declared ceiling (i.e. not over-asserted) and **above** D1's 0.139 floor, and an independent executable witness ([`test/agents-d1-invariance.test.ts`](../../../tooling/ts/packages/core/test/agents-d1-invariance.test.ts), 3 pass) now enforces the invariant as a maintained regression tripwire. `burhan-converge` clean (21 files, 226 claims). **Build the FLAT two-tier agent only; recursion ships as a cycle-linted, depth-bounded schema slot built by nobody until a second real nested agent exists.**

## Context

The operator surfaced a real, bespoke, **unstandardized cowpath**: **Conin** (Construction Intelligence) is *already* a suluk agent — a served-preprompt `SKILL.md` (single source of truth at `/v1/instructions`) over a **deterministic spine** (`generate_deliverable` / `run_core_primitive` → `audit_boq`/`reconcile`/`spread_scurve`) plus an **intelligent retrieval layer** (`search_library` / `find_comparables` / `evidence_for`) — shipped as **one Claude plugin** (`plugin.json` + `.mcp.json` HTTP-MCP-OAuth + a generated `SKILL.md`) and servable by OpenAI-compatible LLMs (OpenRouter). No standard describes the composition. The same two-tier shape recurs across three industry agent frameworks (Strands' agent-as-tool, the Claude Agent SDK's name-keyed `agents` subagent map, OpenAI Agents' handoffs), so this paves a three-vendor cowpath, it does not invent one.

The structural home the council reached near-consensus on is the **[C025](./C025-jobs-vendor-map.md) `x-suluk-jobs` precedent**: a top-level, optional, name-keyed vendor map. The single load-bearing constraint is **D1** — the DOM→ADA request→operation matcher must stay statically + locally decidable and must **never** consult an agent field.

## Decision

Add an **OPTIONAL** top-level **`["x-suluk-agents"]?: Record<string, SulukAgent>`** to `OpenAPIv4Document` (sibling to `x-suluk-jobs`; `additionalProperties`-legal under the existing `[ext: ` `x-${string}` `]` catch-all). A **`SulukAgent`** is:

- **`description`** (required, routing-oriented — the field the serving LLM selects on; a lint rejects empty/one-word),
- **`skills`** — a name-keyed map of instruction bundles. **PRESENCE of `model`** is the hard static **skill (LLM) vs route (deterministic)** discriminator. Skill text is a **provenance pointer** (`source` URL + `contentHash` + `version`), never inlined mutable prose — the served instructions stay the single source of truth and a projected `SKILL.md` is **generated** from it, the content-hash binding making drift tool-detectable (the one feature multiple voices independently called genuinely missing today).
- **`routes`** — a name-keyed map of **by-name `operationRef` `$ref`s into existing `paths[*]`/`webhooks`/`x-suluk-jobs` operations**. **No `model` field, ever.** Never an inline re-declaration (inlining forks [C009](./C009-array-vs-map.md) identity and strands the operation on a 3.1 downgrade). `guarantee` is **declared** intent, never schema-enforced.
- **`agents`** — an optional name-keyed map of **by-name sub-agent refs** (never inline). `maxDepth` is **REQUIRED whenever `agents` is non-empty** (a typed leaf = `maxDepth` 0, `agents` {}); a cycle-linter rejects name-cycles at author/install time (JSON-Schema cannot express acyclicity). A child's effective scope is **INTERSECTION(child, caller)**, never union.

**Selection / tiering / model-pick are RUNTIME-ADVISORY only**, walled exactly as [C018](./C018-callbacks-webhooks.md) walls callback runtime-expressions and [C024](./C024-cost-trigger-and-attribution.md) walls attribution. There is deliberately **no field referencing request/DOM/header/body/query values** — the [#20 `parameterSchema` static-matcher tripwire](../../../plan/STATE.md) is declined identically, by removal-by-design.

**D1 by module boundary, not discipline:** the agent layer is parsed by a separate `@suluk/agents` package that `@suluk/core`'s `buildAda`/`matchRequest` provably never imports; a build-time import-boundary test backs the invariant. `core` gains only the **structural** `SulukAgent` shape — no new normative control keyword.

**Two pure-function projections are the conformance test** (mirroring how `SPEC.md` projects from the ledger, [C022](./C022-live-document-projection.md)): one contract → a Claude plugin (`plugin.json` + `.mcp.json` + generated `SKILL.md`) **and** an OpenRouter/OpenAI-compatible manifest, deterministic given a `contentHash`-pinned instructions snapshot. The map key is the stable wire-level tool/function id on both. **No credentials cross the seam** (OpenRouter keys, the plugin OAuth token) — serving/execution is a post-projection adapter concern ([C020](./C020-extension-cockpit-charter.md) no-credentials / [C023](./C023-contract-lifecycle-facets-and-the-L3-line.md) L3 upheld).

## Consequences — adversarial self-check (the C025 four-line lens; none fires)

- **Does NOT reopen the async scope** (conservative / C018): `x-suluk-agents` is a **vendor map** (`x-suluk-*`), explicitly **not** a normative kind — it describes a *composition over* operations, asserting no event channel / loop / delivery protocol. Same move C024 pre-blessed (cf. `x-suluk-ratelimit` vs C012/#43).
- **Does NOT duplicate webhooks / jobs / modules** (contrarian): a route is a **by-name `$ref` into** an existing operation, never a parallel namespace; an agent is an LLM-orchestration manifest, distinct from a [C021](./C021-modules-contract-merge-marketplace.md) *module* (a contract-merge fragment) and a C025 *job* (non-HTTP background work). Disjoint loci; the four nouns are pinned in CONTEXT.md.
- **Statically decidable** (hudlow @0.78): the static fields are locally decidable from the document; the matcher reads only `doc.paths` (verified `ada.ts:31-39,69-85`) and is **invariant** to the block (test-enforced). Selection stays runtime-only, never in the matcher.
- **Whose job** (handrews @0.70): agents stay a vendor extension; `core` gains only a **structural** `SulukAgent` shape — no new normative control keyword — reusing C009 named maps + the `x-suluk-*` namespace + C013 by-name resolution.

## Honesty (the refutations the council will not let us launder)

- **Determinism is DECLARED, not ENFORCED.** No vendor extension can stop a cheap model calling a retrieval tool to invent a number; `guarantee: same-in-same-out` asserts intent (mirrors C026 PROVISIONAL). A runtime "SOURCED-only-from-a-deterministic-route" gate is a **deferred adapter obligation**, not a schema guarantee.
- **The operator's "tiering SOLVES the context problem" is reframed, not delivered.** Adversarial verification (verified in Conin's code) found tiering **relocates + duplicates** context (conserved, not destroyed): the parent still needs broad context to route, and Conin's *public* MCP `tools/list` ships the **full catalog** today (zero context saved in the served path). The honest, load-bearing claim is **"tiering makes context allocation EXPLICIT and per-tier cost AUDITABLE — a CONDITIONAL reduction a conforming serving adapter must actively perform"** (resident in the default `tools/list`, cold-tail behind `discover_tools`). The genuinely novel, true property is the static `model`-presence partition (skill vs route), computable with zero requests.
- **The recursion is design-forced.** Conin runs ONE flat agent with ZERO nesting; even modeling its retrieval tier as a sub-agent is a first nesting we authored, not one we observed. So recursion ships as **cycle-lint + depth-lint + schema slot only** — no cockpit/cost/serving machinery — until a second real nested (or non-Conin) agent exists.
- **One conforming implementation.** Conin is *non-conformant on day one* (an MCP-only `run_core_primitive` with no REST path → a dangling `operationRef`; snake_case tool ids vs camelCase operationIds; the full-catalog over-serve). These are tracked as **named conformance-failure fixtures**, not laundered as "1:1".

## Deferred

- Recursion runtime/cockpit/cost machinery beyond one parent→child hop (reopen-trigger: a second real nested or non-Conin agent).
- Whether **tier-trimmed serving** becomes a normative projection rule vs stays adapter-only (open until the `@suluk/agents` adapter demonstrably withholds cold-tail tools and Conin's over-serve is fixed).
- Whether the **runtime deterministic-first gate** (SOURCED only from a deterministic route) is mandated by the standard or left to the implementer.
- An **enterprise governance / suppression overlay** (operator-owned deny/allow/cap-tier/model-allowlist + a hard enforced `costCeiling` distinct from estimate/actual) — a future sibling `x-suluk-policy` construct, or out of scope for a single-contributor fork.
- **Expansionist static axes** — streaming, iterative-loop (`maxRounds`/`stopCondition` — Conin's 6-round cap *is* this), human-gate (`requiresHuman`/`resumable` — Conin's PROVISIONAL-review *is* this), memory scope/reset-boundary. `models[]` is adopted; the rest are deferred and may be forked by the first non-Conin agent.
- The parent/child API-key **scope-negotiation** protocol when a child route 403s under a narrower scope (intersection is the rule; graceful-failure mechanics unspecified).
- The full closed `tier` enum and whether `learned` is admissible at all (must be a static enumerable partition or dropped).
