import { test, expect, describe } from "bun:test";
import { parseDocument } from "@suluk/core";
import { crossCut, documentScopes, defaultViewers } from "../src/crosscut";

// A petstore-ish contract: listPets/getPet are public; createPet/deletePet need write:pets; a read:secret op.
const DOC = parseDocument(`openapi: 4.0.0-candidate
info: { title: Pets, version: 1.0.0 }
paths:
  "pet":
    requests:
      listPets: { method: get, responses: { ok: { status: 200 } } }
      createPet: { method: post, security: [ { petstore_auth: [ "write:pets" ] } ], responses: { created: { status: 201 } } }
  "pet/{id}":
    requests:
      getPet: { method: get, responses: { ok: { status: 200 } } }
      deletePet: { method: delete, security: [ { petstore_auth: [ "write:pets" ] } ], responses: { deleted: { status: 204 } } }
      auditPet: { method: get, security: [ { petstore_auth: [ "read:secret" ] } ], responses: { ok: { status: 200 } } }
components:
  securitySchemes:
    petstore_auth: { type: oauth2, flows: { implicit: { authorizationUrl: "https://x/o", scopes: { "write:pets": "w", "read:secret": "r" } } } }
`);

describe("documentScopes / defaultViewers", () => {
  test("collects every scope referenced by an operation", () => {
    expect(documentScopes(DOC)).toEqual(["read:secret", "write:pets"]);
  });
  test("default viewers = anonymous + one per scope + full", () => {
    expect(defaultViewers(DOC).map((v) => v.label)).toEqual(["anonymous", "read:secret", "write:pets", "full"]);
  });
});

describe("crossCut — one contract through every viewer", () => {
  const cc = crossCut(DOC, defaultViewers(DOC));
  const view = (label: string) => cc.viewers.find((v) => v.label === label)!;

  test("anonymous sees only the public operations", () => {
    expect(view("anonymous").visible.sort()).toEqual(["getPet", "listPets"]);
    expect(view("anonymous").hidden.sort()).toEqual(["auditPet", "createPet", "deletePet"]);
  });
  test("a write:pets viewer gains create/delete but NOT the read:secret op", () => {
    expect(view("write:pets").visible.sort()).toEqual(["createPet", "deletePet", "getPet", "listPets"]);
    expect(view("write:pets").visible).not.toContain("auditPet");
  });
  test("the full operator view sees everything", () => {
    expect(view("full").hidden).toHaveLength(0);
    expect(view("full").visible).toHaveLength(5);
  });
  test("the gated surface lists exactly the scope-gated operations + who can reach them", () => {
    const gatedOps = cc.gated.map((g) => g.operation).sort();
    expect(gatedOps).toEqual(["auditPet", "createPet", "deletePet"]);
    const createPet = cc.gated.find((g) => g.operation === "createPet")!;
    expect(createPet.visibleTo).toEqual(["write:pets", "full"]); // anonymous + read:secret cannot
    expect(createPet.requiredScopes).toEqual([["write:pets"]]);
  });
  test("an auth-only operation (security with no scopes) is hidden from anonymous, visible to authenticated", () => {
    const authed = parseDocument(`openapi: 4.0.0-candidate
info: { title: A, version: 1.0.0 }
paths:
  "me":
    requests:
      getMe: { method: get, security: [ { bearerAuth: [] } ], responses: { ok: { status: 200 } } }
      ping:  { method: get, responses: { ok: { status: 200 } } }
components: { securitySchemes: { bearerAuth: { type: http, scheme: bearer } } }
`);
    const viewers = defaultViewers(authed);
    expect(viewers.map((v) => v.label)).toContain("authenticated"); // surfaced because of the auth-only op
    const cc = crossCut(authed, viewers);
    const v = (l: string) => cc.viewers.find((x) => x.label === l)!;
    expect(v("anonymous").visible).toEqual(["ping"]); // NOT getMe
    expect(v("authenticated").visible.sort()).toEqual(["getMe", "ping"]);
    expect(cc.gated.map((g) => g.operation)).toEqual(["getMe"]);
    expect(cc.gated[0].visibleTo).toEqual(["authenticated", "full"]);
  });
  test("a fully-public contract has an empty gated surface", () => {
    const open = parseDocument(`openapi: 4.0.0-candidate
info: { title: Open, version: 1.0.0 }
paths: { "a": { requests: { listA: { method: get, responses: { ok: { status: 200 } } } } } }
`);
    expect(crossCut(open, defaultViewers(open)).gated).toHaveLength(0);
  });
});
