/**
 * @suluk/zod — Zod ⇄ v4 "Suluk" Schema Object conversion.
 *
 * The user-facing chain is: Zod → v4 → (Scalar/Swagger render) → v4 → Zod. Zod is the source of truth and
 * v4 (= JSON Schema 2020-12) is the interchange. zodToV4 emits a v4 Schema Object; v4ToZod rebuilds a Zod
 * schema. The pair is LOSSLESS over the JSON-Schema-representable subset — proven by a fixpoint test
 * (zodToV4∘v4ToZod∘zodToV4 == zodToV4). Zod runtime effects that JSON Schema cannot express (.transform,
 * .refine) are reported by zodToV4().warnings rather than dropped silently. CANDIDATE tooling.
 */
export { zodToV4, type ZodToV4Result } from "./to-v4";
export { v4ToZod, convert, type V4ToZodOptions } from "./to-zod";
// Lexical rich-text typing (Phase 2): the storage shape of a richtext field, in Zod + a v4 projection.
export { lexicalSchema, lexicalNodeSchema, LEXICAL_V4_SCHEMA, type LexicalState } from "./lexical";
