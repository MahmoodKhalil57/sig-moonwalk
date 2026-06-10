import { test, expect, describe } from "bun:test";
import { parseDocument } from "@suluk/core";
import { installModule, ECOMMERCE } from "@suluk/builder";
import { contractToD2, diagramViews } from "../src/diagram";
import { generateAppFiles } from "../src/builder";

const host = () => parseDocument(`openapi: 4.0.0-candidate
info: { title: Shop, version: 1.0.0 }
paths: {}
components: { schemas: { User: { type: object, required: [ email ], properties: { id: { type: integer }, email: { type: string } } } } }`);

describe("diagramViews", () => {
  test("lists the available views", () => {
    expect(diagramViews().map((v) => v.id)).toEqual(["erd", "cycle", "operations"]);
  });
});

describe("contractToD2 — ERD", () => {
  const doc = installModule(host(), ECOMMERCE).doc; // User + Product + Order (Order.customer -> User)
  const d2 = contractToD2(doc, "erd");
  test("emits a sql_table per entity", () => {
    expect(d2).toContain("User: {");
    expect(d2).toContain("Order: {");
    expect(d2).toContain("shape: sql_table");
  });
  test("draws the cross-entity reference as an edge", () => {
    expect(d2).toContain("Order.customer -> User: references");
  });
  test("marks required fields NOT NULL", () => {
    expect(d2).toContain("NOT NULL"); // Order.items / Product.name are required
  });
  test("quotes a field whose name isn't a bare word", () => {
    const odd = parseDocument(`openapi: 4.0.0-candidate
info: { title: T, version: 1.0.0 }
paths: {}
components: { schemas: { "Weird Name": { type: object, properties: { "a-b": { type: string } } } } }`);
    const e = contractToD2(odd, "erd");
    expect(e).toContain('"Weird Name": {');
    expect(e).toContain('"a-b"');
  });
});

describe("contractToD2 — cycle + operations", () => {
  const doc = installModule(host(), ECOMMERCE).doc;
  test("the cycle view links a distinct hub to its projected layers (no contract/contract collision or self-loop)", () => {
    const d2 = contractToD2(doc, "cycle");
    expect(d2).toContain("_hub: {"); // the document-shaped hub, named so it can't collide with the contract layer
    expect(d2).toContain("_hub -> data");
    expect(d2).toContain("_hub -> cost");
    expect(d2).not.toContain("contract -> contract"); // no self-loop
    expect(d2).toContain("contract: {"); // the Contract (API) layer still renders as its own node
  });
  test("a schema field named a D2 reserved keyword (shape) is quoted, not a directive", () => {
    const odd = parseDocument(`openapi: 4.0.0-candidate
info: { title: T, version: 1.0.0 }
paths: {}
components: { schemas: { Box: { type: object, properties: { shape: { type: string }, label: { type: string } } } } }`);
    const e = contractToD2(odd, "erd");
    expect(e).toContain('"shape": string'); // quoted as a field, not a bare `shape:` directive
    expect(e).toContain('"label": string');
  });
  test("the operations view groups operations and shows method + path", () => {
    const d2 = contractToD2(doc, "operations");
    expect(d2).toContain("shape: package");
    expect(d2).toContain("listProduct");
    expect(d2).toContain("POST"); // createProduct etc.
  });
  test("the GENERATED APP ships the contract's diagrams (docs/*.d2 + a README)", () => {
    const files = generateAppFiles(doc);
    const paths = files.map((f) => f.path);
    for (const v of diagramViews()) expect(paths).toContain(`docs/${v.id}.d2`);
    expect(paths).toContain("docs/README.md");
    const erd = files.find((f) => f.path === "docs/erd.d2")!;
    expect(erd.content).toContain("shape: sql_table"); // the app's own data model, as D2
  });
  test("an empty contract still produces valid (non-empty) D2 for every view", () => {
    const empty = parseDocument(`openapi: 4.0.0-candidate
info: { title: E, version: 1.0.0 }
paths: {}
components: { schemas: {} }`);
    for (const v of diagramViews()) expect(contractToD2(empty, v.id).length).toBeGreaterThan(0);
  });
});
