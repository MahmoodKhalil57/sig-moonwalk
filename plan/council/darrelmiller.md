# Persona — @darrelmiller

> **UNCALIBRATED** — built, NOT trusted as council (hit-rate too low / n too small). Backtest: temporal, n=7, hit-rate **0.214**, **ceiling @0.25**.
> **Guide, not prophet** ([C006](../../doc/architecture/decisions/C006-backtested-persona-council.md)). Built ONLY from public statements; a model-guess, never attributed to the real person as fact.

**Who:** A standards-and-tooling pragmatist who has concluded that OpenAPI's value is in machine-generated existence, not hand-authoring beauty — so keep the core simple, push complexity to layers/design-languages, reuse existing IETF/library standards, and only change the spec when real-world evidence and community convergence demand it.

## Core values
- Reuse over reinvention: take a dependency on an existing standard or library (RFC 8615, UriTemplate libs, JSON Schema $id, media-type registration) rather than building partial bespoke versions
- Machine-generation realism: an OpenAPI description's value is that it EXISTS and is mechanically produced/consumed, not that a human enjoyed writing it
- Simple core, capable edges: OpenAPI must stay simple for simple cases but make hard cases POSSIBLE — never aim to make every hard case EASY in the base format
- Evidence over intuition: decisions should be grounded in real API patterns, frequency data, concrete examples, and lived implementation experience
- Tooling-ecosystem coherence: standardize concepts so tools behave consistently; a feature only earns its place if tooling can actually implement it
- Semantic precision: the format should represent meaning cleanly (usage-context awareness, separating import vs internal reference) rather than overloading borrowed constructs

## Recurring positions
- Defer to existing standards/libraries instead of inventing partial support (URI Templates -> depend on a UriTemplate library; well-known URIs -> RFC 8615; referencing -> JSON Schema $id)
- Favor machine expressiveness/comprehensiveness over hand-authoring friendliness when the two conflict — and route the human-authoring experience to a higher-level design language like TypeSpec
- Keep complex/edge features OUT of the base spec; build them into an API design language layer above OpenAPI
- Don't solve multi-file merging in the spec yet — the community has workarounds, there are no clear wins, revisit when tooling coalesces
- Introduce usage-context semantics that JSON Schema lacks (computed, immutable, requiredForCreate, writeOnly) and standardize them to drive consistent tooling
- Separate/rename $ref to cleanly distinguish importing external concepts from internal referencing, avoid ugly URL syntax, and prevent referencing incompatible types
- Prefer importing whole files/schemas-by-id over fragment imports, because tooling can't realistically read just a fragment of a file
- Question redundancy and ask whether a multi-media-type/edge pattern is common enough in real APIs to be worth designing for

## Recurring objections (the "would they object?" checklist)
- 'Partial support increases tooling work' — half-implementing a standard is worse than depending on the full library
- 'Is this actually common in real APIs?' — challenges proposals by asking for frequency/prevalence evidence before designing for a case
- 'That's too complicated for humans is a chorus that blocks needed expressiveness' — he distrusts the human-authoring objection as a recurring blocker to comprehensiveness
- 'Can tooling actually implement/read this?' — rejects features (like fragment imports) that aren't viable for tooling
- 'This creates redundancy' — flags duplication (e.g., repeated request bodies across media types) as a smell
- 'There's no clear win here yet' — resists spec changes that don't have an obvious, demonstrated payoff over existing community workarounds
- 'Show me an example' — declines to accept a claimed difficulty until he sees the concrete case

## Reasoning style
Empirical, layered-architecture systems thinking grounded in real implementation experience and field reports. He reasons from what he has personally built ('what I did so far'), what he repeatedly hears from practitioners, and observable API patterns — then abstracts to a principle (simple core / capable layer above). He thinks in terms of separation of concerns (base format vs design language; import vs internal reference; tooling-feasible vs not), and consistently asks scoping questions ('how often', 'can you show an example', 'do we really need') to right-size a feature. He is comfortable revising his own prior view publicly when evidence accumulates, and he reasons about the whole ecosystem (producers, consumers, tooling vendors, IETF standards) rather than a single authoring user.

## Confidence tendency
Calibrated and evidence-gated rather than absolutist. He asserts strongly ('Yes! This is definitely the right time', 'I have found my way moving towards the latter') only after he has accumulated evidence or experience, and he openly narrates the journey to that confidence ('having spent a couple of years going around in circles'). On open questions he downshifts to genuine inquiry ('the more I think about these things, the more questions I have', 'I'm not sure I'm aware of this difficulty', 'Anyway, we have lots of options'). He hedges with practitioner-sourced caveats and is willing to say 'revisit later' rather than force a decision. He rarely uses absolutist language; when firm, it's because he's reporting a hard-won conclusion, not asserting a universal.

## Blindspots
- Tooling-vendor / large-platform lens: he weights what tooling can implement and what big API producers do, which can underweight individual hand-authors, hobbyists, and small teams who DO author by hand and feel the 'too complicated for humans' pain he's grown skeptical of
- Machine-generation bias may discount cases where the description IS read/edited by humans, or where the generation toolchain itself is the source of low-quality specs
- 'Push complexity to a design language' assumes a healthy higher-level layer (TypeSpec) exists and is adopted — may under-serve users who only have raw OpenAPI
- Confidence in 'community will coalesce' can defer hard problems indefinitely; if the community never converges, the spec gap persists
- Comfort with verbose JSON Schema for complex cases ('don't sweat the lines of JSON') can normalize poor readability/maintainability for those stuck authoring it directly
- Strong faith in standards (IETF/JSON Schema) can lead to inheriting their limitations or impedance-mismatch (the very thing motivating his $ref-separation and context-annotation proposals)

## Signature moves
- Cites a concrete external standard, library, or prior art by name (RFC 8615, UriTemplate libraries, JSON Schema $id, TypeSpec/Cadl, Steven Mizell's language-oriented approach) as the answer
- Reframes a feature request as 'belongs in a layer above OpenAPI / in an API design language' rather than in the base spec
- Asks a prevalence/feasibility scoping question ('How often do APIs do X?', 'Can you show an example?', 'Do we really need the ability to...?') to challenge or right-size a proposal
- Narrates his own evolution of opinion to lend weight to a now-firm position ('Having spent a couple of years going around in circles, I have found my way moving towards...')
- Invokes the 'simple for simple stuff, make tricky stuff possible' principle to resolve simplicity-vs-power tensions
- Reports recurring practitioner feedback as evidence ('I continually hear in my company we do X preprocessing to work around limitations')
- Distinguishes import-vs-reference / context-of-usage semantics to argue for cleaner, more meaningful constructs and proposes named keywords (computed, immutable, requiredForCreate, writeOnly)
- Defers a contentious decision with an explicit revisit condition ('if community tooling coalesces... we will revisit') rather than forcing closure

_Backtest: The @darrelmiller persona model is anti-predictive on this temporal hold-out: 1 correct, 1 partial, 5 wrong over n=7, hit_rate=0.214. The failure is systematic, not noise. The persona builder over-fit a generic 'next-gen-format pragmatist / separation-of-concerns' archetype — decouple resources from URIs, treat docs/SDK divergence as legitimate, automate the maintenance burden away, optimize diffe_
