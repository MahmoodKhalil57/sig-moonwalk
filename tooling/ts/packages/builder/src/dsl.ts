/**
 * The composition DSL — the contract model.
 *
 * Ported from ~/apps/multivendorbuilder's DSL and rebuilt on the Suluk discipline. The tier rule
 * (components → blocks → sections → pages) is secondary; the LOAD-BEARING idea is the contract:
 *
 *   A document's `params` is EXACTLY and ONLY what the tier above may set.
 *
 * Each tier consumes the full contract of the tier below, hardcodes most of it with literals, and
 * re-publishes a deliberately narrower `params` upward. "The owner can't change the form's fields" is not
 * a special rule — `fields` simply isn't in the section's `params`, so the validator rejects it like any
 * unknown key. The narrowing IS the contract surface. This is the SAME discipline as Suluk's per-viewer doc
 * projection (an operation you can't see isn't a rule — its scope just isn't in your principal), applied to
 * composition rather than visibility.
 *
 * Bindings inside a document's `root` / `catalog`:
 *   { $bind: "paramName" }  → forward this document's resolved param value (object form so a literal stays literal)
 *   { $each: "listParam" }  → expand to the catalog entries the consumer selected (honouring the list controls)
 *   { $slot: true }         → where consumer-passed children render
 */

export type Tier = "components" | "blocks" | "sections" | "pages";

/** What each tier may compose (its children come from this tier). `components` is the leaf (real UI). */
export const COMPOSES: Record<Exclude<Tier, "components">, Tier> = {
  blocks: "components",
  sections: "blocks",
  pages: "sections",
};

export type ListControl = "include" | "hide" | "reorder" | "repeat";

export type ParamSpec =
  | { type: "enum"; options: string[]; default?: string; required?: boolean }
  | { type: "text"; default?: string; required?: boolean }
  | { type: "number"; default?: number; required?: boolean }
  | { type: "boolean"; default?: boolean; required?: boolean }
  | {
      type: "list";
      /** Catalog keys the consumer may pick from. */
      options: string[];
      /** Which manipulations the consumer is allowed (the narrowing on a list). */
      controls: ListControl[];
      /** Default ordered selection. */
      default?: string[];
    };

/** Forwards a resolved param of the current document. */
export interface BindRef { $bind: string }
/** Placeholder expanded to the consumer's catalog selection. */
export interface EachRef { $each: string }
/** Placeholder where a consumer's passed-in children render. */
export interface SlotRef { $slot: true }

export type DslChild = string | number | DslNode | EachRef | SlotRef;

export interface DslNode {
  /** A component (leaf) name, or a block/section doc name. */
  type: string;
  /** Pick a named preset (variant) on the referenced document. */
  variant?: string;
  /** Inputs for the referenced doc, or props for a component. A value may be a {$bind} into the current doc. */
  props?: Record<string, unknown>;
  children?: DslChild | DslChild[];
}

export interface DslDocument {
  name: string;
  tier: Tier;
  /** The upward contract: ALL (and only) what the tier above may set. */
  params?: Record<string, ParamSpec>;
  /** Named presets binding this document's own params. */
  variants?: Record<string, Record<string, unknown>>;
  /** Named, fully-configured child instances a `list` param picks from. */
  catalog?: Record<string, DslNode>;
  root: DslNode;
}

export const isBind = (v: unknown): v is BindRef => !!v && typeof v === "object" && "$bind" in (v as object);
export const isEach = (c: unknown): c is EachRef => !!c && typeof c === "object" && "$each" in (c as object);
export const isSlot = (c: unknown): c is SlotRef => !!c && typeof c === "object" && "$slot" in (c as object);

export function isListSpec(s: ParamSpec): s is Extract<ParamSpec, { type: "list" }> {
  return s.type === "list";
}
