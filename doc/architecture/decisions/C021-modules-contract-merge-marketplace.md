# C21. Suluk modules compose by contract-merge — the marketplace rides the shadcn registry; curate before open

> **Provenance:** Candidate-fork ADR (Suluk), not a SIG decision. Decides what a "module" IS, how modules
> compose, and how a marketplace is built — grounded in two primitives Suluk already ships (the whole-stack
> shadcn registry from `@suluk/builder`, and the duck-typed swappable `PaymentProvider` from `@suluk/stripe`).
> Decided by a 6-lens product council (2026-06-10). Roadmap:
> [`plan/EXTENSION-ROADMAP.md`](../../../plan/EXTENSION-ROADMAP.md). Sibling:
> [C020](./C020-extension-cockpit-charter.md) (the cockpit charter).

Date: 2026-06-10

## Status

Accepted (candidate-fork) as **direction**, with the central primitive (the install-time contract-merge)
**not yet built** — ceiling **0.62** (Module-Skeptic), because no working multi-module install exists in the
repo to witness the interop claim. The merge discipline (below) is the gating requirement; the marketplace is
sequenced *after* it.

## Context

The operator's vision: "things like ecommerce can be added as **modules** like adding a library; download the
extensions you want until you have a complete platform that lives and interacts together **without ever having
to be a developer** — building blocks made for you, that developers can intuitively build and understand why
(to improve our version or swap a provider)." Plus: "a **marketplace architecture on top of shadcn** that lets
any user contribute modules/plugins."

This is grounded, not speculative: `@suluk/builder`'s `generateRegistryJson` already emits a **whole-stack**
shadcn registry (`registry:file` carries backend routes + schema + UI, not just components), and `@suluk/stripe`
already demonstrates a **swappable provider** behind a duck-typed interface. The marketplace "on top of shadcn"
is therefore the *distribution layer Suluk already owns*, not a new system.

The hard part is **interop**, and the code does not solve it yet: there is no cross-module `$ref` resolution,
no name-collision handling across independently-authored modules (only `unique()` *within* one `buildApp`), no
migration ordering, and auto-generated slices are pure CRUD (no business logic).

## Decision

1. **A module is a mergeable contract fragment + its bindings** — a manifest:
   `{ name, version, provides[], requires[], schemas, operations?, cost?, security?, registryItems?,
   providerSlots?, seed?, migrations? }`. It owns the entities in `provides`, references (never copies) entities
   in `requires` via `$ref`. CRUD UI/routes auto-derive; the module ships only the *extra* (a Storefront page).
2. **Composition = a structured merge into the one v4 doc**, then every cockpit layer re-projects unchanged
   (`buildCycle` already iterates `components.schemas` + `paths`). A shared entity is **one schema**, so the API
   client, the DB FK, the cost attribution, and the auth scopes all see the same `User`. **This is why Suluk
   modules genuinely compose where generic plugins don't: they integrate at the contract, and everything
   downstream is a projection — so the whole stack regenerates consistently.**
3. **The merge discipline is the product** (gating, build *before* the marketplace): install must **namespace**
   every entity/route/table (no bare `User`), **rewrite `$ref`s**, **detect collisions and refuse** (report, not
   auto-suffix), and **check `requires` is satisfied** (fail closed). A module may depend only on another's
   declared contract, never reach into internals — the same narrowing the DSL validator enforces *within* a
   registry, lifted to *across* registries.
4. **Provider-swap = a slot per facet.** Generalize `PaymentProvider` to `{ payments, auth, email, storage }`
   slots; swapping binds a different implementation of the same interface at app config; the contract is
   unchanged. The slot interface is the visible seam a developer reads to understand *why*.
5. **Curate before open.** First-party curated modules (ecommerce / crm / auth / billing) ship first. An open
   marketplace (any contributor) is gated behind: **contract-diff shown at install** (what schemas/routes/tables
   it adds/touches), a **conformance grade** (reuse `@suluk/hono` `audit`), and **`burhan-converge` over the
   merged contract**. A third-party module mutates your contract → your whole stack; opening before the merge
   discipline + diff-review is a supply-chain hole.
6. **The honest pitch** (not over-claimed): a non-developer composes ~80% (entities, CRUD UI, pages,
   usage-billing, deploy-prep); a developer wires the irreducible 20% (cross-module relationships, business
   rules, money edge-cases, migrations). The contract makes that 20% **small, legible, and swappable** — not a
   rewrite. Not "no developer ever."

## Consequences

- **(+)** Reuses three real primitives (single-source doc, whole-stack registry, duck-typed provider); the
  marketplace is distribution, not a new runtime.
- **(+)** The contract-merge gives total, consistent composition — the defensible core no general plugin system
  has.
- **(−/risk)** The interop layer (namespacing, ref-rewrite, collision-refuse, migration diffs) is unbuilt and is
  the whole game; until a working two-module install witnesses it, the "complete interacting platform" is
  aspiration. Ceiling held at 0.62.
- **First proof (slice S2):** `@suluk/builder` `SulukModule` + `installModule(doc, mod)` + one real `ecommerce`
  manifest (`Order → $ref User`, a checkout op + cost, a `payments` slot) + tests asserting the cycle lights up
  *and* a colliding module errors. Validate the merge against a real two-module install before lifting the
  ceiling.
