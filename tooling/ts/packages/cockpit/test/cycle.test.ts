import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "@suluk/core";
import { buildCycle, cycleSummary, docChecks } from "../src/cycle";
import { entityNames, generateForm, generateTable, generateStoresModule, exportV4Json } from "../src/codegen";

const petstoreSrc = readFileSync(
  join(import.meta.dir, "..", "..", "core", "test", "conformance", "valid", "01-petstore.yaml"),
  "utf8",
);
const petstore = parseDocument(petstoreSrc);

describe("buildCycle — the cockpit spine (every layer from one hub)", () => {
  const model = buildCycle(petstore);

  test("models all eight layers", () => {
    expect(model.layers.map((l) => l.id)).toEqual(["data", "contract", "auth", "document", "docs", "state", "ui", "tests"]);
  });
  test("data layer lists the entities (Pet, Category, Tag)", () => {
    const data = model.layers.find((l) => l.id === "data")!;
    expect(data.items.map((i) => i.label).sort()).toEqual(["Category", "Pet", "Tag"]);
  });
  test("contract layer lists operations and flags scope-gated ones", () => {
    const contract = model.layers.find((l) => l.id === "contract")!;
    const names = contract.items.map((i) => i.label);
    expect(names).toContain("createPet");
    expect(names).toContain("listPets");
    // createPet requires write:pets → flagged info; listPets is public
    expect(contract.items.find((i) => i.label === "createPet")!.status).toBe("info");
    expect(contract.items.find((i) => i.label === "listPets")!.status).toBeUndefined();
  });
  test("auth layer lists the security schemes", () => {
    const auth = model.layers.find((l) => l.id === "auth")!;
    expect(auth.items.map((i) => i.label).sort()).toEqual(["api_key", "petstore_auth"]);
  });
  test("document layer reports validity + coverage", () => {
    expect(model.valid).toBe(true);
    const docLayer = model.layers.find((l) => l.id === "document")!;
    expect(docLayer.summary).toContain("meta-schema ✓");
  });
  test("state layer derives a store per operation (GET → fetcher, else mutator)", () => {
    const state = model.layers.find((l) => l.id === "state")!;
    expect(state.items.find((i) => i.label === "listPets")!.detail).toBe("fetcher store");
    expect(state.items.find((i) => i.label === "createPet")!.detail).toBe("mutator store");
  });
  test("ui layer derives a form+table per entity", () => {
    const ui = model.layers.find((l) => l.id === "ui")!;
    expect(ui.items.find((i) => i.label === "Pet")!.detail).toMatch(/form \(\d+ fields\)/);
  });
  test("tests layer runs doc-level contract checks (all pass for petstore)", () => {
    const tests = model.layers.find((l) => l.id === "tests")!;
    expect(tests.status).toBe("ok");
    expect(tests.items.every((i) => i.status === "ok")).toBe(true);
  });
});

describe("the cockpit is a FUNCTION of the viewer (per-WHO projection)", () => {
  test("anonymous hides scope-gated operations; a scoped principal reveals them", () => {
    const anon = buildCycle(petstore, { principal: { scopes: [] } });
    const writer = buildCycle(petstore, { principal: { scopes: ["write:pets"] } });
    const anonOps = anon.layers.find((l) => l.id === "contract")!.items.map((i) => i.label);
    const writerOps = writer.layers.find((l) => l.id === "contract")!.items.map((i) => i.label);
    expect(anonOps).toContain("listPets");        // public
    expect(anonOps).not.toContain("createPet");   // requires write:pets
    expect(writerOps).toContain("createPet");
    // the hidden count is surfaced honestly
    expect(anon.layers.find((l) => l.id === "contract")!.summary).toContain("hidden for this viewer");
  });
  test("no principal ⇒ full view", () => {
    const full = buildCycle(petstore);
    expect(full.layers.find((l) => l.id === "contract")!.items.map((i) => i.label)).toContain("createPet");
  });
});

describe("docChecks — the doc as an executable check", () => {
  test("petstore passes all doc-level checks", () => {
    expect(docChecks(petstore).every((c) => c.pass)).toBe(true);
  });
});

describe("codegen actions land real artifacts", () => {
  test("entityNames lists the schemas", () => {
    expect(entityNames(petstore).sort()).toEqual(["Category", "Pet", "Tag"]);
  });
  test("generateForm emits a shadcn form TSX for Pet", () => {
    const tsx = generateForm(petstore, "Pet");
    expect(tsx).toContain("useForm");
    expect(tsx).toContain("zodResolver");
    expect(tsx).toContain("FormField");
    expect(tsx).toContain("PetForm");
  });
  test("generateTable emits a shadcn table TSX for Pet", () => {
    expect(generateTable(petstore, "Pet")).toContain("<Table");
  });
  test("generateStoresModule wires createApiStores and lists derived stores", () => {
    const mod = generateStoresModule(petstore);
    expect(mod).toContain("createApiStores");
    expect(mod).toContain("@suluk/nano-stores");
    expect(mod).toContain("createPet"); // a derived store listed in the comment
  });
  test("exportV4Json round-trips the document to JSON", () => {
    const json = JSON.parse(exportV4Json(petstoreSrc));
    expect(json.openapi).toContain("4.");
  });
});

describe("cycleSummary — flat status line", () => {
  test("returns one entry per layer", () => {
    expect(cycleSummary(buildCycle(petstore)).length).toBe(8);
  });
});
