/**
 * @suluk/agents — the Suluk Agent composition layer (C027). Lint + project an `x-suluk-agents` map (skills +
 * deterministic routes + by-name sub-agents) into a Claude plugin AND an OpenRouter/OpenAI-compatible manifest:
 * one contract, two artifacts, zero network at generate time. This package is the OTHER side of the D1 wall —
 * it reads `x-suluk-agents`, which @suluk/core's matcher (buildAda/matchRequest) provably never does. Selection
 * and tiering are runtime-advisory; determinism is DECLARED, never enforced. CANDIDATE tooling — NOT official OAS.
 *
 * NB (the C027 module-boundary invariant): @suluk/core MUST NEVER import @suluk/agents. The dependency is one-way.
 * test/core-boundary.test.ts enforces it as a maintained tripwire.
 */
export { lintAgents, lintOk, assertAgentInstallable, type LintFinding, type Severity } from "./lint";
export {
  parsePointer, resolveOperationRef, agentMap, subAgentKey, childKeys, findCycle, subtreeDepth, deepStrings,
  type OperationLocus, type ResolvedOperation,
} from "./resolve";
export { contentHash, renderSkillMd, type SkillRenderInput } from "./skill";
export {
  projectClaudePlugin, projectOpenRouter,
  type ClaudePluginOptions, type ClaudePluginArtifacts,
  type OpenRouterOptions, type OpenRouterAgentManifest, type OpenRouterFunctionTool,
} from "./project";
export { reachableSurface, assertServedSubset, assertServedSubsetGoverned, verifySkillFreshness, type ConformanceFinding } from "./conformance";
export { intersectScope, analyzeScopes, localEscalations, type Scope, type ScopeEscalation } from "./scope";
export {
  agentManifest, verifyAgentFreshness,
  type AgentManifest, type AgentManifestNode, type AgentManifestSkill, type AgentManifestRoute, type AgentManifestGoverned,
} from "./manifest";
// policy (C028): the operator governance overlay — monotone-narrowing MEET + the static lints. costCeiling is
// DECLARED, never schema-enforced (enforcedBy names a runtime adapter); enforcement is reserved (build-by-nobody).
export {
  policyConstrain, effectiveUnderPolicies, policiesFor, policyAppliesTo, lintPolicy, policyOk,
  type EffectiveAgent, type EffectiveSkill, type PolicyNarrowing, type PolicyConstrainResult,
} from "./policy";
