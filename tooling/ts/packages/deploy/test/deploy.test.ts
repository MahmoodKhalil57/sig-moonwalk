import { test, expect, describe } from "bun:test";
import * as z from "zod";
import { zodToV4 } from "@suluk/zod";
import { cloudflare, providers, schemaToSql, type DeployInput } from "../src/index";

const input: DeployInput = {
  name: "My Petshop!",
  appModule: "./src/app",
  assetsDir: "./dist/client",
  entities: [
    { name: "Pet", schema: zodToV4(z.object({ id: z.number().int().optional(), name: z.string(), status: z.enum(["available", "sold"]), price: z.number() })).schema },
    { name: "Category", schema: zodToV4(z.object({ id: z.number().int().optional(), name: z.string() })).schema },
  ],
};

describe("cloudflare provider — generate the deploy plan", () => {
  const plan = cloudflare.generate(input);

  test("emits wrangler.jsonc, worker.ts, schema.sql", () => {
    expect(plan.files.map((f) => f.path).sort()).toEqual(["schema.sql", "worker.ts", "wrangler.jsonc"]);
  });

  test("wrangler.jsonc is valid JSON with a slug name, D1 binding, assets, observability", () => {
    const cfg = JSON.parse(plan.files.find((f) => f.path === "wrangler.jsonc")!.content);
    expect(cfg.name).toBe("my-petshop"); // slugified (the '!' and space gone)
    expect(cfg.main).toBe("worker.ts");
    expect(cfg.compatibility_flags).toContain("nodejs_compat");
    expect(cfg.d1_databases[0].binding).toBe("DB");
    expect(cfg.d1_databases[0].database_name).toBe("my-petshop-db");
    expect(cfg.assets.directory).toBe("./dist/client");
    expect(cfg.assets.not_found_handling).toBe("single-page-application");
    expect(cfg.observability.enabled).toBe(true);
  });

  test("worker.ts exports the Hono app as the Worker default", () => {
    const worker = plan.files.find((f) => f.path === "worker.ts")!.content;
    expect(worker).toContain('import { app } from "./src/app"');
    expect(worker).toContain("export default app");
  });

  test("schema.sql has a CREATE TABLE per entity with a sane SQLite column mapping", () => {
    const sql = plan.files.find((f) => f.path === "schema.sql")!.content;
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS pet");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS category");
    expect(sql).toContain("id INTEGER PRIMARY KEY AUTOINCREMENT");
    expect(sql).toContain("name TEXT NOT NULL"); // required string → TEXT NOT NULL
    expect(sql).toContain("price REAL");          // number → REAL
    expect(sql).toContain("status TEXT");         // enum → TEXT
  });

  test("the steps are ordered: login → d1 create → apply schema → deploy", () => {
    expect(plan.steps.map((s) => s.cmd)).toEqual([
      "wrangler login",
      "wrangler d1 create my-petshop-db",
      "wrangler d1 execute my-petshop-db --file=./schema.sql --remote",
      "wrangler deploy",
    ]);
  });

  test("notes flag auth-in-terminal, the database_id fill-in, and the swappable design", () => {
    const notes = plan.notes.join(" ");
    expect(notes).toContain("wrangler login");
    expect(notes).toContain("database_id");
    expect(notes.toLowerCase()).toContain("swappable");
  });
});

describe("schemaToSql + the provider registry", () => {
  test("schemaToSql is exported standalone", () => {
    expect(schemaToSql(input.entities)).toContain("CREATE TABLE IF NOT EXISTS pet");
  });
  test("cloudflare is registered as a provider (the swappable point)", () => {
    expect(providers.cloudflare).toBe(cloudflare);
    expect(providers.cloudflare.name).toBe("cloudflare");
  });
});

describe("cloudflare provider — PREVIEW variant (the two locks + a safe seed)", () => {
  const plan = cloudflare.generate({ ...input, preview: true, previewRoles: ["admin", "super-admin", "x'); DROP TABLE user;--"] });
  const wrangler = plan.files.find((f) => f.path === "wrangler.jsonc")!.content;
  const seed = plan.files.find((f) => f.path === "seed.sql")!.content;
  test("names a -preview Worker with BOTH locks (SULUK_PREVIEW var + PREVIEW_DB binding)", () => {
    const cfg = JSON.parse(wrangler);
    expect(cfg.name).toContain("-preview");
    expect(cfg.vars.SULUK_PREVIEW).toBe("1");
    expect(cfg.d1_databases.some((d: { binding: string }) => d.binding === "PREVIEW_DB")).toBe(true);
    expect(cfg.d1_databases.some((d: { binding: string }) => d.binding === "DB")).toBe(true);
  });
  test("seedSql sanitizes role names — a hostile role is SKIPPED, never interpolated into SQL", () => {
    expect(seed).toContain("preview-admin");
    expect(seed).toContain("preview-super-admin"); // hyphen is safe
    expect(seed).not.toContain("DROP TABLE");      // the injection payload is rejected
    expect(seed).toContain("SKIPPED 1 role");      // seedSql's own defense-in-depth filter surfaces it
  });
  test("a teardown step is included (a standing preview is a live credentialed surface)", () => {
    expect(plan.steps.some((s) => s.cmd.includes("wrangler delete"))).toBe(true);
  });
  test("the PROD plan sets none of it", () => {
    const prod = cloudflare.generate(input).files.find((f) => f.path === "wrangler.jsonc")!.content;
    expect(prod).not.toContain("SULUK_PREVIEW");
    expect(prod).not.toContain("PREVIEW_DB");
  });
});
