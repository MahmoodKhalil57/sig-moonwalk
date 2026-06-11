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
        createProduct: { method: "post", contentSchema: { type: "object", properties: { name: { type: "string" }, priceCents: { type: "integer" }, status: { type: "string", enum: ["draft", "published"] } }, required: ["name"] }, responses: { created: { status: 201 } }, "x-suluk-access": { requires: "admin" }, "x-suluk-cost": { estimateMicroUsd: 145 } },
        getProduct: { method: "get", responses: { ok: { status: 200 } }, "x-suluk-access": { requires: "anyone" } },
      },
    },
    "checkout/order": { requests: { checkout: { method: "post", contentSchema: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { productId: { type: "integer" }, qty: { type: "integer" } } } } } }, responses: { created: { status: 201 } }, "x-suluk-access": { requires: "anyone" } } } },
  },
} as unknown as OpenAPIv4Document;

describe("@suluk/sdk — generate a typed ofetch SDK from a v4 contract", () => {
  const sdk = generateSdk(doc, { baseURL: "https://api.example.com" });

  test("emits a self-contained ofetch client", () => {
    expect(sdk).toContain('import { ofetch, type FetchError } from "ofetch"');
    expect(sdk).toContain("export function createClient");
    expect(sdk).toContain("onRequest");                       // auth interceptor
    expect(sdk).toContain("Authorization: `Bearer ${t}`");
    expect(sdk).toContain('"https://api.example.com"');
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

  test("typed input/output from the schemas", () => {
    expect(sdk).toContain("name: string");                    // createProduct body
    expect(sdk).toContain('"draft" | "published"');           // enum union
    expect(sdk).toMatch(/body: \{[^}]*name: string/);          // create takes a typed body
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
