import { test, expect, describe } from "bun:test";
import { generateTests } from "../src/index";
import type { OpenAPIv4Document } from "@suluk/core";

const doc = {
  openapi: "4.0.0-candidate",
  info: { title: "Store API" },
  paths: {
    product: {
      requests: {
        listProduct: { method: "get", responses: { ok: { status: 200, contentSchema: { type: "array", items: { type: "object", properties: { id: { type: "integer" } }, required: ["id"], additionalProperties: false } } } }, "x-suluk-access": { requires: "anyone" }, "x-suluk-cost": { estimateMicroUsd: 10 }, "x-suluk-source": { file: "src/schema.ts", symbol: "product", kind: "drizzle-table" } },
        createProduct: { method: "post", contentSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] }, responses: { created: { status: 201 } }, "x-suluk-access": { requires: "admin" }, "x-suluk-cost": { estimateMicroUsd: 145 }, "x-suluk-source": { file: "src/schema.ts", symbol: "product", kind: "drizzle-table" } },
      },
    },
    "cart/{id}": { requests: { getCart: { method: "get", responses: { ok: { status: 200 } }, "x-suluk-access": { requires: "authenticated", scope: "owner" }, "x-suluk-source": { file: "src/ops.ts", symbol: "getCart", kind: "operation" } } } },
  },
} as unknown as OpenAPIv4Document;

describe("@suluk/testgen — generate a conformance suite from a v4 contract", () => {
  const suite = generateTests(doc, { baseURL: "https://api.example.com" });

  test("emits a self-contained, fetch-based suite (bun:test default) with the generic validator", () => {
    expect(suite).toContain('import { test, expect, describe } from "bun:test"');
    expect(suite).toContain('import { Validator } from "@cfworker/json-schema"');
    expect(suite).toContain("async function call(method: string, path: string");
    expect(suite).toContain('process.env.SULUK_BASE_URL');
    expect(suite).toContain('"https://api.example.com"');
  });

  test("ACCESS ENFORCEMENT on the wire — non-public ops must DENY anon a success; public ops must be reachable", () => {
    // a public op: anon must NOT be auth-blocked
    expect(suite).toContain('access — public: anon is NOT auth-blocked');
    expect(suite).toMatch(/expect\(\[401, 403\],[^)]*\)\.not\.toContain\(r\.status\)/);
    // an admin op: anon must get NO 2xx (the server enforces; the facet is only the expectation)
    expect(suite).toContain('access — ENFORCED: anon gets NO success');
    expect(suite).toMatch(/expect\(\[200, 201, 204\],[^)]*\)\.not\.toContain\(r\.status\)/);
    // it tests the WIRE, never a projection
    expect(suite).toContain("verified on the wire");
    expect(suite).not.toContain("?as=");
  });

  test("parameterized paths are filled; the positive side is token-gated (synthetic principal, optional)", () => {
    expect(suite).toContain('"/cart/1"');                       // {id} → a placeholder
    expect(suite).toContain("SULUK_USER_TOKEN");                // owner/authenticated positive side
    expect(suite).toContain("if (!tok) return;");               // skipped without a synthetic principal
  });

  test("L1 status smoke + schema conformance for a public, parameter-free GET", () => {
    expect(suite).toContain('status — returns a declared status');
    expect(suite).toContain("[200]");                            // listProduct's declared status
    expect(suite).toContain('conformance — a 2xx body validates against the declared response schema');
    expect(suite).toContain('validate({"type":"array"');        // the response schema, embedded as data
  });

  test("cost is checked as DECLARED + well-formed, never a literal µ$ amount", () => {
    expect(suite).toContain("declares a well-formed x-suluk-cost");
    expect(suite).toContain("145 >= 0");
    expect(suite).not.toMatch(/toBe\(145\)/);                    // never asserts the literal amount
  });

  test("each op group is LABELLED with its provenance (x-suluk-source) — a failure points at the source", () => {
    expect(suite).toContain("createProduct  [POST product]  · admin  ←  src/schema.ts#product");
    expect(suite).toContain("getCart  [GET cart/{id}]  · authenticated  ←  src/ops.ts#getCart");
  });

  test("framework toggle emits vitest imports", () => {
    expect(generateTests(doc, { framework: "vitest" })).toContain('from "vitest"');
  });
});
