/**
 * The TWIN PROJECTION (C027) — one `x-suluk-agents` declaration → a Claude plugin AND an OpenRouter/OpenAI-compatible
 * manifest. Both are PURE FUNCTIONS of (doc, agentName, opts): zero network at generate time (instruction snapshots
 * are inputs, contentHash-pinned), deterministic, and the map KEY is the stable wire-level tool/function id on both.
 * No credentials ever enter an artifact (the .mcp.json OAuth token is acquired host-side; C020/C023 upheld).
 * Projection refuses a non-installable agent (fail-loud) — so a dangling operationRef or a missing maxDepth does
 * NOT silently emit a broken artifact.
 */
import type { OpenAPIv4Document, SchemaOrRef, SulukSkillRef } from "@suluk/core";
import { agentMap, resolveOperationRef } from "./resolve";
import { assertAgentInstallable } from "./lint";
import { contentHash, renderSkillMd } from "./skill";

const stable = (v: unknown) => JSON.stringify(v, null, 2);

/** The first skill that declares a model — an agent's primary LLM tier (drives the model preference list). */
function primarySkill(skills?: Record<string, SulukSkillRef>): [string, SulukSkillRef] | null {
  for (const [k, s] of Object.entries(skills ?? {})) if (s.model && s.model.length) return [k, s];
  const first = Object.entries(skills ?? {})[0];
  return first ?? null;
}

// ───────────────────────────── Claude plugin projection ─────────────────────────────

export interface ClaudePluginOptions {
  /** the HTTP MCP endpoint the plugin connects to (e.g. https://host/mcp). */
  mcpUrl: string;
  version?: string;
  displayName?: string;
  homepage?: string;
  keywords?: string[];
  author?: { name: string; email?: string };
  /** instruction snapshots per skill name (the pinned served content); a skill without one emits no SKILL.md. */
  instructions?: Record<string, string>;
}

export interface ClaudePluginArtifacts {
  /** path → content; e.g. "plugin.json", ".mcp.json", "skills/operate/SKILL.md". */
  files: Record<string, string>;
}

export function projectClaudePlugin(doc: OpenAPIv4Document, agentName: string, opts: ClaudePluginOptions): ClaudePluginArtifacts {
  assertAgentInstallable(doc, agentName);
  const agent = agentMap(doc)[agentName];

  const pluginJson = {
    name: agentName,
    ...(opts.displayName ? { displayName: opts.displayName } : {}),
    description: agent.description,
    version: opts.version ?? "0.1.0",
    ...(opts.author ? { author: opts.author } : {}),
    ...(opts.homepage ? { homepage: opts.homepage } : {}),
    ...(opts.keywords ? { keywords: opts.keywords } : {}),
    mcpServers: "./.mcp.json",
  };

  // HTTP MCP with host-side OAuth — NO token embedded (creds never cross the seam; C020/C023).
  const mcpJson = { mcpServers: { [agentName]: { type: "http", url: opts.mcpUrl, oauth: {} } } };

  const files: Record<string, string> = {
    "plugin.json": stable(pluginJson),
    ".mcp.json": stable(mcpJson),
  };

  for (const [sk, skill] of Object.entries(agent.skills ?? {})) {
    const text = opts.instructions?.[sk];
    if (text === undefined) continue; // no snapshot supplied → no generated SKILL.md (honest: we never invent text)
    files[`skills/${sk}/SKILL.md`] = renderSkillMd({
      name: sk,
      description: skill.whenToUse ?? agent.description,
      instructions: text,
      source: skill.provenance?.source,
      version: skill.provenance?.version,
    });
  }

  return { files };
}

// ──────────────────────────── OpenRouter / OpenAI-compatible ────────────────────────────

export interface OpenRouterFunctionTool {
  type: "function";
  function: { name: string; description: string; parameters: SchemaOrRef };
}

export interface OpenRouterAgentManifest {
  name: string;
  /** model preference list (cheap→capable) from the primary skill; the OpenRouter ids to try in order. */
  model: string[];
  tier?: "resident" | "cold-tail";
  /** a POINTER to the served instructions + the pinned hash — never inlined creds, never the full text by default. */
  instructions: { source?: string; contentHash?: string; version?: string };
  /**
   * The DEFAULT tool surface — RESIDENT routes only, plus a synthetic `discover_tools` when cold-tail routes exist.
   * This is the tier-trim: the cheap/lower tier carries a SMALLER tool surface (the conditional context reduction).
   */
  tools: OpenRouterFunctionTool[];
  /** COLD-TAIL routes — NOT in the default surface; revealed on demand via `discover_tools`. */
  discoverable: OpenRouterFunctionTool[];
  /** sub-agents → one front-door tool each (dispatched as a NEW completion at the child's tier). */
  subAgents: { name: string; ref: string }[];
}

/** The synthetic meta-tool that reveals cold-tail tools — present in the default surface only when some exist. */
const DISCOVER_TOOLS_FN: OpenRouterFunctionTool = {
  type: "function",
  function: {
    name: "discover_tools",
    description: "Reveal additional cold-tail tools for this agent on demand. They are kept OUT of the default tool list so the resident surface stays small — call this to widen it (reorder/lazy-load, never widen beyond the declared reachable set).",
    parameters: { type: "object" },
  },
};

export interface OpenRouterOptions {
  /** instruction snapshots per skill name; when given for the primary skill, the manifest carries the computed hash. */
  instructions?: Record<string, string>;
}

export function projectOpenRouter(doc: OpenAPIv4Document, agentName: string, opts: OpenRouterOptions = {}): OpenRouterAgentManifest {
  assertAgentInstallable(doc, agentName);
  const agent = agentMap(doc)[agentName];
  const prim = primarySkill(agent.skills);
  const [primName, primSkill] = prim ?? [undefined, undefined as SulukSkillRef | undefined];

  const snapshot = primName ? opts.instructions?.[primName] : undefined;
  const instructions = {
    source: primSkill?.provenance?.source,
    contentHash: snapshot !== undefined ? contentHash(snapshot) : primSkill?.provenance?.contentHash,
    version: primSkill?.provenance?.version,
  };

  const built = Object.entries(agent.routes ?? {}).map(([rk, route]) => {
    const req = resolveOperationRef(doc, route.operationRef)?.request; // installable ⇒ non-null
    const parameters: SchemaOrRef = (req?.contentSchema ?? req?.parameterSchema?.body ?? { type: "object" }) as SchemaOrRef;
    const description = req?.summary ?? req?.description ?? `route ${rk} (${route.guarantee ?? "declared"})`;
    const fn: OpenRouterFunctionTool = { type: "function", function: { name: rk, description, parameters } };
    return { tier: route.tier ?? "resident", fn };
  });
  const residentTools = built.filter((b) => b.tier !== "cold-tail").map((b) => b.fn);
  const discoverable = built.filter((b) => b.tier === "cold-tail").map((b) => b.fn);
  // the default surface is resident-only; expose `discover_tools` ONLY when there is something to discover
  const tools = discoverable.length ? [...residentTools, DISCOVER_TOOLS_FN] : residentTools;

  const subAgents = Object.entries(agent.agents ?? {}).map(([local, r]) => ({ name: local, ref: r.ref }));

  return {
    name: agentName,
    model: primSkill?.model ?? [],
    ...(primSkill?.tier ? { tier: primSkill.tier } : {}),
    instructions,
    tools,
    discoverable,
    subAgents,
  };
}
