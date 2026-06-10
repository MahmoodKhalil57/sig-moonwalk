# Suluk tooling — architecture

> CANDIDATE tooling for the OpenAPI v4.0 "Suluk" candidate (NOT official OAS, NOT SIG-ratified).
> This doc is the design spine for `tooling/`. The spec itself lives in `specification/candidate-v4/`.

## The thesis: contracts in, everything else derived

The user types the **least possible** contract surface:

```
Hono endpoints  +  Zod validations  +  Better Auth settings
```

…and the system **derives** the rest. The contracts are the single **source of truth**; every other
artifact is a **Derivation** — a pure projection of the contracts. The OpenAPI v4 document is itself just
one Derivation, never the source (this mirrors Suluk's own "the Document is a projection of the ledger"
discipline).

```
   Data floor               Contracts                         Derivations (projections of the hub)
  ┌──────────────┐        ┌───────────────┐        ┌──────────────────────────────────────────────┐
  │ Drizzle      │  CRUD  │ Hono routes   │        │  v4 doc ─▶ 3.1 downgrade ─▶ Scalar / Swagger  │
  │  tables      │ ─────▶ │ Zod schemas   │ ─────▶ │     │                                          │
  │ (system of   │        │ Better Auth   │  v4    │     ├──▶ Nano Stores client (state corner)     │
  │  record)     │        │  settings     │  hub   │     ├──▶ shadcn forms / tables (UI corner)     │
  └──────────────┘        └───────────────┘        │     ├──▶ request-validation middleware         │
                                                   │     ├──▶ auto-generated contract TESTS         │
                                                   │     └──▶ documentation-coverage audit          │
                                                   └──────────────────────────────────────────────┘
                                       ▲
                          ┌────────────┴─────────────┐
                          │  suluk-vscode = the COCKPIT — every layer above is visible, navigable,
                          │  and actionable from one surface, re-projected per viewer + time.
                          └──────────────────────────────────────────────────────────────────────┘
```

The cycle is now **declarative end to end**: a Drizzle table is the system of record (`@suluk/drizzle`
emits its CRUD RouteContracts); the contract projects to the v4 hub; and from the hub fall the docs
(`@suluk/scalar`/`swagger`), the client **state** (`@suluk/nano-stores`), the **UI** (`@suluk/shadcn`),
the validation, the tests, and the audit. The developer authors the data + contract; everything else is
derived.

## The doc is a function, not a file

The pivotal requirement: the emitted documentation must be **dynamic** — it varies by **who** and **when**
is asking. So the central Derivation is not a static document but a pure function:

```ts
render(contracts, principal, now) -> v4 Document
```

- **principal** (the *who*): scopes / roles from Better Auth. The v4 by-name security model (C014) makes
  per-viewer filtering clean — include only operations whose `security` requirements the principal
  satisfies; redact or annotate the rest. A reader sees *their* API, plus their own facts (API keys,
  rate-limit budget) injected as examples / `x-` extensions.
- **now** (the *when*): drives deprecation visibility, version selection, "what is live", scheduled
  rollouts. `now` is an input, never `Date.now()` read ambiently — so a render is reproducible and
  testable (you can ask "what did/will the doc look like at time T").

A static export is just `render(contracts, publicPrincipal, now)`. Nothing special-cases it.

## Package map

| Package | Role | Status |
|---|---|---|
| `@suluk/core` | parse · validate(meta-schema) · resolve-by-name · signature · ADA · match | ✅ 19 tests |
| `@suluk/openapi-compat` | v4 ⇄ 3.1 (the Scalar/Swagger lever; ingest external 3.x via `upgrade`) | ✅ 12 tests |
| `@suluk/zod` | lossless Zod ⇄ v4 Schema Objects (fixpoint-proven) | ✅ 29 tests |
| `@suluk/scalar` / `@suluk/swagger` | render a v4 doc via the 3.1 downgrade | ✅ 5 + 6 tests |
| `@suluk/hono` | the derivation engine: `render(routes, principal, now) -> v4`; validation middleware; **audit**; **contract-test generation** | ✅ 14 tests |
| `@suluk/better-auth` | official Better-Auth-on-Hono: auth settings → securitySchemes/security; ingest its `openAPI()` output via `compat.upgrade`; session → principal | ✅ 12 tests |
| `@suluk/drizzle` | **data floor**: Drizzle table → Zod (drizzle-zod) → v4 schemas + DB metadata + **CRUD RouteContracts** | ✅ 17 tests |
| `@suluk/nano-stores` | **state corner**: v4 contracts → typed `@nanostores/query` fetcher/mutator stores (Zod-guarded I/O) | ✅ 8 tests |
| `@suluk/shadcn` | **UI corner**: v4 Schema Objects → form/table specs + shadcn TSX (react-hook-form + zodResolver) | ✅ 20 tests |
| `@suluk/builder` | **the builder**: tiered contract-narrowing DSL; `buildApp` (backend+frontend) + `toShadcnRegistry` | ✅ 16 tests |
| `@suluk/deploy` | **the capstone**: swappable `DeployProvider`; Cloudflare (Workers + D1 + assets) | ✅ 8 tests |
| `@suluk/cockpit` | the **pure cockpit core** (cycle · builder · codegen · deploy · validate/audit/preview) — shared brain | ✅ 35 tests |
| `@suluk/admin` | the **/superadmin web panel** — the cockpit rendered as a Hono web UI, superadmin-gated | ✅ 7 tests |
| `@suluk/example-petshop` | runnable end-to-end demo — real Drizzle → live CRUD + Scalar + frontend + /superadmin + client round-trip | ✅ 10 tests |
| `@suluk/docs` | generate a GitHub-Pages docs site from source (Suluk documents itself) | ✅ 10 tests |
| `suluk-core` (Rust) | perf core: parse + signature + reverse-parse matcher; 2nd independent impl | ✅ 9 tests |
| `suluk-vscode` | the cockpit's **editor face** — a thin vscode shell over `@suluk/cockpit` (Cycle + Builder TreeViews, "View as", codegen, deploy) | tsc + bundle |

**Total: 17 TS packages (228 tests) + a Rust core (9 tests) = 237 green.**

## One brain, two faces

The cockpit's logic lives once, in **`@suluk/cockpit`** (pure: `buildCycle`, `buildBuilderModel`, codegen,
`deployPlan`, validate/audit/preview — no host API). Two shells render it:
- **`suluk-vscode`** — the editor face (TreeViews + commands + webviews).
- **`@suluk/admin`** — the **`/superadmin`** web face (Hono-served HTML, superadmin-gated). Mounted with
  `app.route("/", adminApp({ document, authorize }))`; the petshop demo mounts it live.
Because both consume the same core, the admin panel *is* the extension — it cannot drift from it.

## `@suluk/hono` — the derivation engine (design)

1. **Route registry.** A thin wrapper that captures, per route: method, path, Zod schemas for
   param/query/header/json body and the response, plus optional metadata (summary, tags, security).
   Hono + `@hono/zod-validator` already declares the input schemas; we read them, so the contract stays
   in the route definition (minimal extra typing).
2. **`emitV4(registry, ctx?) -> { document, diagnostics }`.** Zod→v4 via `@suluk/zod`; assemble the v4
   Document. `ctx = { principal?, now?, servers? }` enables the dynamic projection (filter by scope, set
   servers by env, mark deprecations by `now`). No `ctx` ⇒ the full public doc.
3. **`validator()` middleware.** Validate incoming requests against the *same* Zod schemas the doc is
   built from — the doc and the runtime can never drift, because they are one source.
4. **`audit(document) -> Finding[]`.** Documentation-coverage: flag operations missing
   summary/description/response schema/examples. This is the *ceiling* side of the Conformance Grade
   (an under-documented route indicts the producer). Optional `autofill` synthesizes sane defaults.
5. **`generateContractTests(document) -> TestCase[]`.** The doc as an executable check: per operation,
   assert valid example instances satisfy the request schema, invalid ones are rejected, the live
   response matches the declared response schema, and ADA signatures don't collide (reuse
   `core.buildAda().collisions`). Emit as `bun:test` cases.

## `@suluk/better-auth` — official Better Auth on Hono (design)

- Derive v4 `securitySchemes` (bearer / session-cookie / apiKey) + by-name `security` from the Better Auth
  instance config.
- Ingest Better Auth's own `openAPI()` plugin output (OpenAPI 3.x for `/sign-in`, `/session`, OAuth
  callbacks, …) → `compat.upgrade()` → v4 → merge into the app doc, so the auth surface is documented
  without re-typing it.
- Provide the `principal` extractor that feeds `render(contracts, principal, now)` — closing the loop on
  per-viewer docs.

## The three cycle-closing packages

- **`@suluk/drizzle` (data floor).** A Drizzle table is the system of record. `tableSchemas` (drizzle-zod
  select/insert/update) → `tableToV4` (via `@suluk/zod`) → `tableComponents`; `tableMetadata` reads
  pk/notNull/hasDefault/enum off the column descriptors; `crudRoutes(table)` emits list/get/create/update/
  delete RouteContracts. `emitV4(crudRoutes(table))` validates against the meta-schema — the floor reaches
  the hub with no hand-written contract.
- **`@suluk/nano-stores` (state corner).** The *same* RouteContracts the server is built from project into a
  typed `@nanostores/query` client: GET → fetcher stores, the rest → mutator stores, with the contract's Zod
  guarding request **and** response edges (`SchemaViolationError`). One contract, two projections.
- **`@suluk/shadcn` (UI corner).** v4 Schema Object → `formSpec`/`tableSpec` descriptors → shadcn TSX
  (`renderFormTsx`/`renderTableTsx`: react-hook-form + zodResolver). Codegen only — no runtime UI deps.

## `suluk-vscode` — the cockpit (the unifying surface)

The extension is where the whole cycle becomes coherent: one v4 document is the hub, and every projection is
visible, navigable, and actionable from one place.

- **`buildCycle(doc, {principal?})` (pure, tested).** An 8-layer model — *data · contract · auth · document ·
  docs · state · ui · tests* — each layer a projection of the hub. It is a **function of the viewer**: pass
  scopes and scope-gated operations the principal can't reach are filtered out (the per-WHO projection,
  applied at the hub; the hidden count surfaced honestly). `docChecks` = the doc as an executable check.
- **`codegen` (pure, tested).** Actions that land files, each reusing a projection package: `generateForm`/
  `generateTable` (shadcn TSX), `generateStoresModule` (the `@suluk/nano-stores` wiring + derived store
  list), `exportV4Json`. The editor never reimplements a projection.
- **The shell.** A "Suluk · Cycle" TreeView with status icons; **"View as…"** re-projects the tree to a
  principal's scopes; commands for every codegen action; Scalar/Swagger webview previews; validate/audit
  diagnostics in the Problems panel.

## The builder — compose the whole stack (`@suluk/builder`)

Inspired by `~/apps/multivendorbuilder`'s **page → section → block → component** DSL, rebuilt with the Suluk
discipline. The load-bearing idea is **contract-narrowing**: *a document's `params` is EXACTLY and ONLY what
the tier above may set.* Each tier consumes the full contract below, hardcodes most of it, and re-publishes a
narrower `params` upward — the narrowing IS the safety surface (the same discipline as the per-viewer doc
projection, applied to composition). "The owner can't change the form's fields" isn't a rule — `fields` just
isn't in the section's `params`.

The Suluk twist binds the tiers to the cycle: lower tiers **auto-generate** from an entity schema (Form/Table
blocks, a CRUD section, the backend CRUD routes); a **page** composes sections. So `buildApp(spec)` emits
**both ends from one spec** — backend (routes → `emitV4` → v4 doc) *and* frontend (shadcn components + page
TSX). Building a page builds the front *and* the back, because each entity carries data + contract + UI.

## Distribution — shadcn registry as the whole-stack package format

shadcn's registry isn't UI-only: a `registry:file` item carries arbitrary files to any target. So
`toShadcnRegistry(builtApp)` packages **each slice as one installable unit** (`npx shadcn add <item>`) bundling
its shadcn Form/Table **and** its backend routes module **and** its v4 schema. The registry becomes the
universal distribution format for every layer — managed from the cockpit. This is what makes the stack modular
and installable end to end.

## The deployment capstone — Cloudflare (swappable)

The terminal stage: once a user logs into their Cloudflare account *through the extension*, everything deploys
to Cloudflare — Hono → **Workers**, the frontend → **Pages**, Drizzle(sqlite) → **D1**, plus observability /
compute. This is an *adapter, not a rewrite*: the stack is already Cloudflare-native by construction (Hono is
the canonical Workers framework; `@suluk/drizzle` targets `sqlite-core`, which *is* D1). Kept behind a
**swappable target interface** (`@suluk/deploy`) so Cloudflare is the first provider, not the only one — the
services are built on good standards we can swap later. **Built** as `@suluk/deploy`: `cloudflare.generate()`
emits `wrangler.jsonc` (D1 binding + static `assets` SPA-fallback + observability) + `worker.ts`
(`export default app`) + `schema.sql` (from the entities) + an ordered plan (login → d1 create → apply →
deploy). The extension's "Deploy to Cloudflare" command writes these + a `DEPLOY.md` and opens a terminal —
it never runs `wrangler` for you (deploys are consequential; OAuth login happens in your terminal).

## Invariants every package keeps

- **Honest losses are enumerated, never silent** — `compat` collision diagnostics, `zod` lossy-effect
  warnings, `hono` audit findings, `drizzle`/`shadcn` warnings. The pattern is uniform.
- **Schema Objects are JSON Schema 2020-12 verbatim** across v4 / 3.1 / Zod / Drizzle — no re-encoding, so the
  conversions are thin and the round-trips are exact.
- **One source, many projections.** The data + contract are authored once; docs, state, UI, validation,
  tests, and audit are all derived — they cannot drift, because they are the same source.
- **Pure logic + thin adapters.** Every package separates tested pure functions from a duck-typed/host shell
  (`hono.mount`, `better-auth.mountAuth`, the vscode shell). That is why coverage is high and the host
  bindings are trivial.
- **CANDIDATE labeling** stays on every artifact; nothing here is official OAS.
