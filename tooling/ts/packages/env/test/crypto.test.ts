import { test, expect, describe } from "bun:test";
import { keygen, encrypt, decrypt, isEncrypted, publicFromPrivate, SCHEME } from "../src/crypto";

describe("@suluk/env crypto — ML-KEM-768 + AES-256-GCM", () => {
  test("keygen produces scheme-tagged keys of the right size", () => {
    const { publicKey, privateKey } = keygen();
    expect(publicKey.startsWith(`${SCHEME}:`)).toBe(true);
    expect(privateKey.startsWith(`${SCHEME}:`)).toBe(true);
    expect(publicKey).not.toBe(privateKey);
  });

  test("round-trip: a value encrypted to the public key decrypts with the private key", async () => {
    const { publicKey, privateKey } = keygen();
    const secret = "sk_live_abc123_$$_unicode_é_🔐";
    const token = await encrypt(publicKey, secret);
    expect(isEncrypted(token)).toBe(true);
    expect(token).toContain(`encrypted:${SCHEME}:`);
    expect(token).not.toContain(secret); // ciphertext doesn't leak the plaintext
    expect(await decrypt(privateKey, token)).toBe(secret);
  });

  test("each encryption is unique (fresh KEM encapsulation + IV) but both decrypt", async () => {
    const { publicKey, privateKey } = keygen();
    const a = await encrypt(publicKey, "same");
    const b = await encrypt(publicKey, "same");
    expect(a).not.toBe(b); // non-deterministic — no ciphertext correlation
    expect(await decrypt(privateKey, a)).toBe("same");
    expect(await decrypt(privateKey, b)).toBe("same");
  });

  test("publicFromPrivate recovers the SAME public key (so `set` works given only the secret)", async () => {
    const { publicKey, privateKey } = keygen();
    expect(publicFromPrivate(privateKey)).toBe(publicKey);
    // and a value encrypted to the derived public key still decrypts
    const token = await encrypt(publicFromPrivate(privateKey), "derived-pk-works");
    expect(await decrypt(privateKey, token)).toBe("derived-pk-works");
  });

  test("the WRONG private key cannot decrypt (GCM auth fails)", async () => {
    const a = keygen(); const b = keygen();
    const token = await encrypt(a.publicKey, "for-a-only");
    await expect(decrypt(b.privateKey, token)).rejects.toThrow();
  });

  test("a tampered ciphertext is rejected (authenticated encryption)", async () => {
    const { publicKey, privateKey } = keygen();
    const token = await encrypt(publicKey, "integrity");
    const flipped = token.slice(0, -3) + (token.endsWith("A") ? "B" : "A") + token.slice(-2);
    await expect(decrypt(privateKey, flipped)).rejects.toThrow();
  });

  test("decrypt rejects non-tokens + unknown schemes", async () => {
    const { privateKey } = keygen();
    await expect(decrypt(privateKey, "plaintext")).rejects.toThrow("not an encrypted value");
    await expect(decrypt(privateKey, "encrypted:rsa2048:abcd")).rejects.toThrow("unsupported cipher scheme");
  });
});
