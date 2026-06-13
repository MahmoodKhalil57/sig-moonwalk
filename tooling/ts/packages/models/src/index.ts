/**
 * @suluk/models — a weekly, PUBLIC-DATA-ONLY OpenRouter model catalog + a selector. A suluk skill declares NEEDS
 * (hard filters) + a small PREFERENCE (a named profile), and selectModel picks the best CURRENT model — never a
 * hard-coded id. Decidable OpenRouter facts are numbers; noisy benchmarks are coarse TIERS with {source, asOf};
 * UNKNOWN is honest (never imputed to worst); no cross-axis composite is stored (blending is the selector's job).
 * Council wf_729cde52-cc7. CANDIDATE tooling — NOT official OAS. The live weekly fetcher is specified in REFRESH.md
 * (this package ships the schema + selector + a SEED catalog; the 200-row generated catalog is the data-eng spine).
 */
import type { ModelCatalog } from "./types";
export type {
  Tier, Cell, DataRetention, ModelRecord, ModelCatalog, HardFilters, Profile, Preferences, RankedModel, SelectResult,
} from "./types";
export { SEED_CATALOG } from "./catalog";
// the committed, content-addressed OpenRouter fact catalog (generated weekly by scripts/refresh.ts): real prices /
// context / caps for ~300+ models. Benchmark TIER cells (intel.*) stay UNKNOWN until the Class-B overlay lands.
import OPENROUTER_CATALOG_JSON from "./openrouter-catalog.json";
export const OPENROUTER_CATALOG = OPENROUTER_CATALOG_JSON as unknown as ModelCatalog;
export { PROFILES, type ResolvedProfile } from "./profiles";
export { selectModel, deriveRequirements } from "./select";
// the weekly fetcher spine: documented tier bucketing rules (red-line) + the pure OpenRouter facts transform + a thin live fetch.
export { BUCKETING_RULES, applyBucketing, type AxisRule } from "./bucketing";
export { normalizeOpenRouter, normalizeOpenRouterModel, catalogFrom, snapshotHash, type ORModel } from "./normalize";
export { fetchOpenRouterCatalog } from "./fetch";
