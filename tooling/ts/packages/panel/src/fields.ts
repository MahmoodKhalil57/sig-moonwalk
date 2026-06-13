/**
 * Field-type inference — the Payload-parity core, contract-first. Given an entity's JSON-Schema (from the v4 doc's
 * components.schemas), infer the Payload-style field set: the right widget per property (text/textarea/number/
 * boolean/select/date/email/url/json/richtext/relationship), required/nullable, enum options, and relationships
 * (a `<entity>Id` whose `<Entity>` is itself an entity). No config DSL — the contract IS the config.
 */

export type FieldType =
  | "text" | "textarea" | "richtext" | "number" | "boolean"
  | "select" | "date" | "datetime" | "email" | "url" | "json" | "relationship";

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  nullable: boolean;
  readOnly: boolean;
  description?: string;
  options?: string[];          // select
  optionType?: "string" | "number" | "boolean"; // the enum's scalar type (so the form coerces select values back)
  relationTo?: string;         // relationship → entity name
  relationLabelField?: string; // which field of the related entity to show
}

type Schema = Record<string, unknown>;

const TITLE_FIELDS = ["title", "name", "label", "headline", "question", "slug", "code", "email"];
const TEXTAREA_NAMES = /^(description|excerpt|summary|message|answer|bio|notes?|abstract|subtitle)$/i;
const RICHTEXT_NAMES = /^(body|html|content|richText|markdown)$/i;
const URLISH_NAMES = /(url|link|href|image|cover|avatar|logo|photo|icon)$/i;

/** Unwrap `anyOf:[{type:X},{type:null}]` (drizzle-zod's nullable form) into the concrete branch + a nullable flag. */
function unwrap(s: Schema): { schema: Schema; nullable: boolean } {
  const anyOf = s.anyOf as Schema[] | undefined;
  if (Array.isArray(anyOf)) {
    return { schema: anyOf.find((x) => x.type !== "null") ?? {}, nullable: anyOf.some((x) => x.type === "null") };
  }
  return { schema: s, nullable: s.type === "null" };
}

/** "coverImageUrl" → "Cover Image", "categoryId" → "Category". */
export function humanize(name: string): string {
  return name.replace(/Id$/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ")
    .replace(/\burl\b/i, "URL").trim().replace(/^\w/, (c) => c.toUpperCase());
}

function widgetOf(name: string, s: Schema, entities: Set<string>): { type: FieldType; relationTo?: string; options?: string[]; optionType?: "string" | "number" | "boolean" } {
  const enumVals = s.enum as unknown[] | undefined;
  if (Array.isArray(enumVals) && enumVals.length) {
    const t = s.type as string | undefined;
    const optionType = t === "integer" || t === "number" || typeof enumVals[0] === "number" ? "number"
      : t === "boolean" || typeof enumVals[0] === "boolean" ? "boolean" : "string";
    return { type: "select", options: enumVals.map(String), optionType };
  }
  const t = s.type as string | undefined;
  const rel = /^(.*)Id$/.exec(name);
  if (rel && (t === "integer" || t === "number")) {
    const ent = rel[1].charAt(0).toUpperCase() + rel[1].slice(1);
    if (entities.has(ent)) return { type: "relationship", relationTo: ent };
  }
  // epoch-ms timestamp columns (createdAt / updatedAt / publishedAt / …) read as datetime, not a raw number
  if ((t === "integer" || t === "number") && /(At|Date)$/.test(name)) return { type: "datetime" };
  if (t === "boolean") return { type: "boolean" };
  if (t === "integer" || t === "number") return { type: "number" };
  if (t === "object" || t === "array") return { type: "json" };
  const fmt = s.format as string | undefined;
  if (fmt === "date-time") return { type: "datetime" };
  if (fmt === "date") return { type: "date" };
  if (fmt === "email" || /email/i.test(name)) return { type: "email" };
  if (RICHTEXT_NAMES.test(name)) return { type: "richtext" };
  if (TEXTAREA_NAMES.test(name)) return { type: "textarea" };
  if (fmt === "uri" || URLISH_NAMES.test(name)) return { type: "url" };
  return { type: "text" };
}

export interface FieldsOptions { hide?: string[]; readOnly?: string[] }

/** Infer the ordered field set for an entity. `entities` is the set of entity names (for relationship detection). */
export function fieldsOf(schema: Schema, entities: Set<string> = new Set(), opts: FieldsOptions = {}): Field[] {
  const props = (schema.properties ?? {}) as Record<string, Schema>;
  const required = new Set((schema.required as string[]) ?? []);
  const hide = new Set(opts.hide ?? []);
  const readOnly = new Set(["id", "createdAt", "updatedAt", ...(opts.readOnly ?? [])]);
  const out: Field[] = [];
  for (const [name, raw] of Object.entries(props)) {
    if (hide.has(name)) continue;
    const { schema: s, nullable } = unwrap(raw);
    const w = widgetOf(name, s, entities);
    out.push({
      name, label: humanize(name), type: w.type, options: w.options, optionType: w.optionType, relationTo: w.relationTo,
      relationLabelField: w.relationTo ? "name" : undefined,
      required: required.has(name) && !nullable, nullable, readOnly: readOnly.has(name),
      description: typeof s.description === "string" ? s.description : undefined,
    });
  }
  return out;
}

/** The entity's best "title" field — for list columns + relationship option labels. */
export function titleField(fields: Field[]): string {
  for (const t of TITLE_FIELDS) if (fields.some((f) => f.name === t)) return t;
  return fields.find((f) => f.type === "text" && !f.readOnly)?.name ?? "id";
}
