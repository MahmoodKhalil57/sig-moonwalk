import { test, expect, describe } from "bun:test";

describe("the GENERATED shadcn frontend is real, buildable React (UI corner)", () => {
  test("the frontend (generated components + minimal shadcn primitives + rhf + zod) bundles via Bun", async () => {
    const result = await Bun.build({
      entrypoints: [new URL("../frontend/index.html", import.meta.url).pathname],
      outdir: new URL("../dist/client", import.meta.url).pathname,
    });
    if (!result.success) console.error(result.logs);
    expect(result.success).toBe(true);
    // produced a real browser bundle: an HTML entry + a JS chunk
    expect(result.outputs.some((o) => o.path.endsWith(".html"))).toBe(true);
    expect(result.outputs.some((o) => o.path.endsWith(".js"))).toBe(true);
  });
});
