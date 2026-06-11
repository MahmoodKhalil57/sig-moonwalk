import { test, expect, describe } from "bun:test";
import { formSpec, tableSpec, renderDetailTsx, renderFormSkeletonTsx, renderTableSkeletonTsx, renderDetailSkeletonTsx } from "../src/index";
import type { SchemaOrRef } from "@suluk/core";

const schema = {
  type: "object",
  required: ["name"],
  properties: {
    name: { type: "string" },
    priceCents: { type: "integer" },
    inStock: { type: "boolean" },
  },
} as unknown as SchemaOrRef;

describe("detail (show) view — read-only projection (Phase 3)", () => {
  const tsx = renderDetailTsx(formSpec(schema), { componentName: "ProductDetail" });

  test("renders a definition list with a row per field + the right value expression", () => {
    expect(tsx).toContain("export function ProductDetail({ record }: { record: Record<string, unknown> })");
    expect(tsx).toContain("<dl");
    expect(tsx).toContain("<dt");
    expect(tsx).toContain('{String(record["name"] ?? "")}');
    expect(tsx).toContain('{record["inStock"] ? "Yes" : "No"}'); // booleans show Yes/No
    expect(tsx).toContain("CANDIDATE");
  });
});

describe("loading skeletons mirror each view's shape (Phase 3)", () => {
  test("form skeleton: one label+control placeholder per field + a submit placeholder", () => {
    const tsx = renderFormSkeletonTsx(formSpec(schema));
    expect(tsx).toContain('import { Skeleton } from "@/components/ui/skeleton";');
    expect((tsx.match(/Skeleton className="h-9 w-full"/g) ?? []).length).toBe(3); // 3 fields → 3 control placeholders
    expect(tsx).toContain('Skeleton className="h-9 w-24"'); // submit
  });

  test("table skeleton: a header + N body rows of cell placeholders, count configurable", () => {
    const tsx = renderTableSkeletonTsx(tableSpec(schema), { rows: 8 });
    expect(tsx).toContain("rows = 8");
    expect(tsx).toContain("Array.from({ length: rows })");
    expect(tsx).toContain("<TableHead><Skeleton");
  });

  test("detail skeleton: one placeholder row per field", () => {
    const tsx = renderDetailSkeletonTsx(formSpec(schema));
    expect((tsx.match(/grid grid-cols-3/g) ?? []).length).toBe(3); // 3 field rows
    expect(tsx).toContain("<dl");
  });

  test("an empty/unmappable schema degrades gracefully (no fields → a single placeholder, no crash)", () => {
    const empty = formSpec({ type: "object" } as unknown as SchemaOrRef);
    expect(renderFormSkeletonTsx(empty)).toContain("Skeleton");
    expect(renderDetailTsx(empty)).toContain("no fields derived");
  });
});
