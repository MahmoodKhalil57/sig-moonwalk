/**
 * The "how the tools compose" diagram for the docs site — D2 of the @suluk package graph (each package → its
 * @suluk dependencies). It's the same projection idea as the contract diagrams, applied one level up: instead of
 * one contract → its layers, it's the whole toolkit → how the packages depend on each other. Generated from the
 * harvested package.json deps, rendered on the Architecture page (via kroki.io) + committed as architecture.d2.
 */
import { deflateSync } from "node:zlib";
import type { PackageDoc } from "./harvest";

const short = (name: string) => name.replace(/^@suluk\//, "");
function d2id(name: string): string {
  const s = short(name);
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) ? s : `"${s.replace(/"/g, '\\"')}"`;
}

/** D2 source for the @suluk package dependency graph — the tools that come together to derive a whole stack. */
export function packageGraphD2(packages: PackageDoc[]): string {
  const visible = packages.filter((p) => !p.private);
  // only DRAWN packages are valid edge endpoints — a dep on a private package is omitted (no dangling phantom node)
  const present = new Set(visible.map((p) => p.name));
  const lines: string[] = ["# Suluk — how the tools compose (each package → its @suluk dependencies)", "direction: right", ""];
  for (const p of visible) lines.push(`${d2id(p.name)}: {label: "${short(p.name)}"; shape: rectangle}`);
  lines.push("");
  for (const p of visible) {
    for (const dep of [...p.dependencies, ...p.peerDependencies]) {
      if (present.has(dep) && dep !== p.name) lines.push(`${d2id(p.name)} -> ${d2id(dep)}`);
    }
  }
  return lines.join("\n");
}

/** A kroki.io render URL for D2 source (deflate + base64url) — the package graph is public, so embedding is fine. */
export function krokiD2Url(d2: string): string {
  return `https://kroki.io/d2/svg/${deflateSync(Buffer.from(d2, "utf8")).toString("base64url")}`;
}
