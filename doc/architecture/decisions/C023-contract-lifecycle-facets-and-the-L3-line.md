# C23. Contract-lifecycle facets — provenance + conformance at L2; the renderer renders, never hosts (the L3 line)

> **Provenance:** Candidate-fork ADR (Suluk), not a SIG decision. Decides how far four "contract-lifecycle"
> capabilities may go — provenance, recorded examples, conformance test-gen, and "the renderer renders full apps."
> Decided by the **persona council** (deliberation `whuovh6gs`, 2026-06-11): 9 voices — Class A hudlow@0.78,
> handrews@0.70, rafalkrupinski@0.70; Class C security-reviewer, codegen-author, platform-architect,
> ai-llm-consumer, tech-writer, hand-author-dev. Implemented in `@suluk/core` (`source.ts`), `@suluk/reference`,
> `@suluk/testgen`, and saasuluk. Sibling to [C022](./C022-live-document-projection.md) (the live-document L2/L3
> line); the same L3 disease, the same verdict.

Date: 2026-06-11

## Status

Accepted (candidate-fork). Decision ceiling **0.78** — **asymmetric**: FIRM at 0.78 on every FORBIDDING (the L3s
are structural, the way C022's were, and Class A + every Class C lens converge); HEDGED below ceiling on the
PRESCRIPTIONS — specifically whether the `@suluk/app` L2 generator earns its forever-maintenance surface, and the
recorded-examples redaction/attack-surface claims (capped ≤0.55, unfalsifiable by inspection — the
security-reviewer's gavel: "gate hard, sign-off required," not "settled").

## Context

Four ideas, each temptable past the point where the document stays a static artifact you can hash, diff, and
analyze: (1) tag where each element was authored; (2) record real request/response pairs as examples; (3) generate
tests from the contract; (4) let the renderer "render full frontend programs." Each has an L1/L2 that keeps the
contract a contract and an L3 that turns it into a live oracle. The question, per idea: how far?

## Decision

**Adopt provenance L2 and conformance-test-gen L2 now; gate recorded-examples to L1-later; cap renderer-as-app at
L2 (generate source, never host); forbid every L3.** Build order along the dependency spine —
`provenance → test-gen ← examples-as-fixtures`, renderer-as-app off the side.

- **Provenance — L2, ADOPTED (unanimous).** A per-operation `x-suluk-source: { file, symbol, kind? }` vendor facet
  — the audit trail of WHERE a contract element was projected from — plus a DERIVED reverse index. Implemented:
  `@suluk/core` (`SulukSource`, `sourceIndex`, `sourceCoverage`, `scrubSource`); saasuluk `annotateSource` stamps
  it (CRUD → the Drizzle table, reverse-mapped by object identity; custom ops → `operations.ts`; auth →
  `auth.ts`); `@suluk/reference` renders a "↗ file#symbol" affordance; a CI staleness test fails on a rotting
  pointer.
- **Conformance test-gen — L2, ADOPTED (the ceiling-raiser).** `@suluk/testgen` emits a deterministic suite that
  asserts the SERVER ENFORCES `x-suluk-access` on the real wire, smoke-tests declared statuses, validates 2xx
  bodies against their schemas, and checks declared costs are well-formed. A pure function of the document. It is
  the executable form of C022's access invariant — and on first run against saasuluk it found 13 ops whose wire
  let anon through where the facet said `authenticated`; the fix (owner ops now 401 anon) made the contract true.
- **Recorded examples — L1, GATED, do-LATER.** Frozen + dated + non-normative `x-suluk-examples`. Not built here:
  redaction IS the feature (allowlist-by-schema-shape, fail-closed, synthetic principals, human-in-the-diff,
  validated-at-projection) and it only earns its PII risk once test-gen can consume it as replay fixtures.
- **Renderer-as-app — L1 exists; L2 MAYBE; L3 FORBIDDEN.** L1 = the bounded try-it++ playground (≈ C022's
  projection with a login box). L2 = an `@suluk/app` generator that EMITS downloadable CRUD source (sibling to
  `@suluk/sdk`) — admissible because it is generation, not hosting; "maybe," gated on its maintenance economics.

## The L3 line (forbidden, permanent — not re-openable)

> **"Render full frontend programs" means EMIT a program's SOURCE — never HOST one. The renderer renders; the
> generator generates; the server runs.** Generation is a pure function of the static document and yields auditable
> source the user owns and runs under their own enforcement. The instant a facet's renderer EVALUATES the contract
> into a live, stateful, auth'd thing, the document stops being something you can hash, diff, and statically
> analyze — and becomes an oracle only the running thing can answer.

Three concrete L3s, all forbidden by the same reasoning C022 used:

1. **Provenance L3 — bidirectional write-back** (the rendered doc mutates its own upstream source): inverts
   source-of-truth; a rendered-doc XSS becomes an arbitrary source edit.
2. **Examples L2 auto-refresh / L3 live-streaming** (un-reviewed real responses piped to viewers): the redaction
   problem with the safety gate removed — a data breach with a UI.
3. **Renderer-as-app L3 — a live production runtime** hosting auth'd, stateful, served programs: makes the
   hint-emitter and the enforcer the same component (C022 inv.3 collapses), welds a multi-tenant PaaS threat model
   onto a doc viewer, and kills static analyzability. C022 already forbade this for the document; the line holds
   for every facet hung off it.

## Invariants (the council's non-negotiables)

1. **Every new facet is GENERATED, REDACTED, fail-closed, and a HINT** — never hand-authored, never live, never the
   authz gate. The server is the only authz boundary (C022 inv.3); a facet describes, it does not enforce.
2. **Provenance is a stable SYMBOLIC pointer** (`file#symbol`, never a line number), STAMPED by the projection
   pass (never resolved at generate-time, so generation stays a pure function of the document), advisory only
   (never a routing/identity/authz input), and SCRUBBED from externally-published projections (internal-layout
   disclosure). The reverse index is DERIVED, never stored INTO the canonical (no second source of truth).
3. **Test-gen is a pure function of the canonical document** — same doc in, same suite out, no network at
   generate-time. Its access tests assert the WIRE enforces, NEVER over a projection, and treat `x-suluk-access`
   as the expectation, not the boundary. Cost assertions cap at "declared + well-formed," never a literal µ$.
4. **Recorded examples, if ever built, fail CLOSED**: allowlist-by-schema-shape redaction, synthetic principals,
   human-in-the-diff, dropped-on-stale, non-normative; they feed test-gen as replay fixtures but NEVER seed an
   access-enforcement assertion (a redacted single-role capture proves nothing about the real wire).
5. **The `@suluk/app` generator (if built) adds ZERO app-semantics keywords to the contract** — client state,
   navigation, auth flows, data-binding stay the generator's opinions, never the spec's, or Suluk becomes a UI
   programming language by the back door. The generated app ships secure-by-default; access is a hint-with-banner,
   not a guard.

## Consequences

- `@suluk/core` gains the provenance facet + helpers; `@suluk/reference` shows the source affordance + a
  "⬇ Conformance tests" download; `@suluk/testgen` is a new package. saasuluk stamps + scrubs provenance
  (`/source` is the admin-only reverse index), serves `/conformance.test.ts`, and — driven by the suite — now
  enforces `x-suluk-access: authenticated` on the wire (owner ops 401 anon). The live conformance suite is 284/0.
- Test-gen makes C022's "concealment ≠ access control" invariant **executable** — a standing, generatable proof
  that the wire agrees with the contract. (It does not yet extract C022's *non-additive-subset* checker as a
  library, so C022's 0.70 ceiling stands; this is complementary, not that.)

## Open

- The `@suluk/app` L2 generator is unbuilt — a roadmap/economics bet (rafal + platform-architect own it), not a
  structural question. Recorded examples (L1) are unbuilt pending a redactor proven on a hostile fixture with
  security-reviewer sign-off. Both are deliberately deferred, not rejected.
