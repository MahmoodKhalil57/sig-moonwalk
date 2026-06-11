# @suluk/env

**Config + secrets as a single source of truth — made post-quantum-safe.**

Declare each variable **once**, encrypt the secret **values** with post-quantum crypto so the `.env`
is safe to commit to git and share over public channels, and project that one declaration into **every
surface**: local dev, Cloudflare Workers, preview, a teammate's machine, the VS Code extension, the
admin panel.

It's [dotenvx](https://github.com/dotenvx/dotenvx)'s commit-safely model (a public key encrypts, a
private key decrypts, the encrypted `.env` is committable), with two differences:

1. **Post-quantum.** Values are sealed with **ML-KEM-768** (FIPS-203 key-encapsulation) + **AES-256-GCM**,
   not elliptic-curve ECIES. Quantum-safe, and via [`@noble/post-quantum`](https://github.com/paulmillr/noble-post-quantum)
   it's pure JS — it runs the same in Node, Bun, the browser, **and a Cloudflare Worker**.
2. **Suluk-native.** `defineEnv` makes config a *declared* thing — typed access, a per-surface manifest,
   and a config-**health** view — the same "declare once, project everywhere" idea as the entity registry,
   applied to configuration.

## Why it's safe to commit

Each value is encrypted to a **public key** (embedded in the `.env` as `SULUK_PUBLIC_KEY`). Only the
**private key** (`SULUK_PRIVATE_KEY`, kept in a gitignored `.env.keys` or a secret binding) can decrypt.
So:

- the encrypted `.env` can live in git and be shared in a Slack message — the ciphertext reveals nothing;
- **anyone with just the public key can add or re-encrypt a variable** — a teammate can add a secret
  without ever holding the decryption key;
- the private key travels out-of-band (a password manager, a CI secret, `wrangler secret put`).

## CLI

```bash
suluk-env keygen                 # ML-KEM-768 keypair → public in .env, private in .env.keys (auto-gitignored)
suluk-env set STRIPE_KEY=sk_live_…   # add/update a variable, encrypted (use --plain for non-secrets)
suluk-env encrypt --skip BASE_URL    # encrypt every plaintext value in .env in place
suluk-env ls                     # list variables (masked) + their encrypted/plaintext state
suluk-env get STRIPE_KEY         # decrypt + print one value
suluk-env decrypt                # print the whole .env decrypted (--out file to write)
suluk-env run -- bun start       # decrypt into the environment, then run a command
```

A committed `.env` ends up looking like:

```ini
SULUK_PUBLIC_KEY="mlkem768:EfIdiAi0Fy…"        # commit this — it can only encrypt
BASE_URL="http://localhost:3000"               # left plaintext (not a secret)
STRIPE_SECRET_KEY="encrypted:mlkem768:Alu+Ks…" # ciphertext — safe in git
```

## Library

The core (`@suluk/env`) is runtime-agnostic — Web Crypto + `@noble/post-quantum`, no `node:fs` — so it
imports cleanly inside a Worker. The `fs` helpers + CLI live in `@suluk/env/node`.

```ts
import { keygen, encrypt, decrypt, loadEnv } from "@suluk/env";

// decrypt a committed .env at runtime — works in Node, Bun, AND a Cloudflare Worker
await loadEnv({ content: envFileText, privateKey: env.SULUK_PRIVATE_KEY }); // → injected into process.env
```

In a Worker, ship the encrypted `.env` text in the bundle and pass the private key from a secret binding —
the **same one source of truth** decrypts on every surface.

## Single source of truth — `defineEnv`

```ts
import { defineEnv } from "@suluk/env";

export const env = defineEnv({
  BASE_URL:          { default: "http://localhost:3000", surfaces: ["local", "cloudflare", "preview"] },
  STRIPE_SECRET_KEY: { secret: true, required: true,     surfaces: ["local", "cloudflare"], description: "Stripe API key" },
  RESEND_API_KEY:    { secret: true,                     surfaces: ["cloudflare"] },
});

env.parse(process.env).STRIPE_SECRET_KEY;  // typed + validated (required vars are non-null; throws if missing)
env.forSurface("cloudflare");              // which vars to `wrangler secret put` (the deploy planner reads this)
env.manifest(rawEnvRecord());              // config HEALTH: ok | missing | plaintext-secret | empty + encrypted?
```

`manifest()` is what the **admin panel** renders and the **VS Code extension** surfaces: which keys exist,
which are encrypted at rest, which required ones are **missing**, and — the high-value check — which secrets
are sitting in **plaintext** when they should be encrypted.

## Cryptographic construction

Per value: `encapsulate(publicKey) → (kemCiphertext, sharedSecret)`; `AES-256-GCM(sharedSecret, iv, plaintext)`.
The token is `encrypted:mlkem768:` + base64(`kemCiphertext[1088] | iv[12] | aesCiphertext+tag`). A fresh KEM
encapsulation per value is what lets you add one variable with only the public key. A wrong key or a tampered
token fails the GCM authentication tag → decryption throws.

> Candidate tooling for the Suluk (OpenAPI v4) ecosystem. Apache-2.0.
