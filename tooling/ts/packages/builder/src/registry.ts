/**
 * The document registry — the set of documents the validator/renderer resolves references against. Unlike
 * multivendorbuilder's import.meta.glob discovery (Astro-only), this is an explicit, portable, testable map.
 */
import type { DslDocument, Tier } from "./dsl";
import { COMPOSES } from "./dsl";

export interface Registry {
  /** Leaf component (UI primitive) names a block may reference. */
  components: Set<string>;
  blocks: Record<string, DslDocument>;
  sections: Record<string, DslDocument>;
  pages: Record<string, DslDocument>;
}

export function emptyRegistry(): Registry {
  return { components: new Set(), blocks: {}, sections: {}, pages: {} };
}

/** Build a registry from loose document lists + the set of leaf component names. */
export function registry(opts: { components?: string[]; blocks?: DslDocument[]; sections?: DslDocument[]; pages?: DslDocument[] }): Registry {
  const r = emptyRegistry();
  for (const c of opts.components ?? []) r.components.add(c);
  for (const d of opts.blocks ?? []) r.blocks[d.name] = d;
  for (const d of opts.sections ?? []) r.sections[d.name] = d;
  for (const d of opts.pages ?? []) r.pages[d.name] = d;
  return r;
}

export function findDoc(r: Registry, type: string): DslDocument | undefined {
  return r.pages[type] ?? r.sections[type] ?? r.blocks[type];
}

/** The type names a document of `tier` is allowed to reference (its children come from COMPOSES[tier]). */
export function allowedTypes(r: Registry, tier: Tier): Set<string> {
  if (tier === "components") return new Set(); // leaf — composes nothing
  const target = COMPOSES[tier];
  if (target === "components") return r.components;
  return new Set(Object.keys(r[target as "blocks" | "sections" | "pages"]));
}
