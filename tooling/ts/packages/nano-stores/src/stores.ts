/**
 * createApiStores — project a list of v4 "Suluk" RouteContracts into a typed Nano Stores client (the STATE
 * corner of the suite). GET routes become @nanostores/query FETCHER stores (lazy, cache-keyed, revalidatable);
 * everything else becomes a MUTATOR store. The contract's Zod schemas are the runtime guard on BOTH ends:
 *
 *   - request bodies are validated against `request.json` BEFORE the network call (fail fast, no bad write),
 *   - responses are validated against the route's 2xx response schema AFTER parsing (reject on drift).
 *
 * This is the symmetric twin of @suluk/hono's server-side validation: the same contract that the server
 * derives its router from, the client derives its store layer from — one source of truth, two projections.
 *
 * Honest-loss discipline (house pattern): we never swallow a mismatch. A request/response that fails its
 * schema REJECTS with a typed error carrying the Zod issues; a route we cannot turn into a store (e.g. a GET
 * without a usable name) is recorded as a `warnings[]` entry rather than dropped silently.
 */
import { nanoquery } from "@nanostores/query";
import type { FetcherStore, MutatorStore } from "@nanostores/query";
import type { RouteContract, RouteResponse } from "@suluk/hono";
import { responseList } from "@suluk/hono";
import type { z } from "zod";
import { buildUrl } from "./url";

/** Method+path → a stable by-name handle, mirroring @suluk/hono's deriveName (kept local to avoid a dep). */
function pascal(s: string): string {
  return s.replace(/(^|[-_])(\w)/g, (_m, _sep, c: string) => c.toUpperCase());
}
function deriveName(route: RouteContract): string {
  if (route.name) return route.name;
  const segs = route.path
    .replace(/^\//, "")
    .split("/")
    .filter(Boolean)
    .map((s) => {
      if (s === "*") return "ByWildcard";
      if (s.startsWith(":")) return "By" + pascal(s.slice(1).replace(/\{.*$/, ""));
      if (s.startsWith("{")) return "By" + pascal(s.slice(s.startsWith("{+") ? 2 : 1, -1));
      return pascal(s);
    });
  return route.method + segs.join("");
}

/** The first 2xx response that carries a schema — that's the success body we validate the payload against. */
function successSchema(route: RouteContract): z.ZodType | undefined {
  let fallback: RouteResponse | undefined;
  for (const r of responseList(route.responses)) {
    if (r.status >= 200 && r.status < 300 && r.schema) {
      if (r.status === 200) return r.schema; // prefer the canonical 200
      fallback ??= r;
    }
  }
  return fallback?.schema;
}

/** A validation failure on either edge — carries the Zod issues so callers can surface what drifted. */
export class SchemaViolationError extends Error {
  constructor(
    public readonly side: "request" | "response",
    public readonly route: string,
    public readonly issues: unknown,
  ) {
    super(`@suluk/nano-stores: ${side} payload for "${route}" violates its contract schema`);
    this.name = "SchemaViolationError";
  }
}

/** Validate `value` against a Zod schema; throw a SchemaViolationError on failure, else return the parsed value. */
function guard(side: "request" | "response", routeName: string, schema: z.ZodType | undefined, value: unknown): unknown {
  if (!schema) return value; // nothing to check against — pass through (recorded as low-confidence by the caller's warnings)
  const res = schema.safeParse(value);
  if (!res.success) throw new SchemaViolationError(side, routeName, res.error.issues);
  return res.data;
}

export interface CreateApiStoresOptions {
  /** Prepended to every built URL (e.g. "https://api.example.com"). */
  baseUrl?: string;
  /** Injected fetch — defaults to the global. Tests pass a recording mock. */
  fetch?: typeof fetch;
  /**
   * The current frontend ACTION (a button-click id), sent as `x-suluk-action` on every request so the
   * server's cost meter (@suluk/cost) can attribute cost back to the UI action. A function lets it reflect
   * the live action. A per-call action on `.mutate({ action })` overrides it.
   */
  action?: string | (() => string | undefined);
}

/** A bound fetcher store factory: call with the route's path params to get a cache-keyed store. */
export type FetcherFactory = (params?: Record<string, string | number>) => FetcherStore<unknown>;

/** A bound mutator store: `.mutate({ data, params })` runs the (validated) request and returns the validated body. */
export type MutatorInvoker = MutatorStore<MutatorInput, unknown>;
export interface MutatorInput {
  data?: unknown;
  params?: Record<string, string | number>;
  /** Overrides the store's default action for this call (the `x-suluk-action` cost-tracing tag). */
  action?: string;
}

export interface ApiStores {
  /** name → factory that, given path params, yields a lazy fetcher store. */
  fetchers: Record<string, FetcherFactory>;
  /** name → mutator store (POST/PUT/PATCH/DELETE/…). */
  mutators: Record<string, MutatorInvoker>;
  /** The shared @nanostores/query context (invalidateKeys / revalidateKeys / mutateCache). */
  ctx: ReturnType<typeof nanoquery>[2];
  /** Convenience over ctx.invalidateKeys: invalidate by route NAME (its built URLs) or by a raw URL/prefix. */
  invalidate: (routeNameOrUrl: string) => void;
  /** Non-fatal projection losses (e.g. a GET with no response schema → unvalidated). Never thrown. */
  warnings: string[];
}

export function createApiStores(routes: readonly RouteContract[], opts: CreateApiStoresOptions = {}): ApiStores {
  const doFetch: typeof fetch = opts.fetch ?? globalThis.fetch;
  const baseUrl = opts.baseUrl;

  const [createFetcherStore, createMutatorStore, ctx] = nanoquery();

  // resolve the frontend action → the x-suluk-action header (cost tracing). per-call wins over the default.
  const actionHeaders = (perCall?: string): Record<string, string> => {
    const action = perCall ?? (typeof opts.action === "function" ? opts.action() : opts.action);
    return action ? { "x-suluk-action": action } : {};
  };

  const fetchers: Record<string, FetcherFactory> = {};
  const mutators: Record<string, MutatorInvoker> = {};
  const warnings: string[] = [];
  // name → the URLs we've keyed stores under, so invalidate(name) can target them.
  const urlsByName: Record<string, Set<string>> = {};

  for (const route of routes) {
    const name = deriveName(route);
    const respSchema = successSchema(route);
    urlsByName[name] ??= new Set();

    if (route.method === "get") {
      if (!respSchema) {
        warnings.push(`GET "${name}" (${route.path}) has no 2xx response schema — its data is fetched UNVALIDATED.`);
      }
      // Factory: bind path params now, build the URL, key the fetcher store by [method, url].
      fetchers[name] = (params?: Record<string, string | number>) => {
        const url = buildUrl(route.path, params, baseUrl);
        urlsByName[name]!.add(url);
        return createFetcherStore<unknown>([route.method.toUpperCase(), url], {
          // Per-store fetcher (CommonSettings.fetcher) — receives the spread keys, ignores them, hits the URL.
          fetcher: async () => {
            const res = await doFetch(url, { headers: actionHeaders() });
            const json = await res.json();
            return guard("response", name, respSchema, json);
          },
        });
      };
    } else {
      const reqSchema = route.request?.json;
      if (route.request?.json === undefined) {
        // No request body schema is legitimate (e.g. DELETE) — note it only as informational.
        if (route.method !== "delete") {
          warnings.push(`${route.method.toUpperCase()} "${name}" has no request.json schema — its body is sent UNVALIDATED.`);
        }
      }
      // The actual mutation: validate body → fetch → parse → validate response. Throws on either violation.
      const run = async (input: MutatorInput): Promise<unknown> => {
        const { data: body, params, action } = input ?? {};
        const validBody = guard("request", name, reqSchema, body); // fail BEFORE the network call
        const url = buildUrl(route.path, params, baseUrl);
        urlsByName[name]!.add(url);
        const res = await doFetch(url, {
          method: route.method.toUpperCase(),
          headers: { "content-type": route.request?.contentType ?? "application/json", ...actionHeaders(action) },
          body: validBody === undefined ? undefined : JSON.stringify(validBody),
        });
        const json = await res.json();
        return guard("response", name, respSchema, json);
      };

      const store = createMutatorStore<MutatorInput, unknown>(({ data }) => run(data ?? {}));
      // @nanostores/query@0.3.4 SWALLOWS mutator rejections (.mutate resolves to undefined, error → onError),
      // which would silently hide a contract violation — the exact honest-loss the house pattern forbids. We
      // wrap .mutate so it runs the mutation EXACTLY ONCE and the rejection PROPAGATES to the caller, while
      // mirroring the result/error onto the underlying store's MapStore state for subscribers.
      store.mutate = (async (data?: MutatorInput) => {
        store.setKey("loading", true);
        store.setKey("error", undefined);
        try {
          const out = await run(data ?? {}); // throws on violation → caller's await rejects (the contract)
          store.set({ ...store.get(), loading: false, data: out, error: undefined });
          return out;
        } catch (e) {
          store.set({ ...store.get(), loading: false, error: e as Error });
          throw e; // PROPAGATE — never silent
        }
      }) as typeof store.mutate;
      mutators[name] = store as MutatorInvoker;
    }
  }

  const invalidate = (routeNameOrUrl: string): void => {
    const urls = urlsByName[routeNameOrUrl];
    if (urls && urls.size) {
      // invalidateKeys matches against the joined cache key; our keys are "<METHOD>\0<url>"-ish, so match by URL substring.
      for (const u of urls) ctx.invalidateKeys((key) => key.includes(u));
      return;
    }
    // Treat the argument as a raw URL / prefix.
    ctx.invalidateKeys((key) => key.includes(routeNameOrUrl));
  };

  return { fetchers, mutators, ctx, invalidate, warnings };
}
