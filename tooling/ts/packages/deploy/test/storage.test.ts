import { test, expect, describe } from "bun:test";
import { r2Storage, memoryStorage, durableBindings, type R2BucketLike } from "../src/index";
import type { OpenAPIv4Document } from "@suluk/core";

describe("StorageProvider — the media/upload slot binding (Phase 3)", () => {
  test("r2Storage stores via the R2 binding and resolves the public URL", async () => {
    const calls: { put: [string, unknown][]; del: string[] } = { put: [], del: [] };
    const bucket: R2BucketLike = {
      async put(k, v) { calls.put.push([k, v]); },
      async delete(k) { calls.del.push(k); },
    };
    const store = r2Storage(bucket, { publicBaseUrl: "https://cdn.acme.test/" });
    expect(store.id).toBe("r2");
    const obj = await store.put("avatars/u1.png", new Uint8Array([1, 2]), { contentType: "image/png" });
    expect(obj).toEqual({ key: "avatars/u1.png", url: "https://cdn.acme.test/avatars/u1.png" });
    expect(store.urlFor("x/y.jpg")).toBe("https://cdn.acme.test/x/y.jpg");
    await store.delete("avatars/u1.png");
    expect(calls.put[0][0]).toBe("avatars/u1.png");
    expect(calls.del).toEqual(["avatars/u1.png"]); // the GDPR erasure path
  });

  test("memoryStorage is a working dev impl (put/has/urlFor/delete)", async () => {
    const m = memoryStorage();
    await m.put("k1", "data");
    expect(m.has("k1")).toBe(true);
    expect(m.urlFor("k1")).toBe("memory://media/k1");
    await m.delete("k1");
    expect(m.has("k1")).toBe(false);
  });
});

describe("durableBindings provisions an R2 bucket when the storage slot is bound", () => {
  const docWithStorage = (providers?: Record<string, string>): OpenAPIv4Document => ({
    openapi: "4.0.0-candidate", info: { title: "t", version: "1" }, paths: {},
    ...(providers ? { "x-suluk-providers": providers } : {}),
  } as unknown as OpenAPIv4Document);

  test("a bound storage provider → an R2 MEDIA binding + a `wrangler r2 bucket create` step", () => {
    const plan = durableBindings(docWithStorage({ storage: "r2" }), "shop");
    const media = plan.bindings.find((b) => b.binding === "MEDIA");
    expect(media).toMatchObject({ kind: "r2", resource: "shop-media" });
    expect(plan.steps.some((s) => s.cmd === "wrangler r2 bucket create shop-media")).toBe(true);
  });

  test("no storage slot → no R2 binding", () => {
    expect(durableBindings(docWithStorage(), "shop").bindings.some((b) => b.kind === "r2")).toBe(false);
  });
});
