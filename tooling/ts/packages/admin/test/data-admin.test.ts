import { test, expect, describe } from "bun:test";
import type { OpenAPIv4Document } from "@suluk/core";
import { entityModels, renderEntityForm, renderEntityTable, renderDataIndex, renderEntityAdmin } from "../src/index";

const doc = {
  openapi: "4.0.0-candidate",
  info: { title: "Store", version: "1.0.0" },
  paths: {
    product: {
      requests: {
        listProduct: { method: "get", responses: {}, "x-suluk-access": { requires: "anyone" } },
        createProduct: { method: "post", responses: {}, "x-suluk-access": { requires: "admin" } },
        deleteProduct: { method: "delete", responses: {}, "x-suluk-access": { requires: "admin" } },
      },
    },
  },
  components: {
    schemas: {
      Product: {
        type: "object",
        required: ["name", "priceCents"],
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          priceCents: { type: "integer" },
          status: { type: "string", enum: ["draft", "published"] },
          inStock: { type: "boolean" },
          launchAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
} as unknown as OpenAPIv4Document;

describe("data-admin mode — entity models projected from the contract", () => {
  test("entityModels derives fields (type/required/enum/format) + per-CRUD access scope", () => {
    const [product] = entityModels(doc);
    expect(product.name).toBe("Product");
    expect(product.fields.find((f) => f.name === "name")).toEqual({ name: "name", type: "string", required: true });
    expect(product.fields.find((f) => f.name === "status")?.enum).toEqual(["draft", "published"]);
    expect(product.fields.find((f) => f.name === "launchAt")?.format).toBe("date-time");
    // access read off x-suluk-access: list public, create/delete admin
    expect(product.access).toMatchObject({ list: "anyone", create: "admin", delete: "admin" });
  });

  test("renderEntityForm maps types to inputs and omits id on create", () => {
    const [product] = entityModels(doc);
    const html = renderEntityForm(product, "create", "/superadmin/data/Product");
    expect(html).toContain('type="number"');                         // priceCents
    expect(html).toContain('type="checkbox"');                       // inStock
    expect(html).toContain('type="datetime-local"');                 // launchAt
    expect(html).toContain('<select name="status"');                 // enum → select
    expect(html).toContain("<option>draft</option>");
    expect(html).not.toContain('name="id"');                         // id omitted on create
    expect(html).toContain('action="/superadmin/data/Product"');
  });

  test("renderEntityTable has a column per field + fills sample rows (escaped)", () => {
    const [product] = entityModels(doc);
    const html = renderEntityTable(product, [{ name: "<b>Widget</b>", priceCents: 999 }]);
    expect(html).toContain("<th>name</th>");
    expect(html).toContain("&lt;b&gt;Widget&lt;/b&gt;"); // escaped
    expect(html).toContain("<td>999</td>");
  });

  test("renderDataIndex links each entity + shows access; renderEntityAdmin renders one entity", () => {
    expect(renderDataIndex(doc, "/superadmin")).toContain('href="/superadmin/data/Product"');
    expect(renderEntityAdmin(doc, "Product", "/superadmin")).toContain("New Product");
    expect(renderEntityAdmin(doc, "Nope", "/superadmin")).toContain("No such entity");
  });

  test("renderEntityAdmin is a FUNCTIONAL CRUD page: live load + create/edit/delete against the entity's CRUD route", () => {
    const html = renderEntityAdmin(doc, "Product", "/superadmin");
    expect(html).toContain('"/product"');                       // resolves the entity's CRUD path
    expect(html).toContain('id="adm-rows"');                    // a live-loaded table body
    expect(html).toContain('id="adm-form"');                    // the create/edit form
    expect(html).toContain('method:id?"PATCH":"POST"');         // create POST, edit PATCH
    expect(html).toContain('method:"DELETE"');                  // per-row delete
    expect(html).toContain("fetch(PATH");                       // loads from the CRUD route
    expect(html).toContain('credentials:"same-origin"');        // carries the admin session
  });
});
