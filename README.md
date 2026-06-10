<p align="center">
  <img src="https://raw.githubusercontent.com/MahmoodKhalil57/suluk/main/branding/export/wordmark.png" alt="Suluk" width="420" />
</p>

<h1 align="center">Suluk — an independent OpenAPI v4.0 candidate</h1>

**Suluk** (سُلوك, *"the walk / wayfaring"*; substrate codename `asl-ojs`) — a journey traversed one station at a time toward a goal.

## What this is

Suluk is an independent, single-contributor candidate for **OpenAPI Specification v4.0**, forked from the OAI [Moonwalk SIG](https://github.com/OAI/sig-moonwalk) — which we treat strictly as **read-only priors** — and grounded in the Adam substrate suite (**burhan** reasoning · **daftar** memory · **mizan** gates). The document is authored *one decision per Step* via the recursive-state Walk: Walk → Step → Spine → Frontier.

**Honest disclaimer.** Suluk is **not** the OpenAPI Moonwalk SIG, is **unaffiliated** with the OpenAPI Initiative, and **cannot ratify anything** on the SIG's behalf. It is a personal candidate document that adopts the SIG's published work as priors and deviates only by recorded receipt.

## Inherited principles

These six principles come from the Moonwalk effort and are documented in more detail in the OpenAPI Initiative's [2025 blog post](https://www.openapis.org/blog/2025/02/05/moonwalk-2025-update) (an update to the [2024 post](https://www.openapis.org/blog/2023/12/06/openapi-moonwalk-2024)). Suluk **adopts** them as inherited priors:

1. **Semantics**: Semantics provide purpose, whether the consumer is a human or an AI.
2. **Signatures**: An API operation is identifiable by its signature, which can be based on any aspect of HTTP mechanics.
3. **Inclusion**: Moonwalk aspires to describe all HTTP-based APIs while remaining neutral regarding any specific design debate.
4. **Foundational Interfaces**: Reduce the complexity for tooling authors by establishing standardized interfaces for parsing API description documents and defining consistent methods for expressing API structural semantics.
5. **Separation of Concerns**: Modularization keeps scope manageable with loose coupling among concerns such as HTTP interfaces ("API shapes"), deployment configuration, and content schema formats.
6. **Mechanical Upgrading**: An automated upgrade process from 3.x to 4.0 is part of the Moonwalk effort.

## How the work proceeds

Suluk advances by **the Walk** — each Step resolves exactly one question, records its dependencies, writes a `plan/facts/*.bn` claim with a confidence ceiling, emits a `Cxxx` ADR when the decision is hard to reverse, and re-projects the affected `specification/` section from the ledger. The `specification/` document is a *projection*, never the source of truth.

- **Spine** (always-loaded digest): [plan/STATE.md](plan/STATE.md)
- **Charter**: [C001 — candidate fork charter](doc/architecture/decisions/C001-candidate-fork-charter.md)
- **Mechanism**: [C002 — recursive-state mechanism](doc/architecture/decisions/C002-recursive-state-mechanism.md)
- **Glossary**: [CONTEXT.md](CONTEXT.md)

## Relationship to the upstream SIG

The official OpenAPI Moonwalk SIG's record is preserved here as **read-only priors** under [github-export/](github-export/) (mirrored discussions and ADRs). Suluk's working discipline is **adopt-by-default, deviate-by-receipt**: a SIG prior is never silently overruled — a Deviation requires a claim, a cite-chain, a stated reason the prior is insufficient, and a lowered confidence ceiling.

We **never** PR or push upstream; the upstream is read-only. The canonical sources are the OAI SIG's [discussions](https://github.com/OAI/sig-moonwalk/discussions) and [repository](https://github.com/OAI/sig-moonwalk).
