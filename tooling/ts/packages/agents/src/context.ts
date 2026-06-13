/**
 * CONTEXT INTELLIGENCE (C027) — the agent layer's self-knowledge about its own context economics. No one engineers
 * the perfect agent first try: you declare tools + agents, then MEASURE and let the analyzer right-size the layering.
 * It answers three questions per agent, statically and honestly:
 *
 *  1. LOAD — how much context a single inference AT this agent must hold by default: resident skill instructions
 *     (when a snapshot is supplied) + the resident tool surface (name+description+schema per tool, +1 dispatch tool
 *     per sub-agent, +discover_tools when cold-tail exists) + framing overhead. Cold-tail tools and sub-agent
 *     INTERNALS are NOT counted — that is the whole point of the tiering.
 *  2. RIGHT-SIZING (the flatten/unflatten DUALITY) — too big (over budget/window, heavy resident surface) ⇒
 *     UNFLATTEN (move tools to cold-tail / extract a sub-agent). Too small or redundant (a thin leaf, or a
 *     passthrough that just delegates) ⇒ FLATTEN (collapse the layer up), because every layer COSTS a dispatch tool
 *     + a fresh framing overhead per front-door hop — an unearned layer can cost more than one flat call.
 *  3. MODEL FIT — which of an agent's DECLARED candidate models can actually hold its load, and the minimum context
 *     window it needs. "Which models are expected to work with this agent" is then a computed, checkable fact.
 *
 * HONESTY: token counts are ESTIMATES (~4 chars/token, no real tokenizer) and instruction sizes are only known when
 * a snapshot is supplied — every report says so. This sizes the SHAPE + the window need, not the bill, and it does
 * NOT judge a model's REASONING capability (only whether the context fits) — the declared model[] is the author's
 * capability intent; the analyzer validates window-fit against it.
 */
import type { OpenAPIv4Document } from "@suluk/core";
import { agentMap, resolveOperationRef, subAgentKey } from "./resolve";
import type { LintFinding, Severity } from "./lint";

const CHARS_PER_TOKEN = 4;
const estTokens = (s: string) => Math.ceil(s.length / CHARS_PER_TOKEN);
const BASE_OVERHEAD = 400;          // function-calling framing / system scaffolding (paid once per inference hop)
const SUBAGENT_DISPATCH = 60;       // one front-door dispatch tool per sub-agent (name + short desc)
const DISCOVER_TOOLS = 60;          // the discover_tools meta-tool, present when cold-tail routes exist
const OVERLOAD_TOOL_COUNT = 12;     // a flat agent with this many resident tools is an unflatten candidate
const OVERLOAD_FRACTION = 0.5;      // ...or whose resident tool surface eats this share of its target
const FLATTEN_THIN_TOOLS = 3;       // a leaf sub-agent with <= this many resident tools is a flatten candidate

/** Best-effort model context windows (override per-id via opts.modelWindows). Substring-matched, default null. */
const DEFAULT_WINDOWS: [RegExp, number][] = [
  [/gemini.*(2\.5|1\.5|flash|pro)/i, 1_000_000], [/gemini/i, 1_000_000],
  [/opus|sonnet|haiku|claude/i, 200_000],
  [/gpt-4o|gpt-4\.1|gpt-5|o1|o3/i, 128_000], [/gpt/i, 128_000],
  [/llama|mistral|qwen/i, 128_000],
];
const windowFor = (id: string, overrides?: Record<string, number>): number | null =>
  overrides?.[id] ?? DEFAULT_WINDOWS.find(([re]) => re.test(id))?.[1] ?? null;

export interface ToolContextCost { name: string; tokens: number; tier: "resident" | "cold-tail" }
/** Per declared candidate model: does its context window hold this agent's load? (window null ⇒ unknown model.) */
export interface ModelFit { model: string; window: number | null; fits: boolean | null; headroom: number | null }
export interface AgentContextLoad {
  agent: string;
  instructionsTokens: number;
  instructionsMeasured: boolean;
  residentToolTokens: number;
  overheadTokens: number;
  totalTokens: number;
  coldTailTokens: number;
  tools: ToolContextCost[];
  subAgentCount: number;
  /** the minimum context window a model needs to run this agent (= the default load). */
  minWindowRequired: number;
  /** which DECLARED models are expected to work (window ≥ load) and which can't hold it. */
  modelFit: ModelFit[];
  budget?: number;
  /** the smallest declared model window (the binding window constraint), if any model is known. */
  modelWindow?: number;
  target?: number;
  utilization?: number;
}

export interface UnflattenSuggestion {
  agent: string;
  reason: string;
  moveToColdTail: string[];
  wouldSaveTokens: number;
  alsoConsider: string;
}

/** The dual of unflatten: a thin/redundant layer worth collapsing UP into its parent. */
export interface FlattenSuggestion {
  parent: string;
  child: string;
  reason: string;
  /** the parent's load if the child's resident tools+instructions were inlined. */
  mergedParentTokens: number;
  fitsTarget: boolean;
  /** per-hop overhead removed by collapsing (the child's framing + its dispatch tool). */
  savedHopOverhead: number;
}

export interface ContextReport {
  loads: AgentContextLoad[];
  findings: LintFinding[];
  /** unflatten suggestions for over-target agents (split DOWN). */
  suggestions: UnflattenSuggestion[];
  /** flatten suggestions for thin/redundant layers (collapse UP). */
  flatten: FlattenSuggestion[];
}

export interface ContextOptions {
  instructions?: Record<string, string>;
  modelWindows?: Record<string, number>;
}

function routeCost(doc: OpenAPIv4Document, name: string, operationRef: string, tier: "resident" | "cold-tail"): ToolContextCost {
  const req = resolveOperationRef(doc, operationRef)?.request;
  const desc = req?.summary ?? req?.description ?? "";
  const schema = req?.contentSchema ?? req?.parameterSchema?.body ?? {};
  const tokens = estTokens(name) + estTokens(desc) + estTokens(JSON.stringify(schema)) + 12 /* wrapper */;
  return { name, tokens, tier };
}

/** Compute the context-intelligence report (load + right-sizing + model fit) for every agent in the document. */
export function contextReport(doc: OpenAPIv4Document, opts: ContextOptions = {}): ContextReport {
  const map = agentMap(doc);
  const loads: AgentContextLoad[] = [];
  const findings: LintFinding[] = [];
  const suggestions: UnflattenSuggestion[] = [];
  const add = (severity: Severity, code: string, agent: string, detail: string) => findings.push({ severity, code, agent, detail });

  for (const [name, agent] of Object.entries(map)) {
    const skillEntries = Object.entries(agent.skills ?? {});
    const routeEntries = Object.entries(agent.routes ?? {});

    let instructionsTokens = 0; let anyResidentSkill = false; let anyUnmeasured = false;
    for (const [sk, s] of skillEntries) {
      if (s.tier === "cold-tail") continue;
      anyResidentSkill = true;
      const snap = opts.instructions?.[`${name}/${sk}`];
      if (snap !== undefined) instructionsTokens += estTokens(snap);
      else anyUnmeasured = true;
    }
    const instructionsMeasured = anyResidentSkill ? !anyUnmeasured : true;

    const tools = routeEntries.map(([rk, r]) => routeCost(doc, rk, r.operationRef, r.tier === "cold-tail" ? "cold-tail" : "resident"));
    const residentTools = tools.filter((t) => t.tier === "resident");
    const coldTailTools = tools.filter((t) => t.tier === "cold-tail");
    const subAgentCount = Object.keys(agent.agents ?? {}).length;

    const residentToolTokens = residentTools.reduce((n, t) => n + t.tokens, 0) + subAgentCount * SUBAGENT_DISPATCH + (coldTailTools.length ? DISCOVER_TOOLS : 0);
    const coldTailTokens = coldTailTools.reduce((n, t) => n + t.tokens, 0);
    const overheadTokens = BASE_OVERHEAD;
    const totalTokens = instructionsTokens + residentToolTokens + overheadTokens;

    // model fit: which declared (resident-skill) models can hold this load
    const candidateModels = [...new Set(skillEntries.filter(([, s]) => s.tier !== "cold-tail").flatMap(([, s]) => s.model ?? []))];
    const modelFit: ModelFit[] = candidateModels.map((m) => {
      const window = windowFor(m, opts.modelWindows);
      return { model: m, window, fits: window === null ? null : totalTokens <= window, headroom: window === null ? null : window - totalTokens };
    });
    const withWindow = modelFit.filter((f) => f.window !== null);
    const modelWindow = withWindow.length ? Math.min(...withWindow.map((f) => f.window!)) : undefined;

    const budget = agent.contextBudget?.tokens;
    const target = budget !== undefined && modelWindow !== undefined ? Math.min(budget, modelWindow) : budget ?? modelWindow;
    const utilization = target ? totalTokens / target : undefined;

    const load: AgentContextLoad = {
      agent: name, instructionsTokens, instructionsMeasured, residentToolTokens, overheadTokens, totalTokens,
      coldTailTokens, tools, subAgentCount, minWindowRequired: totalTokens, modelFit,
      ...(budget !== undefined ? { budget } : {}), ...(modelWindow !== undefined ? { modelWindow } : {}),
      ...(target !== undefined ? { target } : {}), ...(utilization !== undefined ? { utilization } : {}),
    };
    loads.push(load);

    // findings
    if (skillEntries.length === 0 && routeEntries.length === 0)
      add("info", "empty-layer", name, "agent declares no skills and no routes — a reserved layer to fill");
    if (anyResidentSkill && anyUnmeasured)
      add("info", "unmeasured-instructions", name, "no instruction snapshot supplied — totalTokens is a LOWER BOUND (tools+overhead only)");

    // model-fit findings (replaces a bare over-window check — names WHICH models work)
    const tooSmall = withWindow.filter((f) => !f.fits);
    if (withWindow.length > 0 && tooSmall.length === withWindow.length)
      add("error", "no-fitting-model", name, `estimated load ${totalTokens} tok exceeds EVERY declared model window (smallest ${modelWindow}) — unflatten or declare a larger-context model`);
    else if (tooSmall.length > 0)
      add("warning", "model-too-small", name, `declared model(s) ${tooSmall.map((f) => f.model).join(", ")} cannot hold this agent (needs ≥${totalTokens} tok window) — they are listed but will not work`);

    if (budget !== undefined && totalTokens > budget)
      add("warning", "context-over-budget", name, `estimated load ${totalTokens} tok exceeds declared contextBudget ${budget}`);
    const overloadByFraction = target !== undefined && residentToolTokens > OVERLOAD_FRACTION * target;
    if (residentTools.length >= OVERLOAD_TOOL_COUNT || overloadByFraction)
      add("warning", "flat-agent-overloaded", name, `resident surface is heavy (${residentTools.length} tools, ${residentToolTokens} tok) — candidate to unflatten (move tools to cold-tail or extract a sub-agent)`);

    const s = suggestUnflatten(load);
    if (s) suggestions.push(s);
  }

  // ── FLATTEN pass (the dual): a thin leaf reached by exactly one parent, whose merge still fits, is gratuitous ──
  const loadBy = new Map(loads.map((l) => [l.agent, l]));
  const refCount = new Map<string, number>();
  for (const a of Object.values(map)) for (const r of Object.values(a.agents ?? {})) { const k = subAgentKey(r.ref); if (k) refCount.set(k, (refCount.get(k) ?? 0) + 1); }
  const flatten: FlattenSuggestion[] = [];
  for (const [pname, agent] of Object.entries(map)) {
    const childKeys = Object.values(agent.agents ?? {}).map((r) => subAgentKey(r.ref)).filter((k): k is string => !!k && !!map[k]);
    const ownRoutes = Object.keys(agent.routes ?? {}).length;
    const ownResidentSkills = Object.values(agent.skills ?? {}).filter((s) => s.tier !== "cold-tail").length;
    if (ownRoutes === 0 && ownResidentSkills === 0 && childKeys.length === 1)
      add("warning", "passthrough-agent", pname, `delegates to "${childKeys[0]}" with no own tools or resident instructions — pure indirection; collapse the two`);
    for (const ck of childKeys) {
      const child = map[ck];
      const childIsLeaf = Object.keys(child.agents ?? {}).length === 0;
      if (!childIsLeaf || (refCount.get(ck) ?? 0) !== 1) continue; // only a leaf reached by exactly one parent
      const pl = loadBy.get(pname)!; const cl = loadBy.get(ck)!;
      const inlinedTools = cl.tools.filter((t) => t.tier === "resident").reduce((n, t) => n + t.tokens, 0);
      const childResidentToolCount = cl.tools.filter((t) => t.tier === "resident").length;
      const merged = pl.totalTokens - SUBAGENT_DISPATCH + inlinedTools + cl.instructionsTokens;
      const fitsTarget = pl.target === undefined || merged <= pl.target;
      if (childResidentToolCount <= FLATTEN_THIN_TOOLS && fitsTarget) {
        flatten.push({ parent: pname, child: ck, reason: `thin leaf (${childResidentToolCount} resident tool(s)); merged load ${merged}${pl.target !== undefined ? ` ≤ target ${pl.target}` : " (no target)"}`, mergedParentTokens: merged, fitsTarget, savedHopOverhead: BASE_OVERHEAD + SUBAGENT_DISPATCH });
        add("info", "flattenable-layer", pname, `sub-agent "${ck}" is a thin leaf that merges within budget — the layer costs ~${BASE_OVERHEAD + SUBAGENT_DISPATCH} tok/hop it does not earn; consider flattening`);
      }
    }
  }

  return { loads, findings, suggestions, flatten };
}

/** When an agent is over its target, the cheapest decomposition: which resident tools to push to cold-tail. */
export function suggestUnflatten(load: AgentContextLoad, target = load.target): UnflattenSuggestion | null {
  if (target === undefined || load.totalTokens <= target) return null;
  const resident = load.tools.filter((t) => t.tier === "resident").sort((a, b) => b.tokens - a.tokens);
  const move: string[] = []; let saved = 0;
  for (const t of resident) {
    if (load.totalTokens - saved <= target) break;
    move.push(t.name); saved += t.tokens;
  }
  return {
    agent: load.agent,
    reason: `load ${load.totalTokens} tok over target ${target} (${Math.round((load.utilization ?? 0) * 100)}%)`,
    moveToColdTail: move,
    wouldSaveTokens: saved,
    alsoConsider: move.length >= 3
      ? `${move.length} tools cluster here — consider extracting them into a sub-agent (front-door re-entry keeps them out of this agent's context entirely)`
      : "move these tools to cold-tail (tier: cold-tail) so they sit behind discover_tools",
  };
}
