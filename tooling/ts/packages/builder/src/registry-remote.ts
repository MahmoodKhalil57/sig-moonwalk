/**
 * Remote registries (L1) — the OPEN marketplace. A registry fetched from a URL is UNTRUSTED data that becomes
 * SulukModules which mutate your contract, so it must be VALIDATED before it can be browsed or installed.
 * parseRegistry accepts only well-formed module entries and surfaces the rejected ones (never silently). The
 * real safety gate is still installModule (refuse-on-collision + requires + validate-merged-doc) — this is the
 * envelope check that keeps a malformed/hostile registry from corrupting the UI before that gate runs. Pure.
 */
import type { ModuleEntry, SulukModule } from "./module";

/** A configured remote registry (persisted by the host). */
export interface RegistrySource {
  name: string;
  url: string;
}

export interface ParsedRegistry {
  name: string;
  /** only the well-formed module entries */
  modules: ModuleEntry[];
  /** malformed entries, surfaced (title + why) rather than hidden */
  rejected: { title: string; reason: string }[];
}

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}
const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Validate one UNTRUSTED module manifest, VALUE-shapes included. Returns the typed module or a human reason. */
export function validateModule(m: unknown): { module?: SulukModule; error?: string } {
  const o = asObject(m);
  if (!o) return { error: "not an object" };
  if (typeof o.name !== "string" || !o.name) return { error: "missing or empty name" };
  const where = `"${o.name}"`;
  if (typeof o.version !== "string") return { error: `${where}: missing version` };
  if (!isStringArray(o.provides)) return { error: `${where}: provides must be an array of strings` };
  if (o.requires !== undefined && !isStringArray(o.requires)) return { error: `${where}: requires must be an array of strings` };
  const schemas = asObject(o.schemas);
  if (!schemas) return { error: `${where}: schemas must be an object` };
  for (const [k, s] of Object.entries(schemas)) if (!asObject(s)) return { error: `${where}: schema "${k}" must be an object` };
  // paths: each PathItem must be a non-null object (a null/scalar value crashes the cycle projectors otherwise)
  if (o.paths !== undefined) {
    const paths = asObject(o.paths);
    if (!paths) return { error: `${where}: paths must be an object` };
    for (const [k, pi] of Object.entries(paths)) if (!asObject(pi)) return { error: `${where}: path "${k}" must be an object` };
  }
  // cost: each entry must be { components: [...], estimateMicroUsd: <finite> } — else a malformed facet is stamped verbatim
  if (o.cost !== undefined) {
    const cost = asObject(o.cost);
    if (!cost) return { error: `${where}: cost must be an object` };
    for (const [op, c] of Object.entries(cost)) {
      const co = asObject(c);
      if (!co || !Array.isArray(co.components) || typeof co.estimateMicroUsd !== "number" || !Number.isFinite(co.estimateMicroUsd)) {
        return { error: `${where}: cost "${op}" must be { components: [...], estimateMicroUsd: <number> }` };
      }
    }
  }
  if (o.providerSlots !== undefined && !asObject(o.providerSlots)) return { error: `${where}: providerSlots must be an object` };
  for (const p of o.provides) if (!hasOwn(schemas, p)) return { error: `${where}: provides "${p}" but ships no schema for it` };
  return { module: o as unknown as SulukModule };
}

/** Parse an UNTRUSTED registry payload (e.g. fetched JSON) into a ModuleRegistry, rejecting malformed entries. */
export function parseRegistry(json: unknown): ParsedRegistry {
  const root = asObject(json);
  if (!root) return { name: "(invalid)", modules: [], rejected: [{ title: "registry", reason: "not a JSON object" }] };
  const name = typeof root.name === "string" && root.name ? root.name : "(unnamed registry)";
  const entries = Array.isArray(root.modules) ? root.modules : [];
  const modules: ModuleEntry[] = [];
  const rejected: { title: string; reason: string }[] = [];
  for (const e of entries) {
    const eo = asObject(e);
    if (!eo) { rejected.push({ title: "(entry)", reason: "entry is not an object" }); continue; }
    const v = validateModule(eo.module);
    const title = typeof eo.title === "string" && eo.title ? eo.title : (asObject(eo.module)?.name as string) ?? "(entry)";
    if (v.error || !v.module) { rejected.push({ title, reason: v.error ?? "invalid module" }); continue; }
    modules.push({ title, description: typeof eo.description === "string" ? eo.description : "", module: v.module });
  }
  return { name, modules, rejected };
}
