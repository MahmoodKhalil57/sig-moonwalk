/**
 * @suluk/builder — the tiered contract-narrowing DSL (components → blocks → sections → pages), bound to the
 * Suluk cycle. The mechanism is ported from ~/apps/multivendorbuilder's DSL and rebuilt with the Suluk
 * discipline (typed, tested, projected from live entities instead of hand-authored). The load-bearing idea is
 * the contract: a document's `params` is EXACTLY and ONLY what the tier above may set — the narrowing is the
 * safety surface, the same discipline as Suluk's per-viewer doc projection.
 *
 * The Suluk twist: a SECTION is a full-stack vertical slice (data → contract → docs → state → ui) and a PAGE
 * composes sections — so buildApp emits the backend (routes + v4) AND the frontend (components + page TSX)
 * from one spec. Each slice can also be packaged as a shadcn REGISTRY ITEM (toShadcnRegistry) bundling its
 * frontend + backend files into one installable unit. CANDIDATE tooling — NOT official OAS.
 */
export {
  COMPOSES, isBind, isEach, isSlot, isListSpec,
  type Tier, type ListControl, type ParamSpec, type DslNode, type DslDocument, type DslChild, type BindRef, type EachRef, type SlotRef,
} from "./dsl";
export { registry, emptyRegistry, findDoc, allowedTypes, type Registry } from "./registry";
export { resolveParams, resolveList } from "./resolve";
export { validateDocument, validateAll, LAYOUT, type DslError } from "./validate";
export { renderPageTsx, resolveComponents } from "./render";
export {
  crudRoutesFromSchema, formBlock, tableBlock, crudSection, appPage, buildApp,
  type Entity, type AppSpec, type BuiltApp,
} from "./fullstack";
export { toShadcnRegistry, type RegistryItem, type RegistryFile } from "./registry-shadcn";
// modules (C021): a module is a mergeable v4 contract fragment; installModule refuses on collision / unmet requires.
export { installModule, namespaceModule, crudV4Paths, type SulukModule, type InstallResult, type ModuleCost } from "./module";
export { ECOMMERCE } from "./modules/ecommerce";
