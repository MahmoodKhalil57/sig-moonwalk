/**
 * {@link FormSpec} → shadcn/ui <Form> TSX (react-hook-form + zodResolver).
 *
 * Pure string codegen — no JSX is evaluated here; we emit a self-contained component file body as text.
 * The output is intentionally idiomatic shadcn: a `useForm` with `zodResolver`, one `<FormField>` per field
 * (the controlled `render={({ field }) => (…)}` pattern), the right control per widget, and a submit `<Button>`.
 *
 * Honest-loss note: we do NOT generate the Zod schema here (that is @suluk/zod's v4ToZod corner). We reference
 * it by `schemaName` so the file is drop-in once the caller wires the import. The default name is `FormSchema`.
 */
import type { FormSpec, FieldSpec, FieldWidget } from "./spec";

export interface RenderFormOptions {
  /** React component name. Default "GeneratedForm". */
  componentName?: string;
  /** Name of the Zod schema symbol passed to zodResolver. Default "FormSchema". */
  schemaName?: string;
}

/** Indent every non-empty line of a block by `n` two-space levels. */
function indent(block: string, n: number): string {
  const pad = "  ".repeat(n);
  return block
    .split("\n")
    .map((l) => (l.length > 0 ? pad + l : l))
    .join("\n");
}

/** The inner control JSX for one field, given the bound `field` from react-hook-form's render prop. */
function controlFor(f: FieldSpec): string {
  switch (f.widget) {
    case "select":
      return [
        `<Select onValueChange={field.onChange} defaultValue={field.value}>`,
        `  <SelectTrigger>`,
        `    <SelectValue placeholder="Select ${escapeAttr(f.label)}" />`,
        `  </SelectTrigger>`,
        `  <SelectContent>`,
        ...(f.options ?? []).map(
          (opt) => `    <SelectItem value="${escapeAttr(opt)}">${escapeText(opt)}</SelectItem>`,
        ),
        `  </SelectContent>`,
        `</Select>`,
      ].join("\n");
    case "switch":
      return `<Switch checked={field.value} onCheckedChange={field.onChange} />`;
    case "checkbox":
      return `<Checkbox checked={field.value} onCheckedChange={field.onChange} />`;
    case "textarea":
      return `<Textarea placeholder="${escapeAttr(f.label)}" {...field} />`;
    case "number":
      return `<Input type="number" placeholder="${escapeAttr(f.label)}" {...field} />`;
    case "email":
      return `<Input type="email" placeholder="${escapeAttr(f.label)}" {...field} />`;
    case "url":
      return `<Input type="url" placeholder="${escapeAttr(f.label)}" {...field} />`;
    case "date":
      return `<Input type="date" placeholder="${escapeAttr(f.label)}" {...field} />`;
    case "text":
    default:
      return `<Input placeholder="${escapeAttr(f.label)}" {...field} />`;
  }
}

/** A complete <FormField> block for one field. */
function fieldBlock(f: FieldSpec): string {
  const labelText = escapeText(f.label) + (f.required ? " *" : "");
  const desc = f.description
    ? `\n        <FormDescription>${escapeText(f.description)}</FormDescription>`
    : "";
  return [
    `<FormField`,
    `  control={form.control}`,
    `  name="${escapeAttr(f.name)}"`,
    `  render={({ field }) => (`,
    `    <FormItem>`,
    `      <FormLabel>${labelText}</FormLabel>`,
    `      <FormControl>`,
    indent(controlFor(f), 4),
    `      </FormControl>${desc}`,
    `      <FormMessage />`,
    `    </FormItem>`,
    `  )}`,
    `/>`,
  ].join("\n");
}

/** Which shadcn modules each widget needs — used to emit a minimal honest import block. */
const WIDGET_IMPORTS: Record<FieldWidget, string[]> = {
  text: ["input"],
  number: ["input"],
  email: ["input"],
  url: ["input"],
  date: ["input"],
  textarea: ["textarea"],
  switch: ["switch"],
  checkbox: ["checkbox"],
  select: ["select"],
};

/** Render a shadcn <Form> component from a {@link FormSpec}. Returns TSX source as a string. */
export function renderFormTsx(spec: FormSpec, opts: RenderFormOptions = {}): string {
  const componentName = opts.componentName ?? "GeneratedForm";
  const schemaName = opts.schemaName ?? "FormSchema";

  // collect the distinct control modules this form actually uses (honest, minimal imports)
  const used = new Set<string>();
  for (const f of spec.fields) for (const m of WIDGET_IMPORTS[f.widget]) used.add(m);

  const controlImports: string[] = [];
  if (used.has("input")) controlImports.push(`import { Input } from "@/components/ui/input";`);
  if (used.has("textarea")) controlImports.push(`import { Textarea } from "@/components/ui/textarea";`);
  if (used.has("switch")) controlImports.push(`import { Switch } from "@/components/ui/switch";`);
  if (used.has("checkbox")) controlImports.push(`import { Checkbox } from "@/components/ui/checkbox";`);
  if (used.has("select")) {
    controlImports.push(
      `import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";`,
    );
  }

  // surface any descriptor warnings as a leading comment so losses are never silent
  const warningHeader =
    spec.warnings.length > 0
      ? `// CANDIDATE codegen warnings (honest losses, not dropped silently):\n` +
        spec.warnings.map((w) => `//   - ${w}`).join("\n") +
        "\n"
      : "";

  const fields = spec.fields.map(fieldBlock).join("\n");

  return `${warningHeader}// CANDIDATE — generated by @suluk/shadcn (renderFormTsx). Not official OAS tooling.
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,${spec.fields.some((f) => f.description) ? "\n  FormDescription," : ""}
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
${controlImports.join("\n")}

import { ${schemaName} } from "./schema";

export function ${componentName}() {
  const form = useForm<z.infer<typeof ${schemaName}>>({
    resolver: zodResolver(${schemaName}),
  });

  function onSubmit(values: z.infer<typeof ${schemaName}>) {
    // TODO: wire the submit handler
    console.log(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
${indent(fields, 4)}
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
`;
}

/** Escape a string for use inside a JSX text node. */
function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");
}

/** Escape a string for use inside a double-quoted JSX attribute. */
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
