/**
 * The MODEL-SELECTION seam (C027 × @suluk/models) — a skill declares NEEDS, not a frozen model id, and the catalog
 * picks the best CURRENT model. Requirements are DERIVED from the agent structure (tool-bearing ⇒ needs tool-calling)
 * + the context analyzer's `minWindowRequired` (the agent's multi-round peak load becomes the hard min-context gate)
 * + the skill's explicit `modelRequire` + the C028 `modelAllowlist` MEET across governing policies. Preferences come
 * from the skill's `modelProfile`/`modelPrefer`. An explicit `model[]` (with no profile/prefer) is the author's
 * opt-out — returned verbatim.
 */
import type { OpenAPIv4Document, SulukSkillRef } from "@suluk/core";
import { selectModel, deriveRequirements, PROFILES, type ModelCatalog, type SelectResult, type Preferences } from "@suluk/models";
import { agentMap } from "./resolve";
import { policiesFor } from "./policy";

/**
 * How a skill RESOLVES to a runtime model (C030, council wf_75f87ab6-b1b — unanimous hybrid). We keep the survivor
 * SET (governance + caps + min-context, the moat) and either PIN a concrete reproducible id, or DELEGATE the
 * per-request pick to OpenRouter's auto-router fenced by our ENUMERATED survivor allowlist (never a wildcard).
 */
export type ResolvedTarget =
  | { kind: "pinned"; model: string }
  | { kind: "router"; model: "openrouter/auto"; allowedModels: string[]; costQualityTradeoff: number }
  | { kind: "latest"; model: string; note: string };

export interface SkillModelResolution {
  ids: string[];
  from: "declared" | "selected";
  /** the selector result (filter trace + per-axis why + coverage gaps) when `from === "selected"`. */
  selection?: SelectResult;
  /** the catalog snapshot the SURVIVOR SET was pinned against (null when declared). */
  snapshotHash: string | null;
  /** the resolved runtime target (pin / router / latest). */
  target: ResolvedTarget;
  /** true ⇒ the SERVED model id is reproducible (pinned). false ⇒ set-pinned but pick-NOT-pinned (router/latest). */
  pickPinned: boolean;
}

/** An operator policy governs this agent ⇒ FORCE PIN (reproducible + auditable; the runtime router cannot bind an
 * endpoint region/retention, and its pick is non-reproducible across dates). C030 governance gate — mechanical. */
function isGoverned(doc: OpenAPIv4Document, agentName: string): boolean {
  return policiesFor(doc, agentName).length > 0;
}

/** cost_quality_tradeoff 0..10 (0=quality, 10=cost) — mechanical from the profile's cost-vs-intelligence weights
 * (set explicitly; do NOT inherit OpenRouter's cost-leaning default of 7). */
export function deriveCQT(skill: SulukSkillRef | undefined): number {
  const base = skill?.modelProfile ? PROFILES[skill.modelProfile].prefer : { intelligence: 2, cost: 2, speed: 1, context: 1 };
  const w = { ...base, ...(skill?.modelPrefer ?? {}) };
  const denom = (w.cost ?? 0) + (w.intelligence ?? 0);
  return denom === 0 ? 5 : Math.max(0, Math.min(10, Math.round((10 * (w.cost ?? 0)) / denom)));
}

/** Best-effort `~author/family-latest` alias for the latest-resolution opt-in (defers the concrete version). */
function toLatestAlias(id: string): string {
  const [author, rest] = id.split("/");
  const family = (rest ?? "").replace(/[-.:@](\d.*|latest|preview|chat|instruct).*$/i, "");
  return author && family ? `~${author}/${family}-latest` : id;
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

/** The public seam: the models for a skill — its DECLARED list (opt-out) or the catalog-SELECTED ranked ids, resolved
 * to a runtime TARGET (pin / router / latest) under the C030 governance gate. */
export function skillModels(doc: OpenAPIv4Document, agentName: string, skillName: string, catalog: ModelCatalog, minWindowRequired?: number): SkillModelResolution {
  const skill = agentMap(doc)[agentName]?.skills?.[skillName];
  // explicit model[] with no profile/prefer ⇒ the author opted out of catalog selection
  const declared = !!(skill?.model?.length && !skill?.modelProfile && !skill?.modelPrefer);
  const selection = declared ? undefined : resolveSkillModels(doc, agentName, skillName, catalog, minWindowRequired);
  const ids = declared ? skill!.model! : selection!.ranked.map((r) => r.id);
  const from: "declared" | "selected" = declared ? "declared" : "selected";
  const snapshotHash = declared ? null : catalog.snapshotHash;

  const mode = skill?.modelResolve ?? "pinned";
  // GOVERNANCE GATE (mechanical): a governed skill MUST pin — router/latest are non-reproducible + cannot bind an endpoint.
  if (isGoverned(doc, agentName) && mode !== "pinned")
    throw new Error(`@suluk/agents: skill "${skillName}" of agent "${agentName}" is GOVERNED by an operator policy — modelResolve:"${mode}" is inadmissible (a governed skill must be "pinned" for reproducible, auditable, endpoint-bindable selection). Remove the policy or use "pinned".`);

  let target: ResolvedTarget;
  let pickPinned: boolean;
  if (mode === "router") { target = { kind: "router", model: "openrouter/auto", allowedModels: ids, costQualityTradeoff: deriveCQT(skill) }; pickPinned = false; }
  else if (mode === "latest") { target = { kind: "latest", model: toLatestAlias(ids[0] ?? ""), note: "~-latest defers the concrete version to request time — NOT reproducible (recorded in the why-explainer)" }; pickPinned = false; }
  else { target = { kind: "pinned", model: ids[0] ?? "" }; pickPinned = true; }

  return { ids, from, selection, snapshotHash, target, pickPinned };
}
