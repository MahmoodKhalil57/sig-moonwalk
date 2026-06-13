/** Entity model — read the v4 document and produce, for each managed entity, its REST base path, inferred fields,
 *  title field, and which CRUD ops are available (derived from the operations present — so a per-role PROJECTED
 *  document yields a per-role panel automatically: ops the role can't perform simply aren't there). */
import type { OpenAPIv4Document } from "@suluk/core";
import { fieldsOf, titleField, type Field, type FieldsOptions } from "./fields";

export interface EntityModel {
  name: string;
  path: string;
  fields: Field[];
  title: string;
  access: { list: boolean; create: boolean; update: boolean; delete: boolean };
}

const NON_ENTITY = /^(ProblemDetails|Error|HttpError|.*ErrorResponse)$/;
type Doc = OpenAPIv4Document & { paths?: Record<string, { requests?: Record<string, unknown> }>; components?: { schemas?: Record<string, Record<string, unknown>> } };

function isEntitySchema(s: Record<string, unknown> | undefined): boolean {
  return !!s && s.type === "object" && !!s.properties && Object.keys(s.properties as object).length > 0;
}

export function entityModels(doc: Doc, opts: FieldsOptions = {}): EntityModel[] {
  const schemas = doc.components?.schemas ?? {};
  const entitySet = new Set(Object.keys(schemas).filter((n) => isEntitySchema(schemas[n]) && !NON_ENTITY.test(n)));
  const opPath = new Map<string, string>();
  for (const [p, pi] of Object.entries(doc.paths ?? {})) for (const op of Object.keys(pi.requests ?? {})) if (!opPath.has(op)) opPath.set(op, p);

  const out: EntityModel[] = [];
  for (const name of entitySet) {
    const listOp = `list${name}`;
    if (!opPath.has(listOp)) continue; // not a CRUD-managed entity (e.g. an auth/value schema)
    const fields = fieldsOf(schemas[name], entitySet, opts);
    const base = opPath.get(listOp)!;
    out.push({
      name, path: base.startsWith("/") ? base : "/" + base, fields, title: titleField(fields),
      access: { list: true, create: opPath.has(`create${name}`), update: opPath.has(`update${name}`), delete: opPath.has(`delete${name}`) },
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
