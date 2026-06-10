import { test, expect, describe } from "bun:test";
import { PROVIDER_CATALOG, providerFacets, readProviders, swapProvider, installModule, ECOMMERCE, BILLING } from "../src/index";
import type { OpenAPIv4Document } from "@suluk/core";

describe("PROVIDER_CATALOG", () => {
  test("each facet lists distinct implementations carrying the right facet", () => {
    for (const facet of providerFacets()) {
      const impls = PROVIDER_CATALOG[facet];
      expect(impls.length).toBeGreaterThanOrEqual(2);
      expect(impls.every((i) => i.facet === facet)).toBe(true);
      expect(new Set(impls.map((i) => i.id)).size).toBe(impls.length);
    }
  });
  test("the first-party payments + auth bindings name their @suluk package", () => {
    expect(PROVIDER_CATALOG.payments.find((i) => i.id === "stripe")?.pkg).toBe("@suluk/stripe");
    expect(PROVIDER_CATALOG.auth.find((i) => i.id === "better-auth")?.pkg).toBe("@suluk/better-auth");
  });
});

describe("readProviders", () => {
  test("installing a module records its providerSlots, readable with alternatives", () => {
    const host: OpenAPIv4Document = { openapi: "4.0.0-candidate", info: { title: "H", version: "1.0.0" }, paths: {}, components: { schemas: { User: { type: "object" } } } };
    const r = installModule(host, ECOMMERCE);
    const bindings = readProviders(r.doc);
    const payments = bindings.find((b) => b.facet === "payments")!;
    expect(payments.impl).toBe("stripe");
    expect(payments.known).toBe(true);
    expect(payments.alternatives.map((a) => a.id)).toEqual(["paddle", "lemonsqueezy"]);
  });
  test("a doc with no provider slots reads as empty", () => {
    expect(readProviders({ openapi: "4.0.0-candidate", info: { title: "X", version: "1.0.0" }, paths: {} })).toEqual([]);
  });
  test("an unknown binding is reported as not-known (a custom provider)", () => {
    const b = readProviders({ "x-suluk-providers": { payments: "homegrown" } })[0];
    expect(b.known).toBe(false);
    expect(b.title).toBe("homegrown");
  });
  test("a mangled x-suluk-providers (string/array) reads as empty, not fabricated rows", () => {
    expect(readProviders({ "x-suluk-providers": "stripe" })).toEqual([]);
    expect(readProviders({ "x-suluk-providers": ["stripe", "resend"] })).toEqual([]);
  });
  test("a deliberate swap survives installing a SECOND module (existing binding wins)", () => {
    const host: OpenAPIv4Document = { openapi: "4.0.0-candidate", info: { title: "H", version: "1.0.0" }, paths: {}, components: { schemas: { User: { type: "object" } } } };
    const withEcom = installModule(host, ECOMMERCE).doc; // payments → stripe
    const swapped = swapProvider(withEcom, "payments", "paddle").doc; // user swaps to paddle
    const withBilling = installModule(swapped as OpenAPIv4Document, BILLING).doc; // BILLING also defaults payments→stripe
    expect(readProviders(withBilling).find((b) => b.facet === "payments")!.impl).toBe("paddle"); // NOT clobbered
  });
});

describe("swapProvider", () => {
  const base = { openapi: "4.0.0-candidate", info: { title: "X", version: "1.0.0" }, paths: {}, "x-suluk-providers": { payments: "stripe" } };
  test("rebinds a slot to another impl of the same interface, without mutating the input", () => {
    const r = swapProvider(base, "payments", "paddle");
    expect(r.error).toBeUndefined();
    expect((r.doc as unknown as Record<string, Record<string, string>>)["x-suluk-providers"].payments).toBe("paddle");
    expect(base["x-suluk-providers"].payments).toBe("stripe"); // input untouched
  });
  test("refuses an unknown facet or an unknown implementation", () => {
    expect(swapProvider(base, "telepathy", "x").error).toContain("unknown provider facet");
    expect(swapProvider(base, "payments", "venmo").error).toContain("not a known payments provider");
  });
  test("can add a NEW slot binding for a facet the doc didn't have", () => {
    const r = swapProvider(base, "email", "resend");
    expect((r.doc as unknown as Record<string, Record<string, string>>)["x-suluk-providers"]).toEqual({ payments: "stripe", email: "resend" });
  });
});
