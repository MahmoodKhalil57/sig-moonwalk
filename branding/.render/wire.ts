// Wire the Suluk brand + publish metadata into every @suluk package.
// - writes a consistent README.md (logo header) per package
// - surgically inserts license/repository/homepage/bugs into package.json (no reformat churn)
// Run: bun wire.ts   (cwd = branding/.render)
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const REPO = "https://github.com/MahmoodKhalil57/suluk";
const RAW = "https://raw.githubusercontent.com/MahmoodKhalil57/suluk/main/branding/export";
const MARKETPLACE =
  "https://marketplace.visualstudio.com/items?itemName=MahmoodKhalil.suluk-vscode";

const PKGS = resolve(import.meta.dir, "../../tooling/ts/packages");

function cleanDesc(d: string): string {
  return d
    .replace(/\s*CANDIDATE tooling.*$/i, "")
    .trim()
    .replace(/[.—\s]+$/, "") + ".";
}

function readmeLines(name: string, desc: string, dir: string, demo: boolean): string {
  const install = demo
    ? [
        "## Run the demo",
        "",
        "```sh",
        `cd tooling/ts/packages/${dir}`,
        "bun install",
        "bun run src/app.ts",
        "```",
      ]
    : ["## Install", "", "```sh", `bun add ${name}`, "```"];
  return [
    '<p align="center">',
    `  <a href="${REPO}">`,
    `    <img src="${RAW}/wordmark.png" alt="Suluk" width="360" />`,
    "  </a>",
    "</p>",
    "",
    `<h1 align="center">${name}</h1>`,
    "",
    `<p align="center"><b>${cleanDesc(desc)}</b></p>`,
    "",
    '<p align="center">',
    `  <em>Part of <a href="${REPO}">Suluk</a> — one typed OpenAPI v4 contract projecting into every full-stack layer.</em>`,
    "</p>",
    "",
    "---",
    "",
    "> **CANDIDATE tooling — not official OpenAPI.** Suluk is a single-contributor candidate for",
    '> OpenAPI Specification v4.0 ("Moonwalk"), unaffiliated with the OpenAPI Initiative and unable',
    "> to ratify anything on the SIG's behalf.",
    "",
    ...install,
    "",
    "## The Suluk cycle",
    "",
    `\`${name}\` is one station on the Suluk walk — author one v4 source, then **validate · audit ·`,
    "preview · generate · deploy** the whole stack from it. Explore the full toolchain in the",
    `[main repository](${REPO}) or drive it from the [VS Code cockpit](${MARKETPLACE}).`,
    "",
    "## License",
    "",
    "Apache-2.0",
    "",
  ].join("\n");
}

function patchPackageJson(file: string, dir: string): string {
  let text = readFileSync(file, "utf8");
  if (text.includes('"repository"')) return "skip (already has repository)";
  // insert after the description line, preserving all existing formatting
  const lines = text.split("\n");
  const idx = lines.findIndex((l) => /^\s*"description":/.test(l));
  if (idx === -1) return "skip (no description line)";
  const block = [
    '  "license": "Apache-2.0",',
    '  "repository": {',
    '    "type": "git",',
    '    "url": "git+https://github.com/MahmoodKhalil57/suluk.git",',
    `    "directory": "tooling/ts/packages/${dir}"`,
    "  },",
    '  "homepage": "https://github.com/MahmoodKhalil57/suluk#readme",',
    '  "bugs": "https://github.com/MahmoodKhalil57/suluk/issues",',
  ];
  // don't duplicate a license key if one already exists elsewhere
  const hasLicense = /^\s*"license":/m.test(text);
  const toInsert = hasLicense ? block.slice(1) : block;
  lines.splice(idx + 1, 0, ...toInsert);
  writeFileSync(file, lines.join("\n"));
  return "patched";
}

const dirs = readdirSync(PKGS).filter((d) => existsSync(resolve(PKGS, d, "package.json")));
let wrote = 0;
for (const dir of dirs) {
  const pjPath = resolve(PKGS, dir, "package.json");
  const pj = JSON.parse(readFileSync(pjPath, "utf8"));
  if (!pj.name?.startsWith("@suluk/")) continue; // skip non-suluk + the vscode pkg (has its own README)
  const demo = !!pj.private;
  const readmePath = resolve(PKGS, dir, "README.md");
  writeFileSync(readmePath, readmeLines(pj.name, pj.description ?? "", dir, demo));
  const pjResult = patchPackageJson(pjPath, dir);
  wrote++;
  console.log(`${pj.name.padEnd(24)} README✓  package.json:${pjResult}`);
}
console.log(`\n${wrote} @suluk packages wired.`);
