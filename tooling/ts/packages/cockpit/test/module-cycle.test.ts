import { test, expect, describe } from "bun:test";
import type { OpenAPIv4Document, PathItem } from "@suluk/core";
import { installModule, ECOMMERCE } from "@suluk/builder";
import { buildCycle } from "../src/cycle";

// The whole point of a module being a contract fragment: after install, EVERY cockpit layer re-projects to
// include the new entities/operations/cost — with no change to the cockpit. This test is the witness.
const host = (): OpenAPIv4Document => ({
  openapi: "4.0.0-candidate",
  info: { title: "Host", version: "1.0.0" },
  paths: { user: { requests: { listUser: { method: "get", responses: { ok: { status: 200 } } } } } } as Record<string, PathItem>,
  components: { schemas: { User: { type: "object", properties: { id: { type: "integer" }, email: { type: "string" } } } } },
});

describe("installModule → the cockpit cycle lights up", () => {
  const before = buildCycle(host());
  const installed = installModule(host(), ECOMMERCE);
  const after = buildCycle(installed.doc);
  const layer = (m: typeof after, id: string) => m.layers.find((l) => l.id === id)!;

  test("the host alone has only User", () => {
    expect(layer(before, "data").items.map((i) => i.label)).toEqual(["User"]);
  });
  test("after install, the data layer gains Product + Order", () => {
    const entities = layer(after, "data").items.map((i) => i.label).sort();
    expect(entities).toEqual(["Order", "Product", "User"]);
  });
  test("the contract layer gains the module's operations (incl. checkout)", () => {
    const ops = layer(after, "contract").items.map((i) => i.label);
    expect(ops).toContain("listProduct");
    expect(ops).toContain("createOrder");
    expect(ops).toContain("checkoutOrder");
  });
  test("the cost layer prices the module's operations", () => {
    const costed = layer(after, "cost").items.map((i) => i.label);
    expect(costed).toContain("createOrder");
    expect(costed).toContain("checkoutOrder");
  });
  test("the UI layer derives a form/table for the new entities", () => {
    const ui = layer(after, "ui").items.map((i) => i.label).sort();
    expect(ui).toEqual(["Order", "Product", "User"]);
  });
  test("the document still validates against the v4 meta-schema after the merge", () => {
    expect(after.valid).toBe(true);
  });
  test("the Providers layer lights up with the module's provider slot (payments→stripe)", () => {
    const providers = layer(after, "providers");
    expect(providers.summary).toContain("payments→stripe");
    expect(providers.items.map((i) => i.label)).toContain("payments");
    expect(layer(before, "providers").summary).toBe("none"); // the host had no provider slots
  });
});
