/**
 * A generic in-memory resource store + the CRUD handlers the generated routes bind to. (In production this
 * is where Drizzle + D1 live; in-memory keeps the demo a single runnable file with zero setup.) The handlers
 * are attached to the contract-generated routes — so request validation still comes from the contract.
 */
import type { Context } from "hono";

export interface CrudHandlers {
  list: (c: Context) => Response | Promise<Response>;
  get: (c: Context) => Response | Promise<Response>;
  create: (c: Context) => Response | Promise<Response>;
  update: (c: Context) => Response | Promise<Response>;
  delete: (c: Context) => Response | Promise<Response>;
}

export function makeHandlers(): CrudHandlers {
  const rows = new Map<string, Record<string, unknown>>();
  let seq = 1;
  return {
    list: (c) => c.json([...rows.values()]),
    get: (c) => {
      const v = rows.get(c.req.param("id") ?? "");
      return v ? c.json(v) : c.json({ error: "not found" }, 404);
    },
    create: async (c) => {
      const body = (await c.req.json()) as Record<string, unknown>;
      const id = body.id != null ? Number(body.id) : seq++;
      const row = { ...body, id };
      rows.set(String(id), row);
      return c.json(row, 201);
    },
    update: async (c) => {
      const id = c.req.param("id") ?? "";
      const body = (await c.req.json()) as Record<string, unknown>;
      const row = { ...(rows.get(id) ?? {}), ...body, id: Number(id) };
      rows.set(id, row);
      return c.json(row);
    },
    delete: (c) => {
      rows.delete(c.req.param("id") ?? "");
      return c.body(null, 204);
    },
  };
}
