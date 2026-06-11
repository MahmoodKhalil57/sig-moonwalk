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
  /** value VALIDATION (checked by validate()/assertEnv(), never by the display-only manifest): */
  /** the value, when present, must match this regex (source string or RegExp). */
  pattern?: string | RegExp;
  /** the value, when present, must be at least this long (a too-short secret is a real misconfiguration). */
  minLength?: number;
  /** required ONLY when validating for one of these surfaces (in addition to `required`, which is always). */
  requiredInSurface?: Surface[];
  /** value patterns that are FORBIDDEN on specific surfaces — e.g. a `sk_test_` key on `cloudflare`. Default
   *  severity "warning" (a gated nudge); set "error" to fail closed. */
  forbidInSurface?: { pattern: string | RegExp; surfaces: Surface[]; message?: string; severity?: IssueSeverity }[];
}
export type EnvSpec = Record<string, VarSpec>;

export type IssueSeverity = "error" | "warning";
export interface EnvIssue { name: string; severity: IssueSeverity; code: "missing" | "too-short" | "pattern" | "forbidden-in-surface"; message: string }
export interface AssertOptions {
  /** the surface being validated (gates requiredInSurface + forbidInSurface). */
  surface?: Surface;
  /** var names whose ERRORS are downgraded to allowed (an explicit, auditable override). */
  allow?: string[];
  /** called once per warning (e.g. console.warn) — assertEnv never throws on warnings. */
  onWarn?: (issue: EnvIssue) => void;
}

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
  /** validate VALUES (presence incl. requiredInSurface, minLength, pattern, forbidInSurface) → a graded issue list. */
  validate(source?: Record<string, string | undefined>, opts?: AssertOptions): EnvIssue[];
  /** FAIL-CLOSED gate: throw on any error-severity issue (warnings go to onWarn); else return the parsed config.
   *  Call at startup so a misconfigured/short/test secret in prod stops the process instead of shipping. */
  assertEnv(source?: Record<string, string | undefined>, opts?: AssertOptions): Parsed<S>;
  /**
   * config health, computed from the RAW .env record (raw = parseEnv(fileContent), so secret values are still
   * encrypted tokens). Pass the runtime env too if you want presence to also count vars set outside the file.
   */
  manifest(raw?: Record<string, string | undefined>, runtime?: Record<string, string | undefined>): ManifestEntry[];
}

export function defineEnv<S extends EnvSpec>(spec: S): DefinedEnv<S> {
  const keys = Object.keys(spec) as (keyof S & string)[];
  const surfacesOf = (k: keyof S & string) => spec[k].surfaces ?? (["local", "cloudflare", "preview", "ci", "vscode"] as Surface[]);

  const parse = (source: Record<string, string | undefined> = (typeof process !== "undefined" ? process.env : {})): Parsed<S> => {
    const out: Record<string, string> = {};
    const missing: string[] = [];
    for (const k of keys) {
      const v = source[k] ?? spec[k].default;
      if (v === undefined || v === "") { if (spec[k].required) missing.push(k); continue; }
      out[k] = v;
    }
    if (missing.length) throw new Error(`@suluk/env: missing required config: ${missing.join(", ")}`);
    return out as Parsed<S>;
  };

  const re = (p: string | RegExp): RegExp => (typeof p === "string" ? new RegExp(p) : p);
  const validate = (source: Record<string, string | undefined> = (typeof process !== "undefined" ? process.env : {}), opts: AssertOptions = {}): EnvIssue[] => {
    const { surface } = opts;
    const issues: EnvIssue[] = [];
    for (const name of keys) {
      const s = spec[name];
      const val = source[name] ?? s.default;
      const requiredHere = s.required || (surface != null && (s.requiredInSurface ?? []).includes(surface));
      if (val === undefined || val === "") {
        if (requiredHere) issues.push({ name, severity: "error", code: "missing", message: `${name} is required${surface ? ` on surface "${surface}"` : ""}` });
        continue;
      }
      if (s.minLength != null && val.length < s.minLength) issues.push({ name, severity: "error", code: "too-short", message: `${name} must be at least ${s.minLength} chars (got ${val.length})` });
      if (s.pattern != null && !re(s.pattern).test(val)) issues.push({ name, severity: "error", code: "pattern", message: `${name} does not match ${re(s.pattern)}` });
      for (const f of s.forbidInSurface ?? []) {
        if (surface != null && f.surfaces.includes(surface) && re(f.pattern).test(val))
          issues.push({ name, severity: f.severity ?? "warning", code: "forbidden-in-surface", message: f.message ?? `${name} matches a value forbidden on surface "${surface}"` });
      }
    }
    return issues;
  };

  return {
    spec, keys, parse, validate,
    assertEnv(source = (typeof process !== "undefined" ? process.env : {}), opts = {}) {
      const issues = validate(source, opts);
      const allow = new Set(opts.allow ?? []);
      const errors = issues.filter((i) => i.severity === "error" && !allow.has(i.name));
      if (opts.onWarn) for (const w of issues.filter((i) => i.severity === "warning")) opts.onWarn(w);
      if (errors.length) throw new Error(`@suluk/env: config failed validation (fail-closed) —\n  ${errors.map((e) => e.message).join("\n  ")}`);
      return parse(source);
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
