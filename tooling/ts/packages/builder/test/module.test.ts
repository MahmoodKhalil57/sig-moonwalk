import { test, expect, describe } from "bun:test";
import type { OpenAPIv4Document, PathItem } from "@suluk/core";
import { installModule, namespaceModule, type SulukModule } from "../src/module";
import { ECOMMERCE } from "../src/modules/ecommerce";

// A minimal host app that already owns `User` (so ecommerce's `requires: User` is satisfied).
const host = (): OpenAPIv4Document => ({
  openapi: "4.0.0-candidate",
  info: { title: "Host", version: "1.0.0" },
  paths: {
    user: { requests: { listUser: { method: "get", responses: { ok: { status: 200, contentType: "application/json", contentSchema: { $ref: "#/components/schemas/User" } } } } } },
  } as Record<string, PathItem>,
  components: { schemas: { User: { type: "object", required: ["email"], properties: { id: { type: "integer" }, email: { type: "string" } } } } },
});

describe("installModule — clean install", () => {
  const r = installModule(host(), ECOMMERCE);
  test("installs and reports what it added", () => {
    expect(r.installed).toBe(true);
    expect(r.conflicts).toHaveLength(0);
    expect(r.added.schemas).toEqual(["Product", "Variant", "Order", "Cart", "Discount", "Review", "Wishlist"]);
    expect(r.added.operations).toContain("listProduct");
    expect(r.added.operations).toContain("createOrder");
    expect(r.added.operations).toContain("checkoutOrder"); // the explicit (non-CRUD) op
  });
  test("merges schemas (incl. the cross-module $ref to User) without losing the host's", () => {
    const s = r.doc.components!.schemas!;
    expect(Object.keys(s).sort()).toEqual(["Cart", "Discount", "Order", "Product", "Review", "User", "Variant", "Wishlist"]);
    expect(JSON.stringify((s.Order as Record<string, unknown>))).toContain("#/components/schemas/User");
  });
  test("merges the CRUD + checkout paths alongside the host's", () => {
    const paths = r.doc.paths as Record<string, PathItem>;
    expect(paths.user).toBeDefined(); // host preserved
    expect(paths.product.requests.listProduct).toBeDefined();
    expect(paths["order/{id}/checkout"].requests.checkoutOrder.method).toBe("post");
  });
  test("applies x-suluk-cost to the right operations", () => {
    const paths = r.doc.paths as Record<string, PathItem>;
    const create = paths.order.requests.createOrder as unknown as Record<string, unknown>;
    expect((create["x-suluk-cost"] as { estimateMicroUsd: number }).estimateMicroUsd).toBe(140);
  });
  test("does NOT mutate the caller's base document", () => {
    const base = host();
    installModule(base, ECOMMERCE);
    expect(Object.keys(base.components!.schemas!)).toEqual(["User"]); // untouched
  });
});

describe("installModule — refuses (the discipline)", () => {
  test("unmet `requires` is refused, base unchanged", () => {
    const noUser: OpenAPIv4Document = { openapi: "4.0.0-candidate", info: { title: "X", version: "1.0.0" }, paths: {}, components: { schemas: {} } };
    const r = installModule(noUser, ECOMMERCE);
    expect(r.installed).toBe(false);
    expect(r.conflicts.some((c) => c.includes('requires "User"'))).toBe(true);
    expect(r.doc).toBe(noUser); // returned unchanged
  });
  test("an entity-name collision is refused", () => {
    const withProduct = host();
    withProduct.components!.schemas!.Product = { type: "object" };
    const r = installModule(withProduct, ECOMMERCE);
    expect(r.installed).toBe(false);
    expect(r.conflicts.some((c) => c.includes('"Product" already exists'))).toBe(true);
  });
  test("an operation-name collision is refused", () => {
    const withListProduct = host();
    (withListProduct.paths as Record<string, PathItem>).p = { requests: { listProduct: { method: "get", responses: { ok: { status: 200 } } } } };
    const r = installModule(withListProduct, ECOMMERCE);
    expect(r.installed).toBe(false);
    expect(r.conflicts.some((c) => c.includes('operation "listProduct"'))).toBe(true);
  });
});

describe("installModule — collision discipline (adversarial regressions)", () => {
  test("a path-key collision vs base is refused (no silent op-merge into an existing path)", () => {
    const withProductPath = host();
    // host owns a custom `product` collection endpoint (different op name) but NO Product schema/op
    (withProductPath.paths as Record<string, PathItem>).product = { requests: { searchProducts: { method: "get", responses: { ok: { status: 200 } } } } };
    const r = installModule(withProductPath, ECOMMERCE);
    expect(r.installed).toBe(false);
    expect(r.conflicts.some((c) => c.includes('path "product" already exists'))).toBe(true);
  });
  test("a self-collision (auto-CRUD op name == an explicit op name) is refused", () => {
    const selfClash: SulukModule = {
      name: "x", version: "0.0.0", provides: ["Thing"],
      schemas: { Thing: { type: "object", properties: { id: { type: "integer" } } } },
      paths: { "thing/extra": { requests: { listThing: { method: "get", responses: { ok: { status: 200 } } } } } }, // listThing also auto-generated
    };
    const r = installModule(host(), selfClash);
    expect(r.installed).toBe(false);
    expect(r.conflicts.some((c) => c.includes('"listThing"') && c.includes("more than once"))).toBe(true);
  });
  test("two provided entities mapping to one resource are refused", () => {
    const clash: SulukModule = { name: "x", version: "0.0.0", provides: ["Order", "order"], schemas: { Order: { type: "object" }, order: { type: "object" } } };
    const r = installModule(host(), clash);
    expect(r.installed).toBe(false);
    expect(r.conflicts.some((c) => c.includes("same path resource"))).toBe(true);
  });
  test("module cost is NOT stamped onto a host operation that happens to share a name", () => {
    // host has its OWN operation named "listProduct"; the module's cost map keys "listProduct" too
    const withHostOp = host();
    (withHostOp.paths as Record<string, PathItem>).catalog = { requests: { reportProduct: { method: "get", responses: { ok: { status: 200 } } } } };
    const mod: SulukModule = {
      name: "x", version: "0.0.0", provides: ["Widget"],
      schemas: { Widget: { type: "object", properties: { id: { type: "integer" } } } },
      cost: { reportProduct: { components: [{ source: "db-read", basis: "per-call", microUsd: 99 }], estimateMicroUsd: 99 } }, // names a HOST op
    };
    const r = installModule(withHostOp, mod);
    expect(r.installed).toBe(true);
    const hostOp = (r.doc.paths as Record<string, PathItem>).catalog.requests.reportProduct as unknown as Record<string, unknown>;
    expect(hostOp["x-suluk-cost"]).toBeUndefined(); // the host op was NOT touched
  });
});

describe("namespaceModule — resolves a collision", () => {
  test("prefixes owned entities + rewrites internal $refs, leaving `requires` intact", () => {
    const ns = namespaceModule(ECOMMERCE, "Shop");
    expect(ns.provides).toEqual(["ShopProduct", "ShopVariant", "ShopOrder", "ShopCart", "ShopDiscount", "ShopReview", "ShopWishlist"]);
    expect(Object.keys(ns.schemas).sort()).toEqual(["ShopCart", "ShopDiscount", "ShopOrder", "ShopProduct", "ShopReview", "ShopVariant", "ShopWishlist"]);
    // the Order→User reference is a REQUIRE, so it must NOT be prefixed
    expect(JSON.stringify(ns.schemas.ShopOrder)).toContain("#/components/schemas/User");
    // cost keys for auto-CRUD ops are remapped to the namespaced entity
    expect(ns.cost!.listShopProduct).toBeDefined();
  });
  test("substring-overlapping entity names do NOT double-prefix (cost keys stay synced to ops)", () => {
    const mod: SulukModule = {
      name: "m", version: "0.0.0", provides: ["Order", "OrderLine"],
      schemas: { Order: { type: "object", properties: { id: { type: "integer" } } }, OrderLine: { type: "object", properties: { id: { type: "integer" } } } },
      cost: { listOrderLine: { components: [{ source: "db-read", basis: "per-call", microUsd: 5 }], estimateMicroUsd: 5 } },
    };
    const ns = namespaceModule(mod, "Shop");
    expect(ns.provides).toEqual(["ShopOrder", "ShopOrderLine"]); // single prefix, not ShopShop…
    expect(ns.cost!.listShopOrderLine).toBeDefined();
    expect(Object.keys(ns.cost!).every((k) => !k.includes("ShopShop"))).toBe(true);
    // and after install, the namespaced OrderLine op actually carries its cost
    const r = installModule(host(), ns);
    expect(r.installed).toBe(true);
    const op = (r.doc.paths as Record<string, PathItem>).shopOrderLine.requests.listShopOrderLine as unknown as Record<string, unknown>;
    expect((op["x-suluk-cost"] as { estimateMicroUsd: number }).estimateMicroUsd).toBe(5);
  });
  test("the namespaced module installs cleanly alongside the original's names", () => {
    const withEcom = installModule(host(), ECOMMERCE).doc; // already has Product/Order
    const r = installModule(withEcom, namespaceModule(ECOMMERCE, "Shop"));
    expect(r.installed).toBe(true);
    expect(Object.keys(r.doc.components!.schemas!).sort()).toEqual(["Cart", "Discount", "Order", "Product", "Review", "ShopCart", "ShopDiscount", "ShopOrder", "ShopProduct", "ShopReview", "ShopVariant", "ShopWishlist", "User", "Variant", "Wishlist"]);
  });
});
