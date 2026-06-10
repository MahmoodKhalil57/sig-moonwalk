import { test, expect, describe } from "bun:test";
import * as z from "zod";
import { zodToV4, v4ToZod } from "../src/index";

/** The losslessness invariant for the chain (Zod is source of truth): a single v4 round-trip is a FIXPOINT. */
function fixpoint(label: string, schema: z.ZodType) {
  test(`fixpoint: ${label}`, () => {
    const json1 = zodToV4(schema).schema;
    const back = v4ToZod(json1);
    const json2 = zodToV4(back).schema;
    expect(json2).toEqual(json1);
  });
}

describe("Zod → v4 → Zod is a fixpoint over the representable subset", () => {
  fixpoint("string", z.string());
  fixpoint("string min/max", z.string().min(2).max(8));
  fixpoint("string regex", z.string().regex(/^a+$/));
  fixpoint("email format", z.email());
  fixpoint("uuid format", z.uuid());
  fixpoint("url format", z.url());
  fixpoint("iso datetime", z.iso.datetime());
  fixpoint("number", z.number());
  fixpoint("number range", z.number().min(0).max(10));
  fixpoint("int (safe-int sentinel)", z.int());
  fixpoint("int range", z.number().int().min(1).max(5));
  fixpoint("boolean", z.boolean());
  fixpoint("literal", z.literal("hello"));
  fixpoint("enum", z.enum(["a", "b", "c"]));
  fixpoint("nullable", z.string().nullable());
  fixpoint("union", z.union([z.string(), z.number()]));
  fixpoint("array", z.array(z.string()));
  fixpoint("array min/max", z.array(z.number()).min(1).max(3));
  fixpoint("tuple", z.tuple([z.string(), z.number()]));
  fixpoint("record", z.record(z.string(), z.number()));
  fixpoint("strict object", z.object({ a: z.string(), b: z.number().optional() }));
  fixpoint("loose object", z.looseObject({ a: z.string() }));
  fixpoint("object with catchall", z.object({ a: z.string() }).catchall(z.boolean()));
  fixpoint("described", z.string().describe("a name"));
  fixpoint("nested", z.object({
    user: z.object({ name: z.string().min(1), email: z.email(), age: z.number().int().optional() }),
    tags: z.array(z.string()),
    role: z.enum(["admin", "user"]),
    bio: z.string().nullable(),
  }));
});

describe("round-tripped Zod preserves validation semantics", () => {
  test("a rebuilt schema accepts/rejects the same values as the original", () => {
    const original = z.object({
      name: z.string().min(2),
      age: z.number().int(),
      email: z.email(),
      role: z.enum(["a", "b"]),
      nickname: z.string().optional(),
    });
    const rebuilt = v4ToZod(zodToV4(original).schema);
    const good = { name: "Jo", age: 30, email: "j@x.com", role: "a" };
    const badName = { name: "J", age: 30, email: "j@x.com", role: "a" };
    const badEmail = { name: "Jo", age: 30, email: "nope", role: "a" };
    const badRole = { name: "Jo", age: 30, email: "j@x.com", role: "c" };
    for (const [v, ok] of [[good, true], [badName, false], [badEmail, false], [badRole, false]] as const) {
      expect(rebuilt.safeParse(v).success).toBe(ok);
      expect(original.safeParse(v).success).toBe(ok); // sanity: same verdict on the original
    }
  });
});

describe("honest lossy boundary (enumerated, not silent)", () => {
  test("transform/refine are reported in warnings", () => {
    const withRefine = z.string().refine((s) => s.length > 3);
    const { warnings } = zodToV4(withRefine);
    expect(warnings.length).toBeGreaterThan(0);
  });
  test("a plain representable schema has zero warnings (fully lossless)", () => {
    expect(zodToV4(z.object({ a: z.string(), b: z.number() })).warnings).toEqual([]);
  });
});

describe("$ref resolution against a defs map", () => {
  test("resolves #/components/schemas/Pet by name", () => {
    const defs = { Pet: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } };
    const zt = v4ToZod({ $ref: "#/components/schemas/Pet" }, { defs });
    expect(zt.safeParse({ name: "Rex" }).success).toBe(true);
    expect(zt.safeParse({}).success).toBe(false);
  });
});
