/**
 * @suluk/shadcn — the UI corner. v4 "Suluk" Schema Objects → shadcn/ui form + table specs and TSX scaffolds.
 *
 * The chain is: Zod → v4 Schema Object (@suluk/zod) → descriptor model (formSpec/tableSpec, here) → shadcn TSX
 * (renderFormTsx/renderTableTsx, here). This package is CODEGEN ONLY — no runtime UI deps; it emits component
 * source as strings against the conventional shadcn/ui import paths (react-hook-form + zodResolver for forms).
 *
 * Honest-loss discipline (house pattern): the descriptor specs carry a `warnings: string[]` channel for every
 * property we could not faithfully map (unresolvable $ref, boolean schemas, non-object roots), and the
 * renderers surface those warnings as a leading comment block. Nothing is dropped silently. CANDIDATE tooling.
 */
export {
  formSpec,
  tableSpec,
  type FieldWidget,
  type FieldSpec,
  type FormSpec,
  type ColumnSpec,
  type TableSpec,
  type SpecOptions,
} from "./spec";

export { renderFormTsx, type RenderFormOptions } from "./render-form";
export { renderTableTsx, type RenderTableOptions } from "./render-table";
