/**
 * The C027 agent linter — the BLOCKING author/install gate the council made a red-line. It enforces what
 * JSON-Schema cannot, and (crucially) the D1 selector-rejection: NO agent field may carry a request-value
 * runtime-expression, so the matcher can never be pressured into reading an agent field (the #20 tripwire,
 * declined by removal-by-design). Lint is the only place determinism/acyclicity/depth are checked — never the
 * runtime matcher.
 */
import type { OpenAPIv4Document, SulukAgent } from "@suluk/core";
import { agentMap, childKeys, deepStrings, findCycle, resolveOperationRef, subtreeDepth } from "./resolve";
import { localEscalations } from "./scope";

export type Severity = "error" | "warning" | "info";
export interface LintFinding {
  severity: Severity;
  /** machine code, e.g. "agent-cycle", "missing-max-depth", "dangling-operation-ref", "request-value-selector". */
  code: string;
  agent: string;
  detail: string;
  /** dotted locus within the agent, e.g. "routes.run_core_primitive.operationRef". */
  at?: string;
}

/** A C018-style runtime expression — a request-value selector. Forbidden ANYWHERE in an agent (D1). */
const RUNTIME_EXPR = /\{\s*\$(request|response|method|url|statusCode|inputs)\b/i;

/** Fields whose presence-as-a-router would smuggle dynamic dispatch into the static contract (defense in depth). */
const FORBIDDEN_SELECTOR_KEYS = new Set(["selector", "strategy", "discriminator", "routeWhen", "dispatchOn"]);

export function lintAgents(doc: OpenAPIv4Document): LintFinding[] {
  const map = agentMap(doc);
  const out: LintFinding[] = [];
  const add = (severity: Severity, code: string, agent: string, detail: string, at?: string) =>
    out.push({ severity, code, agent, detail, at });

  for (const [name, agent] of Object.entries(map)) {
    // --- description: required, routing-oriented (the field the serving LLM selects on) ---
    const desc = (agent.description ?? "").trim();
    if (!desc) add("error", "empty-description", name, "an agent description is required and routing-oriented");
    else if (!desc.includes(" ")) add("warning", "thin-description", name, `one-word description "${desc}" — the serving LLM will mis-route`);

    // --- D1 GATE: no request-value selector anywhere in the agent object ---
    for (const { path, value } of deepStrings(agent)) {
      if (RUNTIME_EXPR.test(value))
        add("error", "request-value-selector", name, `D1: a request-value runtime-expression is forbidden in an agent ("${value}")`, path);
    }
    for (const { path } of deepStrings(agent)) {
      const leaf = path.split(".").pop() ?? "";
      if (FORBIDDEN_SELECTOR_KEYS.has(leaf))
        add("error", "request-value-selector", name, `D1: field "${leaf}" would route on request data — inadmissible`, path);
    }

    // --- routes: by-name $refs into EXISTING operations; NO model; resolve-lint ---
    for (const [rk, route] of Object.entries(agent.routes ?? {})) {
      if ((route as unknown as Record<string, unknown>).model !== undefined)
        add("error", "route-has-model", name, `route "${rk}" carries a model — a route is deterministic (no model); make it a skill`, `routes.${rk}`);
      if (!route.operationRef)
        add("error", "missing-operation-ref", name, `route "${rk}" has no operationRef`, `routes.${rk}`);
      else if (!resolveOperationRef(doc, route.operationRef))
        add("error", "dangling-operation-ref", name, `route "${rk}" operationRef does not resolve to an existing operation: ${route.operationRef}`, `routes.${rk}.operationRef`);
    }

    // --- skills: a skill is the LLM tier (model present); provenance should pin the source ---
    for (const [sk, skill] of Object.entries(agent.skills ?? {})) {
      if (!skill.model || skill.model.length === 0)
        add("warning", "skill-without-model", name, `skill "${sk}" has no model — a no-model unit is a route, not a skill`, `skills.${sk}`);
      if (skill.provenance && !skill.provenance.contentHash)
        add("warning", "skill-provenance-unpinned", name, `skill "${sk}" provenance lacks a contentHash — drift cannot be detected`, `skills.${sk}.provenance`);
    }

    // --- sub-agents: by-name refs must resolve; recursion needs a bound; no cycles ---
    const children = childKeys(agent);
    for (const c of children) {
      if (!c.key) add("error", "malformed-subagent-ref", name, `sub-agent "${c.local}" ref is not a #/x-suluk-agents/<key> pointer: ${c.ref}`, `agents.${c.local}`);
      else if (!map[c.key]) add("error", "dangling-subagent-ref", name, `sub-agent "${c.local}" refs a missing agent: ${c.key}`, `agents.${c.local}`);
    }

    // --- scope: a child may not DECLARE a permission its caller does not grant (no escalation across a hop; D1-of-authz) ---
    for (const esc of localEscalations(doc, name)) {
      add("error", "scope-escalation", name, `sub-agent "${esc.childLocal}" (${esc.child}) declares scope its caller does not grant: ${esc.perms.join(", ")} — a child's effective scope is INTERSECTION(child, caller), never union`, `agents.${esc.childLocal}`);
    }

    // --- thinking bound (C029): maxRounds REQUIRED + positive when `thinking` present; no loop-process / stopCondition ---
    if (agent.thinking) {
      const mr = agent.thinking.maxRounds;
      if (mr === undefined) add("error", "missing-max-rounds", name, "thinking present but no maxRounds — a thinking envelope MUST declare its round cap (mirrors maxDepth-required-when-agents)", "thinking");
      else if (!(typeof mr === "number" && mr >= 1 && Number.isInteger(mr))) add("error", "invalid-max-rounds", name, `maxRounds must be an integer >= 1 (got ${mr})`, "thinking.maxRounds");
      // any stopCondition-shaped member is forbidden — the loop trajectory stays runtime-opaque (declare the bound, not the process)
      for (const k of Object.keys(agent.thinking as Record<string, unknown>))
        if (/^(stopCondition|stopConditionKind|steps?|loop|process|until|while)$/i.test(k))
          add("error", "thinking-process-declared", name, `thinking.${k} models the loop PROCESS — forbidden (declare the bound maxRounds/budget, never the trajectory; it stays runtime-opaque)`, `thinking.${k}`);
    }
    if (children.length > 0) {
      const cycle = findCycle(map, name);
      if (cycle) add("error", "agent-cycle", name, `recursion cycle: ${cycle.join(" → ")}`);
      if (agent.maxDepth === undefined)
        add("error", "missing-max-depth", name, "an agent with sub-agents MUST declare maxDepth (no bound ⇒ does not install)");
      else if (!cycle) {
        const depth = subtreeDepth(map, name);
        if (depth > agent.maxDepth)
          add("error", "depth-exceeds-max", name, `reachable sub-agent depth ${depth} exceeds declared maxDepth ${agent.maxDepth}`);
      }
    }
  }
  return out;
}

/** True ⇒ no error-severity findings (warnings/info are advisory). */
export const lintOk = (findings: LintFinding[]): boolean => !findings.some((f) => f.severity === "error");

/** Convenience: lint a single agent's existence + errors, throwing the first error (for fail-loud projection). */
export function assertAgentInstallable(doc: OpenAPIv4Document, agentName: string): void {
  if (!agentMap(doc)[agentName]) throw new Error(`@suluk/agents: no agent "${agentName}" in x-suluk-agents`);
  const errs = lintAgents(doc).filter((f) => f.severity === "error" && f.agent === agentName);
  if (errs.length) throw new Error(`@suluk/agents: agent "${agentName}" does not install:\n  - ${errs.map((e) => `${e.code}: ${e.detail}`).join("\n  - ")}`);
}

// re-export the agent type for consumers that only import the linter
export type { SulukAgent };
