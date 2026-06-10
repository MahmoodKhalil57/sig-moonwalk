/**
 * @suluk/nano-stores tests — prove the STATE-corner projection round-trips through a RECORDING mock fetch:
 * buildUrl substitution; a mutator that hits the right URL+method+JSON body and returns the validated body;
 * request-schema and response-schema violations both REJECT (honest loss, never silent); and a lazy fetcher
 * store that — once mounted and awaited — fetches the right URL and exposes the parsed data via .get().data.
 */
import { test, expect } from "bun:test";
import { z } from "zod";
import { allTasks, keepMount } from "nanostores";
import type { RouteContract } from "@suluk/hono";
import { buildUrl, createApiStores, SchemaViolationError } from "../src/index";

// ---- a recording mock fetch -------------------------------------------------
interface Call {
  url: string;
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
}
function mockFetch(canned: (url: string, init?: RequestInit) => unknown) {
  const calls: Call[] = [];
  const fn = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body, headers: init?.headers as Record<string, string> | undefined });
    const payload = canned(url, init);
    return { ok: true, status: 200, json: async () => payload } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

// ---- the contract under test ------------------------------------------------
const Pet = z.object({ id: z.number(), name: z.string() });
const NewPet = z.object({ name: z.string() });

const routes: RouteContract[] = [
  {
    method: "get",
    path: "/pet/:petId",
    name: "getPet",
    request: { params: z.object({ petId: z.string() }) },
    responses: [{ status: 200, schema: Pet }],
  },
  {
    method: "post",
    path: "/pet",
    name: "createPet",
    request: { json: NewPet },
    responses: [{ status: 200, schema: Pet }],
  },
];

// ---- buildUrl ---------------------------------------------------------------
test("buildUrl: Hono ':name' substitution + baseUrl join", () => {
  expect(buildUrl("/pet/:petId", { petId: 42 })).toBe("/pet/42");
  expect(buildUrl("/pet/:petId", { petId: 42 }, "https://api.x.com")).toBe("https://api.x.com/pet/42");
  // trailing slash on base is not doubled
  expect(buildUrl("/pet/:petId", { petId: "abc" }, "https://api.x.com/")).toBe("https://api.x.com/pet/abc");
});

test("buildUrl: RFC-6570 '{name}' substitution (v4 uriTemplate form)", () => {
  expect(buildUrl("pet/{petId}", { petId: 7 }, "https://api.x.com")).toBe("https://api.x.com/pet/7");
  // url-encoding of values
  expect(buildUrl("/q/:term", { term: "a b/c" })).toBe("/q/a%20b%2Fc");
});

test("buildUrl: unbound placeholder is left verbatim (honest loss, never silently emptied)", () => {
  expect(buildUrl("/pet/:petId")).toBe("/pet/:petId");
  expect(buildUrl("/pet/{petId}", {})).toBe("/pet/{petId}");
});

// ---- mutator: right URL + method + JSON body, returns validated body --------
test("mutator .mutate hits the right URL+method+JSON body and returns the validated response", async () => {
  const { fn, calls } = mockFetch(() => ({ id: 1, name: "Rex" }));
  const api = createApiStores(routes, { baseUrl: "https://api.x.com", fetch: fn });

  const result = await api.mutators.createPet.mutate({ data: { name: "Rex" } });

  expect(result).toEqual({ id: 1, name: "Rex" });
  expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toBe("https://api.x.com/pet");
  expect(calls[0]!.method).toBe("POST");
  expect(calls[0]!.body).toEqual({ name: "Rex" });
  expect(calls[0]!.headers?.["content-type"]).toBe("application/json");
});

// ---- request-schema violation REJECTS --------------------------------------
test("a request that violates the request schema is rejected (before the network call)", async () => {
  const { fn, calls } = mockFetch(() => ({ id: 1, name: "Rex" }));
  const api = createApiStores(routes, { baseUrl: "https://api.x.com", fetch: fn });

  // `name` should be a string; pass a number to violate NewPet.
  let err: unknown;
  try {
    await api.mutators.createPet.mutate({ data: { name: 123 } as never });
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(SchemaViolationError);
  expect((err as SchemaViolationError).side).toBe("request");
  // fail-fast: no network call happened.
  expect(calls).toHaveLength(0);
});

// ---- response-schema violation REJECTS --------------------------------------
test("a response that violates the response schema is rejected", async () => {
  const { fn } = mockFetch(() => ({ id: "not-a-number", name: "Rex" })); // id must be number
  const api = createApiStores(routes, { baseUrl: "https://api.x.com", fetch: fn });

  let err: unknown;
  try {
    await api.mutators.createPet.mutate({ data: { name: "Rex" } });
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(SchemaViolationError);
  expect((err as SchemaViolationError).side).toBe("response");
});

// ---- fetcher store: lazy, fetches right URL, exposes parsed data ------------
test("a fetcher store (keepMount + allTasks) fetches the right URL and exposes parsed data via .get().data", async () => {
  const { fn, calls } = mockFetch(() => ({ id: 99, name: "Fido" }));
  const api = createApiStores(routes, { baseUrl: "https://api.x.com", fetch: fn });

  const store = api.fetchers.getPet({ petId: "99" });
  keepMount(store); // fetcher is lazy — mount triggers the fetch
  await allTasks(); // await in-flight fetcher tasks

  expect(store.get().data).toEqual({ id: 99, name: "Fido" });
  expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toBe("https://api.x.com/pet/99");
  expect(calls[0]!.method).toBe("GET");
});

// ---- response-schema violation on a FETCHER also surfaces (not silent) ------
test("a fetcher whose response violates the schema surfaces an error, not bad data", async () => {
  const { fn } = mockFetch(() => ({ id: "nope", name: "Fido" }));
  const api = createApiStores(routes, { baseUrl: "https://api.x.com", fetch: fn });

  const store = api.fetchers.getPet({ petId: "1" });
  keepMount(store);
  await allTasks();

  const v = store.get();
  expect(v.data).toBeUndefined();
  expect(v.error).toBeInstanceOf(SchemaViolationError);
});
