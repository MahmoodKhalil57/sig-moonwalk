import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument, buildAda } from "@suluk/core";
import { downgrade, upgrade, validate31 } from "../src/index";

const corpus = join(import.meta.dir, "..", "..", "core", "test", "conformance", "valid");
const petstore = parseDocument(readFileSync(join(corpus, "01-petstore.yaml"), "utf8"));

describe("v4 → 3.1 downgrade (the Scalar/Swagger lever)", () => {
  const { document, diagnostics } = downgrade(petstore);

  test("produces a document that validates against the OFFICIAL OpenAPI 3.1 meta-schema", () => {
    const v = validate31(document);
    if (!v.valid) console.error(JSON.stringify(v.errors, null, 2));
    expect(v.valid).toBe(true);
  });

  test("declares 3.1 version + carries info/paths", () => {
    expect((document as any).openapi).toBe("3.1.0");
    expect((document as any).info.title).toContain("Petstore");
    expect(Object.keys((document as any).paths)).toContain("/pet");
  });

  test("name-keyed requests become method-keyed operations, operationId = the v4 name", () => {
    const petPost = (document as any).paths["/pet"].post;
    expect(petPost.operationId).toBe("createPet");
    expect((document as any).paths["/pet"].get.operationId).toBe("listPets");
  });

  test("the shared (inherited) path param is materialized onto each operation (C012 merge)", () => {
    const getPet = (document as any).paths["/pet/{petId}"].get;
    const petIdParam = (getPet.parameters ?? []).find((p: any) => p.name === "petId");
    expect(petIdParam).toBeDefined();
    expect(petIdParam.in).toBe("path");
    expect(petIdParam.required).toBe(true); // 3.1: path params always required
  });

  test("per-location query schema expands into a 3.1 query parameter", () => {
    const op = (document as any).paths["/pet/findByStatus"].get;
    const statusParam = (op.parameters ?? []).find((p: any) => p.name === "status");
    expect(statusParam).toBeDefined();
    expect(statusParam.in).toBe("query");
    expect(statusParam.required).toBe(true);
  });

  test("flattened body (contentType + contentSchema) becomes requestBody.content", () => {
    const rb = (document as any).paths["/pet"].post.requestBody;
    expect(rb.content["application/json"].schema.$ref).toBe("#/components/schemas/Pet");
  });

  test("inherited pathResponses/apiResponses are merged into operations for rendering", () => {
    const getPet = (document as any).paths["/pet/{petId}"].get;
    expect(Object.keys(getPet.responses)).toContain("404"); // from pathResponses.petNotFound
    expect(Object.keys(getPet.responses)).toContain("5XX"); // from apiResponses.globalServerError
  });

  test("schemas pass through verbatim (shared 2020-12 dialect)", () => {
    expect((document as any).components.schemas.Pet).toEqual(petstore.components!.schemas!.Pet as any);
  });

  test("petstore has no method collisions → clean downgrade", () => {
    expect(diagnostics.filter((d) => d.kind === "collision")).toEqual([]);
  });
});

describe("collision is reported, never silently lost (C003 lossy boundary)", () => {
  test("two same-method requests on one path emit a collision diagnostic", () => {
    const doc = parseDocument(`
openapi: 4.0.0-candidate
info: { title: t, version: "1" }
paths:
  "thing":
    requests:
      listA: { method: get, responses: { ok: { status: 200 } } }
      listB: { method: get, responses: { ok: { status: 200 } } }
`);
    const { document, diagnostics } = downgrade(doc);
    const collisions = diagnostics.filter((d) => d.kind === "collision");
    expect(collisions.length).toBe(1);
    expect(collisions[0].message).toContain("listB");
    // still produced VALID 3.1 (first request wins)
    expect(validate31(document).valid).toBe(true);
    expect((document as any).paths["/thing"].get.operationId).toBe("listA");
  });
});

describe("3.1 → v4 → 3.1 round-trip", () => {
  test("downgrade → upgrade recovers the operations by name + method", () => {
    const { document } = downgrade(petstore);
    const v4again = upgrade(document);
    const ada = buildAda(v4again);
    const names = ada.operations.map((o) => o.name).sort();
    // operationId carried the original v4 names through the 3.1 hop
    expect(names).toContain("createPet");
    expect(names).toContain("getPet");
    expect(names).toContain("findByStatus");
  });

  test("upgrade output is a structurally valid v4 doc that re-downgrades to valid 3.1", () => {
    const v4again = upgrade(downgrade(petstore).document);
    const redown = downgrade(v4again);
    expect(validate31(redown.document).valid).toBe(true);
  });
});
