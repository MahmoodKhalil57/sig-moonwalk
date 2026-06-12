import { test, expect, describe } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The C027 MODULE-BOUNDARY INVARIANT — D1 enforced by build, not discipline. @suluk/core's matcher must never be
 * able to consult an agent field, and the structural guarantee of that is: @suluk/core NEVER imports @suluk/agents.
 * This is a maintained tripwire — if anyone ever wires the agent layer into core, this fails loud.
 */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("C027 module boundary (D1 by build)", () => {
  const coreSrc = join(import.meta.dir, "..", "..", "core", "src");

  test("@suluk/core imports nothing from @suluk/agents (the dependency is one-way)", () => {
    const offenders: string[] = [];
    for (const f of walk(coreSrc)) {
      const text = readFileSync(f, "utf8");
      if (/from\s+["']@suluk\/agents["']|require\(\s*["']@suluk\/agents["']\s*\)|from\s+["'][./]+agents["']/.test(text)) {
        offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("@suluk/core's matcher source (ada.ts) never references x-suluk-agents", () => {
    const ada = readFileSync(join(coreSrc, "ada.ts"), "utf8");
    expect(ada.includes("x-suluk-agents")).toBe(false);
    expect(ada.includes("agents")).toBe(false);
  });
});
