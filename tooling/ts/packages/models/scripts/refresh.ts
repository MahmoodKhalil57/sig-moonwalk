/**
 * Weekly refresh (Class A) — fetch OpenRouter /models, normalize to the fact-cell catalog, and write the committed,
 * content-addressed artifact `src/openrouter-catalog.json`. Run: `bun scripts/refresh.ts [asOf]`. NETWORK.
 * The benchmark TIER overlay (Class B) is a separate, lower-cadence, human-reviewed step (see REFRESH.md).
 */
import { fetchOpenRouterCatalog, applyTierOverlay, KNOWN_TIERS } from "../src/index";

const asOf = process.argv[2] ?? new Date().toISOString().slice(0, 10);
let cat = await fetchOpenRouterCatalog(asOf);
// Class-B bootstrap: overlay the small cited frontier-standings seed onto intel.* (the full curation is the TODO).
cat = applyTierOverlay(cat, KNOWN_TIERS, { source: "public-leaderboard-consensus", asOf });
const overlaid = cat.rows.filter((r) => r.intel.reasoning.value !== null).length;
const out = new URL("../src/openrouter-catalog.json", import.meta.url);
await Bun.write(out, JSON.stringify(cat) + "\n"); // compact — it ships in the npm package (transitively via @suluk/agents)
console.log(`@suluk/models: wrote ${cat.rows.length} models (${overlaid} with intel tiers) · asOf ${asOf} · ${cat.snapshotHash}`);
