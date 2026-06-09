# OpenAPI v4.0 Candidate (Moonwalk Fork)

A single-contributor effort, grounded in the Adam substrate suite (burhan / daftar / mizan), to author a complete, internally-consistent **candidate** for OpenAPI Specification v4.0 — honestly labelled as a fork/proposal, not as closure of the official Moonwalk SIG. This glossary is the shared language for that effort; it is a glossary only, not a spec or a plan.

## Language

**Candidate v4.0**:
The complete, internally-consistent specification document we author end-to-end. Our artifact, under our control. Distinct from anything the official SIG ratifies.
_Avoid_: the spec, moonwalk, v4 (all ambiguous with the official effort)

**Completion**:
The state in which the Candidate v4.0 is internally coherent as a **single unified document covering every Concern** (API shapes, content schema formats, deployment configuration, foundational interfaces, mechanical upgrade). Monolithic — there is no per-module finish line, so Completion is judged on whole-document coherence. Explicitly **not** official ratification, SIG consensus, or community adoption.
_Avoid_: done, shipped, ratified, finished

**Concern**:
One of the loosely-coupled areas Moonwalk separates: API shapes, content schema formats, deployment configuration, foundational interfaces, mechanical upgrade. In our Candidate these are sections of one document, not separate deliverables.
_Avoid_: module, package (they are not independently shipped)

**Originated section**:
A part of the Candidate with no strong SIG prior, constructed by burhan from the principles. Carries an inherently low confidence ceiling until independently witnessed; contrast with an Inherited prior. Deployment, upgrade, and foundational-interface areas are mostly Originated.
_Avoid_: draft, stub (those describe maturity, not provenance)

**The SIG**:
The official OpenAPI Moonwalk Special Interest Group and its consensus process (discussions → weekly-call consensus → ADRs → eventual formal spec). We are an external contributor building a candidate; we are not the SIG and cannot ratify on its behalf.
_Avoid_: the project, moonwalk (when meaning the official body)

**Prior**:
An existing position from the SIG record — an accepted ADR, an initial proposal, or a discussion consensus — that we treat as input to our reasoning, with an explicit confidence ceiling, rather than as fixed truth.
_Avoid_: requirement, given, fact

**Inherited prior**:
A Prior we adopt unchanged into the Candidate. Default outcome for any Prior; recorded so the Candidate's lineage to the SIG record is always traceable.
_Avoid_: assumption, copy

**Deviation**:
A point where the Candidate departs from a Prior. Permitted only with a recorded justification receipt — the contested claim, its cite-chain, why the Prior was insufficient, and the new confidence ceiling. Never silent.
_Avoid_: change, override, fix (when unrecorded)
