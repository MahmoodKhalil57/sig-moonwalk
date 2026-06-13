import { test, expect, describe } from "bun:test";
import { fieldsOf, titleField, humanize, entityModels, renderInput, renderForm, renderList, renderShell, panelApp } from "../src/index";

const productSchema = {
  type: "object",
  required: ["name", "priceCents"],
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    slug: { type: "string" },
    description: { anyOf: [{ type: "string" }, { type: "null" }] },
    body: { anyOf: [{ type: "string" }, { type: "null" }] },
    priceCents: { type: "integer" },
    categoryId: { anyOf: [{ type: "integer" }, { type: "null" }] },
    status: { type: "string", enum: ["draft", "published"] },
    priority: { type: "integer", enum: [1, 2, 3] },
    imageUrl: { anyOf: [{ type: "string" }, { type: "null" }] },
    isActive: { type: "boolean" },
    createdAt: { type: "integer" },
    contactEmail: { type: "string" },
  },
};
const entities = new Set(["Product", "Category"]);

describe("field-type inference", () => {
  const fields = fieldsOf(productSchema, entities);
  const by = (n: string) => fields.find((f) => f.name === n)!;
  test("maps each property to the right Payload-style widget", () => {
    expect(by("name").type).toBe("text");
    expect(by("description").type).toBe("textarea");
    expect(by("body").type).toBe("richtext");
    expect(by("priceCents").type).toBe("number");
    expect(by("status").type).toBe("select");
    expect(by("status").options).toEqual(["draft", "published"]);
    expect(by("status").optionType).toBe("string");
    expect(by("priority").type).toBe("select"); // a NUMERIC enum is still a select…
    expect(by("priority").options).toEqual(["1", "2", "3"]);
    expect(by("priority").optionType).toBe("number"); // …but carries its scalar type so the form submits numbers, not "1"
    expect(by("isActive").type).toBe("boolean");
    expect(by("imageUrl").type).toBe("url");
    expect(by("contactEmail").type).toBe("email");
    expect(by("createdAt").type).toBe("datetime");
  });
  test("relationship: categoryId → Category (because Category is an entity)", () => {
    expect(by("categoryId").type).toBe("relationship");
    expect(by("categoryId").relationTo).toBe("Category");
  });
  test("required (non-nullable) + readOnly + nullable flags", () => {
    expect(by("name").required).toBe(true);
    expect(by("priceCents").required).toBe(true);
    expect(by("description").nullable).toBe(true);
    expect(by("id").readOnly).toBe(true);
    expect(by("createdAt").readOnly).toBe(true);
  });
  test("humanize + titleField", () => {
    expect(humanize("coverImageUrl")).toBe("Cover Image URL");
    expect(humanize("categoryId")).toBe("Category");
    expect(titleField(fields)).toBe("name");
  });
});

describe("entityModels from a document", () => {
  const doc = {
    components: { schemas: { Product: productSchema, ProblemDetails: { type: "object", properties: { title: { type: "string" } } } } },
    paths: {
      product: { requests: { listProduct: {}, createProduct: {} } },
      "product/{id}": { requests: { getProduct: {}, updateProduct: {}, deleteProduct: {} } },
    },
  };
  const ms = entityModels(doc as never);
  test("only CRUD-managed entities; access derived from present ops; path normalized", () => {
    expect(ms.map((m) => m.name)).toEqual(["Product"]); // ProblemDetails has no listProblemDetails → excluded
    expect(ms[0].path).toBe("/product");
    expect(ms[0].access).toEqual({ list: true, create: true, update: true, delete: true });
  });
  test("a projected doc without create/delete ops yields a read-only-ish model", () => {
    const ro = entityModels({ components: doc.components, paths: { product: { requests: { listProduct: {} } }, "product/{id}": { requests: { getProduct: {} } } } } as never);
    expect(ro[0].access).toEqual({ list: true, create: false, update: false, delete: false });
  });
});

describe("renderers produce HTML", () => {
  const fields = fieldsOf(productSchema, entities);
  test("renderInput per type", () => {
    expect(renderInput(fields.find((f) => f.name === "isActive")!)).toContain("pf-switch");
    expect(renderInput(fields.find((f) => f.name === "status")!)).toContain("<option value=\"draft\"");
    expect(renderInput(fields.find((f) => f.name === "categoryId")!)).toContain('data-rel="Category"');
    const rt = renderInput(fields.find((f) => f.name === "body")!);
    expect(rt).toContain("data-rt");                 // the markdown editor wrapper
    expect(rt).toContain('data-md="bold"');           // toolbar
    expect(rt).toContain('data-rt-tab="preview"');    // Write/Preview
    expect(rt).toContain('name="body"');              // the textarea is still the form input
  });
  const model = entityModels({ components: { schemas: { Product: productSchema } }, paths: { product: { requests: { listProduct: {}, createProduct: {}, updateProduct: {}, deleteProduct: {} } } } } as never)[0];
  test("form + list + shell render without throwing", () => {
    const form = renderForm(model, { basePath: "/panel", relPaths: { Category: "/category" }, canDelete: true });
    expect(form).toContain('id="pf-form"');
    expect(form).toContain("pf-meta");
    expect(form).toContain("data-rt"); // Product has a rich-text `body` → the editor is present + its init script runs
    const lst = renderList(model, { basePath: "/panel" });
    expect(lst).toContain("pf-table");
    expect(lst).toContain("+ New Product");
    const shell = renderShell({ title: "saasuluk", brand: "saasuluk", basePath: "/panel", entities: [{ name: "Product" }], active: "Product", heading: "Product", body: lst });
    expect(shell).toContain("<aside class=\"pf-side\"");
    expect(shell).toContain("Collections");
  });
  test("panelApp builds a Hono app", () => {
    const a = panelApp({ document: { components: { schemas: { Product: productSchema } }, paths: { product: { requests: { listProduct: {} } } } } as never, authorize: () => true });
    expect(typeof a.fetch).toBe("function");
  });
});
