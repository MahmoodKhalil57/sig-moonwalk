# C28. `x-suluk-policy` — operator governance overlay (sibling vendor map; static subset built, enforcement reserved)

> **Provenance:** Candidate-fork ADR (Suluk), **not** a SIG decision. ORIGINATED. Resolves the [C027](./C027-suluk-agents-composition-map.md) deferred question (council open-Q #6: does an operator governance overlay belong?). Council panel `wf_b2f1fd82-7a7` (11 voices): **8 sibling-build / 3 defer / 0 core / 0 decline** — both Class-A static-decidability voices (hudlow @0.74, handrews @0.70) and the security-reviewer land sibling-build; the deferrers (rafalkrupinski @0.70, pragmatist, devex-pm) object only to *building enforcement for zero fleets*. **Every** voice agreed the identical shape, the identical MEET override algebra, the identical D1 red-line, and the identical `costCeiling` honesty — the contest was build-now-vs-reserve, not correctness. Adversarial verification: all three load-bearing claims **hold-with-caveat** (@0.5 / @0.58 / @0.52). Ledger: [`plan/facts/0policy-d1.bn`](../../../plan/facts/0policy-d1.bn). Honest ceiling **~0.52** (Originated; governance over an agent layer that itself leans on D1's 0.139 floor — originated-on-originated).

Date: 2026-06-13

## Status

**Accepted (candidate-fork), SCOPED.** Build the **statically-decidable subset**; **RESERVE** (build-by-nobody) the `costCeiling` enforcement runtime. D1 gate passed: `d1_policy_selector_safe` ([`0policy-d1.bn`](../../../plan/facts/0policy-d1.bn)) — `mizan_verify_claim` no-bcmea, cap 0.55 = declared, above the 0.139 floor; witnessed by [`test/policy-d1-invariance.test.ts`](../../../tooling/ts/packages/core/test/policy-d1-invariance.test.ts) (matcher byte-identical with vs without a **deny-all** policy). `burhan-converge` clean (230 claims). Built: `@suluk/agents` `policy.ts` + the cockpit OBSERVE diff. **40 agents tests / 122 cockpit tests / 36 core tests pass, tsc clean.**

## Context

C027 shipped the `x-suluk-agents` standard but **deferred** the enterprise governance overlay as contested (open-Q #6). An agent already self-declares scope, tier, model preference, and `x-suluk-cost`. The question: does an **operator-owned** policy that *overrides* that self-declaration belong — and is it premature for a single-contributor fork with one self-operated agent (Conin)?

The deciding asymmetry (security-reviewer, unrefuted by the deferrers): you cannot retrofit an operator authz **floor** after agents ship self-declaring scope — at the first multi-tenant fleet a self-declared broad scope *is* a capability grant (confused-deputy). The slot must be **reserved before minting**. But the deferrers are right about exactly one thing — the `costCeiling` *enforcement* (a terminate-at-spend kill-switch for zero fleets is decoration) — so the synthesis honors it by **not building it**.

## Decision

Add an **OPTIONAL** top-level **`["x-suluk-policy"]?: Record<string, SulukPolicy>`** keyed by **operator/fleet name** (not agent name — the operator owns it; one policy spans many third-party agents), riding the `x-suluk-jobs`/`x-suluk-agents` move EXACTLY (additive, no new normative kind, byte-identical validation for a policy-free doc). A `SulukPolicy` carries ONLY static, locally-decidable, **narrow-only** fields: `appliesTo` (by-name refs into `x-suluk-agents` keys — **never** a request predicate), `scopeAllowlist`, `agents`/`tools`/`retrievalTools` `{deny,allow}`, `capTier`, `modelAllowlist`, `maxDepthCap`, `forbidNesting`, and `costCeiling{ amount, amountUnit, basis, enforcedBy }` with **`enforcedBy` REQUIRED**.

**Override = a monotone MEET.** `policyConstrain(agent, policy)` reuses the shipped `intersectScope`: **effective = INTERSECT(operatorPolicy, agentSelfDeclaration)** — it never *exceeds* either input on any axis (the precise claim, *not* "operator always narrower": there is no operator node above the root agent today, so the policy genuinely *adds* it). A widening result is a lint **hard-fail**, the same class as the shipped `scope-escalation` lint.

**Built now (real author-time teeth, zero runtime):** `policyConstrain` + the effective fold into the signable `agentManifest` (so the C021 signature covers the operator's caps) + the policy-aware over-serve auditor (`assertServedSubsetGoverned` → `policy-denied-served`) + `lintPolicy`: `request-value-selector` rejection (D1), `policy-applies-dangling`/`-malformed`, `policy-unsatisfiable` (a `modelAllowlist` that leaves a skill no model, or a deny that removes every tool), the `policy-widening` defensive guard, and the **novel cross-facet `cap-below-estimate`** check (operator under-budgeted vs the author's own `x-suluk-cost` estimate). Plus a read-only **cockpit OBSERVE diff** (declared vs effective + the cost three-number).

**Declared-only, RESERVED (build-by-nobody):** the `costCeiling` terminate-at-spend enforcement runtime. The schema **declares** the cap (the operator's third number — cap/estimate/actual on three distinct owners: operator `x-suluk-policy` / author `x-suluk-cost` / C026 reconciled); it **cannot enforce** it. `enforcedBy` names the runtime adapter; a cap-breaching run is a NAMED conformance failure.

## Consequences — adversarial self-check (the C025 four-line lens; none fires)

- **No async reopen / no kind duplication:** `x-suluk-policy` is a vendor map describing *constraints over* agents — not an event channel, not a new normative kind. Distinct from a C021 *module* and a C025 *job*.
- **Statically decidable (hudlow @0.74):** every field is a set/enum/min/membership op; the matcher reads only `doc.paths` (witnessed) and is **invariant** to a deny-all policy. Selection stays out of the matcher — `appliesTo` binds by agent name, never a request value.
- **Whose job (handrews @0.70):** governance is its OWN top-level map, never grafted onto `SulukAgent` — so a reader can statically tell who owns (thus who is trusted to set) a field. `core` gains only the structural `SulukPolicy` shape.
- **Real cowpath (rafalkrupinski @0.70):** the *static lint* acts on the one real agent today; only the enforcement runtime (which he correctly calls decoration for zero fleets) is reserved.

## Honesty (the caveats the panel + verifiers will not let us launder)

- **`costCeiling` is DECLARED, not ENFORCED.** A schema-declared number a generator can only emit is decoration until a runtime adapter carries it. `enforcedBy` is required so no reader mistakes declaration for enforcement (C026 PROVISIONAL restated at the point of definition). Anyone reading C028 as "Suluk enforces your budget" has been misled.
- **Zero second user today.** Conin is author==operator, so the override has nothing to override and the hole the floor closes is not yet open. The verdict survives only because reserving a security floor is a one-way door AND the static subset reuses shipped infra at near-zero cost — the gap to the deferrers' DEFER is ~one lint package, deliberately small.
- **Originated-on-originated.** Governance over an agent layer that leans on D1's soft 0.139 floor — ceiling held ≤0.52; an independent D1 witness would lift the whole tower.
- **MEET soundness assumption.** `analyzeScopes`/`intersectScope` use first-reaching-path intersection on a DAG — sound for the shallow one-hop shapes shipped today; re-audit before the recursion reopen-trigger fires.

## Deferred — reopen-trigger

Build the `costCeiling` **enforcement runtime** (admission-gate / terminate-at-spend) + any cost-metering/billing engine + a `@suluk/policy` execution path ONLY when a **real fleet operator runs ≥2 agents authored by a party OTHER than the operator** (third-party self-declaration the operator must override). Concrete signal: a second `x-suluk-policy` entry pointing at agents not in the operator's own `x-suluk-agents` authorship, OR a conforming adapter that wires a runtime meter. Until then the static lint ships and the enforcement runtime is built-by-nobody — exactly as C027 reserved recursion-beyond-one-hop and the tier-trim-serving mandate.
