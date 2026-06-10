/**
 * Drizzle table → CRUD RouteContracts (the @suluk/hono shape). This closes the floor-to-contract chain:
 * Drizzle (data) → Hono RouteContract (interface) → emitV4 → v4 document. We generate the conventional five
 * REST operations from the table's select/insert/update Zod schemas. Nothing here is opinionated about the
 * handler — these are pure contract shapes, derivable into a v4 doc with no running server. CANDIDATE tooling.
 */
import * as z from "zod";
import { getTableName } from "drizzle-orm";
import type { RouteContract, RouteResponse } from "@suluk/hono";
import { tableSchemas } from "./schemas";
import { pascalCase, type AnyTable } from "./meta";

export interface CrudOptions {
  /** Base path for the collection. Default "/" + tableName, e.g. "/users". */
  basePath?: string;
  /** Path-param name for the item id. Default "id" ⇒ ".../:id". */
  idParam?: string;
}

/**
 * Generate the five conventional CRUD RouteContracts for a drizzle table:
 *   - list   GET    {base}            → 200 array(select)
 *   - get    GET    {base}/:id        → 200 select, 404
 *   - create POST   {base}            (json insert) → 201 select
 *   - update PATCH  {base}/:id        (json update) → 200 select
 *   - delete DELETE {base}/:id        → 204
 * Names are list<Pascal>/get<Pascal>/create<Pascal>/update<Pascal>/delete<Pascal> (C009 by-name handles).
 * `:id` is typed as a string param (path params arrive as strings; the DB layer coerces).
 */
export function crudRoutes(table: AnyTable, opts: CrudOptions = {}): RouteContract[] {
  const tableName = getTableName(table);
  const base = opts.basePath ?? `/${tableName}`;
  const idParam = opts.idParam ?? "id";
  const Pascal = pascalCase(tableName);
  const { select, insert, update } = tableSchemas(table);

  // path-param object — `:id` (and any future composite key) is a string in the URI template.
  const idParams = z.object({ [idParam]: z.string() });
  const itemPath = `${base}/:${idParam}`;

  const ok = (status: number, schema: z.ZodType, description: string): RouteResponse => ({ status, schema, description });
  const bare = (status: number, description: string): RouteResponse => ({ status, description });

  return [
    {
      method: "get",
      path: base,
      name: `list${Pascal}`,
      summary: `List ${tableName}`,
      tags: [tableName],
      responses: [ok(200, z.array(select), `A page of ${tableName}.`)],
    },
    {
      method: "get",
      path: itemPath,
      name: `get${Pascal}`,
      summary: `Fetch one ${tableName} row by ${idParam}`,
      tags: [tableName],
      request: { params: idParams },
      responses: [ok(200, select, `The ${tableName} row.`), bare(404, "Not found.")],
    },
    {
      method: "post",
      path: base,
      name: `create${Pascal}`,
      summary: `Create a ${tableName} row`,
      tags: [tableName],
      request: { json: insert },
      responses: [ok(201, select, `The created ${tableName} row.`)],
    },
    {
      method: "patch",
      path: itemPath,
      name: `update${Pascal}`,
      summary: `Update a ${tableName} row by ${idParam}`,
      tags: [tableName],
      request: { params: idParams, json: update },
      responses: [ok(200, select, `The updated ${tableName} row.`), bare(404, "Not found.")],
    },
    {
      method: "delete",
      path: itemPath,
      name: `delete${Pascal}`,
      summary: `Delete a ${tableName} row by ${idParam}`,
      tags: [tableName],
      request: { params: idParams },
      responses: [bare(204, "Deleted.")],
    },
  ];
}
