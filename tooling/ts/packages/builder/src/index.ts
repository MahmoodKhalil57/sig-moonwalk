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
export {
  installModule, namespaceModule, crudV4Paths, moduleOperations, gradeModule, previewInstall, schemaRefName,
  type SulukModule, type InstallResult, type ModuleCost, type ModuleRegistry, type ModuleEntry, type ModuleGrade, type InstallPreview,
} from "./module";
// the curated first-party module registry (M2) + stack templates (L2)
export { AUTH, ECOMMERCE, CRM, BILLING, FIRST_PARTY_REGISTRY, STACK_TEMPLATES, resolveTemplate, type StackTemplate } from "./modules";
// composition (L2): plan + install a set of modules in dependency order — the non-developer "compose a platform" flow
export { planComposition, composeModules, type CompositionPlan, type ComposeResult, type ComposeStep } from "./compose";
// provider slots (M3): swap a facet binding (payments/auth/email/storage) for another impl of the same interface
export { PROVIDER_CATALOG, providerFacets, readProviders, swapProvider, type ProviderImpl, type ProviderBinding, type SwapResult } from "./providers";
// remote registries (L1): validate an UNTRUSTED registry fetched from a URL (the open marketplace)
export { parseRegistry, validateModule, type RegistrySource, type ParsedRegistry } from "./registry-remote";
// signed registries (L1+): verify a publisher signature → provenance for the open marketplace
export { signRegistry, verifyRegistrySignature, generateSigningKeypair, isSignedEnvelope, type SignedEnvelope } from "./signing";
