/**
 * mount — the thin Hono adapter. Wires the SAME RouteContract list that emitV4 reads onto a live Hono app,
 * using @hono/zod-validator with the contract's own Zod schemas. Because the doc and the running app are
 * projected from one source, they cannot drift. This is the only file that imports Hono.
 */
import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { RouteContract } from "./contract";

type Registrar = Record<string, (path: string, ...rest: unknown[]) => unknown>;

/** Mount each contract's handler (with request validation derived from its Zod schemas) onto `app`. */
export function mount<T extends Hono>(app: T, routes: readonly RouteContract[]): T {
  const registrar = app as unknown as Registrar;
  for (const route of routes) {
    const middlewares: unknown[] = [];
    const req = route.request;
    if (req?.json) middlewares.push(zValidator("json", req.json as Parameters<typeof zValidator>[1]));
    if (req?.query) middlewares.push(zValidator("query", req.query as Parameters<typeof zValidator>[1]));
    if (req?.params) middlewares.push(zValidator("param", req.params as Parameters<typeof zValidator>[1]));
    if (req?.header) middlewares.push(zValidator("header", req.header as Parameters<typeof zValidator>[1]));
    const handler = route.handler ?? ((c: { json: (b: unknown, s?: number) => unknown }) => c.json({ message: "not implemented" }, 501));
    registrar[route.method](route.path, ...middlewares, handler);
  }
  return app;
}
