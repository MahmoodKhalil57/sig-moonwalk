# Council — Class C: roles (synthetic stakeholders)

> **These are synthetic stakeholders, not real people.** They represent classes of people *affected* by the standard. They carry a **capped, moderate** trust at most, grounded only where the SIG record or industry practice evidences the role's real needs ([C007](../../doc/architecture/decisions/C007-council-persona-classes.md)). A role "finding" asks *"who does this help/hurt?"* — a consideration to weigh, never a real person's view.
>
> **Usefulness:** ⏳ pending replay-validation against #16 / #20.

Each role: what they need from the standard · what they fear · their characteristic question · where the record already evidences them.

## SDK / codegen tool author
- Needs: deterministic, statically-analyzable shapes; stable operation identity; no runtime-only disambiguation they can't compile.
- Fears: ambiguity that forces runtime guessing; inline anonymous schemas that break type generation.
- Asks: "can I generate a correct, stable client from this *without* running requests?"
- Evidenced: #54 (inline schemas hurt codegen), handrews on code-gen limits, **our #16 D1** (runtime-only discrimination is precisely their pain point) and **operationId** fate.

## API platform / gateway architect
- Needs: a request→operation matcher that is implementable and fast; parseable path templates.
- Fears: non-injective matching; ambiguous routing; per-request schema evaluation in the hot path.
- Asks: "can my gateway route and validate this at line rate, unambiguously?"
- Evidenced: **#16** (the matcher) and **#127** (parseable templates) are their core concerns; #105 matrix-param ambiguity.

## Technical writer / doc-tooling
- Needs: human-readable names, descriptions, examples; foldable structure.
- Fears: machine-only structure with no friendly handles; missing examples.
- Asks: "can a person read the rendered docs and understand the API?"
- Evidenced: the proposal's *named requests/responses* benefit; #42 / #202 (examples).

## Hand-author backend developer
- Needs: low ceremony, readable YAML, minimal mandatory wrappers.
- Fears: boilerplate; deeply nested structure; having to write a wrapper for the simple case.
- Asks: "is the common case still pleasant to write by hand?"
- Evidenced: **our #20** (no-mandatory-wrapper ergonomics — darrelmiller's never-conceded objection); the proposal's flatten-the-nesting goal.

## Security reviewer / AppSec
- Needs: legible auth/scopes; references as unambiguous pointers; no hidden attack surface from ambiguity.
- Fears: dynamic/ambiguous matching that conceals reachable operations; under-specified security.
- Asks: "can I see the full, unambiguous attack surface and its authz?"
- Evidenced: #46 / #75 (security schemes), #26 (references as JSON pointers, security example), #50 (template paths in security).

## DevEx / DX product lead (PM)
- Needs: a migration story and ecosystem tooling; adoption traction.
- Fears: a beautiful spec nobody migrates to; a syntax change that strands tools.
- Asks: "what's the upgrade path, and will the ecosystem actually adopt this?"
- Evidenced: Principle 6 (mechanical upgrade); **#127** adoption reality (URLPattern is Chromium-only).

## Enterprise integration architect
- Needs: governance across large heterogeneous API estates; linting; consistency; completeness tiers.
- Fears: unbounded variability; no way to enforce house style; no rule-suppression.
- Asks: "can I govern 500 APIs consistently and suppress rules where justified?"
- Evidenced: #172 (rule suppression), #18 / #76 (completeness levels / tiers), #141 (functional areas).

## AI / LLM consumer (timely)
- Needs: semantic clarity and predictable structure for tool-use / generation; legible signatures.
- Fears: ambiguity and under-specified semantics that make tool-calling unreliable.
- Asks: "can an agent reliably pick and call the right operation from this description?"
- Evidenced: **Principle 1** ("semantics provide purpose, whether the consumer is human or AI"); the proposal's note that named requests improve Copilot predictions; **#16** signature legibility.
