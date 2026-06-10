import { test, expect, describe } from "bun:test";
import type { OpenAPIv4Document, PathItem } from "@suluk/core";
import { FIRST_PARTY_REGISTRY, gradeModule, previewInstall, installModule, ECOMMERCE, BILLING, type SulukModule } from "../src/index";

const host = (): OpenAPIv4Document => ({
  openapi: "4.0.0-candidate",
  info: { title: "Host", version: "1.0.0" },
  paths: { user: { requests: { listUser: { method: "get", summary: "List User", responses: { ok: { status: 200 } } } } } } as Record<string, PathItem>,
  components: { schemas: { User: { type: "object", properties: { id: { type: "integer" }, email: { type: "string" } } } } },
});

describe("FIRST_PARTY_REGISTRY", () => {
  test("is a non-empty named registry of distinct modules", () => {
    expect(FIRST_PARTY_REGISTRY.modules.length).toBeGreaterThanOrEqual(3);
    const names = FIRST_PARTY_REGISTRY.modules.map((m) => m.module.name);
    expect(new Set(names).size).toBe(names.length); // distinct
    for (const e of FIRST_PARTY_REGISTRY.modules) {
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.description.length).toBeGreaterThan(0);
    }
  });
  test("every first-party module installs cleanly into a host that satisfies its requires", () => {
    for (const e of FIRST_PARTY_REGISTRY.modules) {
      // a host providing exactly this module's requires (empty for `auth`, which itself PROVIDES User)
      const h: OpenAPIv4Document = { openapi: "4.0.0-candidate", info: { title: "Host", version: "1.0.0" }, paths: {}, components: { schemas: Object.fromEntries((e.module.requires ?? []).map((r) => [r, { type: "object" }])) } };
      const r = installModule(h, e.module);
      expect(r.installed).toBe(true);
      expect(r.conflicts).toHaveLength(0);
    }
  });
});

describe("gradeModule", () => {
  test("a fully-costed, documented module grades A", () => {
    const g = gradeModule(ECOMMERCE);
    expect(g.grade).toBe("A");
    expect(g.costCoverage).toBeGreaterThan(0.99);
  });
  test("a partially-costed module grades B and says why", () => {
    const g = gradeModule(BILLING); // ~half its ops declare cost
    expect(g.grade).toBe("B");
    expect(g.costCoverage).toBeLessThan(1);
    expect(g.notes.some((n) => n.includes("declare no cost"))).toBe(true);
  });
  test("a fully-uncosted module grades C (the grade is honest, not floored at B)", () => {
    const lazy: SulukModule = { name: "lazy", version: "0.0.0", provides: ["Widget"], schemas: { Widget: { type: "object", properties: { id: { type: "integer" } } } } };
    expect(gradeModule(lazy).grade).toBe("C");
  });
  test("a module that declares no operations grades C (not a free A)", () => {
    const empty: SulukModule = { name: "empty", version: "0.0.0", provides: [], schemas: {}, crud: false };
    const g = gradeModule(empty);
    expect(g.grade).toBe("C");
    expect(g.notes).toContain("declares no operations");
  });
});

describe("previewInstall — contract-diff-on-install (no commit)", () => {
  test("a clean install previews what it adds + requires + grade, willInstall true", () => {
    const p = previewInstall(host(), ECOMMERCE);
    expect(p.willInstall).toBe(true);
    expect(p.addsSchemas).toEqual(["Product", "Order"]);
    expect(p.addsOperations).toContain("checkoutOrder");
    expect(p.requires).toEqual(["User"]);
    expect(p.missingRequires).toHaveLength(0);
    expect(p.cost.find((c) => c.operation === "checkoutOrder")?.estimateMicroUsd).toBe(2900);
    expect(p.grade.grade).toBe("A");
  });
  test("previewing into a host WITHOUT the requirement flags it, willInstall false, and does NOT mutate the doc", () => {
    const noUser: OpenAPIv4Document = { openapi: "4.0.0-candidate", info: { title: "X", version: "1.0.0" }, paths: {}, components: { schemas: {} } };
    const p = previewInstall(noUser, ECOMMERCE);
    expect(p.willInstall).toBe(false);
    expect(p.missingRequires).toEqual(["User"]);
    expect(p.addsSchemas).toEqual(["Product", "Order"]); // still shows what it WOULD add
    expect(Object.keys(noUser.components!.schemas!)).toHaveLength(0); // untouched
  });
});
