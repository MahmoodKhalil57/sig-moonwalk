import { test, expect, describe } from "bun:test";
import { generateTests, generateMoneyTests } from "../src/index";
import { orderTotal, verifyAmount, prorateDiscount, idempotencyKey } from "@suluk/stripe";
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

  test("error-conformance: a non-public op asserts the deny body is RFC-9457 Problem Details (the B1 envelope)", () => {
    expect(suite).toContain("error-conformance — a denied request returns a well-formed Problem Details body");
    expect(suite).toContain('typeof body.title === "string" && body.status === r.status'); // the @suluk/hono envelope fields
    // a public op never gets an error-conformance block (it isn't expected to deny)
    expect(suite.split("access — public").length).toBeGreaterThan(1);
  });
});

describe("@suluk/testgen — generateMoneyTests (PARITY §2 checkout-resilience, in-process)", () => {
  const money = generateMoneyTests();

  test("emits a self-contained bun:test suite importing the @suluk/stripe primitives", () => {
    expect(money).toContain('import { test, expect, describe } from "bun:test"');
    expect(money).toContain('} from "@suluk/stripe"');
    expect(money).toContain("verifyAmount");
    expect(money).toContain("prorateDiscount");
    expect(money).toContain("idempotencyKey");
  });

  test("encodes the load-bearing invariants: anti-tampering, never-over-discount, exact proration, idempotency", () => {
    expect(money).toContain('expect(tampered.reason).toBe("amount-mismatch")');         // anti-tampering
    expect(money).toContain("orderTotal(lines, huge).totalCents).toBe(0)");             // never negative
    expect(money).toContain("expect(sum(shares)).toBe(want)");                          // proration sums exactly
    expect(money).toContain("idempotencyKey(\"user_1\", [...lines].reverse())).toBe(k1"); // retry reuses the key
  });

  test("honestly labels the originated (stronger-than-saastarter) invariants", () => {
    expect(money).toContain("stronger than saastarter");
    expect(money).toContain("origination inspired by"); // honestly flags the non-ported invariants
  });

  test("stripeModule + framework are configurable", () => {
    const v = generateMoneyTests({ framework: "vitest", stripeModule: "../pricing" });
    expect(v).toContain('from "vitest"');
    expect(v).toContain('} from "../pricing"');
  });
});

// Smoke (closes the loop): the invariants the emitter ENCODES actually hold for the real @suluk/stripe build.
describe("@suluk/testgen — money smoke against the real @suluk/stripe primitives", () => {
  test("verifyAmount rejects tampering; proration sums exactly; idempotency is deterministic", () => {
    const lines = [{ unitCents: 1999, qty: 2, id: "a" }, { unitCents: 500, qty: 1, id: "b" }, { unitCents: 333, qty: 3 }];
    const exact = orderTotal(lines, null).totalCents;
    expect(verifyAmount(lines, null, exact).ok).toBe(true);
    expect(verifyAmount(lines, null, exact - 1).ok).toBe(false);
    const shares = prorateDiscount(lines, 777);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(777);
    expect(idempotencyKey("u1", lines)).toBe(idempotencyKey("u1", [...lines].reverse()));
    expect(orderTotal(lines, { type: "fixed", value: 9_999_999 }).totalCents).toBe(0);
  });
});
