/**
 * defineEnv — config as a single source of truth. Declare each variable ONCE (its surfaces, whether it is a
 * secret, its default, whether it is required) and project that one declaration everywhere:
 *   • typed, validated access            → `env.parse(process.env).STRIPE_SECRET_KEY` (required ones are non-null)
 *   • a per-surface manifest             → which keys local / cloudflare / preview / a teammate / vscode each need
 *   • a config-HEALTH view               → present? encrypted-at-rest? a secret sitting in plaintext? missing?
 * The admin panel renders the health, the deploy planner reads `forSurface("cloudflare")` to know which secrets to
 * push, and the VS Code extension shows what's missing locally — all from this one object. (The entity registry,
 * but for config.)
 */
// a value is "encrypted at rest" iff it's an `encrypted:…` token. Inlined (not imported from ./crypto) so the
// registry/manifest carry NO dependency on @noble/post-quantum — a Worker that only renders config-health stays light.
const isEncrypted = (v: string): boolean => v.startsWith("encrypted:");

export type Surface = "local" | "cloudflare" | "preview" | "ci" | "vscode" | (string & {});

export interface VarSpec {
  /** a secret — its value must be ENCRYPTED at rest in the committed .env (plaintext is flagged). */
  secret?: boolean;
  /** must be present (after defaults) — else parse() throws and health = "missing". */
  required?: boolean;
  /** fallback value when absent. */
  default?: string;
  /** which surfaces need this var (default: every surface). Drives the deploy/vscode projections. */
  surfaces?: Surface[];
  description?: string;
  example?: string;
}
export type EnvSpec = Record<string, VarSpec>;

// required vars (and vars with a default) are non-optional in the parsed type; everything else is string|undefined.
type ParsedKeys<S extends EnvSpec> = { [K in keyof S]: S[K] extends { required: true } ? K : S[K] extends { default: string } ? K : never }[keyof S];
export type Parsed<S extends EnvSpec> = { [K in ParsedKeys<S>]: string } & { [K in Exclude<keyof S, ParsedKeys<S>>]?: string };

export type HealthStatus = "ok" | "missing" | "plaintext-secret" | "empty";
export interface ManifestEntry {
  name: string; secret: boolean; required: boolean; surfaces: Surface[];
  description?: string; example?: string;
  present: boolean; encrypted: boolean; status: HealthStatus;
}

export interface DefinedEnv<S extends EnvSpec> {
  spec: S;
  keys: (keyof S & string)[];
  /** validate a source (process.env or a parsed .env), apply defaults, throw on a missing required var. */
  parse(source?: Record<string, string | undefined>): Parsed<S>;
  /** the var names a given surface needs (for the deploy planner / vscode). */
  forSurface(surface: Surface): (keyof S & string)[];
  /**
   * config health, computed from the RAW .env record (raw = parseEnv(fileContent), so secret values are still
   * encrypted tokens). Pass the runtime env too if you want presence to also count vars set outside the file.
   */
  manifest(raw?: Record<string, string | undefined>, runtime?: Record<string, string | undefined>): ManifestEntry[];
}

export function defineEnv<S extends EnvSpec>(spec: S): DefinedEnv<S> {
  const keys = Object.keys(spec) as (keyof S & string)[];
  const surfacesOf = (k: keyof S & string) => spec[k].surfaces ?? (["local", "cloudflare", "preview", "ci", "vscode"] as Surface[]);

  return {
    spec, keys,
    parse(source = (typeof process !== "undefined" ? process.env : {})) {
      const out: Record<string, string> = {};
      const missing: string[] = [];
      for (const k of keys) {
        const v = source[k] ?? spec[k].default;
        if (v === undefined || v === "") { if (spec[k].required) missing.push(k); continue; }
        out[k] = v;
      }
      if (missing.length) throw new Error(`@suluk/env: missing required config: ${missing.join(", ")}`);
      return out as Parsed<S>;
    },
    forSurface(surface) {
      return keys.filter((k) => surfacesOf(k).includes(surface));
    },
    manifest(raw = {}, runtime = {}) {
      return keys.map((name): ManifestEntry => {
        const rawVal = raw[name];
        const present = (rawVal !== undefined && rawVal !== "") || runtime[name] !== undefined || spec[name].default !== undefined;
        const encrypted = typeof rawVal === "string" && isEncrypted(rawVal);
        const secret = Boolean(spec[name].secret);
        const status: HealthStatus =
          !present && spec[name].required ? "missing" :
          !present ? "empty" :
          secret && rawVal !== undefined && !encrypted ? "plaintext-secret" : "ok";
        return { name, secret, required: Boolean(spec[name].required), surfaces: surfacesOf(name), description: spec[name].description, example: spec[name].example, present, encrypted, status };
      });
    },
  };
}
