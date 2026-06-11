import { test, expect, describe } from "bun:test";
import { referenceHtml, referenceResponse, crossCut, reachable, costRollup, DEFAULT_VIEWERS, schemaHtml, sampleOf, escapeHtml } from "../src/index";
import type { OpenAPIv4Document } from "@suluk/core";

const doc = {
  openapi: "4.0.0-candidate",
  info: { title: "Test Store API", description: "A v4 store with **cost** and `access`." },
  servers: [{ url: "https://api.example.com" }],
  tags: { Product: {}, Operations: {} },
  paths: {
    product: {
      requests: {
        listProduct: { method: "get", summary: "List products", tags: ["Product"], responses: { ok: { status: 200, description: "ok", contentSchema: { $ref: "#/components/schemas/Product" } } }, "x-suluk-access": { requires: "anyone" }, "x-suluk-cost": { estimateMicroUsd: 10, components: [{ source: "db-read", basis: "per-call", microUsd: 10 }] } },
        createProduct: { method: "post", summary: "Create a product", tags: ["Product"], contentType: "application/json", contentSchema: { $ref: "#/components/schemas/Product" }, responses: { created: { status: 201, description: "created" }, forbidden: { status: 403, description: "not admin" } }, security: [{ bearer: [] }], "x-suluk-access": { requires: "admin" }, "x-suluk-cost": { estimateMicroUsd: 145, components: [{ source: "compute", basis: "per-call", microUsd: 100 }, { source: "db-write", basis: "per-call", microUsd: 45 }] } },
      },
    },
    order: {
      requests: {
        createOrder: { method: "post", summary: "Place an order", tags: ["Operations"], responses: { created: { status: 201 } }, "x-suluk-access": { requires: "authenticated", scope: "owner" } },
      },
    },
    search: {
      requests: {
        // two requests sharing GET on one path → collision/multi
        searchProducts: { method: "get", summary: "Search products", tags: ["Operations"], responses: { ok: { status: 200 } }, "x-suluk-access": { requires: "anyone" } },
        searchPosts: { method: "get", summary: "Search posts", tags: ["Operations"], responses: { ok: { status: 200 } }, "x-suluk-access": { requires: "anyone" } },
        uncosted: { method: "delete", summary: "no cost declared", tags: ["Operations"], responses: { ok: { status: 204 } } },
      },
    },
  },
  components: {
    schemas: { Product: { type: "object", required: ["name"], properties: { name: { type: "string" }, priceCents: { type: "integer", default: 0 }, status: { type: "string", enum: ["draft", "published"] } } } },
    securitySchemes: { sessionCookie: { type: "apiKey", in: "cookie", name: "s" }, bearer: { type: "http", scheme: "bearer", description: "an `sk_` token" } },
  },
} as unknown as OpenAPIv4Document;

describe("@suluk/reference — complete v4-native renderer", () => {
  const html = referenceHtml(doc, { costLedgerUrl: "/cost" });

  test("v4 identity, not 3.1", () => {
    expect(html).toContain("OpenAPI 4.0.0-candidate");
    expect(html).not.toContain("3.1.0");
  });

  test("requests-shape: every NAMED request renders (none dropped)", () => {
    for (const n of ["listProduct", "createProduct", "createOrder", "searchProducts", "searchPosts", "uncosted"]) expect(html).toContain(`op-${n}`);
    expect(html).toContain("named requests share"); // the multi-on-a-method note
  });

  test("signature collision diagnostic fires for two requests sharing a method", () => {
    expect(html).toMatch(/signature (provable collision|not statically determinable)/);
  });

  test("cost facet: badge + breakdown + coverage badge + header rollup", () => {
    expect(html).toContain("145µ$");
    expect(html).toContain("compute 100µ$");                 // breakdown
    expect(html).toContain("no cost model");                 // the uncosted delete op
    expect(html).toContain("priced");                        // the rollup badge
    expect(html).toContain('data-drift');                    // drift placeholder for the live ledger
    expect(html).toContain('window.__SULUK_COST_URL="/cost"');
  });

  test("ACCESS projection: per-op chips + the View-as lens + the reachability matrix", () => {
    expect(html).toContain("View as");
    expect(html).toContain('data-view="anon"');
    expect(html).toContain('data-view="admin"');
    expect(html).toContain("Reachability");
    // createProduct (admin) is NOT reachable by anon — its card carries only viewers that can reach it
    const card = html.slice(html.indexOf('id="op-createProduct"'), html.indexOf('id="op-createProduct"') + 400);
    expect(card).toContain('data-reach="admin"');            // admin-only
    const listCard = html.slice(html.indexOf('id="op-listProduct"'), html.indexOf('id="op-listProduct"') + 400);
    expect(listCard).toContain('data-reach="anon user admin"'); // public
  });

  test("crossCut + reachable compute the projection correctly", () => {
    const cc = crossCut(doc);
    const create = cc.rows.find((r) => r.name === "createProduct")!;
    expect(create.reach).toEqual({ anon: false, user: false, admin: true });
    const list = cc.rows.find((r) => r.name === "listProduct")!;
    expect(list.reach).toEqual({ anon: true, user: true, admin: true });
    const order = cc.rows.find((r) => r.name === "createOrder")!;
    expect(order.reach).toEqual({ anon: false, user: true, admin: true }); // authenticated
    expect(reachable({ requires: "admin" }, DEFAULT_VIEWERS[0])).toBe(false);
    expect(reachable(undefined, DEFAULT_VIEWERS[0])).toBe(true); // absent facet = public
  });

  test("costRollup tallies priced vs undeclared", () => {
    const r = costRollup(doc);
    expect(r.priced).toBe(2);      // listProduct (10) + createProduct (145)
    expect(r.undeclared).toBe(4);  // createOrder, searchProducts, searchPosts, uncosted
    expect(r.priced + r.undeclared).toBe(6);
    expect(r.totalMicroUsd).toBe(155);
  });

  test("schema rendering: models section, $ref links, examples, enums, required", () => {
    expect(html).toContain('id="model-Product"');
    expect(html).toContain("priceCents");
    expect(html).toContain("published");                     // enum value
    expect(html).toContain("example");                       // generated example block
    expect(schemaHtml(doc, { $ref: "#/components/schemas/Product" })).toContain("Product");
    expect(sampleOf(doc, { type: "object", properties: { a: { type: "integer" } } })).toEqual({ a: 0 });
  });

  test("auth section + per-op security + copy-as-curl", () => {
    expect(html).toContain("Authentication");
    expect(html).toContain("sessionCookie");
    expect(html).toContain("copy as curl");
    expect(html).toContain("https://api.example.com");       // server in the curl
  });

  test("chrome present: search, dark-mode, collapse, scroll-spy script", () => {
    expect(html).toContain('id="filter"');
    expect(html).toContain('data-act="theme"');
    expect(html).toContain('data-act="collapse"');
    expect(html).toContain("IntersectionObserver");          // scroll-spy
  });

  test("referenceResponse is text/html", async () => {
    expect((await (referenceResponse(doc)).text())).toContain("Test Store API");
    expect(escapeHtml('<a>"&')).toBe("&lt;a&gt;&quot;&amp;");
  });
});
