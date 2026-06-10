import { test, expect, describe } from "bun:test";
import { join } from "node:path";
import { harvest, generateSite, mdToHtml, parseExports, firstBlockComment } from "../src/index";

const packagesDir = join(import.meta.dir, "..", ".."); // tooling/ts/packages

const fw = harvest({
  packagesDir,
  title: "Suluk",
  tagline: "One typed contract, projected into your whole stack.",
  description: "Suluk derives the **whole stack** from one source.",
  repoUrl: "https://github.com/MahmoodKhalil57/suluk",
});

describe("mdToHtml", () => {
  test("renders headings, code, lists, tables, inline", () => {
    const html = mdToHtml("# Title\n\nsome **bold** and `code` and [a](b)\n\n- one\n- two\n\n\`\`\`ts\nconst x = 1;\n\`\`\`\n\n| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain('<a href="b">a</a>');
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<pre><code");
    expect(html).toContain("<table>");
  });
  test("escapes HTML in text + code", () => {
    expect(mdToHtml("a <script>x</script>")).toContain("&lt;script&gt;");
  });
});

describe("harvest — straight from the real monorepo source", () => {
  test("finds the Suluk packages with names + descriptions + overviews", () => {
    expect(fw.packages.length).toBeGreaterThanOrEqual(15);
    const core = fw.packages.find((p) => p.name === "@suluk/core")!;
    expect(core).toBeDefined();
    expect(core.description.length).toBeGreaterThan(10);
    expect(core.overview).toContain("foundation"); // from core/src/index.ts's leading doc-comment
    expect(core.exports).toContain("parseDocument");
  });
  test("parseExports collects barrel re-exports (names + types)", () => {
    const ex = parseExports(`export { a, b as c } from "./x";\nexport type { T } from "./y";\nexport function fn(){}`);
    expect(ex).toEqual(["a", "c", "fn", "T"]);
  });
  test("firstBlockComment strips the JSDoc markers", () => {
    expect(firstBlockComment("/**\n * hello\n * world\n */\ncode")).toBe("hello\nworld");
  });
});

describe("generateSite — a complete static site", () => {
  const files = generateSite(fw);
  const byPath = new Map(files.map((f) => [f.path, f.content]));

  test("emits index, a page per package, architecture, the curated pages, css, .nojekyll", () => {
    expect(byPath.has("index.html")).toBe(true);
    expect(byPath.has("style.css")).toBe(true);
    expect(byPath.has(".nojekyll")).toBe(true);
    expect(byPath.has("getting-started.html")).toBe(true);
    expect(byPath.has("contributing.html")).toBe(true);
    expect(byPath.has("community.html")).toBe(true);
    for (const p of fw.packages) expect(byPath.has(`${p.slug}.html`)).toBe(true);
  });
  test("the landing lists every package and the cycle", () => {
    const index = byPath.get("index.html")!;
    expect(index).toContain("@suluk/core");
    expect(index).toContain("@suluk/builder");
    expect(index).toContain("The cycle");
    expect(index).toContain('href="suluk-core.html"');
  });
  test("a package page has install + overview + public API", () => {
    const core = byPath.get("suluk-core.html")!;
    expect(core).toContain("bun add @suluk/core");
    expect(core).toContain("Public API");
    expect(core).toContain("parseDocument");
  });
  test("the community page explains building libraries via the shadcn registry", () => {
    expect(byPath.get("community.html")!).toContain("registry");
    expect(byPath.get("community.html")!).toContain("discussions");
  });
  test("links are relative (GitHub-Pages-subpath safe)", () => {
    expect(byPath.get("index.html")!).not.toContain('href="/');
  });
});
