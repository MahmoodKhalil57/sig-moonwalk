/**
 * The cockpit's BUILDER surface (pure logic). Treats the hub document's components.schemas as entities, runs
 * @suluk/builder over them, and exposes the tiered composition (pages → sections → blocks → components) with
 * EACH tier's param contract attached — so the contract-narrowing is visible in the tree (a section node
 * shows it exposes {tone, blocks}; you can read straight off it that a page can't reach the form's fields).
 * Plus the two actions that land artifacts: generate the whole app, and export the shadcn registry.
 */
import type { OpenAPIv4Document, SchemaOrRef } from "@suluk/core";
import { buildApp, toShadcnRegistry, type Entity, type BuiltApp, type DslDocument, type ParamSpec } from "@suluk/builder";
import type { Registry } from "@suluk/builder";

export interface BuilderNode {
  tier: "page" | "section" | "block" | "component";
  label: string;
  /** The param-contract keys this tier exposes upward (empty for a leaf component). */
  contract: string[];
  children: BuilderNode[];
}

/** Each components.schemas entry becomes a builder entity. */
export function entitiesFromDoc(doc: OpenAPIv4Document): Entity[] {
  const schemas = (doc.components?.schemas ?? {}) as Record<string, SchemaOrRef>;
  return Object.entries(schemas).map(([name, schema]) => ({ name, schema }));
}

function contractKeys(doc: DslDocument | undefined): string[] {
  return Object.keys(doc?.params ?? {});
}

function listOptions(doc: DslDocument | undefined, key: string): string[] {
  const spec = doc?.params?.[key] as ParamSpec | undefined;
  return spec && spec.type === "list" ? spec.options : [];
}

function blockNode(reg: Registry, name: string): BuilderNode {
  const block = reg.blocks[name];
  const componentType = block?.root.type ?? "?";
  return {
    tier: "block", label: name, contract: contractKeys(block),
    children: [{ tier: "component", label: componentType, contract: [], children: [] }],
  };
}

function sectionNode(reg: Registry, name: string): BuilderNode {
  const section = reg.sections[name];
  return {
    tier: "section", label: name, contract: contractKeys(section),
    children: listOptions(section, "blocks").map((b) => blockNode(reg, b)),
  };
}

function pageNode(reg: Registry, page: DslDocument): BuilderNode {
  return {
    tier: "page", label: page.name, contract: contractKeys(page),
    children: listOptions(page, "sections").map((s) => sectionNode(reg, s)),
  };
}

/** The full tier tree (pages → sections → blocks → components) with each tier's contract. */
export function builderTree(app: BuiltApp): BuilderNode[] {
  return Object.values(app.registry.pages).map((p) => pageNode(app.registry, p));
}

export interface BuilderModel {
  app: BuiltApp;
  tree: BuilderNode[];
  /** DSL contract violations (empty ⇒ sound). */
  errors: { doc: string; path: string; message: string }[];
  entityCount: number;
}

/** Build the full builder model from a v4 document (its schemas → entities → buildApp). */
export function buildBuilderModel(doc: OpenAPIv4Document): BuilderModel {
  const entities = entitiesFromDoc(doc);
  const app = buildApp({ entities, info: { title: doc.info?.title ?? "App", version: doc.info?.version ?? "0.0.0" } });
  return { app, tree: builderTree(app), errors: app.errors, entityCount: entities.length };
}

export interface GeneratedFile { path: string; content: string }

/** All files for the generated app: the v4 doc, the frontend components + pages, and the shadcn registry. */
export function generateAppFiles(doc: OpenAPIv4Document): GeneratedFile[] {
  const { app } = buildBuilderModel(doc);
  const files: GeneratedFile[] = [];
  files.push({ path: "openapi.json", content: JSON.stringify(app.backend.document, null, 2) });
  for (const c of app.frontend.components) files.push({ path: `components/${c.name}.tsx`, content: c.tsx });
  for (const p of app.frontend.pages) files.push({ path: `app/${p.name.toLowerCase()}/page.tsx`, content: p.tsx });
  const reg = toShadcnRegistry(app, { name: (doc.info?.title ?? "app").toLowerCase().replace(/\s+/g, "-") });
  files.push({ path: "registry.json", content: JSON.stringify(reg.index, null, 2) });
  for (const item of reg.items) files.push({ path: `registry/${item.name}.json`, content: JSON.stringify(item, null, 2) });
  return files;
}

/** The shadcn registry (index + items) as a pretty JSON string — the "Export shadcn registry" action. */
export function generateRegistryJson(doc: OpenAPIv4Document): string {
  const { app } = buildBuilderModel(doc);
  const reg = toShadcnRegistry(app, { name: (doc.info?.title ?? "app").toLowerCase().replace(/\s+/g, "-") });
  return JSON.stringify({ registry: reg.index, items: reg.items }, null, 2);
}
