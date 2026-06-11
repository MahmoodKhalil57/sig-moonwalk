/**
 * Lexical rich-text typing (saastarter-parity Phase 2). A rich-text field stores a serialized Lexical editor state
 * — a recursive node tree under `{ root: … }`. This gives that state a Zod type (so a richtext field validates +
 * infers) and a hand-authored v4 (JSON Schema 2020-12) projection a contract author can drop onto a property
 * (recursive via a `$defs` self-`$ref`, which zodToV4 can't emit from a `z.lazy`). The @suluk/shadcn `richtext`
 * widget renders against this shape.
 */
import * as z from "zod";

/** A single Lexical node — recursive + open (each node type carries its own extra fields; we keep the common ones). */
export const lexicalNodeSchema: z.ZodType = z.lazy(() =>
  z
    .object({
      type: z.string(),
      version: z.number().optional(),
      children: z.array(lexicalNodeSchema).optional(),
      text: z.string().optional(),
      format: z.union([z.number(), z.string()]).optional(),
    })
    .passthrough(),
);

/** The serialized Lexical editor state — `{ root: { children: [...] } }`. The storage shape of a richtext field. */
export const lexicalSchema = z
  .object({
    root: z
      .object({
        type: z.literal("root"),
        children: z.array(lexicalNodeSchema),
        direction: z.union([z.literal("ltr"), z.literal("rtl"), z.null()]).optional(),
        format: z.union([z.string(), z.number()]).optional(),
        indent: z.number().optional(),
        version: z.number().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type LexicalState = z.infer<typeof lexicalSchema>;

/**
 * The v4 (JSON Schema 2020-12) projection of a Lexical state — recursive via a `$defs.lexicalNode` self-`$ref`.
 * Drop it onto a property (or `$ref` it from components) to declare a richtext field in a contract. Frozen.
 */
export const LEXICAL_V4_SCHEMA = Object.freeze({
  type: "object",
  title: "LexicalState",
  description: "A serialized Lexical rich-text editor state.",
  ["x-suluk-widget"]: "richtext",
  properties: {
    root: {
      type: "object",
      properties: {
        type: { const: "root" },
        children: { type: "array", items: { $ref: "#/$defs/lexicalNode" } },
        direction: { type: ["string", "null"], enum: ["ltr", "rtl", null] },
        format: { type: ["string", "number"] },
        indent: { type: "integer" },
        version: { type: "integer" },
      },
      required: ["type", "children"],
    },
  },
  required: ["root"],
  $defs: {
    lexicalNode: {
      type: "object",
      properties: {
        type: { type: "string" },
        version: { type: "integer" },
        children: { type: "array", items: { $ref: "#/$defs/lexicalNode" } },
        text: { type: "string" },
        format: { type: ["string", "number"] },
      },
      required: ["type"],
    },
  },
});
