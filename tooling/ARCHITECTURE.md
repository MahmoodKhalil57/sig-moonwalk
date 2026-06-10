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
                        ┌──────────────────────────── Derivations ───────────────────────────┐
   Contracts            │                                                                     │
  (source of truth)     │   v4 OpenAPI doc ──▶ 3.1 downgrade ──▶ Scalar / Swagger UI          │
  ┌───────────────┐     │        │                                                            │
  │ Hono routes   │     │        ├──▶ TS types (consumer SDKs)                                │
  │ Zod schemas   │ ───▶│        ├──▶ request-validation middleware (same schemas)            │
  │ Better Auth   │     │        ├──▶ auto-generated contract TESTS (executable checks)       │
  └───────────────┘     │        └──▶ documentation-coverage audit (under-doc detection)      │
                        └─────────────────────────────────────────────────────────────────────┘
```

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
| `@suluk/core` | parse · validate(meta-schema) · resolve-by-name · signature · ADA · match | ✅ built, tested |
| `@suluk/openapi-compat` | v4 ⇄ 3.1 (the Scalar/Swagger lever; ingest external 3.x via `upgrade`) | ✅ built, tested |
| `@suluk/zod` | lossless Zod ⇄ v4 Schema Objects (fixpoint-proven) | ✅ built, tested |
| `@suluk/scalar` / `@suluk/swagger` | render a v4 doc via the 3.1 downgrade | ✅ built, tested |
| `@suluk/hono` | the derivation engine: `render(routes, principal, now) -> v4`; validation middleware; **audit**; **contract-test generation** | ◻ next |
| `@suluk/better-auth` | official Better-Auth-on-Hono: auth settings → securitySchemes/security; ingest its `openAPI()` output via `compat.upgrade` | ◻ next |
| `suluk-core` (Rust) | perf core: parse + signature + reverse-parse matcher | ◻ planned |
| `tooling/vscode/` | validate (core) + "Preview in Scalar/Swagger" (compat) — the higher-level proof | ◻ planned |

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

## Invariants every package keeps

- **Honest losses are enumerated, never silent** — `compat` collision diagnostics, `zod` lossy-effect
  warnings, `hono` audit findings. The pattern is uniform.
- **Schema Objects are JSON Schema 2020-12 verbatim** across v4 / 3.1 / Zod — no re-encoding, so the
  conversions are thin and the round-trips are exact.
- **CANDIDATE labeling** stays on every artifact; nothing here is official OAS.
