import { test, expect, describe } from "bun:test";
import { AUTH, ECOMMERCE, gradeModule, moduleOperations } from "../src/index";

describe("AUTH module — Better Auth core entities (Phase 1)", () => {
  test("provides User + Session/Account/Verification (the security-tab + cascade targets)", () => {
    expect(AUTH.provides).toEqual(["User", "Session", "Account", "Verification"]);
  });

  test("User gains emailVerified + image (Better Auth core fields)", () => {
    const user = AUTH.schemas.User as { properties: Record<string, unknown> };
    expect(user.properties.emailVerified).toEqual({ type: "boolean" });
    expect(user.properties.image).toEqual({ type: "string" });
  });

  test("Session is list/revoke-able (the security tab) and references the user by id", () => {
    expect(moduleOperations(AUTH)).toEqual(expect.arrayContaining(["listSession", "deleteSession"]));
    const session = AUTH.schemas.Session as { properties: Record<string, unknown>; required: string[] };
    expect(session.properties.userId).toEqual({ type: "integer" });
    expect(session.required).toContain("token");
  });

  test("still grades A — every operation (incl. the new entities) declares cost", () => {
    expect(gradeModule(AUTH).grade).toBe("A");
  });
});

describe("ECOMMERCE module — fleshed storefront (Phase 1)", () => {
  test("provides the full storefront surface", () => {
    expect(ECOMMERCE.provides).toEqual(["Product", "Variant", "Order", "Cart", "Discount", "Review", "Wishlist"]);
  });

  test("Discount mirrors @suluk/stripe's math shape (type/value/minSubtotalCents)", () => {
    const d = ECOMMERCE.schemas.Discount as { properties: Record<string, { enum?: string[] }> };
    expect(d.properties.type.enum).toEqual(["percent", "fixed"]);
    expect(d.properties.minSubtotalCents).toBeDefined();
  });

  test("the new entities reference the host's User (compose-time requires)", () => {
    expect(ECOMMERCE.requires).toContain("User");
    // Cart/Review/Wishlist carry a userId FK to the auth-provided User
    expect((ECOMMERCE.schemas.Wishlist as { required: string[] }).required).toContain("userId");
  });

  test("still grades A — checkout + every CRUD op declares cost", () => {
    expect(gradeModule(ECOMMERCE).grade).toBe("A");
  });
});
