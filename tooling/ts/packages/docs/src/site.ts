/**
 * Assemble the full static site from a harvested FrameworkDoc: a landing page, one page per package, the
 * architecture, and curated Getting-started / Contributing / Community pages (overridable), plus the
 * stylesheet and a `.nojekyll` so GitHub Pages serves every file verbatim.
 */
import { renderIndex, renderPackage, renderMarkdownPage, STYLE, type SiteFile } from "./render";
import type { FrameworkDoc } from "./harvest";

export interface SiteOptions {
  /** Markdown overrides for the curated pages. */
  gettingStarted?: string;
  contributing?: string;
  community?: string;
}

export function generateSite(fw: FrameworkDoc, opts: SiteOptions = {}): SiteFile[] {
  const files: SiteFile[] = [{ path: "index.html", content: renderIndex(fw) }];
  for (const p of fw.packages) files.push({ path: `${p.slug}.html`, content: renderPackage(fw, p) });
  if (fw.architecture) files.push({ path: "architecture.html", content: renderMarkdownPage(fw, "architecture.html", "Architecture", fw.architecture) });
  files.push({ path: "getting-started.html", content: renderMarkdownPage(fw, "getting-started.html", "Get started", opts.gettingStarted ?? defaultGettingStarted(fw)) });
  files.push({ path: "contributing.html", content: renderMarkdownPage(fw, "contributing.html", "Contributing", opts.contributing ?? defaultContributing(fw)) });
  files.push({ path: "community.html", content: renderMarkdownPage(fw, "community.html", "Community", opts.community ?? defaultCommunity(fw)) });
  files.push({ path: "style.css", content: STYLE });
  files.push({ path: ".nojekyll", content: "" });
  return files;
}

function defaultGettingStarted(fw: FrameworkDoc): string {
  return `# Get started

${fw.title} turns **one source of truth** — your data schema + your routes — into the whole stack. You write
the contract once; the docs, the typed client, the UI, the validation, the tests, and the admin panel are all
*derived* from it, so they cannot drift.

## The 30-second tour

\`\`\`ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { tableToV4 } from "@suluk/drizzle";
import { buildApp } from "@suluk/builder";

// 1. your data is the system of record (Drizzle — and sqlite-core IS Cloudflare D1)
const pet = sqliteTable("pet", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  status: text("status", { enum: ["available", "pending", "sold"] }).notNull().default("available"),
});

// 2. one call derives BOTH ends
const app = buildApp({ entities: [{ name: "Pet", schema: tableToV4(pet).insert }] });

app.backend.document;     // → the OpenAPI v4 document (validated)
app.backend.routes;       // → Hono CRUD RouteContracts (mount them)
app.frontend.components;  // → shadcn Form + Table (TSX)
app.frontend.pages;       // → page TSX wired to the typed client
\`\`\`

From that one document you get **Scalar/Swagger docs**, a typed **Nano Stores** client, generated **shadcn**
UI, **contract tests**, a documentation **audit**, the **/superadmin** admin panel, and a **Cloudflare**
deploy plan. See the [runnable demo](${fw.repoUrl}/tree/main/tooling/ts/packages/example-petshop) — it boots
the entire stack from one schema.

## Install

Everything is a small focused package — add only what you need:

\`\`\`
bun add @suluk/core @suluk/hono @suluk/zod
\`\`\`

Browse all ${fw.packages.length} packages on the [home page](index.html#packages), and read
[how it fits together](architecture.html).

## The discipline (why it stays coherent)

- **One source, many projections.** The v4 document is the hub; everything is derived from it.
- **Honest losses are enumerated, never silent** — every converter reports what it couldn't carry.
- **Schema Objects are JSON Schema 2020-12 verbatim** across v4 / 3.1 / Zod / Drizzle.
- **Pure logic + thin shells** — the cockpit runs identically in the editor and on \`/superadmin\`.

> ${fw.title} is a **candidate** exploration of OpenAPI v4 "Moonwalk" — not the official specification.`;
}

function defaultContributing(fw: FrameworkDoc): string {
  return `# Contributing

${fw.title} is a Bun + TypeScript monorepo of ${fw.packages.length} small, single-purpose packages (plus a
Rust core). Contributions are welcome — the architecture is designed so each package is independently
understandable and testable.

## Set up

\`\`\`
git clone ${fw.repoUrl}
cd $(repo) && bun install
bun test            # run a package's tests from its dir
\`\`\`

Every package has \`bun test\` and \`tsc --noEmit\` gates. Keep both green.

## How the code is organized

- Each package separates **pure logic** (unit-tested with \`bun test\`) from a **thin adapter/host shell**
  (duck-typed; type-checked). That's why coverage is high and the host bindings are trivial.
- A new conversion or projection is just a new package that consumes the v4 document (or a Zod/Drizzle
  source) and emits an artifact — follow the shape of \`@suluk/scalar\` or \`@suluk/drizzle\`.
- **Enumerate every loss.** If a transform can't carry something, surface it (a \`warnings\`/\`diagnostics\`
  array), never drop it silently.
- Keep the **CANDIDATE** labeling — nothing here is the official OpenAPI specification.

## Good first contributions

- A new \`DeployProvider\` (Vercel, Fly, a Node box) — implement the interface in \`@suluk/deploy\`.
- A new UI target alongside \`@suluk/shadcn\` (e.g. a different component kit).
- Richer \`@suluk/docs\` output, or a second language core (the Rust \`suluk-core\` is the template).

Open a [discussion](${fw.repoUrl}/discussions) before large changes, and a
[pull request](${fw.repoUrl}/pulls) when ready.`;
}

function defaultCommunity(fw: FrameworkDoc): string {
  return `# Community

${fw.title} is meant to be **extended and built upon**. Here is where that happens.

## Talk about it

- [Discussions](${fw.repoUrl}/discussions) — questions, ideas, show-and-tell.
- [Issues](${fw.repoUrl}/issues) — bugs and concrete proposals.

## Build community libraries

The whole stack ships in shadcn's **registry** format, which means *anything* — frontend components AND
backend slices — can be distributed as an installable unit. \`@suluk/builder\`'s \`toShadcnRegistry\` turns a
slice into a registry item bundling its UI **and** its routes **and** its schema:

\`\`\`
npx shadcn add https://your-registry.example/pet-crud.json
\`\`\`

Publish your own registry (a static JSON host — even GitHub Pages) and the community can install your
full-stack slices with one command. A community library is just a registry of slices that consume the same
v4 contract.

## Extend the framework

- A new **projection** package (the v4 document → some new artifact).
- A new **DeployProvider** (the deploy target is swappable by design).
- A new **cockpit shell** — the editor and \`/superadmin\` are two faces of \`@suluk/cockpit\`; add a third.

See [Contributing](contributing.html) for the conventions, and [Architecture](architecture.html) for the
shape of the whole thing.

> These docs were generated from the repository by \`@suluk/docs\` and are hosted on GitHub Pages — the same
> way your fork's docs can be.`;
}
