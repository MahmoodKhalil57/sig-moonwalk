import { test, expect, describe } from "bun:test";
import type { OpenAPIv4Document } from "@suluk/core";
import { planComposition, composeModules, resolveTemplate, STACK_TEMPLATES, FIRST_PARTY_REGISTRY, AUTH, ECOMMERCE, CRM, type SulukModule } from "../src/index";

const empty = (): OpenAPIv4Document => ({ openapi: "4.0.0-candidate", info: { title: "App", version: "1.0.0" }, paths: {}, components: { schemas: {} } });

describe("planComposition — dependency ordering", () => {
  test("orders providers before requirers (auth before ecommerce/crm)", () => {
    const plan = planComposition(empty(), [ECOMMERCE, CRM, AUTH]); // deliberately out of order
    const idx = (n: string) => plan.order.findIndex((m) => m.name === n);
    expect(plan.ok).toBe(true);
    expect(idx("auth")).toBe(0); // auth provides User → must come first
    expect(idx("auth")).toBeLessThan(idx("ecommerce"));
    expect(idx("auth")).toBeLessThan(idx("crm"));
  });
  test("a requirement nothing provides is reported as unmet (not silently dropped)", () => {
    const plan = planComposition(empty(), [ECOMMERCE]); // ecommerce requires User, but auth isn't selected
    expect(plan.ok).toBe(false);
    expect(plan.unmet).toEqual([{ module: "ecommerce", requires: "User" }]);
  });
  test("a requirement already satisfied by the BASE needs no provider module", () => {
    const withUser = empty();
    withUser.components!.schemas!.User = { type: "object" };
    const plan = planComposition(withUser, [ECOMMERCE]);
    expect(plan.ok).toBe(true);
    expect(plan.order.map((m) => m.name)).toEqual(["ecommerce"]);
  });
  test("a require-cycle between modules is reported (never loops)", () => {
    const a: SulukModule = { name: "a", version: "1", provides: ["A"], requires: ["B"], schemas: { A: { type: "object" } } };
    const b: SulukModule = { name: "b", version: "1", provides: ["B"], requires: ["A"], schemas: { B: { type: "object" } } };
    const plan = planComposition(empty(), [a, b]);
    expect(plan.ok).toBe(false);
    expect(plan.unresolved.sort()).toEqual(["a", "b"]);
  });
  test("a module that requires its OWN provides is unmet (not mislabeled cyclic)", () => {
    const selfish: SulukModule = { name: "selfish", version: "1", provides: ["X"], requires: ["X"], schemas: { X: { type: "object" } } };
    const plan = planComposition(empty(), [selfish]);
    expect(plan.ok).toBe(false);
    expect(plan.unmet).toEqual([{ module: "selfish", requires: "X" }]);
    expect(plan.unresolved).toHaveLength(0); // it's unmet, not a cycle
  });
  test("ok matches what install will do — a provider collision is REFUSED at plan time", () => {
    const p1: SulukModule = { name: "p1", version: "1", provides: ["Product"], schemas: { Product: { type: "object" } } };
    const p2: SulukModule = { name: "p2", version: "1", provides: ["Product"], schemas: { Product: { type: "object" } } };
    const plan = planComposition(empty(), [p1, p2]);
    expect(plan.ok).toBe(false); // name-only ordering would say true; we model the collision installModule refuses
    expect(plan.collisions.some((c) => c.includes('"Product"'))).toBe(true);
    expect(composeModules(empty(), [p1, p2]).ok).toBe(false); // and it really does refuse
  });
  test("the same module selected twice is a collision", () => {
    expect(planComposition(empty(), [AUTH, AUTH]).collisions.some((c) => c.includes("selected more than once"))).toBe(true);
  });
});

describe("composeModules — assemble a platform in one step", () => {
  test("composes auth + ecommerce + crm from empty into a working contract", () => {
    const r = composeModules(empty(), [ECOMMERCE, CRM, AUTH]);
    expect(r.ok).toBe(true);
    expect(r.steps.every((s) => s.installed)).toBe(true);
    const entities = Object.keys(r.doc.components!.schemas!).sort();
    expect(entities).toEqual(["Contact", "Deal", "Order", "Product", "User"]);
    // the cross-module references resolved: Order/Deal $ref the User auth provided
    expect(JSON.stringify(r.doc.components!.schemas!.Order)).toContain("#/components/schemas/User");
  });
  test("an incomplete plan composes what it can and reports ok:false", () => {
    const r = composeModules(empty(), [ECOMMERCE]); // missing auth → User unmet
    expect(r.ok).toBe(false);
    expect(r.steps).toHaveLength(0); // nothing was orderable without User
    expect(r.plan.unmet[0].requires).toBe("User");
  });
});

describe("stack templates (L2)", () => {
  test("every template resolves to real modules (nothing missing) and composes cleanly", () => {
    for (const t of STACK_TEMPLATES) {
      const { modules, missing } = resolveTemplate(t, FIRST_PARTY_REGISTRY);
      expect(missing).toEqual([]); // every name resolved
      expect(modules.length).toBe(t.modules.length);
      expect(composeModules(empty(), modules).ok).toBe(true);
    }
  });
  test("resolveTemplate REPORTS an unresolvable name instead of silently dropping it", () => {
    const { modules, missing } = resolveTemplate({ name: "broken", description: "", modules: ["auth", "does-not-exist"] });
    expect(modules.map((m) => m.name)).toEqual(["auth"]);
    expect(missing).toEqual(["does-not-exist"]);
  });
});
