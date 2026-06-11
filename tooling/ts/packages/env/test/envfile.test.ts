import { test, expect, describe } from "bun:test";
import { keygen, isEncrypted } from "../src/crypto";
import { encryptContent, decryptContent, resolveEnv, parseEnv, PUBLIC_KEY_NAME, PRIVATE_KEY_NAME } from "../src/envfile";

const SAMPLE = `# my app config
export BASE_URL=http://localhost:3000

STRIPE_SECRET_KEY=sk_live_super_secret   # the money key
GREETING="hello world"
EMPTY=
`;

describe("@suluk/env file model — encrypt/decrypt .env content, preserving structure", () => {
  test("encryptContent encrypts plaintext values, preserves comments/blanks, injects the public key", async () => {
    const { publicKey } = keygen();
    const out = await encryptContent(SAMPLE, publicKey);
    expect(out).toContain("# my app config");          // comment preserved
    expect(out).toContain(`${PUBLIC_KEY_NAME}=`);       // public key injected
    expect(out).toContain("export BASE_URL=");          // export prefix preserved
    const rec = parseEnv(out);
    expect(isEncrypted(rec.STRIPE_SECRET_KEY)).toBe(true);
    expect(isEncrypted(rec.GREETING)).toBe(true);
    expect(rec.STRIPE_SECRET_KEY).not.toContain("sk_live_super_secret"); // secret is gone from disk
    expect(rec.EMPTY).toBe("");                          // empty values are left alone
  });

  test("round-trip: encrypt then resolve with the private key recovers every value, minus the key vars", async () => {
    const { publicKey, privateKey } = keygen();
    const enc = await encryptContent(SAMPLE, publicKey);
    const resolved = await resolveEnv(enc, privateKey);
    expect(resolved.BASE_URL).toBe("http://localhost:3000");
    expect(resolved.STRIPE_SECRET_KEY).toBe("sk_live_super_secret"); // inline comment stripped on parse
    expect(resolved.GREETING).toBe("hello world");
    expect(resolved[PUBLIC_KEY_NAME]).toBeUndefined();   // key vars never leak into the resolved env
    expect(resolved[PRIVATE_KEY_NAME]).toBeUndefined();
  });

  test("re-encrypting is idempotent for already-encrypted values (so you can add one var safely)", async () => {
    const { publicKey, privateKey } = keygen();
    const once = await encryptContent(SAMPLE, publicKey);
    const token = parseEnv(once).STRIPE_SECRET_KEY;
    const twice = await encryptContent(once, publicKey);  // encrypt again with only the public key
    expect(parseEnv(twice).STRIPE_SECRET_KEY).toBe(token); // unchanged — not double-encrypted
    expect((await resolveEnv(twice, privateKey)).STRIPE_SECRET_KEY).toBe("sk_live_super_secret");
  });

  test("skipPlain keeps chosen non-secrets readable", async () => {
    const { publicKey } = keygen();
    const out = await encryptContent(SAMPLE, publicKey, { skipPlain: ["BASE_URL"] });
    expect(isEncrypted(parseEnv(out).BASE_URL)).toBe(false);
    expect(parseEnv(out).BASE_URL).toBe("http://localhost:3000");
  });

  test("decryptContent reproduces a readable plaintext file", async () => {
    const { publicKey, privateKey } = keygen();
    const enc = await encryptContent(SAMPLE, publicKey);
    const dec = await decryptContent(enc, privateKey);
    expect(dec).toContain('STRIPE_SECRET_KEY="sk_live_super_secret"');
    expect(dec).toContain("# my app config");
  });

  test("resolveEnv throws when an encrypted value has no private key", async () => {
    const { publicKey } = keygen();
    const enc = await encryptContent(SAMPLE, publicKey);
    await expect(resolveEnv(enc)).rejects.toThrow("no private key");
  });
});
