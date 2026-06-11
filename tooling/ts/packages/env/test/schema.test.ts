import { test, expect, describe } from "bun:test";
import { defineEnv } from "../src/schema";
import { keygen, encrypt } from "../src/crypto";

const env = defineEnv({
  BASE_URL: { default: "http://localhost:3000", surfaces: ["local", "cloudflare", "preview"] },
  STRIPE_SECRET_KEY: { secret: true, required: true, surfaces: ["local", "cloudflare"], description: "Stripe API key" },
  RESEND_API_KEY: { secret: true, surfaces: ["cloudflare"] },
  ANALYTICS_ID: {},
});

describe("@suluk/env defineEnv — one declaration → typed access + per-surface manifest + health", () => {
  test("parse applies defaults + throws on a missing required var", () => {
    expect(() => env.parse({})).toThrow("missing required config: STRIPE_SECRET_KEY");
    const parsed = env.parse({ STRIPE_SECRET_KEY: "sk_test_x" });
    expect(parsed.BASE_URL).toBe("http://localhost:3000"); // default applied
    expect(parsed.STRIPE_SECRET_KEY).toBe("sk_test_x");
    const _checkType: string = parsed.BASE_URL; void _checkType; // required + default keys are non-optional strings
  });

  test("forSurface projects which vars each surface needs (deploy + vscode read this)", () => {
    expect(env.forSurface("cloudflare").sort()).toEqual(["ANALYTICS_ID", "BASE_URL", "RESEND_API_KEY", "STRIPE_SECRET_KEY"]);
    expect(env.forSurface("preview")).toContain("BASE_URL");
    expect(env.forSurface("preview")).not.toContain("RESEND_API_KEY");
  });

  test("manifest is a config-health view: ok / missing / plaintext-secret / empty + encrypted-at-rest", async () => {
    const { publicKey } = keygen();
    const raw = {
      BASE_URL: "http://localhost:3000",
      STRIPE_SECRET_KEY: await encrypt(publicKey, "sk_live_x"), // a secret, encrypted at rest → ok
      RESEND_API_KEY: "re_plaintext_oops",                      // a secret sitting in plaintext → flagged
      // ANALYTICS_ID absent
    };
    const m = Object.fromEntries(env.manifest(raw).map((e) => [e.name, e]));
    expect(m.STRIPE_SECRET_KEY.status).toBe("ok");
    expect(m.STRIPE_SECRET_KEY.encrypted).toBe(true);
    expect(m.RESEND_API_KEY.status).toBe("plaintext-secret"); // the value-add: catch a secret you forgot to encrypt
    expect(m.RESEND_API_KEY.encrypted).toBe(false);
    expect(m.ANALYTICS_ID.status).toBe("empty");              // present:false, not required
    expect(m.BASE_URL.status).toBe("ok");
  });

  test("a missing REQUIRED var surfaces as 'missing' in the manifest (not just a parse throw)", () => {
    const m = Object.fromEntries(env.manifest({}).map((e) => [e.name, e]));
    expect(m.STRIPE_SECRET_KEY.status).toBe("missing");
    expect(m.BASE_URL.status).toBe("ok"); // has a default → considered present
  });
});
