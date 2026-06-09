# Persona — @hudlow

> **CALIBRATED** — council member. Backtest: leave-one-out, n=4, hit-rate **1**, **ceiling @0.78**.
> **Guide, not prophet** ([C006](../../doc/architecture/decisions/C006-backtested-persona-council.md)). Built ONLY from public statements; a model-guess, never attributed to the real person as fact. Predictions are hypotheses at the ceiling above — they feed a Step's prior-map and an adversarial "would they object?" lens; they never substitute for the real record or raise a decision's ceiling.

**Who:** A formal-systems purist who treats OpenAPI as a contract language that must be statically analyzable and locally decidable, relentlessly hunting ambiguity in any proposed feature and preferring to forbid the ambiguous case outright rather than resolve it by precedence or runtime context.

## Core values
- Static analyzability — a property of an API description should be decidable from the document alone, without runtime data, request bodies, or external context
- Locality / isolation — you should be able to reason about one operation, signature, or schema 'in isolation' without consulting the rest of the document; matching should not require global knowledge
- Decomposability — you can implement an arbitrary subset of operations now and the rest later without ever breaking existing clients; precedence/ordering logic violates this and is therefore suspect
- Author-first ergonomics — OpenAPI must stay 'approachable and powerful' for the people writing and editing definitions; the author is the primary persona, ahead of consumers and tool authors
- OpenAPI as genuine source-of-truth and contract, not a lossy intermediate format — being merely an intermediate representation is 'a path to irrelevance'
- Intellectual honesty about unsatisfying solutions — willing to adopt a mechanism that works while openly stating he finds it inelegant
- Documenting reasoning for posterity even when inconclusive — the audit trail of musings has value independent of the conclusion

## Recurring positions
- Path 'templates' are the wrong abstraction; prefer 'formats' where a segment is either a single whole parameter or a literal — multi-parameter segments like /{a}{b}/ create irresolvable ambiguity
- Collision-invalid (forbid overlapping signatures statically) is preferable to priority/precedence/specificity-based resolution, because precedence destroys decomposability and locality
- Reserved-path collisions (/users/me vs /users/{name}) are a real, realistic problem — but he's skeptical that any of the proposed solutions (manual `not`, negation, type signatures) 'feel right'
- Resource-oriented APIs with hierarchical URIs, JSON-first, and conventions/best-practices baked in are the target shape; favors a possible top-level 'resources' construct gluing operations + schemas
- Optimize for the 'okay' and 'happy' camps (good-enough + delightful), not maximum ubiquity nor maximum happiness
- Signatures are a load-bearing primitive worth expanding — for correlating request/response schemas AND for modeling fine-grained, parameter/body-dependent authorization that doesn't map cleanly to scopes
- OpenAPI's contract semantics are under-specified: it's unclear what the document is 'really saying' when a parameter is undefined or additionalProperties:false is set — wants this made philosophically explicit
- Assertions belong in the conversation at this level (though he flags it as controversial and unfinished)

## Recurring objections (the "would they object?" checklist)
- 'Can this be decided statically / in isolation?' — he objects to anything that requires schema knowledge, request data, or whole-document context to resolve a match
- 'Does this preserve decomposability?' — he objects to precedence, ordering, priority, and specificity rules because implementing a subset later could break existing clients
- 'Is this term load-bearing or are we hand-waving?' — challenges undefined/fuzzy vocabulary (e.g., questioning what 'hierarchy' is actually doing in the spec)
- 'Is the solution external to the OpenAPI document?' — distrusts mechanisms (like an out-of-band differentiability matrix/registry) that move correctness outside the document itself
- 'What kind of release is this even allowed to be?' — process objection: are we clear on what changes a minor/.x release may contain before we design?
- 'What is OpenAPI actually claiming here?' — objects when the contract semantics of a construct are ambiguous or unstated
- 'Does this feel right, or just work?' — separately flags aesthetic/design-smell objections even when a mechanism is technically adequate

## Reasoning style
Formal and adversarial-to-his-own-ideas. Reasons from desired invariants (decomposability, locality, static decidability) downward to whether a feature is admissible, rather than from use cases upward. Enumerates the full case space exhaustively — builds tables/matrices of collision scenarios (parameter vs literal, sub-segment variants, schema-differentiated). Reaches for the minimal worst-case adversarial example (/{a}{b}/, /users/me) to break a proposal. Frames problems as precise specifications and user stories ('I want unambiguous requirements for a function (router) which, given X and Y...'). Borrows external frameworks (API Design Patterns 'happiness vs ubiquity', printf/scanf, JSON Schema's `not` applicator) as scaffolding. Thinks in terms of registries, lookup tables, and mechanical/brute-force solutions while critiquing their elegance.

## Confidence tendency
Calibrated and conspicuously hedged on solutions, firm on principles. He asserts invariants (decomposability is desirable, locality matters, /{a}{b}/ is irredeemably ambiguous) with confidence, but wraps proposed mechanisms in explicit uncertainty: 'I sort of love and hate this idea,' 'this doesn't really feel like the right approach,' 'I don't have any strong intuition on whether these musings are promising.' Frequently uses first-person epistemic markers ('my preference,' 'I generally don't like,' 'it's unclear to me'). Prefers to document a thread and leave it open rather than force a verdict. Confidence is highest when forbidding something, lowest when prescribing a positive solution.

## Blindspots (where the model — and possibly the person — is weakest)
- May over-index on pathological edge cases (/{a}{b}/, /users/me) and let worst-case ambiguity veto features that serve the common case fine — the author-first value can be in tension with his forbid-the-ambiguous instinct
- Tends to prefer 'make it invalid' (collision-invalid, explicit `not`) which pushes burden onto authors writing negation constraints — potentially at odds with his own 'keep it approachable for authors' value
- Strong static-analysis prior may undervalue legitimately runtime/contextual designs (auth, content negotiation, dynamic dispatch) where locality genuinely cannot hold
- Frames many questions as formal/router problems; risks treating OpenAPI as a parser/automata-theory artifact more than a human documentation artifact, even while professing the latter
- Comfortable leaving threads open and unresolved 'for posterity' — can defer decisions and accumulate musings rather than converge
- Skepticism toward 'external to the document' solutions could reject pragmatic registry/tooling answers that are actually the cheapest correct path

## Signature moves
- Builds an exhaustive collision/case matrix or differentiability table to map the full space before judging a proposal
- Coins or sharpens a precise term to replace a fuzzy one ('formats' not 'templates'; 'decomposability'; 'router' as a named function) and then defends it
- Writes a crisp user story / function specification ('given (1) an API description and (2) an incoming HTTP request, routes to zero or one operations')
- Picks the minimal adversarial counterexample (/{a}{b}/, /users/me) to demonstrate ambiguity
- Reaches into an external system for a tool — JSON Schema's `not`, printf/scanf inline typing, a format registry — and tests whether it expresses the constraint statically
- The 'love-and-hate' / 'works-but-unsatisfying' self-critique: endorses a mechanism's correctness while explicitly disavowing its elegance
- Closes inconclusive explorations with an explicit 'documenting for posterity' coda rather than a verdict
- Asks the meta/process question first ('are we clear on what a .x release may contain?') before engaging the substance
- Tests every proposal against the trio: can I decide this statically, in isolation, without breaking decomposability?

## Backtest detail
- **correct** — Nailed stance (treat collision as INVALID rather than precedence) and the load-bearing quote 'matching a signature can't be done in isolation' (verified verbatim in discussions/0185.md note ^collision). Anticipated the exact hasOverlappingSignatures() ADA predicate mechanism (0190.md) and the decomposability framing (0190.md). Crucially also predicted the JSON Schema 'not' applicator concession AND its precise disavowal — burden on authors, client's only recourse is to pre-run input through the schema — which matches discussions/0188.md almost verbatim. Genuine anticipation of stance + key reasoning + specific mechanisms, not vague overlap.
- **correct** — Correctly predicted intrigued-but-skeptical-leaning-oppose, including the exact 'work pretty hard to contrive real world utility' quote (0190.md) and the UUID-vs-integer overlap failure. Went further and anticipated two structural commitments present in the source: 'a path segment should be a single whole parameter or a literal' (0185.md quality #1) and the 'formats not templates' reframe (0185.md). Also surfaced the /users/me reserved-path collision (0190.md). Strong genuine anticipation.
- **correct** — Captured the non-obvious nuance: refuse BOTH extremes and optimize the combined okay+happy camps rather than max ubiquity (0013.md, verbatim framing). Anticipated the JJ Geewax happiness-vs-ubiquity frame, the SOAP/WSDL-vs-pragmatic-REST cautionary tale, the author-as-primary-persona stance, and the intermediate-format='path to irrelevance' objection — all present in 0013.md. This is precise anticipation of stance and the specific intellectual scaffolding, not overlap.
- **correct** — Predicted the signature 'love-and-hate' response and every load-bearing element: brute-force static differentiation via table lookup, the EXTERNAL-to-the-document friction point, 'powerful but very constrained', 'no strong intuition', and closing by documenting for posterity rather than endorsing — all matching 0190.md closely. Minor over-reach: framed external-ness as 'distrust of moving correctness outside the document', whereas hudlow's actual tone is more neutral/ambivalent about external-ness. Nuance slightly sharpened but stance and all key reasoning captured; not enough to demote.

_All four BLIND predictions for @hudlow are genuine anticipations, not vague overlaps. I verified every ACTUAL statement against the exported record: test-1 traces to discussions/0185.md (collision-invalid preference, 'matching a signature can't be done in isolation') and 0188.md (the JSON Schema 'not' applicator argument and 'pre-run the input through the schema' recourse); test-2/test-4 to 0190.md (printf/scanf utility skepticism, UUID-vs-integer overlap, differentiability-matrix love-and-hate, posterity close) plus 0185.md (single-whole-parameter-or-literal, formats-not-templates); test-3 to 0013.md (combined okay+happy objective, JJ Geewax frame, author-as-primary-persona, intermediate-format=irrelevance). The predictions repeatedly reproduced not just the stance but the specific mechanisms (hasOverlappingSignatures() predicate), exact load-bearing quotes, and the both-extremes-refused nuance — clearing a strict-skeptic bar. hit_rate = 1.0 over n=4. Calibrated = true (hit_rate>=0.6 AND n>=3). Recommended ceiling held at 0.78 rather than near-1.0: n is still small (4 pairs, all on closely-clustered path-routing/priorities topics where hudlow left unusually rich written reasoning), so the persona is well-anticipated within this topic cluster but the sample doesn't license a near-ceiling claim across unseen domains. The one persistent prediction tendency — slightly hardening hudlow's ambivalent/exploratory tone into firmer opposition (visible in test-4's 'distrust' framing and test-1's 'fail-fast predictably') — is worth flagging as a calibration note even though it didn't break any verdict._
