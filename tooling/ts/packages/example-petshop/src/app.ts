/**
 * The whole app, from ONE source. buildApp(entities) derives the backend CRUD routes (+ the v4 document) and
 * the frontend (shadcn components + page TSX). Here we bind in-memory handlers to those generated routes and
 * mount them on Hono, then serve the v4 document + the Scalar docs. The frontend artifacts ride along on
 * `built.frontend` (write them with `generate`, or install per-slice via the shadcn registry).
 */
import { Hono } from "hono";
import { mount, type RouteContract } from "@suluk/hono";
import { buildApp } from "@suluk/builder";
import { scalarResponse } from "@suluk/scalar";
import { entities } from "./entities";
import { makeHandlers, type CrudHandlers } from "./store";

export const built = buildApp({ entities, info: { title: "Petshop", version: "1.0.0" } });

// one in-memory store per entity; bind its handlers to the matching generated routes.
const stores = new Map<string, CrudHandlers>(entities.map((e) => [e.name, makeHandlers()]));

const routes: RouteContract[] = built.backend.routes.map((r) => {
  const m = /^(list|create|get|update|delete)(.+)$/.exec(r.name ?? "");
  if (!m) return r;
  const [, op, entity] = m;
  const handlers = stores.get(entity);
  return handlers ? { ...r, handler: handlers[op as keyof CrudHandlers] as RouteContract["handler"] } : r;
});

export const app = mount(new Hono(), routes);

// the derived docs surface — same v4 document, two renderings
app.get("/openapi.json", (c) => c.json(built.backend.document as unknown as Record<string, unknown>));
app.get("/scalar", () => scalarResponse(built.backend.document));
app.get("/", (c) => c.text("Petshop demo — try /scalar · /openapi.json · /pet · /category (GET/POST), /pet/:id (GET/PATCH/DELETE)"));
