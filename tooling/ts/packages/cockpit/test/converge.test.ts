import { test, expect, describe } from "bun:test";
import { parseDocument } from "@suluk/core";
import { installModule, ECOMMERCE, composeModules, resolveTemplate, STACK_TEMPLATES } from "@suluk/builder";
import { convergeContract } from "../src/converge";

const doc = (s: string) => parseDocument(s);

describe("convergeContract — coherence over a whole contract", () => {
  test("a coherent contract is clean", () => {
    const d = doc(`openapi: 4.0.0-candidate
info: { title: T, version: 1.0.0 }
paths:
  "pet":
    requests:
      listPets: { method: get, responses: { ok: { status: 200, contentSchema: { $ref: "#/components/schemas/Pet" } } } }
      createPet: { method: post, security: [ { auth: [ "write:pets" ] } ], responses: { created: { status: 201 } } }
components:
  schemas: { Pet: { type: object, properties: { name: { type: string } } } }
  securitySchemes: { auth: { type: oauth2, flows: { implicit: { authorizationUrl: "https://x", scopes: { "write:pets": "w" } } } } }
`);
    const r = convergeContract(d);
    expect(r.clean).toBe(true);
    expect(r.findings.filter((f) => f.severity === "error")).toHaveLength(0);
  });

  test("an operation requiring an UNDECLARED scope is an error", () => {
    const d = doc(`openapi: 4.0.0-candidate
info: { title: T, version: 1.0.0 }
paths: { "pet": { requests: { createPet: { method: post, security: [ { auth: [ "delete:everything" ] } ], responses: { ok: { status: 201 } } } } } }
components: { securitySchemes: { auth: { type: oauth2, flows: { implicit: { authorizationUrl: "https://x", scopes: { "write:pets": "w" } } } } } }
`);
    const r = convergeContract(d);
    expect(r.clean).toBe(false);
    expect(r.findings.some((f) => f.code === "orphan-scope" && f.message.includes("delete:everything"))).toBe(true);
  });

  test("an operation requiring an UNDECLARED scheme is an error", () => {
    const d = doc(`openapi: 4.0.0-candidate
info: { title: T, version: 1.0.0 }
paths: { "pet": { requests: { createPet: { method: post, security: [ { ghostAuth: [] } ], responses: { ok: { status: 201 } } } } } }
components: { securitySchemes: {} }
`);
    const r = convergeContract(d);
    expect(r.findings.some((f) => f.code === "undeclared-scheme" && f.message.includes("ghostAuth"))).toBe(true);
    expect(r.clean).toBe(false);
  });

  test("a $ref to a missing schema is a dangling-ref error", () => {
    const d = doc(`openapi: 4.0.0-candidate
info: { title: T, version: 1.0.0 }
paths: { "pet": { requests: { getPet: { method: get, responses: { ok: { status: 200, contentSchema: { $ref: "#/components/schemas/Ghost" } } } } } } }
components: { schemas: {} }
`);
    const r = convergeContract(d);
    expect(r.findings.some((f) => f.code === "dangling-ref" && f.where === "Ghost")).toBe(true);
  });

  test("an unreferenced entity is reported as info (not an error)", () => {
    const d = doc(`openapi: 4.0.0-candidate
info: { title: T, version: 1.0.0 }
paths: { "pet": { requests: { ping: { method: get, responses: { ok: { status: 200 } } } } } }
components: { schemas: { Orphan: { type: object } } }
`);
    const r = convergeContract(d);
    expect(r.clean).toBe(true); // info, not error
    expect(r.findings.some((f) => f.code === "unreferenced-entity" && f.where === "Orphan")).toBe(true);
  });

  test("an openIdConnect scheme's scopes are NOT locally checkable — no false orphan-scope", () => {
    const d = doc(`openapi: 4.0.0-candidate
info: { title: T, version: 1.0.0 }
paths: { "x": { requests: { getX: { method: get, security: [ { oidc: [ "profile", "email" ] } ], responses: { ok: { status: 200 } } } } } }
components: { securitySchemes: { oidc: { type: openIdConnect, openIdConnectUrl: "https://idp/.well-known/openid-configuration" } } }
`);
    const r = convergeContract(d);
    expect(r.findings.filter((f) => f.code === "orphan-scope")).toHaveLength(0);
    expect(r.clean).toBe(true);
  });

  test("a DEEP $ref (.../Order/properties/id) resolves to its root — not a false dangling-ref", () => {
    const d = doc(`openapi: 4.0.0-candidate
info: { title: T, version: 1.0.0 }
paths: { "o": { requests: { getId: { method: get, responses: { ok: { status: 200, contentSchema: { $ref: "#/components/schemas/Order/properties/id" } } } } } } }
components: { schemas: { Order: { type: object, properties: { id: { type: integer } } } } }
`);
    const r = convergeContract(d);
    expect(r.findings.some((f) => f.code === "dangling-ref")).toBe(false);
    expect(r.findings.some((f) => f.code === "unreferenced-entity" && f.where === "Order")).toBe(false); // Order IS referenced
  });

  test("a security issue inside a WEBHOOK is caught (not just path operations)", () => {
    const d = doc(`openapi: 4.0.0-candidate
info: { title: T, version: 1.0.0 }
paths: {}
webhooks: { onEvent: { method: post, security: [ { ghostHook: [] } ], responses: { ok: { status: 200 } } } }
components: { securitySchemes: {} }
`);
    expect(convergeContract(d).findings.some((f) => f.code === "undeclared-scheme" && f.message.includes("ghostHook"))).toBe(true);
  });

  test("a malformed (non-array) scope value never iterates character-by-character", () => {
    const d = doc(`openapi: 4.0.0-candidate
info: { title: T, version: 1.0.0 }
paths: { "x": { requests: { getX: { method: get, security: [ { auth: "write" } ], responses: { ok: { status: 200 } } } } } }
components: { securitySchemes: { auth: { type: oauth2, flows: { implicit: { authorizationUrl: "https://x", scopes: { write: "w" } } } } } }
`);
    const r = convergeContract(d);
    expect(r.findings.filter((f) => f.code === "orphan-scope")).toHaveLength(0); // not w,r,i,t,e
  });

  test("a freshly composed platform (auth + ecommerce + crm) converges clean", () => {
    const empty = doc(`openapi: 4.0.0-candidate
info: { title: P, version: 1.0.0 }
paths: {}
components: { schemas: {} }`);
    const composed = composeModules(empty, resolveTemplate(STACK_TEMPLATES.find((t) => t.name === "Everything")!).modules);
    expect(composed.ok).toBe(true);
    expect(convergeContract(composed.doc).clean).toBe(true); // no dangling refs, no orphan scopes across modules
  });

  test("a module installed WITHOUT its required entity would dangle — but install refuses it; converge catches a hand-built dangle", () => {
    // installModule refuses ecommerce without User; convergeContract independently flags a doc someone hand-merged wrong
    const broken = installModule(doc(`openapi: 4.0.0-candidate
info: { title: H, version: 1.0.0 }
paths: {}
components: { schemas: { User: { type: object } } }`), ECOMMERCE).doc;
    // remove User after the fact (simulating a bad hand-edit) → Order.customer now dangles
    delete (broken.components!.schemas as Record<string, unknown>).User;
    expect(convergeContract(broken).findings.some((f) => f.code === "dangling-ref" && f.where === "User")).toBe(true);
  });
});
