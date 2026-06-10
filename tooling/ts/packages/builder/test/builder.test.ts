import { test, expect, describe } from "bun:test";
import * as z from "zod";
import { validateDocument as validateV4 } from "@suluk/core";
import { zodToV4 } from "@suluk/zod";
import {
  registry, validateDocument, validateAll, resolveParams, resolveList,
  buildApp, crudRoutesFromSchema, crudSection, appPage, formBlock, tableBlock, toShadcnRegistry,
  type Entity, type DslDocument, type ParamSpec,
} from "../src/index";

type ListSpec = Extract<ParamSpec, { type: "list" }>;

// entities as v4 Schema Objects (via Zod → v4, the cycle's standard path)
const Pet: Entity = { name: "Pet", schema: zodToV4(z.object({ id: z.number().int().optional(), name: z.string().min(1), status: z.enum(["available", "sold"]) })).schema };
const Category: Entity = { name: "Category", schema: zodToV4(z.object({ id: z.number().int().optional(), name: z.string() })).schema };

describe("contract-narrowing — the load-bearing mechanism", () => {
  const app = buildApp({ entities: [Pet], info: { title: "Pets", version: "1" } });
  const reg = app.registry;

  test("the whole generated composition validates (no contract violations)", () => {
    expect(app.errors).toEqual([]);
    expect(validateAll(reg)).toEqual([]);
  });

  test("a page MAY set what a section exposes (tone)…", () => {
    const ok: DslDocument = { name: "P", tier: "pages", params: { tone: { type: "enum", options: ["default", "compact"], default: "default" } }, root: { type: "PetCrud", props: { tone: "compact" } } };
    expect(validateDocument(ok, reg)).toEqual([]);
  });

  test("…but may NOT set what the section narrowed away (fields) — the narrowing IS the rejection", () => {
    const bad: DslDocument = { name: "P", tier: "pages", root: { type: "PetCrud", props: { fields: ["name"] } } };
    const errors = validateDocument(bad, reg);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("not part of PetCrud's contract");
  });

  test("referencing a type from the wrong tier is rejected (tier rule)", () => {
    // a page composing a BLOCK directly (pages compose sections, not blocks)
    const bad: DslDocument = { name: "P", tier: "pages", root: { type: "PetForm" } };
    expect(validateDocument(bad, reg).length).toBeGreaterThan(0);
  });

  test("an unknown variant is rejected", () => {
    const bad: DslDocument = { name: "P", tier: "pages", root: { type: "PetCrud", variant: "nope" } };
    expect(validateDocument(bad, reg).some((e) => e.message.includes("not a variant"))).toBe(true);
  });
});

describe("resolution", () => {
  test("resolveParams: defaults ← variant ← props (only contract keys survive)", () => {
    const doc: DslDocument = {
      name: "B", tier: "blocks",
      params: { tone: { type: "enum", options: ["a", "b"], default: "a" }, size: { type: "number", default: 1 } },
      variants: { big: { size: 3 } },
      root: { type: "ShadcnForm" },
    };
    expect(resolveParams(doc, undefined, undefined)).toEqual({ tone: "a", size: 1 });
    expect(resolveParams(doc, "big", undefined)).toEqual({ tone: "a", size: 3 });
    expect(resolveParams(doc, "big", { tone: "b", nope: "x" })).toEqual({ tone: "b", size: 3 }); // 'nope' dropped
  });

  test("resolveList honors controls (hide allowed, include denied)", () => {
    const spec: ListSpec = { type: "list", options: ["a", "b", "c"], controls: ["hide", "reorder"], default: ["a", "b", "c"] };
    expect(resolveList(spec, ["c", "a"])).toEqual(["c", "a"]); // reorder + hide ok
    const noInclude: ListSpec = { type: "list", options: ["a", "b"], controls: ["reorder"], default: ["a", "b"] };
    expect(resolveList(noInclude, ["b"]).sort()).toEqual(["a", "b"]); // hide denied → 'a' kept
  });
});

describe("buildApp — backend + frontend from ONE spec", () => {
  const app = buildApp({ entities: [Pet, Category], info: { title: "Shop", version: "1.0.0" } });

  test("backend: 5 CRUD routes per entity, emitted to a valid v4 document", () => {
    expect(app.backend.routes.length).toBe(10);
    expect(validateV4(app.backend.document).valid).toBe(true);
    const names = app.backend.routes.map((r) => r.name);
    expect(names).toContain("listPet");
    expect(names).toContain("createCategory");
  });

  test("frontend: a shadcn Form + Table component per entity", () => {
    const names = app.frontend.components.map((c) => c.name).sort();
    expect(names).toEqual(["CategoryForm", "CategoryTable", "PetForm", "PetTable"]);
    expect(app.frontend.components.find((c) => c.name === "PetForm")!.tsx).toContain("zodResolver");
  });

  test("frontend: a page composing the sections, wired to the stores, with its contract in the header", () => {
    const page = app.frontend.pages.find((p) => p.name === "App")!;
    expect(page.tsx).toContain("<PetTable />");
    expect(page.tsx).toContain("<PetForm />");
    expect(page.tsx).toContain("CONTRACT for this tier: a page may set { tone, sections }");
  });

  test("crudRoutesFromSchema is the unit behind the backend", () => {
    expect(crudRoutesFromSchema("Pet", Pet.schema).map((r) => r.method)).toEqual(["get", "post", "get", "patch", "delete"]);
  });
});

describe("toShadcnRegistry — package each slice (frontend + backend) as an installable unit", () => {
  const app = buildApp({ entities: [Pet], info: { title: "Pets", version: "1" } });
  const reg = toShadcnRegistry(app, { name: "pets-registry" });

  test("emits a full-stack 'block' item per entity bundling UI + backend + schema", () => {
    const block = reg.items.find((i) => i.name === "pet-crud")!;
    expect(block.type).toBe("registry:block");
    const paths = block.files.map((f) => f.path);
    expect(paths).toContain("components/PetForm.tsx");          // frontend
    expect(paths).toContain("server/pet.routes.ts");           // BACKEND, via registry:file
    expect(paths).toContain("server/pet.schema.json");         // the v4 schema travels with it
    expect(block.registryDependencies).toContain("form");      // shadcn UI deps
    expect(block.files.find((f) => f.path === "server/pet.routes.ts")!.content).toContain("crudRoutesFromSchema");
  });

  test("emits a page item that depends on the entity blocks", () => {
    const page = reg.items.find((i) => i.type === "registry:page")!;
    expect(page.registryDependencies).toContain("pet-crud");
  });

  test("the registry index lists every item", () => {
    expect(reg.index.items.map((i) => i.name)).toContain("pet-crud");
  });

  test("case-colliding entity names get UNIQUE registry item names (no silent overwrite)", () => {
    const lowerPet: Entity = { name: "pet", schema: zodToV4(z.object({ name: z.string() })).schema };
    const r = toShadcnRegistry(buildApp({ entities: [Pet, lowerPet], info: { title: "X", version: "1" } }));
    const blockNames = r.items.filter((i) => i.type === "registry:block").map((i) => i.name);
    expect(blockNames).toEqual(["pet-crud", "pet-crud-2"]); // disambiguated, both present
    expect(new Set(r.items.map((i) => i.name)).size).toBe(r.items.length); // all unique
  });

  test("an unslug-safe title becomes a slug-safe registry name", () => {
    const r = toShadcnRegistry(buildApp({ entities: [Pet] }), { name: "My Cool App!" });
    expect(r.index.name).toBe("my-cool-app");
  });
});
