import { test, expect, describe } from "bun:test";
import { formSpec, renderFormTsx } from "../src/index";
import type { SchemaOrRef } from "@suluk/core";

const schema = {
  type: "object",
  properties: {
    launchAt: { type: "string", format: "date-time" },
    avatar: { type: "string", format: "binary" },
    bio: { type: "string", "x-suluk-widget": "richtext" },
    body: { type: "string", contentMediaType: "text/html" },
    authorId: { type: "integer", "x-suluk-relation": "User" },
    plain: { type: "string" },
  },
} as unknown as SchemaOrRef;

describe("richer widgets — detection (Phase 2)", () => {
  const spec = formSpec(schema);
  const widget = (name: string) => spec.fields.find((f) => f.name === name)?.widget;

  test("date-time → datetime; binary → file; html/richtext-hint → richtext; relation ext → relation", () => {
    expect(widget("launchAt")).toBe("datetime");
    expect(widget("avatar")).toBe("file");
    expect(widget("bio")).toBe("richtext");
    expect(widget("body")).toBe("richtext");
    expect(widget("authorId")).toBe("relation");
    expect(widget("plain")).toBe("text");
  });

  test("the relation field captures its target entity", () => {
    expect(spec.fields.find((f) => f.name === "authorId")?.relation).toBe("User");
  });
});

describe("richer widgets — render (Phase 2)", () => {
  const tsx = renderFormTsx(formSpec(schema));

  test("emits the right control per new widget", () => {
    expect(tsx).toContain('<Input type="datetime-local"');
    expect(tsx).toContain('<Input type="file" onChange={(e) => field.onChange(e.target.files?.[0])} />');
    expect(tsx).toContain("<RichTextEditor value={field.value} onChange={field.onChange} />");
    expect(tsx).toContain('<EntitySelect entity="User" value={field.value} onValueChange={field.onChange} />');
  });

  test("imports the app-provided richtext + relation components", () => {
    expect(tsx).toContain('import { RichTextEditor } from "@/components/ui/rich-text-editor";');
    expect(tsx).toContain('import { EntitySelect } from "@/components/ui/entity-select";');
  });
});
