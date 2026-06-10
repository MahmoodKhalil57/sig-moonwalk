import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "@suluk/core";
import { deployPlan, deployMarkdown } from "../src/deploy";

const petstore = parseDocument(
  readFileSync(join(import.meta.dir, "..", "..", "core", "test", "conformance", "valid", "01-petstore.yaml"), "utf8"),
);

describe("deployPlan — the cockpit's Cloudflare deploy surface", () => {
  const plan = deployPlan(petstore);

  test("produces the wrangler config, worker entry, and D1 schema from the doc's entities", () => {
    const paths = plan.files.map((f) => f.path).sort();
    expect(paths).toEqual(["schema.sql", "worker.ts", "wrangler.jsonc"]);
    expect(plan.files.find((f) => f.path === "schema.sql")!.content).toContain("CREATE TABLE IF NOT EXISTS pet");
  });

  test("the ordered steps start with auth and end with deploy", () => {
    expect(plan.steps[0].cmd).toBe("wrangler login");
    expect(plan.steps.at(-1)!.cmd).toBe("wrangler deploy");
  });

  test("deployMarkdown renders a followable DEPLOY.md", () => {
    const md = deployMarkdown(plan);
    expect(md).toContain("# Deploy to Cloudflare");
    expect(md).toContain("wrangler login");
    expect(md).toContain("wrangler.jsonc");
    expect(md).toContain("swappable");
  });
});
