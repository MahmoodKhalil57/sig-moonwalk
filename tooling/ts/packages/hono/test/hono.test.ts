import { test, expect, describe } from "bun:test";
import * as z from "zod";
import { Hono } from "hono";
import { validateDocument, buildAda, matchRequest } from "@suluk/core";
import { validate31, downgrade } from "@suluk/openapi-compat";
import { contract, emitV4, audit, coverage, autofill, runContractChecks, mount } from "../src/index";

const Pet = z.object({ id: z.number().int().optional(), name: z.string().min(1), tags: z.array(z.string()) });

const routes = contract([
  {
    method: "get", path: "/pet", name: "listPets",
    summary: "List pets", tags: ["pets"],
    responses: [{ status: 200, description: "ok", schema: z.array(Pet) }],
  },
  {
    method: "post", path: "/pet", name: "createPet",
    summary: "Create a pet", tags: ["pets"], scopes: ["write:pets"],
    request: { json: Pet, examples: [{ name: "Rex", tags: [] }] },
    responses: [{ status: 201, description: "created", schema: Pet }],
    handler: (c: any) => c.json({ name: "Rex", tags: [] }, 201),
  },
  {
    method: "get", path: "/pet/:petId", name: "getPet",
    summary: "Get a pet by id",
    request: { params: z.object({ petId: z.string() }) },
    responses: [{ status: 200, description: "ok", schema: Pet }, { status: 404, description: "not found" }],
    handler: (c: any) => c.json({ name: "Rex", tags: [] }),
  },
  {
    // an undocumented + deprecated-since route, to exercise audit + the time axis
    method: "get", path: "/legacy", name: "legacyThing",
    deprecatedSince: "2020-01-01", removedSince: "2030-01-01",
    responses: [{ status: 200 }],
  },
]);

describe("emitV4 — the keystone derivation", () => {
  test("produces a v4 document that validates against the meta-schema", () => {
    const { document } = emitV4(routes, { info: { title: "Pets", version: "1.0.0" } });
    const r = validateDocument(document);
    if (!r.valid) console.error(r.errors);
    expect(r.valid).toBe(true);
  });

  test("Hono path :petId becomes a v4 uriTemplate {petId}, indexed in the ADA", () => {
    const { document } = emitV4(routes);
    expect(Object.keys(document.paths)).toContain("pet/{petId}");
    const ada = buildAda(document);
    expect(matchRequest(ada, "GET", "/pet/123")!.operation.name).toBe("getPet");
  });

  test("downgrades to valid OpenAPI 3.1 (Scalar/Swagger-ready)", () => {
    const { document } = emitV4(routes, { info: { title: "Pets", version: "1" } });
    expect(validate31(downgrade(document).document).valid).toBe(true);
  });
});

describe("the document is a FUNCTION of who + when (dynamic projection)", () => {
  test("WHO: a principal without write:pets does not see createPet", () => {
    const reader = emitV4(routes, { principal: { scopes: [] } });
    const names = Object.values(reader.document.paths).flatMap((pi) => Object.keys(pi.requests));
    expect(names).toContain("listPets");
    expect(names).not.toContain("createPet"); // requires write:pets
  });
  test("WHO: a principal WITH write:pets sees createPet", () => {
    const writer = emitV4(routes, { principal: { scopes: ["write:pets"] } });
    const names = Object.values(writer.document.paths).flatMap((pi) => Object.keys(pi.requests));
    expect(names).toContain("createPet");
  });
  test("WHO: no principal ⇒ full public doc (no filtering)", () => {
    const full = emitV4(routes);
    const names = Object.values(full.document.paths).flatMap((pi) => Object.keys(pi.requests));
    expect(names).toContain("createPet");
  });
  test("WHEN: after removedSince the legacy route is hidden", () => {
    const future = emitV4(routes, { now: "2031-06-01" });
    const names = Object.values(future.document.paths).flatMap((pi) => Object.keys(pi.requests));
    expect(names).not.toContain("legacyThing");
  });
  test("WHEN: before removedSince but after deprecatedSince it is shown, marked deprecated", () => {
    const now = emitV4(routes, { now: "2026-06-10" });
    const legacy = now.document.paths["legacy"].requests["legacyThing"];
    expect(legacy.deprecated).toBe(true);
  });
});

describe("audit — under-documented route detection (Conformance-Grade ceiling)", () => {
  test("flags the undocumented legacy route, not the documented ones", () => {
    const { document } = emitV4(routes);
    const findings = audit(document);
    const undocumented = findings.filter((f) => f.code === "missing-doc").map((f) => f.operation);
    expect(undocumented).toContain("legacyThing");
    expect(undocumented).not.toContain("getPet");
  });
  test("coverage is < 1 when a route is undocumented, and autofill raises it to 1", () => {
    const { document } = emitV4(routes);
    expect(coverage(document)).toBeLessThan(1);
    expect(coverage(autofill(document))).toBe(1);
  });
});

describe("contractChecks — auto-generated tests that catch mistakes", () => {
  test("all checks pass for a well-formed contract set", () => {
    const run = runContractChecks(routes);
    if (run.failures.length) console.error(run.failures);
    expect(run.failures).toEqual([]);
    expect(run.total).toBeGreaterThan(5);
  });
  test("a request example that violates its schema is caught", () => {
    const bad = contract([{
      method: "post", path: "/x", name: "x",
      request: { json: z.object({ n: z.number() }), examples: [{ n: "not a number" }] },
      responses: [{ status: 200 }],
    }]);
    expect(runContractChecks(bad).failures.length).toBeGreaterThan(0);
  });
});

describe("mount — one source feeds both the doc and the live app", () => {
  const app = mount(new Hono(), routes);
  test("validation derived from the same contracts rejects bad input, accepts good", async () => {
    const bad = await app.request("/pet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "" }) });
    const good = await app.request("/pet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Rex", tags: [] }) });
    expect(bad.status).toBe(400);   // name.min(1) fails
    expect(good.status).toBe(201);
  });
  test("a GET route responds", async () => {
    expect((await app.request("/pet/9")).status).toBe(200);
  });
});
