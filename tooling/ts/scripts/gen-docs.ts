// Generate the Suluk documentation site from this monorepo's source → ./site (for GitHub Pages).
// Run: bun run scripts/gen-docs.ts
import { harvest, generateSite } from "../packages/docs/src/index";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const tsRoot = new URL("..", import.meta.url).pathname;        // tooling/ts
const repoRoot = join(tsRoot, "..", "..");                     // repo root

const fw = harvest({
  packagesDir: join(tsRoot, "packages"),
  title: "Suluk",
  tagline: "One typed contract — projected into your entire stack: API, docs, typed client, UI, tests, admin, and deploy.",
  description:
    "**Suluk** is a candidate exploration of OpenAPI v4 \"Moonwalk\", built as a framework: you declare your " +
    "data and routes **once**, and everything else — the OpenAPI v4 document, Scalar/Swagger docs, a typed " +
    "Nano Stores client, generated shadcn UI, request validation, contract tests, a documentation audit, an " +
    "admin panel (in your editor *and* on `/superadmin`), and a Cloudflare deploy plan — is **derived** from " +
    "it. One source, many projections; they cannot drift because they are the same source.",
  repoUrl: "https://github.com/MahmoodKhalil57/suluk",
  architecturePath: join(tsRoot, "..", "ARCHITECTURE.md"),     // tooling/ARCHITECTURE.md
});

const out = join(repoRoot, "docs");
const files = generateSite(fw);
for (const f of files) {
  const p = join(out, f.path);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, f.content);
}
console.log(`Generated ${files.length} files for ${fw.packages.length} packages → ${out}`);
