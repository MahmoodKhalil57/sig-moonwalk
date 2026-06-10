import { test, expect, describe } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseDocument, validateDocument, resolveRef, buildAda, matchRequest, computeSignature, collide,
} from "../src/index";

const here = import.meta.dir;
const corpus = join(here, "conformance");
const petstore = parseDocument(readFileSync(join(corpus, "valid", "01-petstore.yaml"), "utf8"));

describe("validate against the conformance corpus", () => {
  for (const f of readdirSync(join(corpus, "valid")).filter((f: string) => f.endsWith(".yaml"))) {
    test(`valid/${f} MUST validate`, () => {
      const r = validateDocument(parseDocument(readFileSync(join(corpus, "valid", f), "utf8")));
      expect(r.errors).toEqual([]);
      expect(r.valid).toBe(true);
    });
  }
  for (const f of readdirSync(join(corpus, "invalid")).filter((f: string) => f.endsWith(".yaml"))) {
    test(`invalid/${f} MUST be rejected`, () => {
      const r = validateDocument(parseDocument(readFileSync(join(corpus, "invalid", f), "utf8")));
      expect(r.valid).toBe(false);
      expect(r.errors.length).toBeGreaterThan(0);
    });
  }
});

describe("reference resolution (by name, C019 §A.1)", () => {
  test("resolves #/components/schemas/Pet by name", () => {
    const pet = resolveRef(petstore, "#/components/schemas/Pet") as any;
    expect(pet.type).toBe("object");
    expect(pet.required).toContain("name");
  });
  test("throws on a missing key (never positional fallback)", () => {
    expect(() => resolveRef(petstore, "#/components/schemas/Nope")).toThrow();
  });
});

describe("ADA + matching", () => {
  const ada = buildAda(petstore);
  test("indexes every request as an operation", () => {
    // petstore: pet{createPet,listPets} + pet/findByStatus{findByStatus} + pet/{petId}{getPet,updatePet,deletePet}
    expect(ada.operations.length).toBeGreaterThanOrEqual(6);
  });
  test("matches GET /pet/123 to getPet with captured petId", () => {
    const m = matchRequest(ada, "GET", "/pet/123");
    expect(m).not.toBeNull();
    expect(m!.operation.name).toBe("getPet");
    expect(m!.pathParams.petId).toBe("123");
  });
  test("matches POST /pet to createPet", () => {
    expect(matchRequest(ada, "POST", "/pet")!.operation.name).toBe("createPet");
  });
  test("concrete-over-variable: GET /pet beats GET /pet/{petId} for /pet", () => {
    expect(matchRequest(ada, "GET", "/pet")!.operation.name).toBe("listPets");
  });
  test("captures the query string", () => {
    const m = matchRequest(ada, "GET", "/pet/findByStatus?status=available");
    expect(m).not.toBeNull();
    expect(m!.query.status).toEqual(["available"]);
  });
  test("no match returns null", () => {
    expect(matchRequest(ada, "GET", "/nonexistent/path")).toBeNull();
  });
});

describe("signatures + collisions (C019 §A.2 / C003)", () => {
  test("signature key is deterministic and shape-based", () => {
    const a = computeSignature("pet/{petId}", { method: "get", responses: { ok: { status: 200 } } } as any).key;
    const b = computeSignature("pet/{name}", { method: "GET", responses: { ok: { status: 200 } } } as any).key;
    expect(a).toBe(b); // var spelling erased to {}; method case-normalized
  });
  test("different methods are provably-disjoint", () => {
    const a = computeSignature("pet", { method: "get", responses: {} } as any).tuple;
    const b = computeSignature("pet", { method: "post", responses: {} } as any).tuple;
    expect(collide(a, b)).toBe("provably-disjoint");
  });
  test("different literal path is provably-disjoint", () => {
    const a = computeSignature("pet", { method: "get", responses: {} } as any).tuple;
    const b = computeSignature("store", { method: "get", responses: {} } as any).tuple;
    expect(collide(a, b)).toBe("provably-disjoint");
  });
});
