/**
 * v4 "Suluk" Schema Object (JSON Schema 2020-12) → Zod.
 *
 * The inverse of {@link zodToV4} over the representable subset. Designed for a clean FIXPOINT: for any Zod
 * schema s, zodToV4(v4ToZod(zodToV4(s))) deep-equals zodToV4(s). The trick for string formats and the
 * safe-integer sentinel: recognize the marker and rebuild with the Zod constructor that re-emits it
 * identically, rather than literally replaying min/max/pattern (which would double up).
 *
 * `$ref` is resolved against an optional defs map (e.g. components.schemas / $defs); unknown refs throw.
 */
import * as z from "zod";

export interface V4ToZodOptions {
  /** Resolver for `$ref`: a map of pointer → schema, or a function. Supports "#/$defs/X", "#/components/schemas/X". */
  defs?: Record<string, unknown> | ((ref: string) => unknown);
}

type JSchema = Record<string, unknown> | boolean;

// Zod 4 emits these bounds for z.int(); recognizing the sentinel keeps the fixpoint exact.
const SAFE_INT_MIN = -9007199254740991;
const SAFE_INT_MAX = 9007199254740991;

function resolveRef(ref: string, defs: V4ToZodOptions["defs"]): unknown {
  if (typeof defs === "function") return defs(ref);
  if (defs && typeof defs === "object") {
    if (ref in defs) return defs[ref];
    const name = ref.split("/").pop()!;
    if (name in defs) return defs[name];
  }
  throw new Error(`v4ToZod: cannot resolve $ref ${ref} (pass options.defs to resolve it)`);
}

/** Re-attach JSON-Schema annotations (description / default / title / examples) onto a built Zod type. */
function applyMeta(zt: z.ZodType, s: Record<string, unknown>): z.ZodType {
  let out = zt;
  if (typeof s.default !== "undefined") out = out.default(s.default as never);
  if (typeof s.description === "string") out = out.describe(s.description);
  const meta: Record<string, unknown> = {};
  if (typeof s.title === "string") meta.title = s.title;
  if (Array.isArray(s.examples)) meta.examples = s.examples;
  if (s["x-zod"] && typeof s["x-zod"] === "object") meta["x-zod"] = s["x-zod"];
  if (Object.keys(meta).length) out = out.meta(meta);
  return out;
}

function stringType(s: Record<string, unknown>): z.ZodType {
  // recognize a format and rebuild with the canonical constructor (reproduces format + pattern identically).
  switch (s.format) {
    case "email": return z.email();
    case "uuid": return z.uuid();
    case "uri": return z.url();
    case "date-time": return z.iso.datetime();
    case "date": return z.iso.date();
    case "time": return z.iso.time();
    case "duration": return z.iso.duration();
  }
  let st = z.string();
  if (typeof s.minLength === "number") st = st.min(s.minLength);
  if (typeof s.maxLength === "number") st = st.max(s.maxLength);
  if (typeof s.pattern === "string") st = st.regex(new RegExp(s.pattern));
  return st;
}

function numberType(s: Record<string, unknown>, integer: boolean): z.ZodType {
  if (integer && s.minimum === SAFE_INT_MIN && s.maximum === SAFE_INT_MAX) return z.int();
  let nt = integer ? z.number().int() : z.number();
  if (typeof s.minimum === "number") nt = nt.min(s.minimum);
  if (typeof s.maximum === "number") nt = nt.max(s.maximum);
  if (typeof s.exclusiveMinimum === "number") nt = nt.gt(s.exclusiveMinimum);
  if (typeof s.exclusiveMaximum === "number") nt = nt.lt(s.exclusiveMaximum);
  if (typeof s.multipleOf === "number") nt = nt.multipleOf(s.multipleOf);
  return nt;
}

function objectType(s: Record<string, unknown>, opts: V4ToZodOptions): z.ZodType {
  const props = s.properties as Record<string, JSchema> | undefined;
  const ap = s.additionalProperties;

  // record forms: keyed map, no fixed properties.
  if (!props && (s.propertyNames || (ap && typeof ap === "object"))) {
    const key = s.propertyNames ? convert(s.propertyNames as JSchema, opts) : z.string();
    const val = ap && typeof ap === "object" ? convert(ap as JSchema, opts) : z.any();
    return z.record(key as z.ZodType<string | number | symbol>, val);
  }

  const required = new Set((s.required as string[] | undefined) ?? []);
  const shape: Record<string, z.ZodType> = {};
  for (const [name, ps] of Object.entries(props ?? {})) {
    const child = convert(ps, opts);
    shape[name] = required.has(name) ? child : child.optional();
  }
  // additionalProperties policy: false ⇒ strict object (z.object); {} ⇒ loose; schema ⇒ catchall.
  if (ap === false || ap === undefined) return z.object(shape);
  if (ap === true) return z.looseObject(shape);
  if (ap !== null && typeof ap === "object" && Object.keys(ap).length === 0) return z.looseObject(shape);
  return z.object(shape).catchall(convert(ap as JSchema, opts));
}

function arrayType(s: Record<string, unknown>, opts: V4ToZodOptions): z.ZodType {
  if (Array.isArray(s.prefixItems)) {
    const items = (s.prefixItems as JSchema[]).map((p) => convert(p, opts));
    return z.tuple(items as [z.ZodType, ...z.ZodType[]]);
  }
  const item = s.items ? convert(s.items as JSchema, opts) : z.any();
  let at = z.array(item);
  if (typeof s.minItems === "number") at = at.min(s.minItems);
  if (typeof s.maxItems === "number") at = at.max(s.maxItems);
  return at;
}

/** Core recursive conversion of one v4/JSON-Schema node to a Zod type. */
export function convert(node: JSchema, opts: V4ToZodOptions = {}): z.ZodType {
  if (node === true || (typeof node === "object" && Object.keys(node).length === 0)) return z.any();
  if (node === false) return z.never();
  const s = node as Record<string, unknown>;

  if (typeof s.$ref === "string") return convert(resolveRef(s.$ref, opts.defs) as JSchema, opts);

  // const / enum
  if ("const" in s) return applyMeta(z.literal(s.const as never), s);
  if (Array.isArray(s.enum)) {
    const vals = s.enum as unknown[];
    const allStrings = vals.every((v) => typeof v === "string");
    const zt = allStrings ? z.enum(vals as string[]) : z.union(vals.map((v) => z.literal(v as never)) as unknown as [z.ZodType, z.ZodType, ...z.ZodType[]]);
    return applyMeta(zt, s);
  }

  // nullable sugar: anyOf [T, {type:null}]  →  T.nullable()
  if (Array.isArray(s.anyOf)) {
    const branches = s.anyOf as JSchema[];
    const nullIdx = branches.findIndex((b) => typeof b === "object" && (b as Record<string, unknown>).type === "null");
    if (branches.length === 2 && nullIdx >= 0) {
      const other = branches[1 - nullIdx];
      return applyMeta(convert(other, opts).nullable(), s);
    }
    return applyMeta(z.union(branches.map((b) => convert(b, opts)) as [z.ZodType, z.ZodType, ...z.ZodType[]]), s);
  }
  if (Array.isArray(s.oneOf)) {
    return applyMeta(z.union((s.oneOf as JSchema[]).map((b) => convert(b, opts)) as [z.ZodType, z.ZodType, ...z.ZodType[]]), s);
  }
  if (Array.isArray(s.allOf)) {
    const parts = (s.allOf as JSchema[]).map((b) => convert(b, opts));
    return applyMeta(parts.reduce((acc, p) => z.intersection(acc, p)), s);
  }

  // type-driven
  const type = s.type;
  if (Array.isArray(type)) {
    // e.g. ["string","null"] → nullable
    if (type.length === 2 && type.includes("null")) {
      const base = type.find((t) => t !== "null")!;
      return applyMeta(convert({ ...s, type: base } as JSchema, opts).nullable(), s);
    }
    return applyMeta(z.union(type.map((t) => convert({ ...s, type: t } as JSchema, opts)) as [z.ZodType, z.ZodType, ...z.ZodType[]]), s);
  }
  switch (type) {
    case "string": return applyMeta(stringType(s), s);
    case "integer": return applyMeta(numberType(s, true), s);
    case "number": return applyMeta(numberType(s, false), s);
    case "boolean": return applyMeta(z.boolean(), s);
    case "null": return applyMeta(z.null(), s);
    case "object": return applyMeta(objectType(s, opts), s);
    case "array": return applyMeta(arrayType(s, opts), s);
  }
  // no type keyword but object-ish keywords present
  if (s.properties || s.additionalProperties !== undefined || s.propertyNames) return applyMeta(objectType(s, opts), s);
  if (s.items || s.prefixItems) return applyMeta(arrayType(s, opts), s);
  return z.any();
}

/** Convert a v4 Schema Object to a Zod schema. */
export function v4ToZod(schema: JSchema, opts: V4ToZodOptions = {}): z.ZodType {
  return convert(schema, opts);
}
