/**
 * @suluk/panel — contract-first admin panels, in the spirit of Payload but projected from ONE OpenAPI v4 document.
 * Payload makes you configure collections in a framework-coupled DSL; @suluk/panel INFERS the same field types
 * (text/textarea/richtext/number/boolean/select/date/email/url/json/relationship) straight from the contract's
 * component schemas, renders shadcn/theme-aware forms + data tables, and mounts a role-aware admin — pass a
 * per-role PROJECTED document and you get a per-role dashboard for free. No DB coupling (it drives the contract's
 * REST), no config drift (the contract is the single source). CANDIDATE tooling.
 */
export { fieldsOf, titleField, humanize, type Field, type FieldType, type FieldsOptions } from "./fields";
export { entityModels, type EntityModel } from "./model";
export { renderInput, renderFieldRow } from "./widgets";
export { renderList, type ListOptions } from "./list";
export { renderForm, type FormOptions } from "./form";
export { renderShell, PANEL_CSS, type ShellOptions } from "./shell";
export { panelApp, type PanelOptions } from "./app";
