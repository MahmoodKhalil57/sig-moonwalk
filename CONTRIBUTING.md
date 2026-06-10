# Contributing to Suluk

> Suluk is a **candidate** exploration of OpenAPI v4 "Moonwalk" — not the official specification.

Suluk is a Bun + TypeScript monorepo of small, single-purpose packages (plus a Rust core) under
[`tooling/`](tooling/). The full, always-current contributor guide is generated into the docs site
(**Contributing** and **Community** pages); this file is the quick start.

## Set up

```sh
cd tooling/ts && bun install
cd packages/<name> && bun test          # each package has bun test + tsc gates — keep both green
```

## Conventions

- **Pure logic + thin shells.** Each package separates unit-tested pure functions from a duck-typed host
  adapter. That is why coverage is high and the bindings are trivial.
- **One source, many projections.** New work is usually a new package that consumes the v4 document (or a
  Zod/Drizzle source) and emits an artifact — follow `@suluk/scalar` or `@suluk/drizzle`.
- **Enumerate every loss.** If a transform cannot carry something, surface it (a `warnings`/`diagnostics`
  array) — never drop it silently.
- **Keep the CANDIDATE labeling.** Nothing here is the official OpenAPI specification.

## Docs

The documentation site is generated **from source** by [`@suluk/docs`](tooling/ts/packages/docs) into the
committed [`docs/`](docs/) folder, which GitHub Pages serves directly (Settings → Pages → Deploy from a
branch → `main` / `docs`). Regenerate **and commit** `docs/` when packages change:

```sh
cd tooling/ts && bun run gen:docs   # → ../../docs
```

Open a [discussion](https://github.com/MahmoodKhalil57/sig-moonwalk/discussions) before large changes.
