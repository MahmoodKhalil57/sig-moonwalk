/**
 * The Suluk binding — where the tiers map onto the cycle. The lower tiers are AUTO-GENERATED from an entity
 * schema (a v4 Schema Object): a Form block + Table block (UI), a CRUD section that composes them, and the
 * backend CRUD RouteContracts. A page composes sections. buildApp emits BOTH ends from one spec:
 *   backend  = the union of CRUD routes → emitV4 → a v4 document
 *   frontend = per-entity shadcn components + per-page TSX
 * So "build a page" builds the frontend AND the backend, because each entity carries data+contract+UI together.
 */
import * as z from "zod";
import type { OpenAPIv4Document, SchemaOrRef } from "@suluk/core";
import { v4ToZod } from "@suluk/zod";
import type { RouteContract } from "@suluk/hono";
import { emitV4 } from "@suluk/hono";
import { formSpec, tableSpec, renderFormTsx, renderTableTsx } from "@suluk/shadcn";
import { listQuerySchema } from "@suluk/drizzle";
import type { DslDocument, ParamSpec } from "./dsl";
import { registry, type Registry } from "./registry";
import { validateAll } from "./validate";
import { renderPageTsx } from "./render";

export interface Entity {
  name: string;
  schema: SchemaOrRef;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Generate backend CRUD RouteContracts from an entity's v4 schema (schemas → Zod for the bodies). */
export function crudRoutesFromSchema(name: string, schema: SchemaOrRef, defs?: Record<string, SchemaOrRef>): RouteContract[] {
  const entity = v4ToZod(schema as Record<string, unknown>, { defs }) as z.ZodType;
  const base = `/${lower(name)}`;
  const idParams = z.object({ id: z.string() });
  // List routes carry the five reserved list-query params (page/perPage/sort/order/q) — DECLARED here so they
  // project into the v4 doc + the typed SDK + the auto-wired query validator, and PARSED at runtime by the same
  // package's parseListQuery. Per-column equality filters are flat (read at runtime), so they aren't enumerated.
  const listQuery = listQuerySchema();
  return [
    { method: "get", path: base, name: `list${name}`, summary: `List ${name}`, tags: [name], request: { query: listQuery }, responses: [{ status: 200, description: "ok", schema: z.array(entity) }] },
    { method: "post", path: base, name: `create${name}`, summary: `Create ${name}`, tags: [name], request: { json: entity }, responses: [{ status: 201, description: "created", schema: entity }] },
    { method: "get", path: `${base}/:id`, name: `get${name}`, summary: `Get ${name} by id`, tags: [name], request: { params: idParams }, responses: [{ status: 200, description: "ok", schema: entity }, { status: 404, description: "not found" }] },
    { method: "patch", path: `${base}/:id`, name: `update${name}`, summary: `Update ${name}`, tags: [name], request: { params: idParams, json: entity }, responses: [{ status: 200, description: "updated", schema: entity }] },
    { method: "delete", path: `${base}/:id`, name: `delete${name}`, summary: `Delete ${name}`, tags: [name], request: { params: idParams }, responses: [{ status: 204, description: "deleted" }] },
  ];
}

const TONE: ParamSpec = { type: "enum", options: ["default", "compact"], default: "default" };

/** A Form block for an entity. Its contract (`params`) exposes only tone + which fields — the field SET is fixed. */
export function formBlock(entity: Entity, defs?: Record<string, SchemaOrRef>): DslDocument {
  const fields = formSpec(entity.schema, { defs }).fields.map((f) => f.name);
  return {
    name: `${entity.name}Form`, tier: "blocks",
    params: { tone: TONE, fields: { type: "list", options: fields, controls: ["hide", "reorder"], default: fields } },
    root: { type: "ShadcnForm", props: { entity: entity.name } },
  };
}

/** A Table block for an entity. Exposes tone + which columns. */
export function tableBlock(entity: Entity, defs?: Record<string, SchemaOrRef>): DslDocument {
  const cols = tableSpec(entity.schema, { defs }).columns.map((c) => c.key);
  return {
    name: `${entity.name}Table`, tier: "blocks",
    params: { tone: TONE, columns: { type: "list", options: cols, controls: ["hide", "reorder"], default: cols } },
    root: { type: "ShadcnTable", props: { entity: entity.name } },
  };
}

/**
 * A CRUD section composing the entity's Table + Form blocks. It HARDCODES the block field/column details and
 * re-publishes only { tone, blocks } upward — so a page may reorder/hide the two blocks and set tone, but can
 * NOT reach into the form's fields. The narrowing is the section's contract.
 */
export function crudSection(entity: Entity): DslDocument {
  const table = `${entity.name}Table`, form = `${entity.name}Form`;
  return {
    name: `${entity.name}Crud`, tier: "sections",
    params: {
      tone: TONE,
      blocks: { type: "list", options: [table, form], controls: ["include", "hide", "reorder"], default: [table, form] },
    },
    catalog: {
      [table]: { type: table, props: { tone: { $bind: "tone" } } },
      [form]: { type: form, props: { tone: { $bind: "tone" } } },
    },
    root: { type: "Stack", children: [{ $each: "blocks" }] },
  };
}

/** A page composing the given sections. Forwards tone; exposes only { sections, tone } upward. */
export function appPage(name: string, sectionNames: string[]): DslDocument {
  const catalog: Record<string, { type: string; props: Record<string, unknown> }> = {};
  for (const s of sectionNames) catalog[s] = { type: s, props: { tone: { $bind: "tone" } } };
  return {
    name, tier: "pages",
    params: {
      tone: TONE,
      sections: { type: "list", options: sectionNames, controls: ["include", "hide", "reorder"], default: sectionNames },
    },
    catalog,
    root: { type: "Stack", children: [{ $each: "sections" }] },
  };
}

export interface AppSpec {
  entities: Entity[];
  /** Optional explicit pages; if omitted, one "App" page composing every entity's CRUD section is generated. */
  pages?: DslDocument[];
  info?: { title?: string; version?: string };
  baseUrl?: string;
}

export interface BuiltApp {
  entities: Entity[];
  registry: Registry;
  backend: { routes: RouteContract[]; document: OpenAPIv4Document };
  frontend: { components: { name: string; tsx: string }[]; pages: { name: string; tsx: string }[] };
  /** DSL contract violations (empty ⇒ the composition is sound). */
  errors: import("./validate").DslError[];
}

/** Build the WHOLE app — backend (routes + v4) and frontend (components + pages) — from one declarative spec. */
export function buildApp(spec: AppSpec): BuiltApp {
  const defs: Record<string, SchemaOrRef> = Object.fromEntries(spec.entities.map((e) => [e.name, e.schema]));

  // tiers
  const blocks = spec.entities.flatMap((e) => [tableBlock(e, defs), formBlock(e, defs)]);
  const sections = spec.entities.map((e) => crudSection(e));
  const pages = spec.pages ?? [appPage("App", sections.map((s) => s.name))];
  const reg = registry({ components: ["ShadcnForm", "ShadcnTable"], blocks, sections, pages });

  // backend
  const routes = spec.entities.flatMap((e) => crudRoutesFromSchema(e.name, e.schema, defs));
  const { document } = emitV4(routes, { info: { title: spec.info?.title ?? "App", version: spec.info?.version ?? "0.0.0" } });

  // frontend
  const components = spec.entities.flatMap((e) => [
    { name: `${e.name}Form`, tsx: renderFormTsx(formSpec(e.schema, { defs }), { componentName: `${e.name}Form`, schemaName: `${e.name}Schema` }) },
    { name: `${e.name}Table`, tsx: renderTableTsx(tableSpec(e.schema, { defs }), { componentName: `${e.name}Table` }) },
  ]);
  const renderedPages = pages.map((p) => ({ name: p.name, tsx: renderPageTsx(p, reg, { baseUrl: spec.baseUrl }) }));

  return {
    entities: spec.entities,
    registry: reg,
    backend: { routes, document },
    frontend: { components, pages: renderedPages },
    errors: validateAll(reg),
  };
}
