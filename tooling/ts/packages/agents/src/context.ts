/**
 * Context-budget analysis (C027) — the "do I need to unflatten?" check. No one engineers the perfect agent first
 * try: you declare tools + agents, then MEASURE where a single inference is carrying too much, and decompose.
 *
 * This estimates the context an inference AT an agent must hold BY DEFAULT — its resident skill instructions + its
 * resident tool surface (each tool is a name+description+schema blob that sits in the window) + a fixed framing
 * overhead — and compares it to (a) the agent's declared `contextBudget` and (b) the SMALLEST context window among
 * its candidate models (the agent must fit the cheapest model it might run on). Cold-tail tools and sub-agent
 * INTERNALS are NOT counted — they are behind `discover_tools` / front-door re-entry (that is the whole point of the
 * tiering). When overloaded, {@link suggestUnflatten} says exactly what to move to cold-tail or extract into a
 * sub-agent.
 *
 * HONESTY: token counts are ESTIMATES (~4 chars/token, no real tokenizer) and instruction sizes are only known when
 * a snapshot is supplied — every report says so. This sizes the SHAPE, not the bill.
 */
import type { OpenAPIv4Document } from "@suluk/core";
import { agentMap, resolveOperationRef } from "./resolve";
import type { LintFinding, Severity } from "./lint";

const CHARS_PER_TOKEN = 4;
const estTokens = (s: string) => Math.ceil(s.length / CHARS_PER_TOKEN);
const BASE_OVERHEAD = 400;          // function-calling framing / system scaffolding
const SUBAGENT_DISPATCH = 60;       // one front-door dispatch tool per sub-agent (name + short desc)
const DISCOVER_TOOLS = 60;          // the discover_tools meta-tool, present when cold-tail routes exist
const OVERLOAD_TOOL_COUNT = 12;     // a flat agent with this many resident tools is an unflatten candidate
const OVERLOAD_FRACTION = 0.5;      // ...or whose resident tool surface eats this share of its target

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
export interface AgentContextLoad {
  agent: string;
  /** resident skill instruction tokens (measured from a supplied snapshot; 0 + `instructionsMeasured:false` otherwise). */
  instructionsTokens: number;
  instructionsMeasured: boolean;
  /** the default tool surface that sits in the window: resident routes + one dispatch tool per sub-agent. */
  residentToolTokens: number;
  /** fixed framing overhead. */
  overheadTokens: number;
  /** the total a single default inference must hold. */
  totalTokens: number;
  /** cold-tail routes (NOT loaded by default — behind discover_tools); reported for transparency, not counted. */
  coldTailTokens: number;
  tools: ToolContextCost[];
  subAgentCount: number;
  /** the agent's declared `contextBudget.tokens`, if any. */
  budget?: number;
  /** the smallest window among the agent's candidate models (the cheapest model must fit), if resolvable. */
  modelWindow?: number;
  /** the binding target = min(budget, modelWindow) when known. */
  target?: number;
  /** total / target (>1 ⇒ over). */
  utilization?: number;
}

export interface UnflattenSuggestion {
  agent: string;
  reason: string;
  /** resident tools to move to cold-tail (behind discover_tools) — the cheapest decomposition. */
  moveToColdTail: string[];
  wouldSaveTokens: number;
  /** the structural alternative when moving tools isn't enough. */
  alsoConsider: string;
}

export interface ContextReport {
  loads: AgentContextLoad[];
  findings: LintFinding[];
  /** unflatten suggestions for every over-target agent. */
  suggestions: UnflattenSuggestion[];
}

export interface ContextOptions {
  /** instruction snapshots keyed "<agentKey>/<skillName>" (the served text, pinned) — enables instruction sizing. */
  instructions?: Record<string, string>;
  /** exact model-id → context window overrides (takes precedence over the built-in table). */
  modelWindows?: Record<string, number>;
}

/** Estimate one route's tool-definition cost (name + description + parameter schema), tier-tagged. */
function routeCost(doc: OpenAPIv4Document, name: string, operationRef: string, tier: "resident" | "cold-tail"): ToolContextCost {
  const req = resolveOperationRef(doc, operationRef)?.request;
  const desc = req?.summary ?? req?.description ?? "";
  const schema = req?.contentSchema ?? req?.parameterSchema?.body ?? {};
  const tokens = estTokens(name) + estTokens(desc) + estTokens(JSON.stringify(schema)) + 12 /* wrapper */;
  return { name, tokens, tier };
}

/** Compute the context load + findings for every agent in the document. */
export function contextReport(doc: OpenAPIv4Document, opts: ContextOptions = {}): ContextReport {
  const map = agentMap(doc);
  const loads: AgentContextLoad[] = [];
  const findings: LintFinding[] = [];
  const suggestions: UnflattenSuggestion[] = [];
  const add = (severity: Severity, code: string, agent: string, detail: string) => findings.push({ severity, code, agent, detail });

  for (const [name, agent] of Object.entries(map)) {
    const skillEntries = Object.entries(agent.skills ?? {});
    const routeEntries = Object.entries(agent.routes ?? {});

    // resident skill instructions (cold-tail skills are deferred); measured only when a snapshot is supplied
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

    const budget = agent.contextBudget?.tokens;
    const models = skillEntries.find(([, s]) => s.tier !== "cold-tail" && s.model?.length)?.[1].model ?? [];
    const windows = models.map((m) => windowFor(m, opts.modelWindows)).filter((w): w is number => w !== null);
    const modelWindow = windows.length ? Math.min(...windows) : undefined;
    const target = budget !== undefined && modelWindow !== undefined ? Math.min(budget, modelWindow) : budget ?? modelWindow;
    const utilization = target ? totalTokens / target : undefined;

    const load: AgentContextLoad = {
      agent: name, instructionsTokens, instructionsMeasured, residentToolTokens, overheadTokens, totalTokens,
      coldTailTokens, tools, subAgentCount,
      ...(budget !== undefined ? { budget } : {}), ...(modelWindow !== undefined ? { modelWindow } : {}),
      ...(target !== undefined ? { target } : {}), ...(utilization !== undefined ? { utilization } : {}),
    };
    loads.push(load);

    // findings
    if (skillEntries.length === 0 && routeEntries.length === 0)
      add("info", "empty-layer", name, "agent declares no skills and no routes — a reserved layer to fill");
    if (anyResidentSkill && anyUnmeasured)
      add("info", "unmeasured-instructions", name, "no instruction snapshot supplied — totalTokens is a LOWER BOUND (tools+overhead only)");
    if (modelWindow !== undefined && totalTokens > modelWindow)
      add("error", "context-over-window", name, `estimated load ${totalTokens} tok exceeds the smallest model window ${modelWindow} — this agent cannot fit; unflatten it`);
    if (budget !== undefined && totalTokens > budget)
      add("warning", "context-over-budget", name, `estimated load ${totalTokens} tok exceeds declared contextBudget ${budget}`);
    const overloadByFraction = target !== undefined && residentToolTokens > OVERLOAD_FRACTION * target;
    if (residentTools.length >= OVERLOAD_TOOL_COUNT || overloadByFraction)
      add("warning", "flat-agent-overloaded", name, `resident surface is heavy (${residentTools.length} tools, ${residentToolTokens} tok) — candidate to unflatten (move tools to cold-tail or extract a sub-agent)`);

    const s = suggestUnflatten(load);
    if (s) suggestions.push(s);
  }

  return { loads, findings, suggestions };
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
