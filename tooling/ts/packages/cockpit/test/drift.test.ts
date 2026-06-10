import { test, expect, describe } from "bun:test";
import { parseDocument } from "@suluk/core";
import { diffContracts, canonical } from "../src/drift";

// A small but realistic v4 contract: two ops + one schema. We mutate copies of it to provoke each drift kind.
const BASE = `openapi: 4.0.0-candidate
info: { title: T, version: 1.0.0 }
paths:
  "project":
    requests:
      listProject:
        method: get
        responses: { ok: { status: 200, contentType: application/json, contentSchema: { type: array, items: { $ref: "#/components/schemas/Project" } } } }
      createProject:
        method: post
        security: [ { bearerAuth: [ "write:project" ] } ]
        contentSchema: { $ref: "#/components/schemas/Project" }
        responses: { created: { status: 201 } }
components:
  schemas:
    Project: { type: object, required: [ name ], properties: { id: { type: integer }, name: { type: string } } }
`;
const doc = (s: string) => parseDocument(s);

describe("diffContracts", () => {
  test("identical contracts ⇒ no drift", () => {
    const d = diffContracts(doc(BASE), doc(BASE));
    expect(d.identical).toBe(true);
    expect(d.summary).toContain("in sync");
    expect(d.operations.added).toHaveLength(0);
    expect(d.operations.changed).toHaveLength(0);
    expect(d.schemas.changed).toHaveLength(0);
  });

  test("key reordering is NOT drift (canonical comparison)", () => {
    const reordered = `openapi: 4.0.0-candidate
info: { version: 1.0.0, title: T }
paths:
  "project":
    requests:
      listProject:
        responses: { ok: { contentType: application/json, status: 200, contentSchema: { items: { $ref: "#/components/schemas/Project" }, type: array } } }
        method: get
      createProject:
        responses: { created: { status: 201 } }
        method: post
        contentSchema: { $ref: "#/components/schemas/Project" }
        security: [ { bearerAuth: [ "write:project" ] } ]
components:
  schemas:
    Project: { properties: { name: { type: string }, id: { type: integer } }, required: [ name ], type: object }
`;
    expect(diffContracts(doc(BASE), doc(reordered)).identical).toBe(true);
  });

  test("an op present locally but not deployed ⇒ added (not yet shipped)", () => {
    // deployed = BASE without createProject
    const deployed = BASE.replace(/      createProject:[\s\S]*?responses: \{ created: \{ status: 201 \} \}\n/, "");
    const d = diffContracts(doc(BASE), doc(deployed));
    expect(d.identical).toBe(false);
    expect(d.operations.added.map((o) => o.name)).toEqual(["createProject"]);
    expect(d.operations.added[0].detail).toBe("POST project");
    expect(d.operations.removed).toHaveLength(0);
  });

  test("an op deployed but gone locally ⇒ removed (prod still serves it)", () => {
    const local = BASE.replace(/      createProject:[\s\S]*?responses: \{ created: \{ status: 201 \} \}\n/, "");
    const d = diffContracts(doc(local), doc(BASE));
    expect(d.operations.removed.map((o) => o.name)).toEqual(["createProject"]);
    expect(d.operations.added).toHaveLength(0);
  });

  test("a changed method/scope/response ⇒ changed with named field deltas", () => {
    // local bumps createProject to PUT, drops the scope, adds a 400 response
    const local = BASE
      .replace("      createProject:\n        method: post", "      createProject:\n        method: put")
      .replace('        security: [ { bearerAuth: [ "write:project" ] } ]\n', "")
      .replace("responses: { created: { status: 201 } }", "responses: { created: { status: 201 }, bad: { status: 400 } }");
    const d = diffContracts(doc(local), doc(BASE));
    const c = d.operations.changed.find((o) => o.name === "createProject")!;
    expect(c).toBeDefined();
    expect(c.changes.some((x) => x.includes("method"))).toBe(true);
    expect(c.changes.some((x) => x.includes("scopes"))).toBe(true);
    expect(c.changes.some((x) => x.includes("responses"))).toBe(true);
  });

  test("schema add / remove / change are tracked independently", () => {
    const local = BASE
      .replace("name: { type: string }", "name: { type: string }, slug: { type: string }") // change Project
      .replace("components:\n  schemas:", "components:\n  schemas:\n    Tag: { type: object, properties: { label: { type: string } } }"); // add Tag
    const d = diffContracts(doc(local), doc(BASE));
    expect(d.schemas.added).toContain("Tag");
    expect(d.schemas.changed).toContain("Project");
    expect(d.schemas.removed).toHaveLength(0);
  });

  // regression — operations named the same across DIFFERENT paths must not collide (the C009 name is unique
  // only within one pathItem). Keying by bare name silently hid drift; identity is pathTemplate + name.
  const TWOPATH = `openapi: 4.0.0-candidate
info: { title: T, version: 1.0.0 }
paths:
  "project": { requests: { get: { method: get, responses: { ok: { status: 200 } } } } }
  "user":    { requests: { get: { method: get, responses: { ok: { status: 200 } } } } }
`;
  test("cross-path same-name op REMOVED is reported (not masked by a sibling)", () => {
    const deployed = TWOPATH.replace(/  "user":[\s\S]*\n/, ""); // drop the user path
    const d = diffContracts(doc(TWOPATH), doc(deployed));
    expect(d.identical).toBe(false);
    expect(d.operations.added.map((o) => o.detail)).toContain("GET user");
    // and the project/get sibling must NOT be falsely reported as changed
    expect(d.operations.changed).toHaveLength(0);
  });
  test("cross-path same-name op CHANGED is not hidden by an identical sibling", () => {
    // local drifts ONLY project/get (200→500); user/get stays identical
    const local = TWOPATH.replace('"project": { requests: { get: { method: get, responses: { ok: { status: 200 } } } } }', '"project": { requests: { get: { method: get, responses: { ok: { status: 500 } } } } }');
    const d = diffContracts(doc(local), doc(TWOPATH));
    expect(d.identical).toBe(false); // must NOT report "in sync"
    const c = d.operations.changed.filter((o) => o.detail === "GET project");
    expect(c).toHaveLength(1);
    expect(c[0].changes.some((x) => x.includes("responses"))).toBe(true);
  });
  test("response status 200 (number) vs \"200\" (string) is NOT drift", () => {
    const numStatus = `openapi: 4.0.0-candidate
info: { title: T, version: 1.0.0 }
paths: { "p": { requests: { g: { method: get, responses: { ok: { status: 200 } } } } } }
`;
    const strStatus = numStatus.replace("status: 200", 'status: "200"');
    expect(diffContracts(doc(numStatus), doc(strStatus)).identical).toBe(true);
  });
  test("deeper response-body drift is caught even alongside a named change", () => {
    const base = `openapi: 4.0.0-candidate
info: { title: T, version: 1.0.0 }
paths: { "p": { requests: { g: { method: get, responses: { ok: { status: 200 } } } } } }
`;
    // local changes method AND adds a content schema to the same response
    const local = base.replace("g: { method: get, responses: { ok: { status: 200 } } }", "g: { method: post, responses: { ok: { status: 200, contentSchema: { type: object } } } }");
    const c = diffContracts(doc(local), doc(base)).operations.changed.find((o) => o.name === "g")!;
    expect(c.changes.some((x) => x.includes("method"))).toBe(true);
    expect(c.changes.some((x) => x.includes("shape"))).toBe(true); // the residual is not suppressed
  });

  test("provider-slot drift (x-suluk-providers) is reported", () => {
    const local = { openapi: "4.0.0-candidate", info: { title: "T", version: "1.0.0" }, paths: {}, "x-suluk-providers": { payments: "paddle", email: "resend" } } as unknown as Parameters<typeof diffContracts>[0];
    const deployed = { openapi: "4.0.0-candidate", info: { title: "T", version: "1.0.0" }, paths: {}, "x-suluk-providers": { payments: "stripe" } } as unknown as Parameters<typeof diffContracts>[0];
    const d = diffContracts(local, deployed);
    expect(d.identical).toBe(false);
    expect(d.providers.changed).toEqual([{ facet: "payments", from: "stripe", to: "paddle" }]);
    expect(d.providers.added).toEqual([{ facet: "email", impl: "resend" }]);
    expect(d.summary).toContain("providers");
  });
  test("canonical() is cycle-safe (does not overflow the stack)", () => {
    const a: Record<string, unknown> = { x: 1 };
    a.self = a;
    expect(() => canonical(a)).not.toThrow();
  });

  test("canonical() is stable under key permutation", () => {
    expect(canonical({ b: 1, a: { y: 2, x: 3 } })).toBe(canonical({ a: { x: 3, y: 2 }, b: 1 }));
    expect(canonical([1, 2, 3])).not.toBe(canonical([3, 2, 1])); // array order IS significant
  });
});
