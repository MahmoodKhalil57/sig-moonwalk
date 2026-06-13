/**
 * The LIVE weekly fetcher (Class A) — a THIN wrapper over the pure `normalizeOpenRouter` transform. This is the only
 * part that needs network; it is deliberately tiny so the transform stays unit-tested. The Class-B benchmark TIER
 * pass (BFCL/IFEval/SWE-bench/RULER/MMLU-Pro/LMArena → `applyBucketing`) is a separate, lower-cadence, human-reviewed
 * step that overlays `intel.*` tiers onto these rows — see REFRESH.md. `asOf` must be passed in (scripts stamp time;
 * the package never calls `new Date()` implicitly so a run is reproducible).
 */
import type { ModelCatalog } from "./types";
import { type ORModel, normalizeOpenRouter, catalogFrom } from "./normalize";

/** Fetch OpenRouter `/models` and normalize to the fact-cell catalog. NETWORK — run from a weekly script/CI, not tests. */
export async function fetchOpenRouterCatalog(asOf: string, opts: { baseUrl?: string; fetchImpl?: typeof fetch } = {}): Promise<ModelCatalog> {
  const base = opts.baseUrl ?? "https://openrouter.ai/api/v1";
  const f = opts.fetchImpl ?? fetch;
  const res = await f(`${base}/models`);
  if (!res.ok) throw new Error(`@suluk/models: OpenRouter /models returned ${res.status}`);
  const body = (await res.json()) as { data?: ORModel[] };
  if (!Array.isArray(body.data)) throw new Error("@suluk/models: unexpected OpenRouter /models payload (no data[])");
  return catalogFrom(normalizeOpenRouter(body.data, asOf), asOf);
}
