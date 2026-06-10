// Type stub for the AOT-generated (ajv-standalone) v4 meta-schema validator. Regenerate the .js with
// `bun run scripts/gen-validator.ts`. The validator is a plain function (no `new Function`) with `.errors`.
declare const validate: ((doc: unknown) => boolean) & {
  errors?: { instancePath?: string; message?: string; params?: Record<string, unknown> }[] | null;
};
export default validate;
