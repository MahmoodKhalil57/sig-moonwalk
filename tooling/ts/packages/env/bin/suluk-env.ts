#!/usr/bin/env bun
/**
 * suluk-env — the CLI for @suluk/env. Post-quantum-encrypt your .env so it's safe to commit + share.
 *
 *   suluk-env keygen                 generate a keypair (public → .env, private → .env.keys, gitignored)
 *   suluk-env set KEY=value          add/update a variable (encrypted; --plain to keep it readable)
 *   suluk-env encrypt                encrypt every plaintext value in .env in place
 *   suluk-env decrypt [--out FILE]   print (or write) the decrypted .env
 *   suluk-env get KEY                decrypt + print one value
 *   suluk-env ls                     list variables (masked) with their encrypted/plaintext state
 *   suluk-env run -- <cmd...>        decrypt into the environment, then run a command
 *
 * Global: --env <path> (default .env), --keys <path> (default .env.keys).
 */
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { keygen, decrypt, isEncrypted, publicFromPrivate } from "../src/crypto";
import { parseEnv, PUBLIC_KEY_NAME, PRIVATE_KEY_NAME } from "../src/envfile";
import { encryptEnvFile, decryptEnvFileToString, setVar, readPrivateKey, readPublicKey, ensureKeypair, loadEnvFile, type FileOpts } from "../src/node";

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const has = (name: string) => argv.includes(name);
const o: FileOpts = { envPath: flag("--env") ?? ".env", keysPath: flag("--keys") ?? ".env.keys" };
const positionals = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--env" && argv[i - 1] !== "--keys");
const cmd = positionals[0];

const c = { dim: (s: string) => `\x1b[2m${s}\x1b[0m`, green: (s: string) => `\x1b[32m${s}\x1b[0m`, yellow: (s: string) => `\x1b[33m${s}\x1b[0m`, red: (s: string) => `\x1b[31m${s}\x1b[0m`, bold: (s: string) => `\x1b[1m${s}\x1b[0m` };
const die = (msg: string): never => { console.error(c.red(`✖ ${msg}`)); process.exit(1); };
const mask = (v: string) => (v.length <= 8 ? "•".repeat(v.length) : `${v.slice(0, 3)}${"•".repeat(Math.min(12, v.length - 6))}${v.slice(-3)}`);

function ensureGitignored(path: string) {
  const gi = ".gitignore";
  const body = existsSync(gi) ? readFileSync(gi, "utf8") : "";
  if (!body.split(/\r?\n/).some((l) => l.trim() === path)) { appendFileSync(gi, `${body && !body.endsWith("\n") ? "\n" : ""}${path}\n`); console.log(c.dim(`  + added ${path} to .gitignore`)); }
}

async function main() {
  switch (cmd) {
    case "keygen": {
      if (readPrivateKey(o)) die(`a keypair already exists (${o.keysPath}). Delete it first to rotate, or use a fresh --keys path.`);
      const kp = ensureKeypair(o); // writes the private key to .env.keys
      ensureGitignored(o.keysPath!);
      // make sure the public key is recorded in .env
      await setVar(PUBLIC_KEY_NAME, kp.publicKey, { ...o, plain: true });
      console.log(c.green("✔ generated an ML-KEM-768 keypair"));
      console.log(`  ${PUBLIC_KEY_NAME}  → ${o.envPath} ${c.dim("(commit this — it can only encrypt)")}`);
      console.log(`  ${PRIVATE_KEY_NAME} → ${o.keysPath} ${c.dim("(gitignored — keep it secret)")}`);
      break;
    }
    case "set": {
      const pair = positionals[1] ?? "";
      const eq = pair.indexOf("=");
      if (eq < 0) die('usage: suluk-env set KEY=value [--plain]');
      const name = pair.slice(0, eq), value = pair.slice(eq + 1);
      await setVar(name, value, { ...o, plain: has("--plain") });
      console.log(c.green(`✔ ${has("--plain") ? "set" : "encrypted"} ${name}`) + c.dim(` → ${o.envPath}`));
      break;
    }
    case "encrypt": {
      const skip = (flag("--skip") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const { publicKey } = await encryptEnvFile({ ...o, skipPlain: skip });
      ensureGitignored(o.keysPath!);
      console.log(c.green(`✔ encrypted all plaintext values in ${o.envPath}`) + (skip.length ? c.dim(` (kept plaintext: ${skip.join(", ")})`) : ""));
      console.log(c.dim(`  public key: ${publicKey.slice(0, 24)}…`));
      break;
    }
    case "decrypt": {
      const out = await decryptEnvFileToString(o);
      const dest = flag("--out");
      if (dest) { writeFileSync(dest, out.endsWith("\n") ? out : out + "\n"); console.log(c.green(`✔ wrote decrypted env → ${dest}`)); }
      else process.stdout.write(out.endsWith("\n") ? out : out + "\n");
      break;
    }
    case "get": {
      const name = positionals[1];
      if (!name) die("usage: suluk-env get KEY");
      const raw = parseEnv(existsSync(o.envPath!) ? readFileSync(o.envPath!, "utf8") : "")[name!];
      if (raw === undefined) die(`${name} is not set in ${o.envPath}`);
      if (!isEncrypted(raw)) { process.stdout.write(raw + "\n"); break; }
      const priv = readPrivateKey(o) ?? die(`${name} is encrypted but no private key (${o.keysPath} / ${PRIVATE_KEY_NAME})`);
      process.stdout.write((await decrypt(priv, raw)) + "\n");
      break;
    }
    case "ls": {
      const rec = parseEnv(existsSync(o.envPath!) ? readFileSync(o.envPath!, "utf8") : "");
      const names = Object.keys(rec).filter((k) => k !== PUBLIC_KEY_NAME && k !== PRIVATE_KEY_NAME);
      if (!names.length) { console.log(c.dim("(no variables)")); break; }
      const w = Math.max(...names.map((n) => n.length));
      for (const n of names) {
        const v = rec[n];
        const tag = isEncrypted(v) ? c.green("🔒 encrypted") : v === "" ? c.dim("(empty)") : c.yellow(`◻ plaintext ${c.dim(mask(v))}`);
        console.log(`  ${n.padEnd(w)}  ${tag}`);
      }
      console.log(c.dim(`\n  ${names.length} variable(s) · ${readPublicKey(o) ? "keypair present" : c.red("no keypair — run `suluk-env keygen`")}`));
      break;
    }
    case "run": {
      const sep = argv.indexOf("--");
      const command = sep >= 0 ? argv.slice(sep + 1) : [];
      if (!command.length) die("usage: suluk-env run -- <command> [args...]");
      await loadEnvFile(o);
      const r = spawnSync(command[0], command.slice(1), { stdio: "inherit", env: process.env });
      process.exit(r.status ?? 1);
      break;
    }
    default:
      console.log(readFileSync(new URL("./suluk-env.ts", import.meta.url), "utf8").split("\n").slice(2, 18).join("\n").replace(/^\s*\*\s?/gm, "").replace(/\/\*\*|\s*\*\//g, "").trim());
      if (cmd && cmd !== "help" && cmd !== "--help") process.exit(2);
  }
}
main().catch((e) => die((e as Error).message));
