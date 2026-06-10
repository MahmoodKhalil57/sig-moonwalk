import { test, expect, describe } from "bun:test";
import { keepMount, allTasks } from "nanostores";
import { createApiStores } from "@suluk/nano-stores";
import { app, built } from "../src/app";

// route the generated client's fetch at the LIVE Hono app (in a browser this is a real network fetch).
const BASE = "http://petshop.test";
const appFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : (input as Request).url;
  return app.request(url.replace(BASE, ""), init);
}) as unknown as typeof fetch;

describe("the generated Nano Stores client round-trips against the LIVE backend (state corner)", () => {
  const api = createApiStores(built.backend.routes, { baseUrl: BASE, fetch: appFetch });

  test("a mutator store creates through the contract-validated route and returns the validated body", async () => {
    const created = (await api.mutators.createPet.mutate({ data: { name: "Nimbus", status: "available" } })) as { id: number; name: string };
    expect(created.name).toBe("Nimbus");
    expect(typeof created.id).toBe("number");
  });

  test("a fetcher store reads the live list and exposes the validated data", async () => {
    const $list = api.fetchers.listPet();
    keepMount($list);
    await allTasks();
    const state = $list.get() as { data?: { name: string }[]; error?: unknown };
    expect(state.error).toBeUndefined();
    expect(Array.isArray(state.data)).toBe(true);
    expect(state.data!.some((p) => p.name === "Nimbus")).toBe(true); // the pet we just created via the mutator
  });

  test("a request that violates the contract is rejected client-side before it ever hits the network", async () => {
    // name is required by the Pet schema; the client validates the request edge and rejects.
    await expect(api.mutators.createPet.mutate({ data: { status: "available" } })).rejects.toBeDefined();
  });
});
