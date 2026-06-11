import { test, expect, describe } from "bun:test";
import { defineEnv } from "../src/schema";

const env = defineEnv({
  BASE_URL: { default: "http://localhost:3000" },
  STRIPE_SECRET_KEY: {
    secret: true, minLength: 20, pattern: /^sk_(test|live)_/,
    requiredInSurface: ["cloudflare", "preview"],
    forbidInSurface: [{ pattern: /^sk_test_/, surfaces: ["cloudflare"], message: "a TEST Stripe key is set in production", severity: "warning" }],
  },
  BETTER_AUTH_SECRET: { secret: true, minLength: 32, requiredInSurface: ["cloudflare"] },
});

describe("@suluk/env — validate() + assertEnv() (the fail-closed startup gate)", () => {
  test("validate: requiredInSurface is enforced only on that surface", () => {
    expect(env.validate({}, { surface: "local" }).filter((i) => i.code === "missing")).toHaveLength(0); // not required locally
    const cf = env.validate({}, { surface: "cloudflare" });
    expect(cf.filter((i) => i.code === "missing").map((i) => i.name).sort()).toEqual(["BETTER_AUTH_SECRET", "STRIPE_SECRET_KEY"]);
  });

  test("validate: minLength + pattern are checked when present", () => {
    const issues = env.validate({ STRIPE_SECRET_KEY: "sk_test_short" }, { surface: "local" });
    expect(issues.find((i) => i.code === "too-short" && i.name === "STRIPE_SECRET_KEY")).toBeDefined();
    const bad = env.validate({ STRIPE_SECRET_KEY: "definitely-not-a-stripe-key-xx" });
    expect(bad.find((i) => i.code === "pattern")).toBeDefined();
  });

  test("validate: forbidInSurface flags a test key in production (warning by default)", () => {
    const onCf = env.validate({ STRIPE_SECRET_KEY: "sk_test_" + "x".repeat(24), BETTER_AUTH_SECRET: "y".repeat(40) }, { surface: "cloudflare" });
    const w = onCf.find((i) => i.code === "forbidden-in-surface");
    expect(w).toMatchObject({ severity: "warning", name: "STRIPE_SECRET_KEY" });
    // not flagged locally (surface gating)
    expect(env.validate({ STRIPE_SECRET_KEY: "sk_test_" + "x".repeat(24) }, { surface: "local" }).find((i) => i.code === "forbidden-in-surface")).toBeUndefined();
  });

  test("assertEnv: THROWS fail-closed on an error (missing/short/pattern), with all messages", () => {
    expect(() => env.assertEnv({}, { surface: "cloudflare" })).toThrow(/required/);
    expect(() => env.assertEnv({ STRIPE_SECRET_KEY: "sk_live_x", BETTER_AUTH_SECRET: "z".repeat(40) }, { surface: "cloudflare" })).toThrow(/at least 20/); // too short
  });

  test("assertEnv: passes + returns the parsed config when valid; warnings go to onWarn, never throw", () => {
    const warns: string[] = [];
    const cfg = env.assertEnv(
      { STRIPE_SECRET_KEY: "sk_test_" + "x".repeat(24), BETTER_AUTH_SECRET: "z".repeat(40) },
      { surface: "cloudflare", onWarn: (i) => warns.push(i.name) },
    );
    expect(cfg.BASE_URL).toBe("http://localhost:3000"); // default applied + typed non-optional
    expect(cfg.STRIPE_SECRET_KEY).toContain("sk_test_");
    expect(warns).toEqual(["STRIPE_SECRET_KEY"]); // the test-key-in-prod warning fired but did not fail closed
  });

  test("assertEnv: allow[] downgrades a specific error (explicit, auditable override)", () => {
    expect(() => env.assertEnv({ BETTER_AUTH_SECRET: "z".repeat(40) }, { surface: "cloudflare" })).toThrow(/STRIPE_SECRET_KEY/);
    expect(() => env.assertEnv({ BETTER_AUTH_SECRET: "z".repeat(40) }, { surface: "cloudflare", allow: ["STRIPE_SECRET_KEY"] })).not.toThrow();
  });
});
