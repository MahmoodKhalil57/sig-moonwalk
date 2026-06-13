/**
 * Weekly refresh (Class A) — fetch OpenRouter /models, normalize to the fact-cell catalog, and write the committed,
 * content-addressed artifact `src/openrouter-catalog.json`. Run: `bun scripts/refresh.ts [asOf]`. NETWORK.
 * The benchmark TIER overlay (Class B) is a separate, lower-cadence, human-reviewed step (see REFRESH.md).
 */
import { fetchOpenRouterCatalog } from "../src/index";

const asOf = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const cat = await fetchOpenRouterCatalog(asOf);
const out = new URL("../src/openrouter-catalog.json", import.meta.url);
await Bun.write(out, JSON.stringify(cat) + "\n"); // compact — it ships in the npm package (transitively via @suluk/agents)
console.log(`@suluk/models: wrote ${cat.rows.length} models · asOf ${asOf} · ${cat.snapshotHash}`);
