import { test, expect, describe } from "bun:test";
import { migrationSql, secretPushPlan, durableBindings, schemaToSql } from "../src/index";
import type { DeployEntity } from "../src/index";
import type { OpenAPIv4Document } from "@suluk/core";

const productV1: DeployEntity = {
  name: "Product",
  schema: { type: "object", required: ["name"], properties: { id: { type: "integer" }, name: { type: "string" }, priceCents: { type: "integer" } } },
};
const productV2: DeployEntity = {
  name: "Product",
  schema: { type: "object", required: ["name", "sku"], properties: { id: { type: "integer" }, name: { type: "string" }, sku: { type: "string" } } }, // +sku (required), -priceCents
};
const order: DeployEntity = { name: "Order", schema: { type: "object", properties: { id: { type: "integer" }, total: { type: "integer" } } } };

describe("contract-delta → additive migration SQL", () => {
  test("a brand-new entity → CREATE TABLE", () => {
    const sql = migrationSql([productV1], [productV1, order]);
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS order");
    expect(sql).not.toContain("CREATE TABLE IF NOT EXISTS product"); // unchanged → no DDL
  });

  test("a new column → ALTER ADD COLUMN (nullable); a required new column is noted", () => {
    const sql = migrationSql([productV1], [productV2]);
    expect(sql).toContain("ALTER TABLE product ADD COLUMN sku TEXT;");
    expect(sql).toContain("was required in the contract; added NULLABLE"); // can't ADD NOT NULL to a populated table
  });

  test("a removed column / table is flagged, never DROPped (additive-only)", () => {
    const sql = migrationSql([productV1, order], [productV2]); // priceCents removed; Order removed
    expect(sql).toContain("product.priceCents was removed");
    expect(sql).toContain("table order was removed");
    expect(sql).not.toContain("DROP");
  });

  test("identical contracts → no additive changes", () => {
    expect(migrationSql([productV1], [productV1])).toContain("no additive changes");
  });

  test("a fresh deploy (no prev) is just the full schema as CREATEs", () => {
    expect(migrationSql([], [productV1])).toContain("CREATE TABLE IF NOT EXISTS product");
    expect(schemaToSql([productV1])).toContain("CREATE TABLE IF NOT EXISTS product"); // schemaToSql output unchanged
  });
});

describe("secret-push plan (never holds a value)", () => {
  test("interactive: one `secret put` per secret, value prompted (never on the command line)", () => {
    const plan = secretPushPlan(["RESEND_API_KEY", "STRIPE_SECRET_KEY"], { workerName: "shop" });
    expect(plan.steps.map((s) => s.cmd)).toEqual([
      "wrangler secret put RESEND_API_KEY --name shop",
      "wrangler secret put STRIPE_SECRET_KEY --name shop",
    ]);
    expect(plan.notes.join(" ")).toContain("prompts for the value");
  });

  test("bulk: a single step + a decrypt-from-env note; no secret value emitted", () => {
    const plan = secretPushPlan(["A", "B"], { workerName: "shop", bulk: true });
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].cmd).toContain("wrangler secret bulk");
    expect(plan.notes.join(" ")).toContain("DECRYPTED env");
  });

  test("no secrets → no steps", () => {
    expect(secretPushPlan([], { workerName: "x" }).steps).toHaveLength(0);
  });
});

describe("durable bindings derived from the contract's facets", () => {
  const docWith = (extra: Record<string, unknown>): OpenAPIv4Document => ({
    openapi: "4.0.0-candidate", info: { title: "t", version: "1" },
    paths: { thing: { requests: { doThing: { method: "post", responses: {}, ...extra } } } },
  } as unknown as OpenAPIv4Document);

  test("an x-suluk-ratelimit op → a RATE_LIMIT KV binding + a create step", () => {
    const plan = durableBindings(docWith({ "x-suluk-ratelimit": { windowMs: 60000, maxRequests: 10, key: "ip" } }), "shop");
    expect(plan.bindings.find((b) => b.binding === "RATE_LIMIT")).toMatchObject({ kind: "kv", resource: "shop-ratelimit" });
    expect(plan.steps[0].cmd).toBe("wrangler kv namespace create shop-ratelimit");
  });

  test("an x-suluk-cost op → a COST_SINK KV binding; a plain contract → none", () => {
    expect(durableBindings(docWith({ "x-suluk-cost": { estimateMicroUsd: 10 } })).bindings.some((b) => b.binding === "COST_SINK")).toBe(true);
    expect(durableBindings(docWith({})).bindings).toHaveLength(0);
  });
});
