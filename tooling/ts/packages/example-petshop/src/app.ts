/**
 * The whole app, from ONE source. buildApp(entities) derives the backend CRUD routes (+ the v4 document) and
 * the frontend (shadcn components + page TSX). Here we bind real Drizzle handlers to the generated routes,
 * meter what each request costs (per user + per frontend action), and serve the v4 document (annotated with
 * the declared per-operation cost so it bubbles to Scalar + /superadmin), the docs, and a raw /cost view.
 */
import { Hono } from "hono";
import { mount, type RouteContract } from "@suluk/hono";
import { buildApp } from "@suluk/builder";
import { buildAda, matchRequest } from "@suluk/core";
import { scalarResponse } from "@suluk/scalar";
import { adminApp } from "@suluk/admin";
import { annotateCosts, costMeter, MemoryCostSink, summarize, type CostModel } from "@suluk/cost";
import { entities, tables } from "./entities";
import { drizzleHandlers, resetDb, type CrudHandlers } from "./store";

export const built = buildApp({ entities, info: { title: "Petshop", version: "1.0.0" } });

// What each operation costs YOU (µ$). Declared on the contract; bubbles to the doc/Scalar/cockpit; metered below.
const read = (micro: number): CostModel => ({ components: [{ source: "db-read", basis: "per-call", microUsd: micro }], estimateMicroUsd: micro });
const write = (micro: number): CostModel => ({ components: [{ source: "compute", basis: "per-call", microUsd: 100 }, { source: "db-write", basis: "per-call", microUsd: micro }], estimateMicroUsd: 100 + micro });
const costs: Record<string, CostModel> = {
  listPet: read(12), getPet: read(8), createPet: write(30), updatePet: write(30), deletePet: write(20),
  listCategory: read(10), getCategory: read(8), createCategory: write(20), updateCategory: write(20), deleteCategory: write(15),
};

/** The v4 document with x-suluk-cost on each operation — this is what the docs + admin render. */
export const document = annotateCosts(built.backend.document, costs);

// REAL Drizzle handlers, one per entity table, bound to the matching contract-generated routes.
const handlersByEntity = new Map<string, CrudHandlers>(
  entities.map((e) => [e.name, drizzleHandlers(tables[e.name as keyof typeof tables] as Parameters<typeof drizzleHandlers>[0])]),
);
const routes: RouteContract[] = built.backend.routes.map((r) => {
  const m = /^(list|create|get|update|delete)(.+)$/.exec(r.name ?? "");
  if (!m) return r;
  const [, op, entity] = m;
  const handlers = handlersByEntity.get(entity);
  return handlers ? { ...r, handler: handlers[op as keyof CrudHandlers] as RouteContract["handler"] } : r;
});

export const sink = new MemoryCostSink();
const ada = buildAda(document);

export const app = new Hono();
// meter EVERY request: the operation (matched via the ADA) → its declared cost → attributed to the user
// (x-user header) + the frontend action (x-suluk-action header the client sets). Recorded into the sink.
app.use("*", costMeter({
  sink, costs,
  operationOf: (c) => matchRequest(ada, c.req.method, new URL(c.req.url).pathname)?.operation.name,
  principalOf: (c) => c.req.header("x-user") || "anon",
}));
mount(app, routes);

// the derived docs surface — the ANNOTATED v4 document, two renderings (Scalar shows x-suluk-cost)
app.get("/openapi.json", (c) => c.json(document as unknown as Record<string, unknown>));
app.get("/scalar", () => scalarResponse(document));

// cost, displayed AS IT IS — total + per-user / per-operation / per-action / per-source. Build pricing on top.
app.get("/cost", (c) => c.json(summarize(sink.events())));

// the /superadmin web admin panel — the SAME cockpit (now incl. the Cost layer, since the doc is annotated).
app.route("/", adminApp({ document, title: "Petshop", authorize: (c) => c.req.header("x-role") === "superadmin" }));

app.get("/", (c) => c.text("Petshop demo — /scalar · /openapi.json · /superadmin (x-role: superadmin) · /cost · /pet · /category"));

/** Reset the shared in-memory state (DB rows + cost events) — used by tests for isolation. */
export function resetDemo(): void { resetDb(); sink.clear(); }
