import { test, expect, describe } from "bun:test";
import { generateSdk, tsType } from "../src/index";
import type { OpenAPIv4Document } from "@suluk/core";

const doc = {
  openapi: "4.0.0-candidate",
  info: { title: "Store API" },
  paths: {
    product: {
      requests: {
        listProduct: { method: "get", summary: "List products", responses: { ok: { status: 200, contentSchema: { type: "array", items: { type: "object", properties: { id: { type: "integer" }, name: { type: "string" } } } } } }, "x-suluk-access": { requires: "anyone" }, "x-suluk-cost": { estimateMicroUsd: 10 } },
        createProduct: { method: "post", contentSchema: { type: "object", properties: { name: { type: "string", maxLength: 160, pattern: "^[^<>]+$" }, priceCents: { type: "integer", minimum: 0, maximum: 1000000000 }, status: { type: "string", enum: ["draft", "published"] } }, required: ["name"], additionalProperties: false }, responses: { created: { status: 201 } }, "x-suluk-access": { requires: "admin" }, "x-suluk-cost": { estimateMicroUsd: 145 } },
        getProduct: { method: "get", responses: { ok: { status: 200 } }, "x-suluk-access": { requires: "anyone" } },
      },
    },
    "checkout/order": { requests: { checkout: { method: "post", contentSchema: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { productId: { type: "integer" }, qty: { type: "integer" } } } } } }, responses: { created: { status: 201 } }, "x-suluk-access": { requires: "anyone" } } } },
  },
} as unknown as OpenAPIv4Document;

describe("@suluk/sdk — generate a typed ofetch SDK from a v4 contract", () => {
  const sdk = generateSdk(doc, { baseURL: "https://api.example.com" });

  test("emits a self-contained ofetch + generic-validator client", () => {
    expect(sdk).toContain('import { ofetch, type FetchError } from "ofetch"');
    expect(sdk).toContain('import { Validator } from "@cfworker/json-schema"'); // generic, eval-free engine
    expect(sdk).toContain("export function createClient");
    expect(sdk).toContain("onRequest");                          // auth interceptor
    expect(sdk).toContain('h.set("Authorization", `Bearer ${t}`)'); // injects the bearer via Headers.set
    expect(sdk).toContain('"https://api.example.com"');
    expect(sdk).toContain("Requires: `npm i ofetch @cfworker/json-schema`");
  });

  test("named-request identity → entity-grouped methods (CRUD by entity, custom by path)", () => {
    expect(sdk).toContain("product: {");
    expect(sdk).toContain("list: Object.assign");
    expect(sdk).toContain("create: Object.assign");
    expect(sdk).toContain("get: Object.assign");
    expect(sdk).toContain("checkout: {");
    expect(sdk).toContain("order: Object.assign");
  });

  test("v4 superpowers as INERT typed metadata (.cost / .requires) + a $manifest", () => {
    expect(sdk).toContain('requires: "admin"');               // createProduct
    expect(sdk).toContain("cost: 145");
    expect(sdk).toContain('requires: "anyone"');
    expect(sdk).toContain("$manifest:");
    expect(sdk).toContain('"product.create":{"cost":145,"requires":"admin"}');
  });

  test("input JSON Schemas shipped AS DATA — the contract's real constraints, validated directly (not transpiled)", () => {
    // the schemas are emitted as a data map, NOT transpiled into a validator's source
    expect(sdk).toContain("export const schemas = {");
    expect(sdk).toContain("product_create:");
    // the contract's REAL constraints survive verbatim as JSON Schema (lossless — what's stored is what's checked)
    expect(sdk).toContain('"maxLength":160');
    expect(sdk).toContain('"pattern":"^[^<>]+$"');
    expect(sdk).toContain('"minimum":0');
    expect(sdk).toContain('"maximum":1000000000');
    expect(sdk).toContain('"enum":["draft","published"]');
    expect(sdk).toContain('"additionalProperties":false');
    // each input is wrapped as a STANDARD SCHEMA, backed by the generic engine
    expect(sdk).toContain("const product_createInput = std<");
    expect(sdk).toContain("(schemas.product_create)");
    expect(sdk).toContain('"~standard"');
    expect(sdk).toContain('vendor: "suluk"');
    expect(sdk).toContain('new Validator(schema as object, "2020-12")');
    // the body is statically typed from the SAME schema, and validated through it before send
    expect(sdk).toMatch(/body: \{ name: string/);
    expect(sdk).toContain("body: _v ? parse(product_createInput, body) : body");
    // validation is configurable + on by default
    expect(sdk).toContain("validate?: boolean");
    expect(sdk).toContain("const _v = config.validate !== false");
    // the Standard Schema is surfaced as typed metadata (.input) + the raw schemas are introspectable
    expect(sdk).toContain("input: product_createInput");
    expect(sdk).toContain("$schemas: schemas");
  });

  test("one source — components.schemas emit a Standard Schema + an inferred TS type from the one JSON Schema", () => {
    const withModels = generateSdk({
      openapi: "4.0.0-candidate", info: { title: "M" },
      paths: { thing: { requests: { getThing: { method: "get", responses: { ok: { status: 200 } } } } } },
      components: { schemas: { Money: { type: "object", properties: { cents: { type: "integer", minimum: 0 } }, required: ["cents"], additionalProperties: false } } },
    } as unknown as OpenAPIv4Document);
    expect(withModels).toContain("export type Money = { cents: number };");
    expect(withModels).toContain("export const MoneySchema = std<Money>(");
    expect(withModels).toContain('"minimum":0'); // the real constraint travels with the data
  });

  test("collisions are resolved by DETERMINISTIC namespacing (never a runtime guess), and surfaced", () => {
    const bad = { openapi: "4.0.0-candidate", info: { title: "X" }, paths: {
      a: { requests: { createThing: { method: "post", responses: { ok: { status: 200 } } } } },
      b: { requests: { createThing: { method: "post", responses: { ok: { status: 200 } } } } }, // both → thing.create
    } } as unknown as OpenAPIv4Document;
    const out = generateSdk(bad); // does NOT throw
    expect(out).toContain("createPost: Object.assign");
    expect(out).toContain("createPost2: Object.assign"); // distinct, stable names
    expect(out).toContain("Namespaced 1 method collision");
  });

  test("tsType maps schemas to TS", () => {
    expect(tsType(doc, { type: "string" })).toBe("string");
    expect(tsType(doc, { type: "array", items: { type: "integer" } })).toBe("number[]");
    expect(tsType(doc, { type: "object", properties: { a: { type: "string" } }, required: ["a"] })).toBe("{ a: string }");
  });
});
