/**
 * The 6 named PROFILES — the 90%-case author UX (a profile = preset preference weights + AUTO-WIRED implied hard
 * filters so the author can't foot-gun). Same SHAPE as today's skill.model[] (a preference, not an id), so the
 * migration is mechanical. The escape hatch (≤4 small int weights + taskShape) is for power users; the catalog
 * tracks ~30 fields but the author touches ~4.
 */
import type { HardFilters, Preferences, Profile } from "./types";

export interface ResolvedProfile {
  prefer: { intelligence: 0 | 1 | 2 | 3; cost: 0 | 1 | 2 | 3; speed: 0 | 1 | 2 | 3; context: 0 | 1 | 2 | 3 };
  taskShape?: Preferences["taskShape"];
  /** filters the profile auto-wires (an author choosing "tool-reliable" implicitly requires tool-calling). */
  impliedFilters: Partial<HardFilters>;
}

export const PROFILES: Record<Profile, ResolvedProfile> = {
  "tool-reliable": { prefer: { intelligence: 3, cost: 1, speed: 1, context: 1 }, taskShape: "agentic", impliedFilters: { needsTools: true } },
  "cheap-fast": { prefer: { intelligence: 1, cost: 3, speed: 3, context: 0 }, impliedFilters: {} },
  "balanced": { prefer: { intelligence: 2, cost: 2, speed: 2, context: 1 }, impliedFilters: {} },
  "max-reasoning": { prefer: { intelligence: 3, cost: 0, speed: 0, context: 1 }, taskShape: "reasoning", impliedFilters: {} },
  "long-context": { prefer: { intelligence: 2, cost: 1, speed: 0, context: 3 }, impliedFilters: { fidelityFloor: "mid" } },
  "vision": { prefer: { intelligence: 2, cost: 1, speed: 1, context: 1 }, impliedFilters: { inputModalities: ["image"] } },
};
