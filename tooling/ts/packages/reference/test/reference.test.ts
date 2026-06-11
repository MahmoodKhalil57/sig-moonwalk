import { test, expect, describe } from "bun:test";
import { referenceHtml, referenceResponse, normalize, crossCut, reachable, reachState, costRollup, codeSamples, portalHtml, DEFAULT_VIEWERS, schemaHtml, sampleOf, constraintNotes, escapeHtml, type ReferencePlugin } from "../src/index";
import type { OpenAPIv4Document } from "@suluk/core";

const doc = {
  openapi: "4.0.0-candidate",
  info: { title: "Test Store API", description: "A v4 store." },
  servers: [{ url: "https://api.example.com" }, { url: "https://staging.example.com", description: "staging" }],
  tags: { Product: { description: "Catalog things." }, Operations: {} },
  apiResponses: { serverError: { status: 500, description: "server error" } }, // composed into every op (C012)
  paths: {
    product: {
      shared: { parameterSchema: { query: { type: "object", properties: { fields: { type: "string" } } } } }, // C012 shared param
      requests: {
        listProduct: { method: "get", summary: "List", tags: ["Product"], parameterSchema: { query: { type: "object", properties: { limit: { type: "integer" } } } }, responses: { ok: { status: 200 } }, "x-suluk-access": { requires: "anyone" }, "x-suluk-cost": { estimateMicroUsd: 10, components: [{ source: "db-read", microUsd: 10 }] } },
        createProduct: { method: "post", summary: "Create", tags: ["Product"], contentType: "application/json", contentSchema: { $ref: "#/components/schemas/Product" }, responses: { created: { status: 201 } }, security: [{ bearer: [] }], "x-suluk-access": { requires: "admin" }, "x-suluk-cost": { estimateMicroUsd: 145, components: [{ source: "compute", microUsd: 100 }, { source: "db-write", microUsd: 45 }] } },
      },
    },
    "a/{id}": { requests: { create: { method: "post", summary: "create on a", tags: ["Operations"], responses: { ok: { status: 200 } } } } },
    "b/{id}": { requests: { create: { method: "post", summary: "create on b", tags: ["Operations"], responses: { ok: { status: 200 } } } } }, // duplicate NAME on a different path
    order: { requests: { createOrder: { method: "post", summary: "Order", tags: ["Operations"], responses: { ok: { status: 201 } }, "x-suluk-access": { requires: "authenticated", scope: "owner" } } } },
    search: {
      requests: {
        searchProducts: { method: "get", tags: ["Operations"], responses: { ok: { status: 200 } } },
        searchPosts: { method: "get", tags: ["Operations"], responses: { ok: { status: 200 } } }, // shares GET → collision
        broken: { method: "put", tags: ["Operations"], contentSchema: { $ref: "#/components/schemas/DoesNotExist" }, responses: { ok: { status: 200 } } }, // DANGLING ref
      },
    },
  },
  components: {
    schemas: { Product: { type: "object", required: ["name"], properties: { name: { type: "string", minLength: 3, maxLength: 64 }, sku: { type: "string", pattern: "^sk_" }, status: { type: "string", enum: ["draft", "published"] } } } },
    securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "an `sk_` token" } },
  },
} as unknown as OpenAPIv4Document;

describe("@suluk/reference — IR + complete renderer", () => {
  test("normalize → RefDoc: path-scoped ids (duplicate names don't collide)", () => {
    const ir = normalize(doc);
    const creates = ir.operations.filter((o) => o.name === "create");
    expect(creates.length).toBe(2);
    expect(creates[0].id).not.toBe(creates[1].id); // path-scoped — H2 fixed
    expect(new Set(ir.operations.map((o) => o.id)).size).toBe(ir.operations.length); // all ids unique
  });

  test("C012 composition: apiResponses + shared params compose into the effective operation, marked inherited", () => {
    const ir = normalize(doc);
    const list = ir.operations.find((o) => o.name === "listProduct")!;
    expect(list.responses.some((r) => r.status === "500" && r.inherited)).toBe(true);         // apiResponses composed in
    const fields = list.request.params.find((p) => p.name === "fields")!;
    expect(fields.inherited).toBe(true);                                                       // shared query param
    expect(list.request.params.find((p) => p.name === "limit")!.inherited).toBe(false);        // own param
  });

  test("dangling $ref does NOT crash — degrades, and surfaces a diagnostic", () => {
    const ir = normalize(doc);
    const html = referenceHtml(doc); // would throw before the safe-deref fix
    expect(html).toContain("DoesNotExist");          // rendered as a chip, not a crash
    expect(html.length).toBeGreaterThan(1000);
  });

  test("schema constraints are rendered", () => {
    const html = referenceHtml(doc);
    expect(html).toContain("min len 3");
    expect(html).toContain("max len 64");
    expect(html).toContain("^sk_");                  // pattern
    expect(constraintNotes({ minimum: 0, maximum: 9, nullable: true })).toContain("≥ 0");
  });

  test("3-state reachability: owner-scope is ◐ (scoped) for a user, ● (full) for admin", () => {
    expect(reachState({ requires: "authenticated", scope: "owner" }, DEFAULT_VIEWERS[1])).toBe("scoped"); // user
    expect(reachState({ requires: "authenticated", scope: "owner" }, DEFAULT_VIEWERS[2])).toBe("full");   // admin
    expect(reachState({ requires: "admin" }, DEFAULT_VIEWERS[0])).toBe("none");
    const cc = crossCut(doc);
    expect(cc.rows.find((r) => r.name === "createOrder")!.reach).toEqual({ anon: "none", user: "scoped", admin: "full" });
    expect(reachable({ requires: "admin" }, DEFAULT_VIEWERS[0])).toBe(false);
  });

  test("v4 identity + cost + access projection + signature collisions all render", () => {
    const html = referenceHtml(doc, { costLedgerUrl: "/cost" });
    expect(html).toContain("OpenAPI 4.0.0-candidate");
    expect(html).not.toContain("3.1.0");
    expect(html).toContain("145µ$");                                  // cost
    expect(html).toContain("priced subtotal");                       // honest rollup label
    expect(html).toContain("View as");                               // lens
    expect(html).toContain("◐");                                     // scoped glyph in the matrix
    expect(html).toMatch(/signature (provable collision|not statically determinable)/);
    const create = html.slice(html.indexOf('id="b-id__create"'), html.indexOf('id="b-id__create"') + 200);
    expect(create).toContain("create");
  });

  test("multi-language code samples + try-it + server selector", () => {
    const html = referenceHtml(doc);
    const s = codeSamples("https://api.example.com", normalize(doc).operations.find((o) => o.name === "createProduct")!, { name: "x" });
    expect(s.map((x) => x.lang)).toEqual(["curl", "js", "python"]);
    expect(s.find((x) => x.lang === "python")!.code).toContain("requests.post");
    expect(html).toContain("JavaScript");                            // tab
    expect(html).toContain("ti-send");                               // try-it button
    expect(html).toContain('id="server-select"');                    // 2 servers → selector
    expect(html).toContain("staging");
  });

  test("tag descriptions, deep-link, models searchable, auth, diagnostics banner", () => {
    const html = referenceHtml(doc);
    expect(html).toContain("Catalog things.");                       // tag description
    expect(html).toContain("copy link");                             // deep-link affordance
    expect(html).toContain('data-name="product"');                   // model is filterable
    expect(html).toContain('id="scheme-bearer"');                    // auth anchor
    expect(html).toContain("diagnostic");                            // the dangling ref surfaced
  });

  test("Phase-4 panels: Cost Explorer + Workflow Calculator + ADA Playground + projection map + whoami", () => {
    const html = referenceHtml(doc, { whoamiUrl: "/api/whoami" });
    expect(html).toContain("Cost Explorer + Workflow Calculator");
    expect(html).toContain("cx-pick");                 // pickable rows for the workflow
    expect(html).toContain("calls/mo");                // monthly projection
    expect(html).toContain("ADA Resolution Playground");
    expect(html).toContain("__SULUK_SIG_INDEX");       // the signature index for client resolution
    expect(html).toContain("One contract → every layer"); // projection map
    expect(html).toContain('window.__SULUK_WHOAMI="/api/whoami"'); // L2 live-view detection
    expect(html).toContain("hidden by access policy");  // legible projection (council invariant 7)
  });

  test("plugin seam: onNormalize + opCardAfter slot", () => {
    const plugin: ReferencePlugin = {
      name: "test",
      onNormalize: (ir) => { ir.info.title = "Plugged"; return ir; },
      slots: { opCardAfter: (op) => `<!--after:${op.name}-->` },
    };
    const html = referenceHtml(doc, { plugins: [plugin] });
    expect(html).toContain("Plugged");
    expect(html).toContain("<!--after:listProduct-->");
  });

  test("Phase-3 portal: multi-document index", () => {
    const html = portalHtml([{ name: "store", title: "Store API", href: "/reference", version: "v4", description: "the shop" }], { pageTitle: "APIs" });
    expect(html).toContain("Store API");
    expect(html).toContain('href="/reference"');
    expect(html).toContain("1 APIs");
  });

  test("referenceResponse + escaping", async () => {
    expect((await referenceResponse(doc).text())).toContain("Test Store API");
    expect(escapeHtml(`<a>"'&`)).toBe("&lt;a&gt;&quot;&#39;&amp;");
    expect(sampleOf(doc, { type: "object", properties: { a: { type: "integer" } } })).toEqual({ a: 0 });
    expect(schemaHtml(doc, { $ref: "#/components/schemas/Product" })).toContain("Product");
  });

  test("costRollup", () => {
    const r = costRollup(doc);
    expect(r.priced).toBe(2); expect(r.totalMicroUsd).toBe(155);
  });
});
