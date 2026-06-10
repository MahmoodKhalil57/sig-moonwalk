import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "@suluk/core";
import { buildBuilderModel, entitiesFromDoc, generateAppFiles, generateRegistryJson, type BuilderNode } from "../src/builder";

const petstore = parseDocument(
  readFileSync(join(import.meta.dir, "..", "..", "core", "test", "conformance", "valid", "01-petstore.yaml"), "utf8"),
);

function find(nodes: BuilderNode[], tier: string, label?: string): BuilderNode | undefined {
  for (const n of nodes) {
    if (n.tier === tier && (!label || n.label === label)) return n;
    const inner = find(n.children, tier, label);
    if (inner) return inner;
  }
  return undefined;
}

describe("buildBuilderModel — the cockpit Builder surface", () => {
  const model = buildBuilderModel(petstore);

  test("treats each schema as an entity (Pet, Category, Tag)", () => {
    expect(entitiesFromDoc(petstore).map((e) => e.name).sort()).toEqual(["Category", "Pet", "Tag"]);
    expect(model.entityCount).toBe(3);
  });

  test("the composition is sound", () => {
    expect(model.errors).toEqual([]);
  });

  test("the tree is pages → sections → blocks → components", () => {
    const page = model.tree[0];
    expect(page.tier).toBe("page");
    const section = find(model.tree, "section", "PetCrud")!;
    expect(section.children.map((c) => c.label).sort()).toEqual(["PetForm", "PetTable"]);
    const block = find(model.tree, "block", "PetForm")!;
    expect(block.children[0].tier).toBe("component"); // ShadcnForm
  });

  test("each tier carries its param contract (the narrowing is visible)", () => {
    const page = find(model.tree, "page")!;
    const section = find(model.tree, "section", "PetCrud")!;
    const block = find(model.tree, "block", "PetForm")!;
    // a page may set { tone, sections }; a section { tone, blocks }; a form block { tone, fields }
    expect(page.contract.sort()).toEqual(["sections", "tone"]);
    expect(section.contract.sort()).toEqual(["blocks", "tone"]);
    expect(block.contract).toContain("fields");
    // the narrowing: `fields` is in the BLOCK contract but NOT the section/page contract
    expect(section.contract).not.toContain("fields");
    expect(page.contract).not.toContain("fields");
  });
});

describe("generate actions land artifacts", () => {
  test("generateAppFiles emits the v4 doc, frontend components/pages, and the shadcn registry", () => {
    const files = generateAppFiles(petstore);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("openapi.json");
    expect(paths).toContain("components/PetForm.tsx");
    expect(paths.some((p) => p.startsWith("app/") && p.endsWith("page.tsx"))).toBe(true);
    expect(paths).toContain("registry.json");
    expect(paths.some((p) => p === "registry/pet-crud.json")).toBe(true);
  });

  test("generateRegistryJson packages each slice (UI + backend) as installable items", () => {
    const reg = JSON.parse(generateRegistryJson(petstore)) as { items: { name: string; files: { path: string }[] }[] };
    const petCrud = reg.items.find((i) => i.name === "pet-crud")!;
    const filePaths = petCrud.files.map((f) => f.path);
    expect(filePaths).toContain("components/PetForm.tsx"); // UI
    expect(filePaths).toContain("server/pet.routes.ts");   // backend, in the same install unit
  });
});
