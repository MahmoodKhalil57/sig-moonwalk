/**
 * @suluk/shadcn tests — prove the Schema-Object → descriptor → TSX chain over a Pet schema built with @suluk/zod.
 * CANDIDATE tooling.
 */
import { test, expect, describe } from "bun:test";
import * as z from "zod";
import { zodToV4 } from "@suluk/zod";
import {
  formSpec,
  tableSpec,
  renderFormTsx,
  renderTableTsx,
  type FieldSpec,
} from "../src/index";

// Build the Pet v4 Schema Object via the real @suluk/zod converter (Zod is the source of truth).
const Pet = z.object({
  name: z.string(),
  status: z.enum(["available", "pending", "sold"]),
  age: z.number(),
  active: z.boolean(),
  bio: z.string(),
});
const petSchema = zodToV4(Pet).schema; // a v4 Schema Object (JSON Schema 2020-12)

/** Find a field by name (helper to keep assertions readable). */
function field(fields: FieldSpec[], name: string): FieldSpec {
  const f = fields.find((x) => x.name === name);
  if (!f) throw new Error(`field '${name}' not found`);
  return f;
}

describe("formSpec — object Schema Object → form fields", () => {
  const spec = formSpec(petSchema);

  test("name is a required text field", () => {
    const f = field(spec.fields, "name");
    expect(f.widget).toBe("text");
    expect(f.required).toBe(true);
  });

  test("status is a select carrying the enum options", () => {
    const f = field(spec.fields, "status");
    expect(f.widget).toBe("select");
    expect(f.options).toEqual(["available", "pending", "sold"]);
  });

  test("age is a number field", () => {
    expect(field(spec.fields, "age").widget).toBe("number");
  });

  test("active is a switch field", () => {
    expect(field(spec.fields, "active").widget).toBe("switch");
  });

  test("all five properties became fields, with no honest losses", () => {
    expect(spec.fields.map((f) => f.name).sort()).toEqual(["active", "age", "bio", "name", "status"]);
    expect(spec.warnings).toEqual([]);
  });

  test("widget mapping covers email / url / date / textarea formats", () => {
    const Contact = z.object({
      mail: z.email(),
      site: z.url(),
      born: z.iso.date(),
      bio: z.string().max(500), // maxLength > 120 → textarea
    });
    const f = formSpec(zodToV4(Contact).schema).fields;
    expect(field(f, "mail").widget).toBe("email");
    expect(field(f, "site").widget).toBe("url");
    expect(field(f, "born").widget).toBe("date");
    expect(field(f, "bio").widget).toBe("textarea");
  });

  test("required vs optional is read from the schema's required[]", () => {
    const M = z.object({ a: z.string(), b: z.string().optional() });
    const f = formSpec(zodToV4(M).schema).fields;
    expect(field(f, "a").required).toBe(true);
    expect(field(f, "b").required).toBe(false);
  });

  test("a non-object root yields zero fields plus an enumerated warning (never silent)", () => {
    const arr = zodToV4(z.array(Pet)).schema;
    const spec = formSpec(arr);
    expect(spec.fields).toEqual([]);
    expect(spec.warnings.length).toBeGreaterThan(0);
  });
});

describe("formSpec — $ref resolution via opts.defs", () => {
  test("resolves a top-level OpenAPI Reference Object by name", () => {
    const spec = formSpec({ $ref: "#/components/schemas/Pet" }, { defs: { Pet: petSchema } });
    expect(field(spec.fields, "status").widget).toBe("select");
    expect(spec.warnings).toEqual([]);
  });

  test("an unresolvable $ref warns and yields no fields", () => {
    const spec = formSpec({ $ref: "#/components/schemas/Missing" }, { defs: {} });
    expect(spec.fields).toEqual([]);
    expect(spec.warnings.length).toBeGreaterThan(0);
  });
});

describe("tableSpec — columns derived from properties", () => {
  test("object schema → columns from its properties, with types", () => {
    const spec = tableSpec(petSchema);
    expect(spec.columns.map((c) => c.key).sort()).toEqual(["active", "age", "bio", "name", "status"]);
    const byKey = Object.fromEntries(spec.columns.map((c) => [c.key, c.type]));
    expect(byKey.name).toBe("string");
    expect(byKey.age).toBe("number");
    expect(byKey.active).toBe("boolean");
    expect(spec.warnings).toEqual([]);
  });

  test("array schema → columns from items' properties", () => {
    const spec = tableSpec(zodToV4(z.array(Pet)).schema);
    expect(spec.columns.map((c) => c.key).sort()).toEqual(["active", "age", "bio", "name", "status"]);
  });
});

describe("renderFormTsx — shadcn <Form> codegen", () => {
  const tsx = renderFormTsx(formSpec(petSchema), { componentName: "PetForm", schemaName: "PetSchema" });

  test("contains the react-hook-form + zodResolver wiring", () => {
    expect(tsx).toContain("useForm");
    expect(tsx).toContain("zodResolver");
    expect(tsx).toContain("handleSubmit");
  });

  test("contains a FormField per field and the Input control", () => {
    expect(tsx).toContain("FormField");
    expect(tsx).toContain("<Input");
    // one FormField per property
    const count = tsx.split("<FormField").length - 1;
    expect(count).toBe(5);
  });

  test("emits a <Select with a SelectItem per enum option (because of status)", () => {
    expect(tsx).toContain("<Select");
    expect(tsx).toContain(`<SelectItem value="available"`);
    expect(tsx).toContain(`<SelectItem value="pending"`);
    expect(tsx).toContain(`<SelectItem value="sold"`);
  });

  test("emits a <Switch for the boolean field and a submit <Button>", () => {
    expect(tsx).toContain("<Switch");
    expect(tsx).toContain('<Button type="submit">');
  });

  test("the component is named as requested and labelled CANDIDATE", () => {
    expect(tsx).toContain("export function PetForm()");
    expect(tsx).toContain("CANDIDATE");
  });
});

describe("renderTableTsx — shadcn <Table> codegen", () => {
  const tsx = renderTableTsx(tableSpec(petSchema), { componentName: "PetTable" });

  test("contains the Table skeleton", () => {
    expect(tsx).toContain("<Table");
    expect(tsx).toContain("<TableHeader>");
    expect(tsx).toContain("<TableBody>");
  });

  test("has a TableHead per column header", () => {
    for (const header of ["Name", "Status", "Age", "Active", "Bio"]) {
      expect(tsx).toContain(`<TableHead>${header}</TableHead>`);
    }
  });

  test("the component is named as requested and labelled CANDIDATE", () => {
    expect(tsx).toContain("export function PetTable(");
    expect(tsx).toContain("CANDIDATE");
  });
});
