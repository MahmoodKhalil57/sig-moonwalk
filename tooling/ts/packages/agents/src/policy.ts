/**
 * Operator governance overlay (C028) — `x-suluk-policy`. An OPERATOR-owned policy NARROWS what an agent
 * self-declares: effective = INTERSECT(operatorPolicy, agentSelfDeclaration), a total, order-independent MEET that
 * NEVER EXCEEDS either input on any axis (scope/tier/model/depth/tools/sub-agents). This is the security floor —
 * monotone-narrowing-only; a widening result is a lint HARD-FAIL, not a precedence tiebreak.
 *
 * SCOPE OF THIS MODULE: the statically-decidable subset only. The `costCeiling` is DECLARED here (the operator's
 * third number, cap/estimate/actual) but the schema cannot ENFORCE it — `enforcedBy` names a runtime adapter, and a
 * cap-breaching run is a NAMED conformance failure, never silently honored. The terminate-at-spend kill-switch is
 * RESERVED, built-by-nobody until the reopen-trigger (C028).
 */
import type { OpenAPIv4Document, SulukAgent, SulukPolicy } from "@suluk/core";
import { agentMap, deepStrings, parsePointer } from "./resolve";
import { intersectScope, type Scope } from "./scope";
import type { LintFinding, Severity } from "./lint";

const TIER_RANK = { resident: 0, "cold-tail": 1 } as const;
type Tier = keyof typeof TIER_RANK;

/** deny/allow membership: an `allow` list (when present) is the ONLY permitted set; `deny` removes further. */
const passes = (key: string, f?: { deny?: string[]; allow?: string[] }): boolean => {
  if (!f) return true;
  if (f.allow && !f.allow.includes(key)) return false;
  if (f.deny && f.deny.includes(key)) return false;
  return true;
};

export interface EffectiveSkill {
  name: string;
  /** INTERSECT(skill.model, policy.modelAllowlist). */
  model: string[];
  tier?: Tier;
  /** false ⇒ model ∩ allowlist = ∅: the operator's allowlist leaves this skill no model to run. */
  usable: boolean;
}
export interface EffectiveAgent {
  agent: string;
  /** INTERSECT(agent.scope, policy.scopeAllowlist). */
  scope: Scope;
  maxDepth?: number;
  nestingForbidden: boolean;
  skills: EffectiveSkill[];
  allowedTools: string[];
  deniedTools: string[];
  allowedSubAgents: string[];
  deniedSubAgents: string[];
}
export interface PolicyNarrowing {
  axis: "scope" | "tier" | "model" | "maxDepth" | "tools" | "retrievalTools" | "subAgents" | "nesting";
  detail: string;
}
export interface PolicyConstrainResult {
  effective: EffectiveAgent;
  narrowings: PolicyNarrowing[];
}

/** Does this policy govern `agentKey`? (empty/absent appliesTo ⇒ all agents.) */
export function policyAppliesTo(policy: SulukPolicy, agentKey: string): boolean {
  const refs = policy.appliesTo;
  if (!refs || refs.length === 0) return true;
  return refs.some((r) => { const t = parsePointer(r); return t && t.length === 2 && t[0] === "x-suluk-agents" && t[1] === agentKey; });
}

/** All policies in the document that govern `agentKey`. */
export function policiesFor(doc: OpenAPIv4Document, agentKey: string): SulukPolicy[] {
  return Object.values(doc["x-suluk-policy"] ?? {}).filter((p) => policyAppliesTo(p, agentKey));
}

/** Apply ONE operator policy to an agent — a monotone MEET. Returns the narrowed envelope + an audit of every cut. */
export function policyConstrain(agentName: string, agent: SulukAgent, policy: SulukPolicy): PolicyConstrainResult {
  const narrowings: PolicyNarrowing[] = [];
  const note = (axis: PolicyNarrowing["axis"], detail: string) => narrowings.push({ axis, detail });

  // scope: INTERSECT(agent.scope, scopeAllowlist)
  const declaredScope: Scope = agent.scope ?? null;
  const scope = intersectScope(declaredScope, policy.scopeAllowlist ?? null);
  if (declaredScope && scope && scope.length < declaredScope.length)
    note("scope", `scope narrowed ${declaredScope.length}→${scope.length} (removed ${declaredScope.filter((s) => !scope.includes(s)).join(", ")})`);

  // tier + model per skill
  const skills: EffectiveSkill[] = Object.entries(agent.skills ?? {}).map(([name, s]) => {
    let tier = s.tier as Tier | undefined;
    if (policy.capTier && tier && TIER_RANK[tier] > TIER_RANK[policy.capTier]) { note("tier", `skill "${name}" tier ${tier}→${policy.capTier} (capped)`); tier = policy.capTier; }
    let model = s.model ?? [];
    if (policy.modelAllowlist) {
      const before = model.length;
      model = model.filter((m) => policy.modelAllowlist!.includes(m));
      if (model.length < before) note("model", `skill "${name}" models ${before}→${model.length} (modelAllowlist)`);
    }
    return { name, model, ...(tier ? { tier } : {}), usable: !policy.modelAllowlist || model.length > 0 };
  });

  // tools (routes); retrievalTools is an ADDITIONAL filter on an untrusted tier
  const isUntrusted = agent.trustBoundary === "untrusted";
  const allowedTools: string[] = [], deniedTools: string[] = [];
  for (const rk of Object.keys(agent.routes ?? {})) {
    const ok = passes(rk, policy.tools) && (isUntrusted ? passes(rk, policy.retrievalTools) : true);
    (ok ? allowedTools : deniedTools).push(rk);
  }
  if (deniedTools.length) note(isUntrusted && policy.retrievalTools ? "retrievalTools" : "tools", `denied tools: ${deniedTools.join(", ")}`);

  // sub-agents: deny/allow, and forbidNesting wipes them all
  const nestingForbidden = !!policy.forbidNesting;
  const allowedSubAgents: string[] = [], deniedSubAgents: string[] = [];
  for (const local of Object.keys(agent.agents ?? {})) {
    const ok = !nestingForbidden && passes(local, policy.agents);
    (ok ? allowedSubAgents : deniedSubAgents).push(local);
  }
  if (nestingForbidden && Object.keys(agent.agents ?? {}).length) note("nesting", "forbidNesting ⇒ all sub-agents removed (effective maxDepth 0)");
  else if (deniedSubAgents.length) note("subAgents", `denied sub-agents: ${deniedSubAgents.join(", ")}`);

  // maxDepth: min(agent.maxDepth, maxDepthCap); forbidNesting ⇒ 0
  let maxDepth = agent.maxDepth;
  if (nestingForbidden) maxDepth = 0;
  else if (policy.maxDepthCap !== undefined) {
    const capped = Math.min(agent.maxDepth ?? policy.maxDepthCap, policy.maxDepthCap);
    if (capped !== agent.maxDepth) note("maxDepth", `maxDepth ${agent.maxDepth ?? "∞"}→${capped} (maxDepthCap)`);
    maxDepth = capped;
  }

  return {
    effective: { agent: agentName, scope, ...(maxDepth !== undefined ? { maxDepth } : {}), nestingForbidden, skills, allowedTools, deniedTools, allowedSubAgents, deniedSubAgents },
    narrowings,
  };
}

/** Apply ALL governing policies to an agent (MEET is associative/commutative — compose left-to-right). */
export function effectiveUnderPolicies(doc: OpenAPIv4Document, agentName: string): PolicyConstrainResult {
  const agent = agentMap(doc)[agentName];
  const policies = policiesFor(doc, agentName);
  if (!agent || policies.length === 0) {
    return { effective: { agent: agentName, scope: agent?.scope ?? null, ...(agent?.maxDepth !== undefined ? { maxDepth: agent.maxDepth } : {}), nestingForbidden: false, skills: Object.entries(agent?.skills ?? {}).map(([name, s]) => ({ name, model: s.model ?? [], ...(s.tier ? { tier: s.tier as Tier } : {}), usable: true })), allowedTools: Object.keys(agent?.routes ?? {}), deniedTools: [], allowedSubAgents: Object.keys(agent?.agents ?? {}), deniedSubAgents: [] }, narrowings: [] };
  }
  // fold: apply each policy in turn by intersecting its result with the running effective via a synthetic agent
  let merged = policyConstrain(agentName, agent, policies[0]);
  for (const p of policies.slice(1)) {
    const next = policyConstrain(agentName, agent, p);
    merged = {
      effective: {
        agent: agentName,
        scope: intersectScope(merged.effective.scope, next.effective.scope),
        ...(merged.effective.maxDepth !== undefined || next.effective.maxDepth !== undefined ? { maxDepth: Math.min(merged.effective.maxDepth ?? Infinity, next.effective.maxDepth ?? Infinity) } : {}),
        nestingForbidden: merged.effective.nestingForbidden || next.effective.nestingForbidden,
        skills: merged.effective.skills.map((s) => { const o = next.effective.skills.find((x) => x.name === s.name)!; return { name: s.name, model: s.model.filter((m) => o.model.includes(m)), ...(s.tier ? { tier: s.tier } : {}), usable: s.usable && o.usable }; }),
        allowedTools: merged.effective.allowedTools.filter((t) => next.effective.allowedTools.includes(t)),
        deniedTools: [...new Set([...merged.effective.deniedTools, ...next.effective.deniedTools])].sort(),
        allowedSubAgents: merged.effective.allowedSubAgents.filter((a) => next.effective.allowedSubAgents.includes(a)),
        deniedSubAgents: [...new Set([...merged.effective.deniedSubAgents, ...next.effective.deniedSubAgents])].sort(),
      },
      narrowings: [...merged.narrowings, ...next.narrowings],
    };
  }
  return merged;
}

// ───────────────────────────── lint ─────────────────────────────

const RUNTIME_EXPR = /\{\s*\$(request|response|method|url|statusCode|inputs)\b/i;
const microUsd = (amount: number, unit: "micro-usd" | "cents" | "usd") => amount * (unit === "usd" ? 1_000_000 : unit === "cents" ? 10_000 : 1);

/** Lint every operator policy: D1 selector-rejection, dangling appliesTo, unsatisfiability, widening, cap<estimate. */
export function lintPolicy(doc: OpenAPIv4Document): LintFinding[] {
  const out: LintFinding[] = [];
  const map = agentMap(doc);
  const add = (severity: Severity, code: string, agent: string, detail: string, at?: string) => out.push({ severity, code, agent, detail, at });

  for (const [pname, policy] of Object.entries(doc["x-suluk-policy"] ?? {})) {
    // D1: no request-value selector anywhere in a policy
    for (const { path, value } of deepStrings(policy))
      if (RUNTIME_EXPR.test(value)) add("error", "request-value-selector", pname, `D1: a request-value runtime-expression is forbidden in a policy ("${value}")`, path);

    // appliesTo must bind by agent name (and resolve)
    for (const ref of policy.appliesTo ?? []) {
      const t = parsePointer(ref);
      if (!t || t.length !== 2 || t[0] !== "x-suluk-agents") add("error", "policy-applies-malformed", pname, `appliesTo "${ref}" must be a #/x-suluk-agents/<key> ref (never a request predicate)`);
      else if (!map[t[1]]) add("error", "policy-applies-dangling", pname, `appliesTo refs a missing agent: ${t[1]}`);
    }

    // per governed agent: unsatisfiability + monotone-narrowing guard + cap<estimate
    for (const [aname, agent] of Object.entries(map)) {
      if (!policyAppliesTo(policy, aname)) continue;
      const { effective } = policyConstrain(aname, agent, policy);

      for (const s of effective.skills)
        if (!s.usable) add("error", "policy-unsatisfiable", pname, `modelAllowlist leaves skill "${s.name}" of agent "${aname}" no runnable model`, `${aname}.skills.${s.name}`);
      if (Object.keys(agent.routes ?? {}).length > 0 && effective.allowedTools.length === 0)
        add("error", "policy-unsatisfiable", pname, `policy denies EVERY tool of agent "${aname}" — the agent can do nothing`, aname);

      // monotone guard (defensive — MEET cannot widen; a widening here is a bug)
      if (effective.scope && agent.scope && effective.scope.some((s) => !agent.scope!.includes(s)))
        add("error", "policy-widening", pname, `policy WIDENED agent "${aname}" scope — inadmissible (effective must INTERSECT, never grant)`, aname);

      // cap-below-estimate cross-facet (pure static; warning — the operator under-budgeted vs the author's own number)
      const cost = agent["x-suluk-cost"] as { estimateMicroUsd?: number; amount?: number } | undefined;
      const est = cost?.estimateMicroUsd ?? cost?.amount;
      if (policy.costCeiling && typeof est === "number") {
        const cap = microUsd(policy.costCeiling.amount, policy.costCeiling.amountUnit);
        if (cap < est) add("warning", "cap-below-estimate", pname, `costCeiling (${cap} µ$) is below agent "${aname}" own estimate (${est} µ$) — operator under-budgeted`, aname);
      }
    }

    // honesty: enforcedBy is required by the type, but flag a costCeiling that omits a basis (ambiguous metering)
    if (policy.costCeiling && !policy.costCeiling.basis)
      add("warning", "cost-ceiling-no-basis", pname, "costCeiling has no `basis` — the metering window is ambiguous (declared, not enforced regardless)");
  }
  return out;
}

/** True ⇒ no error-severity policy findings. */
export const policyOk = (findings: LintFinding[]): boolean => !findings.some((f) => f.severity === "error");
