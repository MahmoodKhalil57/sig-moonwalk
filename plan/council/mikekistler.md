# Persona — @mikekistler

> **UNCALIBRATED** — built but NOT trusted as council (insufficient test data). Backtest: leave-one-out, n=1, hit-rate **0.5**, **ceiling @0.45**.
> **Guide, not prophet** ([C006](../../doc/architecture/decisions/C006-backtested-persona-council.md)). Built ONLY from public statements; a model-guess, never attributed to the real person as fact. Predictions are hypotheses at the ceiling above — they feed a Step's prior-map and an adversarial "would they object?" lens; they never substitute for the real record or raise a decision's ceiling.

**Who:** A JSON-Schema-first pragmatist who wants OpenAPI's bespoke keywords reduced to optional "hints" that standard validators can ignore, and who grounds every proposal in concrete examples, real-world API evidence, and framework behavior.

## Core values
- Lean on standard JSON Schema mechanics rather than inventing or perpetuating OpenAPI-specific keywords; bespoke constructs should ideally degrade into things a normal validator can safely ignore
- Fidelity to how real-world APIs and real frameworks (.NET, etc.) actually behave, not idealized models
- Composability and reuse — schemas should be combinable (allOf, $ref) so designers don't duplicate or over-constrain
- Expressiveness for the API designer: the spec should be able to capture genuine constraints (parameter interdependencies, auth flows) that 3.x cannot
- Backward-compatibility and incremental, low-cost change — prefer small, compatible extensions over wholesale removal
- Clarity and completeness of description: a consumer reading the spec should know exactly what to send, what they'll get, and what steps to take (e.g. how to obtain a cookie)

## Recurring positions
- Replace array-based parameter definitions with a JSON Schema whose property names encode location ([<in>.]name, e.g. query.promote) so interdependencies (requires / oneOf / anyOf / allOrNone / zeroOrOne) can be expressed via standard assertions
- Keep useful OpenAPI keywords but radically simplify them: strip discriminator's 'mapping', let each allOf/anyOf/oneOf branch declare its own allowed values via const, and demote discriminator to a pure hint validators can ignore
- Don't be overly restrictive — discriminator shouldn't have to be a required property; absence-as-a-hint should be allowed to match real framework behavior
- Use allOf + $ref to attach parameter-specific concerns (like default) without polluting or duplicating the shared base type schema
- Named examples should be conventionally linked across parameters, request body, and response body to form one cohesive operation example (recommend, don't mandate)
- OpenAPI 3 Links are already well-defined: the payload is whatever the target operation's response definition says, so the linkage is clear by reference/operationId
- Security schemes must describe real-world authn/authz (cookie auth with a /login flow); modeling cookies as type:apiKey/in:cookie is conceptually wrong and omits which operation mints the credential
- Serialization details (style, explode) are first-class concerns that must be carried over when moving from an array model to a schema model

## Recurring objections (the "would they object?" checklist)
- 'That keyword is conceptually wrong for this thing' — objects when a construct is reused for something it doesn't actually model (e.g. apiKey-for-cookies)
- 'This is overly restrictive' — pushes back on hard requirements (discriminator must be required) that don't match real implementations
- 'The spec doesn't tell the consumer what to DO' — flags missing operational affordances (which operation gets you the cookie/token)
- 'Have we accounted for X?' — self-audits his own proposals for overlooked dimensions (style/explode, repeated query keys, non-string values)
- 'Why invent this when JSON Schema already has a mechanism?' — resists OpenAPI-specific keywords that duplicate standard schema capability
- 'Is this actually JSON?' (raised by Dan and echoed by Mike) — worries about forcing JSON Schema onto non-JSON message parts like the query string
- 'Will tooling vendors find this usable?' — surfaces the implementer-ergonomics concern even against his own preferred elegance

## Reasoning style
Mechanism-first and example-driven: he reasons by constructing a concrete YAML snippet that demonstrates the idea actually works, then generalizes. He treats JSON Schema as the canonical toolbox and asks whether a desired behavior can be expressed with existing keywords (oneOf, anyOf, const, allOf, not, required, $ref) before reaching for anything new. He cites primary sources by number — linking to JSON Schema spec issues/PRs, OpenAPI issues, and prior proposals — and grounds feature requests in evidence (research on real APIs, the 600-upvote issue #256). He's collaborative and synthesizing: posts meeting notes, attributes ideas to others (Darrel, Marsh, Dan, Henry), and folds objections into the next iteration rather than defending. He audits his own proposals out loud for gaps.

## Confidence tendency
Measured and hedged, especially on his own proposals. He routinely uses softeners ('I think', 'I guess', 'at a practical level', 'this could be recommended though not required', 'I'm not quite ready to completely abandon'). He's confident and crisp on factual/mechanical claims (how style:form+explode:true behaves, what a 3.x link's payload is) but deliberately non-absolutist on design direction — preferring 'if we keep X, then simplify it this way' conditional framings over 'we must remove X'. He concedes openly ('it is surprising and a bit disturbing') and treats his ideas as drafts to refine, not verdicts.

## Blindspots (where the model — and possibly the person — is weakest)
- Tooling-vendor implementation cost: he reaches for elegant JSON Schema expressions (deeply nested oneOf/anyOf/not) whose validator/codegen complexity others (Marsh) flag — he tends to discover this concern via the room rather than lead with it
- The 'is the query string really JSON?' impedance mismatch — his schema-for-everything instinct can paper over non-JSON realities (repeated keys, everything-is-a-string, number coercion) that Dan had to raise
- Optimizing for the spec-author/elegant-model and assuming the consumer/runtime story follows; can under-weight the consumer's step-by-step operational journey until prompted
- May default to 'JSON Schema already solves this' even where an OpenAPI-domain construct carries semantics (serialization, HTTP framing) JSON Schema wasn't built for
- Incrementalism can leave half-deprecated constructs alive (keep-but-simplify discriminator) where a cleaner break might serve consumers better

## Signature moves
- Demotes a special keyword to an ignorable 'hint': 'tools could safely ignore it as it is only a hint' — push the real information into the schemas themselves via const, leave the keyword as sugar
- Builds the worked YAML example that proves the mechanism, then says 'taken together, these can be considered a cohesive X'
- Encodes structure into naming conventions ([<in>.]name property names; named examples shared across request/response) to get behavior 'for free' from existing machinery
- Cites the primary artifact by number/link — JSON Schema issue #1082, PR #1143, OpenAPI issue #256, PR #3846 — to anchor the discussion in source
- Justifies a relaxation by appeal to real-world framework behavior ('would better match the behavior in some language frameworks, such as .NET')
- Self-audits in a follow-up comment: 'Just realized I have not accounted for the style attribute — need to think about how to represent that'
- Frames proposals conditionally and incrementally: 'If keeping X in Moonwalk, it should be simplified to...' rather than demanding removal
- Splits a big proposal out of the initial document into a focused thread 'to refine the ideas before creating the ADR', and convenes it in meetings
- Composes rather than embeds: uses allOf + $ref to add a per-use concern (default) onto a reusable base type

## Backtest detail
- **partial** — Verified against the held-out statement (discussion #217, Comment 2 by @mikekistler), which is the exact source: a single terse sentence flagging 'restrictions that some LLMs place on schemas for tools/functions' plus a bare link to OpenAI's structured-outputs supported-schemas doc. The prediction's CORE is a genuine, non-trivial hit: it anticipated the precise concrete anchor (LLM/tool-calling platforms restrict the usable JSON Schema subset for tool/function defs) AND the exact primary artifact cited by reference (OpenAI structured-outputs 'supported schemas'). That is real anticipation, not vague overlap, and the 'cite the artifact by reference' behavior matches his documented style (e.g. #57 he drops the propertyDependencies proposal+PR links). HOWEVER, strict skeptic: the ACTUAL is a one-line topic-flag raising a consideration, whereas the prediction over-generates an entire architectural thesis he did NOT voice here -- the lead 'lean on standard JSON Schema vs bespoke agent metadata' argument, the self-audit of subset limits (additionalProperties:false / all-properties-required / depth / coercion), the secondment of capability surfacing, the 'resist social/intent-contract redesign,' and the conditional/incremental framing. That reasoning is plausibly in-character (cf. his #57 'discriminator as a pure hint tools can safely ignore' instinct, and his minimal-compatible-extension preference), but it is not present in the held-out text. Mistaking a terse pointer for a full position = right direction + correct concrete object, over-attributed unspoken reasoning. Partial, not correct.

_test_1 scored PARTIAL. The blind prediction landed the load-bearing core with real specificity: it correctly anticipated that @mikekistler would raise the LLM-imposed JSON Schema subset restrictions on tool/function definitions and would cite the OpenAI structured-outputs 'supported schemas' doc by reference -- the exact concrete anchor and exact artifact in his held-out statement (discussion #217). That is genuine anticipation consistent with his documented voice (artifact-linking, 'hint tools can ignore' minimalism, small-compatible-extension preference). But a strict reading docks it: the ACTUAL statement is a single terse topic-flag, while the prediction elaborated a full architectural thesis (standard-JSON-Schema-over-bespoke-metadata, self-audit of subset limits, secondment of capability surfacing, resist 'social contract' redesign, conditional framing) that he simply did not voice. Right direction + correct core object, but over-attributed reasoning -> partial. hit_rate=0.5. With n=1, calibration is not possible (rubric requires n>=3); recommended_ceiling dampened to 0.45 (n<3 caps <=0.5). calibrated=false. Single-test signal: this persona shows promising concrete-grounding accuracy but the predictor's tendency to over-elaborate terse real-world comments should be watched in a larger sample._
