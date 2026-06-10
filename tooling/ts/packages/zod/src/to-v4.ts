/**
 * Zod → v4 "Suluk" Schema Object.
 *
 * A v4 Schema Object IS JSON Schema 2020-12 (SPEC C013), and Zod 4 emits exactly that via z.toJSONSchema.
 * So this direction is a thin, robust wrapper: emit 2020-12, strip the embedded `$schema` dialect marker
 * (v4 Schema Objects are embedded; the dialect is declared once at the document level), and report the
 * honest lossy boundary — Zod runtime effects that JSON Schema cannot express.
 *
 * Lossy boundary (enumerated, never silent — mirrors @suluk/openapi-compat's collision diagnostics):
 *   - .transform()/.pipe()  → the transform is dropped (output schema reflects the *input* by default)
 *   - .refine()/.superRefine()/.check()  → custom predicates are dropped (base type retained)
 * Brand (.brand<T>()) is COMPILE-TIME only in Zod 4 (no runtime node), so it round-trips as its base type
 * with zero loss. `warnings` lists the dropped effects so callers can decide (and persist them out-of-band).
 */
import * as z from "zod";

export interface ZodToV4Result {
  /** A v4 Schema Object (JSON Schema 2020-12), with the embedded `$schema` marker removed. */
  schema: Record<string, unknown>;
  /** Zod runtime effects that could not be represented (dropped). Empty ⇒ fully lossless. */
  warnings: string[];
}

/**
 * Convert a Zod schema to a v4 Schema Object. `io` picks the input vs output projection for schemas with
 * defaults/transforms ("output" is the default — the shape after parsing).
 */
export function zodToV4(schema: z.ZodType, opts: { io?: "input" | "output" } = {}): ZodToV4Result {
  const warnings: string[] = [];
  const json = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    unrepresentable: "any",
    io: opts.io ?? "output",
    override: (ctx) => {
      // best-effort detection of dropped runtime effects (Zod-internal; guarded so a shape change can't throw)
      try {
        const def = (ctx.zodSchema as { _zod?: { def?: { type?: string; checks?: unknown[] } } })._zod?.def;
        const t = def?.type;
        if (t === "transform" || t === "pipe") warnings.push("transform/pipe dropped (not representable in JSON Schema)");
        for (const c of def?.checks ?? []) {
          const check = (c as { _zod?: { def?: { check?: string } } })._zod?.def?.check;
          if (check === "custom" || check === "refine") warnings.push("custom refinement dropped (not representable in JSON Schema)");
        }
      } catch { /* internals moved — skip detection, never block conversion */ }
    },
  }) as Record<string, unknown>;
  delete json.$schema;
  return { schema: json, warnings: [...new Set(warnings)] };
}
