# C22. The live per-principal document is a projection (L2), never a replacement (L3)

> **Provenance:** Candidate-fork ADR (Suluk), not a SIG decision. Decides how dynamic the v4 document may be with
> respect to user/server state. Decided by the **persona council** (deliberation `wf_69c25b62-7ea`, 2026-06-11):
> 8 voices — Class A hudlow@0.78, handrews@0.70, rafalkrupinski@0.70; Class C security-reviewer, codegen-author,
> platform-architect, ai-llm-consumer, tech-writer. Implemented in `@suluk/reference` + saasuluk
> (`src/server/project.ts`). Sibling facet: [C-cost](../../../tooling/ts/packages/cost) and the access facet
> (`x-suluk-access`).

Date: 2026-06-11

## Status

Accepted (candidate-fork). Decision ceiling **0.70** (the lowest Class-A ceiling on the L1↔L2 line; a persona
prediction never raises a decision's own ceiling, and the subset-checker is the unbuilt piece that holds it there).

## Context

A v4 contract can be seen as a function `emit(routes, {principal, env})`, which invites a tempting feature: serve a
**different document per authenticated user** — routes/properties computed from who-you-are and even DB state, with
the renderer hot-reloading on auth change. The question: how dynamic may the document be?

## Decision

**Adopt L2; forbid L3.**

- **L1 (baseline, kept):** ONE canonical static document; every operation DECLARES its access as a closed facet
  `x-suluk-access: { requires: anyone|authenticated|admin, scope? }`; a renderer computes a client-side "View-as"
  projection. Absence-in-a-view is a *theorem* about the canonical doc.
- **L2 (adopted):** the server MAY additionally emit a per-principal **projection** — a deterministic, side-effect-free
  filter of the canonical — and the renderer MAY hot-reload it on auth change.
- **L3 (forbidden, unanimous):** the canonical document is replaced by per-user/per-DB-computed content. Killing the
  canonical yields no deterministic codegen target, no static attack-surface map, no snapshot/diff — "what is the API?"
  becomes a question only the running server can answer. An oracle, not a contract.

## Invariants (the council's non-negotiables)

1. **One canonical, full, static, auth-free document is authoritative** — the single version-controlled, hashed,
   diffed, security-reviewed artifact and the single codegen input. The projection is derived FROM it, never the reverse.
2. **The projection is a provable, NON-ADDITIVE subset:** same operation identity / signature / path / schema / authz
   on every retained op; it may only hide, never add/rename/reshape/weaken. Mechanically checkable in CI (the gate).
3. **Concealment ≠ access control.** A route absent from a view is STILL reachable on the wire; server-side authz is the
   real, independent boundary. No team may cite "not in my document" as a control.
4. **The visibility predicate is a CLOSED, DECIDABLE lattice** — `requires` + enumerable `scope` — **never an opaque
   DB-state function.** Row-state gating stays a runtime 403, out of the document. (This is the load-bearing line.)
5. **Operation identity is stable + principal-independent** (no re-minting on hot-reload).
6. **Codegen + contract-diff run on the canonical ONLY.** Projections are marked `x-suluk-projection: derived` so a
   generator can refuse to build a shipping SDK from one. Hot-reload is a renderer feature, never a compilation input.
7. **The projection is self-describing + escapable:** it carries a pointer + hash to its canonical parent and its scope;
   the renderer always offers "view-as: everything" so no one is trapped in a partial view.

## Consequences

- `@suluk/reference` renders from the canonical doc and projects client-side (a legible subset: "N hidden by access
  policy — still reachable on the wire"); `whoamiUrl` auto-selects the session viewer; "Everything" is the escape hatch.
- saasuluk: `/openapi.json` is canonical; `/openapi.json?as=me|anon|user|admin` is a stamped projection; `/api/whoami`
  reports the verified principal-class; a subset-conformance test is the standing gate. Live: 96 canonical ops →
  28 in the anon projection.
- **Open (holds the ceiling at 0.70):** the projection subset-checker is a conformance test, not yet a reusable
  library; until it is a mechanically-enforced contract rule everywhere, L2 is only as safe as the discipline applying it.
