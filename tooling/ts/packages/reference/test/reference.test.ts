import { test, expect, describe } from "bun:test";
import { referenceHtml, referenceResponse, escapeHtml } from "../src/index";
import type { OpenAPIv4Document } from "@suluk/core";

const doc = {
  openapi: "4.0.0-candidate",
  info: { title: "Test Store API", description: "A v4 store." },
  tags: { Product: {}, Operations: {} },
  paths: {
    product: {
      requests: {
        listProduct: { method: "get", summary: "List products", tags: ["Product"], responses: { ok: { status: 200, description: "ok" } }, "x-suluk-cost": { estimateMicroUsd: 10, components: [{ source: "db-read", basis: "per-call", microUsd: 10 }] } },
        createProduct: { method: "post", summary: "Create a product", tags: ["Product"], contentType: "application/json", contentSchema: { type: "object", properties: { name: { type: "string" }, priceCents: { type: "integer" } }, required: ["name"] }, responses: { created: { status: 201, description: "created" } }, security: [{ bearer: [] }], "x-suluk-cost": { estimateMicroUsd: 145, components: [{ source: "compute", basis: "per-call", microUsd: 100 }, { source: "db-write", basis: "per-call", microUsd: 45 }] } },
      },
    },
    search: {
      requests: {
        // TWO requests sharing GET on one path — the v4 capability a 3.1 downgrade must drop one of.
        searchProducts: { method: "get", summary: "Search products", tags: ["Operations"], responses: { ok: { status: 200, description: "ok" } } },
        searchPosts: { method: "get", summary: "Search posts", tags: ["Operations"], responses: { ok: { status: 200, description: "ok" } } },
      },
    },
  },
  components: { securitySchemes: { sessionCookie: { type: "apiKey", in: "cookie", name: "s" }, bearer: { type: "http", scheme: "bearer" } } },
} as unknown as OpenAPIv4Document;

describe("@suluk/reference — render a v4 document NATIVELY (not via the 3.1 downgrade)", () => {
  const html = referenceHtml(doc);

  test("announces its real v4 identity, not 3.1", () => {
    expect(html).toContain("OpenAPI 4.0.0-candidate");
    expect(html).not.toContain("3.1.0");
    expect(html).toContain("Test Store API");
  });

  test("renders the requests-shape: every NAMED request appears (none dropped)", () => {
    for (const name of ["listProduct", "createProduct", "searchProducts", "searchPosts"]) {
      expect(html, `missing operation ${name}`).toContain(name);
    }
  });

  test("shows MULTIPLE requests sharing one method — the v4 capability the 3.1 view cannot express", () => {
    // both GET-on-/search operations are present, AND the renderer flags the shared-method capability
    expect(html).toContain("searchProducts");
    expect(html).toContain("searchPosts");
    expect(html.toLowerCase()).toContain("requests share");
  });

  test("surfaces the cost facet (x-suluk-cost) as a first-class badge + breakdown", () => {
    expect(html).toContain("145µ$");                 // createProduct estimate
    expect(html).toContain("10µ$");                  // listProduct estimate
    expect(html).toContain("⛁");                     // the cost glyph
    expect(html).toContain("compute 100µ$");         // breakdown by source (in the title attr)
  });

  test("renders request bodies, params, responses, and per-operation security", () => {
    expect(html).toContain("priceCents");            // request body property
    expect(html).toContain("201");                   // response status
    expect(html).toContain("bearer");                // security scheme referenced by name
    expect(html).toContain("2 auth schemes");        // securitySchemes count badge
    expect(html).toContain("4 operations");
  });

  test("an operation with NO declared cost shows a coverage badge, never a false $0", () => {
    const d = { openapi: "4.0.0-candidate", info: { title: "X" }, paths: { p: { requests: { uncosted: { method: "get", responses: { ok: { status: 200 } } } } } } } as unknown as OpenAPIv4Document;
    const out = referenceHtml(d);
    expect(out).toContain("no cost model");
    expect(out).not.toContain("$0.00");
  });

  test("referenceResponse is a text/html Response", async () => {
    const res = referenceResponse(doc);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("Test Store API");
  });

  test("escapeHtml neutralizes injection", () => {
    expect(escapeHtml('<script>"&')).toBe("&lt;script&gt;&quot;&amp;");
  });
});
