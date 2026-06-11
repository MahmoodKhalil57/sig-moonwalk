import { test, expect, describe, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encryptEnvFile, decryptEnvFileToString, setVar, readPrivateKey, readPublicKey, rawEnvRecord, type FileOpts } from "../src/node";
import { isEncrypted } from "../src/crypto";
import { PRIVATE_KEY_NAME } from "../src/envfile";

const dir = mkdtempSync(join(tmpdir(), "suluk-env-"));
const o: FileOpts = { envPath: join(dir, ".env"), keysPath: join(dir, ".env.keys") };
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("@suluk/env node — fs helpers (the CLI's engine)", () => {
  test("encryptEnvFile encrypts in place + creates the gitignored .env.keys", async () => {
    writeFileSync(o.envPath!, "BASE_URL=http://x\nSTRIPE_SECRET_KEY=sk_live_zzz\n");
    const { publicKey } = await encryptEnvFile({ ...o, skipPlain: ["BASE_URL"] });
    expect(publicKey.startsWith("mlkem768:")).toBe(true);
    expect(existsSync(o.keysPath!)).toBe(true);                         // private key file created
    const raw = rawEnvRecord(o);
    expect(isEncrypted(raw.STRIPE_SECRET_KEY)).toBe(true);              // secret encrypted at rest
    expect(raw.BASE_URL).toBe("http://x");                              // skipped → plaintext
    expect(readFileSync(o.keysPath!, "utf8")).toContain(PRIVATE_KEY_NAME);
  });

  test("setVar adds an encrypted variable, get/decrypt round-trips it", async () => {
    await setVar("RESEND_API_KEY", "re_secret_42", o);
    expect(isEncrypted(rawEnvRecord(o).RESEND_API_KEY)).toBe(true);
    const plain = await decryptEnvFileToString(o);
    expect(plain).toContain('RESEND_API_KEY="re_secret_42"');
    expect(plain).toContain('STRIPE_SECRET_KEY="sk_live_zzz"');
  });

  test("readPrivateKey / readPublicKey resolve from the files", () => {
    expect(readPrivateKey(o)!.startsWith("mlkem768:")).toBe(true);
    expect(readPublicKey(o)!.startsWith("mlkem768:")).toBe(true);
  });

  test("a fresh teammate with ONLY the public key can add a secret (no private key needed)", async () => {
    // simulate: a clone that has .env (with the public key) but NO .env.keys
    const env2 = join(dir, "clone.env");
    writeFileSync(env2, readFileSync(o.envPath!, "utf8"));
    const cloneOpts: FileOpts = { envPath: env2, keysPath: join(dir, "nonexistent.keys") };
    await setVar("NEW_SECRET", "added-by-teammate", cloneOpts); // uses the public key embedded in clone.env
    expect(isEncrypted(rawEnvRecord(cloneOpts).NEW_SECRET)).toBe(true);
    // and the ORIGINAL private key can decrypt what the teammate added
    const plain = await decryptEnvFileToString({ ...cloneOpts, keysPath: o.keysPath });
    expect(plain).toContain('NEW_SECRET="added-by-teammate"');
  });
});
