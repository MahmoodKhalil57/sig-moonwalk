/**
 * @suluk/drizzle — the DATA floor of the Suluk cycle: a Drizzle ORM table is the system of record, and this
 * package projects it into the v4 "Suluk" contract. The chain is
 *
 *   Drizzle table
 *     → Zod (drizzle-zod: select / insert / update)        [tableSchemas]
 *     → v4 Schema Objects (@suluk/zod zodToV4)              [tableToV4, tableComponents]
 *     → Hono RouteContracts (the @suluk/hono interface)    [crudRoutes]
 *     → v4 document (@suluk/hono emitV4)                    [closes the floor-to-contract chain]
 *
 * Plus the honest DB metadata read straight off the column descriptors [tableMetadata]. Losses are never
 * silent: the v4 conversion surfaces zodToV4 warnings (tableToV4Warnings) and component-name collisions
 * (tableComponentsAudit). CANDIDATE tooling (not official OAS).
 */
export {
  tableMetadata,
  pascalCase,
  tableComponentName,
  type AnyTable,
  type ColumnMeta,
  type TableMeta,
} from "./meta";

export {
  tableSchemas,
  tableToV4,
  tableToV4Warnings,
  tableComponents,
  tableComponentsAudit,
  type TableZodSchemas,
  type TableV4Schemas,
} from "./schemas";

export { crudRoutes, type CrudOptions } from "./crud";
