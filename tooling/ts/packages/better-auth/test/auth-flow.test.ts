import { test, expect, describe } from "bun:test";
import { isSafeRelativePath, resolveRedirectTo, withRedirectTo, emailVerificationConfig } from "../src/auth-flow";

describe("redirect preservation — open-redirect-safe", () => {
  test("accepts same-origin relative paths, rejects everything that could escape origin", () => {
    expect(isSafeRelativePath("/account")).toBe(true);
    expect(isSafeRelativePath("/products?x=1#h")).toBe(true);
    for (const bad of [null, undefined, "", "account", "//evil.com", "https://evil.com", "http://evil.com", "/\\evil.com", "javascript://%0aalert(1)", "/a\\b"]) {
      expect(isSafeRelativePath(bad as any), `must reject: ${bad}`).toBe(false);
    }
  });
  test("resolveRedirectTo reads ?redirectTo, falls back when absent/unsafe", () => {
    expect(resolveRedirectTo("?redirectTo=/dashboard", "/account")).toBe("/dashboard");
    expect(resolveRedirectTo("redirectTo=%2Fcart", "/account")).toBe("/cart"); // decoded by URLSearchParams
    expect(resolveRedirectTo("?foo=1", "/account")).toBe("/account"); // absent → fallback
    expect(resolveRedirectTo("?redirectTo=https://evil.com", "/account")).toBe("/account"); // unsafe → fallback
    expect(resolveRedirectTo(new URLSearchParams("redirectTo=/x"))).toBe("/x");
  });
  test("withRedirectTo appends a guarded redirectTo (and drops an unsafe one)", () => {
    expect(withRedirectTo("/login", "/checkout")).toBe("/login?redirectTo=%2Fcheckout");
    expect(withRedirectTo("/login?x=1", "/cart")).toBe("/login?x=1&redirectTo=%2Fcart");
    expect(withRedirectTo("/login", "//evil.com")).toBe("/login"); // unsafe dropped
  });
});

describe("emailVerificationConfig — frictionless defaults", () => {
  test("defaults to verify-on-sign-up + auto-sign-in, threads the sender", () => {
    const send = () => {};
    const cfg = emailVerificationConfig({ sendVerificationEmail: send });
    expect(cfg.sendOnSignUp).toBe(true);
    expect(cfg.autoSignInAfterVerification).toBe(true);
    expect(cfg.sendVerificationEmail).toBe(send);
  });
  test("overrides are honored", () => {
    const cfg = emailVerificationConfig({ sendVerificationEmail: () => {}, autoSignIn: false, sendOnSignUp: false });
    expect(cfg.autoSignInAfterVerification).toBe(false);
    expect(cfg.sendOnSignUp).toBe(false);
  });
});
