import { test, expect, describe } from "bun:test";
import { lexicalSchema, LEXICAL_V4_SCHEMA, type LexicalState } from "../src/index";

describe("Lexical rich-text typing (Phase 2)", () => {
  const valid: LexicalState = {
    root: {
      type: "root",
      children: [
        { type: "paragraph", children: [{ type: "text", text: "hello", format: 1 }] },
      ],
      direction: "ltr",
    },
  };

  test("lexicalSchema accepts a well-formed editor state (recursive children)", () => {
    expect(lexicalSchema.safeParse(valid).success).toBe(true);
  });

  test("rejects a non-root root and a missing root", () => {
    expect(lexicalSchema.safeParse({ root: { type: "paragraph", children: [] } }).success).toBe(false);
    expect(lexicalSchema.safeParse({}).success).toBe(false);
    expect(lexicalSchema.safeParse({ root: { type: "root" } }).success).toBe(false); // children required
  });

  test("nodes are open (passthrough) — node-type-specific fields survive", () => {
    const withExtras = { root: { type: "root", children: [{ type: "heading", tag: "h1", children: [] }] } };
    const parsed = lexicalSchema.parse(withExtras);
    expect((parsed.root.children[0] as { tag?: string }).tag).toBe("h1");
  });

  test("the v4 projection is recursive via a $defs self-$ref + carries the richtext widget hint", () => {
    expect(LEXICAL_V4_SCHEMA["x-suluk-widget"]).toBe("richtext");
    expect((LEXICAL_V4_SCHEMA.$defs.lexicalNode.properties.children as { items: unknown }).items)
      .toEqual({ $ref: "#/$defs/lexicalNode" });
    expect((LEXICAL_V4_SCHEMA.properties.root.properties.children as { items: unknown }).items)
      .toEqual({ $ref: "#/$defs/lexicalNode" });
  });
});
