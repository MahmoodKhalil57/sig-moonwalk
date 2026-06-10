import { test, expect, describe } from "bun:test";
import { parseRegistry, validateModule, installModule, previewInstall } from "../src/index";
import type { OpenAPIv4Document } from "@suluk/core";

const goodModule = {
  name: "blog", version: "0.1.0", provides: ["Post"], requires: ["User"],
  schemas: { Post: { type: "object", required: ["title"], properties: { id: { type: "integer" }, title: { type: "string" }, author: { $ref: "#/components/schemas/User" } } } },
  cost: { listPost: { components: [{ source: "db-read", basis: "per-call", microUsd: 10 }], estimateMicroUsd: 10 } },
};

describe("validateModule (untrusted manifest)", () => {
  test("accepts a well-formed module", () => {
    expect(validateModule(goodModule).error).toBeUndefined();
    expect(validateModule(goodModule).module?.name).toBe("blog");
  });
  test("rejects malformed shapes with a human reason", () => {
    expect(validateModule(null).error).toBe("not an object");
    expect(validateModule({ version: "1" }).error).toContain("name");
    expect(validateModule({ name: "x", version: "1", provides: "Post", schemas: {} }).error).toContain("provides must be an array");
    expect(validateModule({ name: "x", version: "1", provides: ["Post"], schemas: "nope" }).error).toContain("schemas must be an object");
    expect(validateModule({ name: "x", version: "1", provides: ["Post"], schemas: {} }).error).toContain('provides "Post" but ships no schema');
  });
});

describe("parseRegistry (untrusted payload)", () => {
  test("parses a valid registry and keeps the well-formed modules", () => {
    const r = parseRegistry({ name: "Community", modules: [{ title: "Blog", description: "posts", module: goodModule }] });
    expect(r.name).toBe("Community");
    expect(r.modules.map((m) => m.module.name)).toEqual(["blog"]);
    expect(r.rejected).toHaveLength(0);
  });
  test("rejects malformed entries but keeps the good ones (surfaced, not hidden)", () => {
    const r = parseRegistry({ name: "Mixed", modules: [
      { title: "Blog", module: goodModule },
      { title: "Broken", module: { name: "broken", version: "1", provides: ["Ghost"], schemas: {} } },
      "not-an-object",
    ] });
    expect(r.modules.map((m) => m.module.name)).toEqual(["blog"]);
    expect(r.rejected.map((x) => x.title)).toEqual(["Broken", "(entry)"]);
    expect(r.rejected[0].reason).toContain("no schema");
  });
  test("a non-object payload yields zero modules + a clear rejection (never throws)", () => {
    expect(parseRegistry("garbage").rejected[0].reason).toContain("not a JSON object");
    expect(parseRegistry(null).modules).toHaveLength(0);
    expect(parseRegistry({ name: "Empty" }).modules).toHaveLength(0); // no modules array
  });
});

describe("hostile-input hardening (the L1 trust boundary)", () => {
  const host = (): OpenAPIv4Document => ({ openapi: "4.0.0-candidate", info: { title: "H", version: "1.0.0" }, paths: {}, components: { schemas: {} } });
  test("a `requires` of a builtin name (constructor) is REFUSED, not satisfied via the prototype chain", () => {
    const hostile = { name: "evil", version: "1", provides: ["Thing"], requires: ["constructor"], schemas: { Thing: { type: "object", properties: { x: { $ref: "#/components/schemas/constructor" } } } } };
    const r = installModule(host(), validateModule(hostile).module!);
    expect(r.installed).toBe(false);
    expect(r.conflicts.some((c) => c.includes('requires "constructor"'))).toBe(true);
  });
  test("a module whose schema $refs a name nothing provides is REFUSED (dangling-ref backstop)", () => {
    const mod = { name: "x", version: "1", provides: ["A"], schemas: { A: { type: "object", properties: { b: { $ref: "#/components/schemas/Ghost" } } } } };
    const r = installModule(host(), validateModule(mod).module!);
    expect(r.installed).toBe(false);
    expect(r.conflicts.some((c) => c.includes("dangling reference"))).toBe(true);
  });
  test("validateModule rejects builtin-named provides, a null PathItem, and a malformed cost", () => {
    expect(validateModule({ name: "x", version: "1", provides: ["toString"], schemas: {} }).error).toContain('provides "toString"');
    expect(validateModule({ name: "x", version: "1", provides: [], schemas: {}, paths: { "p": null } }).error).toContain('path "p" must be an object');
    expect(validateModule({ name: "x", version: "1", provides: [], schemas: {}, cost: { op: "free!" } }).error).toContain('cost "op"');
    expect(validateModule({ name: "x", version: "1", provides: ["A"], schemas: { A: "not-an-object" } }).error).toContain('schema "A" must be an object');
  });
});

describe("a parsed remote module still goes through the real install gate", () => {
  const host: OpenAPIv4Document = { openapi: "4.0.0-candidate", info: { title: "H", version: "1.0.0" }, paths: {}, components: { schemas: { User: { type: "object" } } } };
  test("installs cleanly into a host with its requirement; previews its grade", () => {
    const mod = parseRegistry({ name: "C", modules: [{ title: "Blog", module: goodModule }] }).modules[0].module;
    expect(previewInstall(host, mod).willInstall).toBe(true);
    expect(installModule(host, mod).installed).toBe(true);
  });
  test("is REFUSED by installModule when its requirement is absent (the discipline still applies to remote modules)", () => {
    const noUser: OpenAPIv4Document = { openapi: "4.0.0-candidate", info: { title: "X", version: "1.0.0" }, paths: {}, components: { schemas: {} } };
    const mod = parseRegistry({ name: "C", modules: [{ title: "Blog", module: goodModule }] }).modules[0].module;
    const r = installModule(noUser, mod);
    expect(r.installed).toBe(false);
    expect(r.conflicts.some((c) => c.includes('requires "User"'))).toBe(true);
  });
});
