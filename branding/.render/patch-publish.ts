// Add publishConfig.access:"public" to every @suluk/* package.json (scoped pkgs default to restricted).
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const PKGS = resolve(import.meta.dir, "../../tooling/ts/packages");
for (const dir of readdirSync(PKGS)) {
  const f = resolve(PKGS, dir, "package.json");
  if (!existsSync(f)) continue;
  let text = readFileSync(f, "utf8");
  const pj = JSON.parse(text);
  if (!pj.name?.startsWith("@suluk/")) continue;
  if (text.includes('"publishConfig"')) { console.log(`${pj.name}: skip`); continue; }
  const lines = text.split("\n");
  const idx = lines.findIndex((l) => /^\s*"description":/.test(l));
  lines.splice(idx + 1, 0, '  "publishConfig": { "access": "public" },');
  writeFileSync(f, lines.join("\n"));
  console.log(`${pj.name}: patched`);
}
