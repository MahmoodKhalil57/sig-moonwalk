/**
 * v4 "Suluk" Schema Object → shadcn/ui descriptor model (form spec + table spec).
 *
 * A v4 Schema Object IS JSON Schema 2020-12 (SPEC C013). This module is the *analysis* corner: it reads a
 * Schema Object and projects it onto a UI-shaped descriptor (the FormSpec / TableSpec) that the renderers in
 * ./render-form and ./render-table turn into shadcn TSX. No runtime UI deps — pure inspection + codegen input.
 *
 * Honest-loss discipline (house pattern — enumerate, never drop silently): the descriptor carries a
 * `warnings: string[]` channel for every property we could not faithfully map (unresolvable $ref, boolean
 * schemas, untyped/union-typed properties, non-object roots for a form). Callers decide; nothing is silent.
 */
import { isReference, type SchemaOrRef, type Schema, type Reference } from "@suluk/core";

/** The shadcn form control we pick for a property. Drives which control the renderer emits. */
export type FieldWidget =
  | "text" | "number" | "checkbox" | "switch" | "select" | "textarea" | "date" | "email" | "url"
  | "datetime" | "file" | "richtext" | "relation";

/** Widget names accepted as an explicit `x-suluk-widget` override on a property. */
const WIDGET_HINTS = new Set<FieldWidget>([
  "text", "number", "checkbox", "switch", "select", "textarea", "date", "email", "url",
  "datetime", "file", "richtext", "relation",
]);

/** One form control, derived from a single object property. */
export interface FieldSpec {
  /** Property name = react-hook-form field name. */
  name: string;
  /** Human label (title if present, else the humanised name). */
  label: string;
  /** Which shadcn control to render. */
  widget: FieldWidget;
  /** Whether the property is in the object's `required[]`. */
  required: boolean;
  /** Schema `description`, if any (rendered as helper text). */
  description?: string;
  /** Allowed values for a `select` (the enum members, stringified). */
  options?: string[];
  /** Numeric bounds (minimum/maximum) — surfaced on number/date inputs. */
  min?: number;
  max?: number;
  /** String `pattern` (regex source) — surfaced as a hint. */
  pattern?: string;
  /** For a `relation` widget: the entity this property references (from `x-suluk-relation`). */
  relation?: string;
}

export interface FormSpec {
  fields: FieldSpec[];
  /** Properties we could not faithfully map (enumerated; never dropped silently). */
  warnings: string[];
}

/** One table column, derived from a single object property. */
export interface ColumnSpec {
  /** Property name = row accessor key. */
  key: string;
  /** Column header (title if present, else the humanised key). */
  header: string;
  /** The JSON Schema `type` of the property ("string"/"number"/… or "unknown"). */
  type: string;
}

export interface TableSpec {
  columns: ColumnSpec[];
  warnings: string[];
}

export interface SpecOptions {
  /** A `$defs`/components map so a top-level or property-level Reference can be resolved by name. */
  defs?: Record<string, SchemaOrRef>;
}

/** A normalised, plain JSON-Schema object view (boolean schemas + refs already resolved away or flagged). */
type SchemaObject = Record<string, unknown>;

/**
 * Resolve an OpenAPI Reference Object against `defs`. Returns the target schema, or `undefined` (with the
 * caller free to record a warning) when the ref is unresolvable. Supports both a bare name key and the
 * canonical "#/components/schemas/<name>" / "#/$defs/<name>" JSON-Pointer tail (C019 resolves BY NAME).
 */
function resolveRef(ref: Reference, defs: Record<string, SchemaOrRef> | undefined): SchemaOrRef | undefined {
  if (!defs) return undefined;
  const ptr = ref.$ref;
  // last path segment is the name (works for bare names and full JSON-Pointers alike)
  const name = ptr.slice(ptr.lastIndexOf("/") + 1);
  return defs[ptr] ?? defs[name];
}

/**
 * Coerce a SchemaOrRef into a plain object Schema, following one level of OpenAPI Reference. Booleans
 * (JSON Schema `true`/`false`) and unresolvable refs return `undefined`; the caller records a warning.
 */
function asObject(s: SchemaOrRef | undefined, defs: Record<string, SchemaOrRef> | undefined): SchemaObject | undefined {
  if (s === undefined) return undefined;
  if (isReference(s)) {
    const target = resolveRef(s, defs);
    if (target === undefined || isReference(target)) return undefined; // unresolved or ref-to-ref: give up (warn upstream)
    return asObject(target, defs);
  }
  if (typeof s === "boolean") return undefined; // boolean schema: no property structure to read
  return s as SchemaObject;
}

/** "firstName" / "first_name" / "first-name" → "First Name". A label is cosmetic; never load-bearing. */
function humanise(name: string): string {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The JSON-Schema `type` of a property, normalised to a single string ("unknown" when absent/union). */
function typeOf(schema: SchemaObject): string {
  const t = schema.type;
  if (typeof t === "string") return t;
  if (Array.isArray(t)) {
    // union type (e.g. ["string","null"]) — take the first non-null member for display
    const nonNull = t.find((m) => m !== "null");
    return typeof nonNull === "string" ? nonNull : "unknown";
  }
  if (Array.isArray(schema.enum)) return "string"; // bare enum implies string-ish
  return "unknown";
}

/**
 * Pick a shadcn widget for a single property Schema Object.
 *   string + enum                       → select (options = enum)
 *   string + format email/uri/url/date  → email / url / date
 *   string + (format long-ish | maxLength>120 | format "textarea") → textarea
 *   number | integer                    → number
 *   boolean                             → switch        (checkbox is also valid; switch per spec)
 *   else                                → text
 */
function pickWidget(schema: SchemaObject): FieldWidget {
  const type = typeOf(schema);
  const format = typeof schema.format === "string" ? schema.format : undefined;
  const enumMembers = Array.isArray(schema.enum) ? schema.enum : undefined;

  // contract-first overrides win: an explicit x-suluk-widget, or x-suluk-relation ⇒ a relation picker.
  const hint = schema["x-suluk-widget"];
  if (typeof hint === "string" && WIDGET_HINTS.has(hint as FieldWidget)) return hint as FieldWidget;
  if (typeof schema["x-suluk-relation"] === "string") return "relation";

  if (type === "boolean") return "switch";
  // enum → select regardless of type (a numeric enum is still a closed choice, not a free number input).
  if (enumMembers && enumMembers.length > 0) return "select";
  if (type === "number" || type === "integer") return "number";

  // string-ish from here down
  if (format === "email") return "email";
  if (format === "uri" || format === "url" || format === "uri-reference") return "url";
  if (format === "date") return "date";
  if (format === "date-time") return "datetime";
  // a binary/base64 string is a file upload; a text/html or lexical media type is rich text.
  if (format === "binary" || format === "byte" || schema.contentEncoding === "base64") return "file";
  if (schema.contentMediaType === "text/html" || schema.contentMediaType === "application/json+lexical") return "richtext";

  const maxLength = typeof schema.maxLength === "number" ? schema.maxLength : undefined;
  if ((maxLength !== undefined && maxLength > 120) || format === "textarea" || schema.contentMediaType !== undefined) {
    return "textarea";
  }
  return "text";
}

/** Stringify enum members for a select's options (drop nullish; everything else String()-ed). */
function enumOptions(schema: SchemaObject): string[] | undefined {
  if (!Array.isArray(schema.enum)) return undefined;
  return schema.enum.filter((m) => m !== null && m !== undefined).map((m) => String(m));
}

/**
 * Build a {@link FormSpec} from an object Schema Object. Each property becomes one {@link FieldSpec}.
 * A non-object root (array/scalar/boolean/unresolved-ref) yields zero fields plus a warning — honest, not silent.
 */
export function formSpec(schema: SchemaOrRef, opts: SpecOptions = {}): FormSpec {
  const warnings: string[] = [];
  const root = asObject(schema, opts.defs);

  if (!root) {
    warnings.push("formSpec: root schema is a boolean or an unresolvable $ref — no fields produced");
    return { fields: [], warnings };
  }

  const props = (root.properties && typeof root.properties === "object")
    ? (root.properties as Record<string, SchemaOrRef>)
    : undefined;
  if (!props) {
    warnings.push(`formSpec: root schema has no 'properties' (type=${typeOf(root)}) — no fields produced`);
    return { fields: [], warnings };
  }

  const requiredList = Array.isArray(root.required) ? (root.required as unknown[]).map(String) : [];
  const required = new Set(requiredList);

  const fields: FieldSpec[] = [];
  for (const [name, raw] of Object.entries(props)) {
    const prop = asObject(raw, opts.defs);
    if (!prop) {
      // boolean schema or unresolved ref in a property slot — fall back to a plain text field, but warn.
      warnings.push(`formSpec: property '${name}' is a boolean/unresolvable schema — defaulted to a text field`);
      fields.push({ name, label: titleOr(name, undefined), widget: "text", required: required.has(name) });
      continue;
    }
    const title = typeof prop.title === "string" ? prop.title : undefined;
    const field: FieldSpec = {
      name,
      label: titleOr(name, title),
      widget: pickWidget(prop),
      required: required.has(name),
    };
    if (typeof prop.description === "string") field.description = prop.description;
    const opt = enumOptions(prop);
    if (opt) field.options = opt;
    if (typeof prop.minimum === "number") field.min = prop.minimum;
    if (typeof prop.maximum === "number") field.max = prop.maximum;
    if (typeof prop.pattern === "string") field.pattern = prop.pattern;
    if (typeof prop["x-suluk-relation"] === "string") field.relation = prop["x-suluk-relation"] as string;
    fields.push(field);
  }

  return { fields, warnings };
}

/** Prefer an explicit schema `title`; else humanise the property name. */
function titleOr(name: string, title: string | undefined): string {
  return title && title.trim().length > 0 ? title : humanise(name);
}

/**
 * Build a {@link TableSpec}. An array root uses its `items` object; an object root uses its own properties.
 * Each property becomes one {@link ColumnSpec}. Non-derivable roots yield zero columns plus a warning.
 */
export function tableSpec(schema: SchemaOrRef, opts: SpecOptions = {}): TableSpec {
  const warnings: string[] = [];
  let root = asObject(schema, opts.defs);

  if (!root) {
    warnings.push("tableSpec: root schema is a boolean or an unresolvable $ref — no columns produced");
    return { columns: [], warnings };
  }

  // array → descend into items (the row shape)
  if (typeOf(root) === "array") {
    const items = asObject(root.items as SchemaOrRef | undefined, opts.defs);
    if (!items) {
      warnings.push("tableSpec: array root has no resolvable object 'items' — no columns produced");
      return { columns: [], warnings };
    }
    root = items;
  }

  const props = (root.properties && typeof root.properties === "object")
    ? (root.properties as Record<string, SchemaOrRef>)
    : undefined;
  if (!props) {
    warnings.push(`tableSpec: row schema has no 'properties' (type=${typeOf(root)}) — no columns produced`);
    return { columns: [], warnings };
  }

  const columns: ColumnSpec[] = [];
  for (const [key, raw] of Object.entries(props)) {
    const prop = asObject(raw, opts.defs);
    if (!prop) {
      warnings.push(`tableSpec: column '${key}' is a boolean/unresolvable schema — typed as 'unknown'`);
      columns.push({ key, header: titleOr(key, undefined), type: "unknown" });
      continue;
    }
    const title = typeof prop.title === "string" ? prop.title : undefined;
    columns.push({ key, header: titleOr(key, title), type: typeOf(prop) });
  }

  return { columns, warnings };
}
