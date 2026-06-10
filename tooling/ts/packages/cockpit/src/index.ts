/**
 * @suluk/cockpit — the PURE cockpit core: the cycle model, the builder model, codegen, deploy planning, and
 * the validate/audit/preview helpers. No host API. Two shells consume this exact core: the vscode extension
 * (suluk-vscode) and the web admin panel (@suluk/admin, served under /superadmin). One brain, two faces.
 * CANDIDATE tooling — NOT official OAS.
 */
export { validateSource, auditSource, previewHtml, looksLikeV4, type Diagnostic } from "./logic";
export { buildCycle, docChecks, cycleSummary, type CycleModel, type CycleLayer, type CycleItem, type LayerStatus, type Principal, type DocCheck } from "./cycle";
export { buildBuilderModel, builderTree, entitiesFromDoc, generateAppFiles, generateRegistryJson, type BuilderModel, type BuilderNode, type GeneratedFile } from "./builder";
export { entityNames, generateForm, generateTable, generateStoresModule, exportV4Json } from "./codegen";
export { deployPlan, deployMarkdown } from "./deploy";
export type { DeployPlan, DeployStep, DeployProvider } from "@suluk/deploy";
// drift (OBSERVE): compare a LOCAL contract against a DEPLOYED one — the "what's drifted in prod" view (C020).
export { diffContracts, canonical, type ContractDiff, type ChangedOp, type OpRef } from "./drift";
// cost formatting, re-exported so the extension shell can render a live /cost ledger without a direct @suluk/cost dep.
export { formatMicroUsd, summarize, type CostSummary } from "@suluk/cost";
