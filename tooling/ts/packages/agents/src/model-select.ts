/**
 * The MODEL-SELECTION seam (C027 × @suluk/models) — a skill declares NEEDS, not a frozen model id, and the catalog
 * picks the best CURRENT model. Requirements are DERIVED from the agent structure (tool-bearing ⇒ needs tool-calling)
 * + the context analyzer's `minWindowRequired` (the agent's multi-round peak load becomes the hard min-context gate)
 * + the skill's explicit `modelRequire` + the C028 `modelAllowlist` MEET across governing policies. Preferences come
 * from the skill's `modelProfile`/`modelPrefer`. An explicit `model[]` (with no profile/prefer) is the author's
 * opt-out — returned verbatim.
 */
import type { OpenAPIv4Document } from "@suluk/core";
import { selectModel, deriveRequirements, type ModelCatalog, type SelectResult, type Preferences } from "@suluk/models";
import { agentMap } from "./resolve";
import { policiesFor } from "./policy";

export interface SkillModelResolution {
  ids: string[];
  from: "declared" | "selected";
  /** the selector result (filter trace + per-axis why + coverage gaps) when `from === "selected"`. */
  selection?: SelectResult;
  /** the catalog snapshot the pick was made against — reproducibility (null when declared). */
  snapshotHash: string | null;
}

/** The C028 modelAllowlist MEET across every policy governing this agent (intersection of the present allowlists). */
function effectiveAllowlist(doc: OpenAPIv4Document, agentName: string): string[] | undefined {
  const lists = policiesFor(doc, agentName).map((p) => p.modelAllowlist).filter((a): a is string[] => Array.isArray(a) && a.length > 0);
  if (!lists.length) return undefined;
  return lists.reduce((acc, a) => acc.filter((x) => a.includes(x)));
}

/** Run the catalog selector for a skill from its declared NEEDS + the analyzer load. */
export function resolveSkillModels(doc: OpenAPIv4Document, agentName: string, skillName: string, catalog: ModelCatalog, minWindowRequired?: number): SelectResult {
  const agent = agentMap(doc)[agentName];
  const skill = agent?.skills?.[skillName];
  const allowlist = effectiveAllowlist(doc, agentName);
  const minWin = Math.max(minWindowRequired ?? 0, skill?.modelRequire?.minContext ?? 0);
  const reqs = deriveRequirements({
    minWindowRequired: minWin > 0 ? minWin : undefined,
    hasRoutes: Object.keys(agent?.routes ?? {}).length > 0,
    needsStructured: skill?.modelRequire?.needsStructured,
    inputModalities: skill?.modelRequire?.inputModalities,
    policy: allowlist ? { modelAllowlist: allowlist } : undefined,
  });
  const prefs: Preferences = { profile: skill?.modelProfile, prefer: skill?.modelPrefer };
  return selectModel(reqs, prefs, catalog);
}

/** The public seam: the models for a skill — its DECLARED list (opt-out) or the catalog-SELECTED ranked ids. */
export function skillModels(doc: OpenAPIv4Document, agentName: string, skillName: string, catalog: ModelCatalog, minWindowRequired?: number): SkillModelResolution {
  const skill = agentMap(doc)[agentName]?.skills?.[skillName];
  // explicit model[] with no profile/prefer ⇒ the author opted out of catalog selection
  if (skill?.model?.length && !skill.modelProfile && !skill.modelPrefer) return { ids: skill.model, from: "declared", snapshotHash: null };
  const selection = resolveSkillModels(doc, agentName, skillName, catalog, minWindowRequired);
  return { ids: selection.ranked.map((r) => r.id), from: "selected", selection, snapshotHash: catalog.snapshotHash };
}
