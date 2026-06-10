<p align="center">
  <a href="https://github.com/MahmoodKhalil57/suluk">
    <img src="https://raw.githubusercontent.com/MahmoodKhalil57/suluk/main/branding/export/wordmark.png" alt="Suluk" width="360" />
  </a>
</p>

<h1 align="center">@suluk/builder</h1>

<p align="center"><b>Tiered contract-narrowing DSL (components→blocks→sections→pages) bound to the Suluk cycle. A page composes sections; buildApp emits backend (routes+v4) AND frontend (page TSX) at once. Inspired by multivendorbuilder's DSL, rebuilt with the Suluk discipline.</b></p>

<p align="center">
  <em>Part of <a href="https://github.com/MahmoodKhalil57/suluk">Suluk</a> — one typed OpenAPI v4 contract projecting into every full-stack layer.</em>
</p>

---

> **CANDIDATE tooling — not official OpenAPI.** Suluk is a single-contributor candidate for
> OpenAPI Specification v4.0 ("Moonwalk"), unaffiliated with the OpenAPI Initiative and unable
> to ratify anything on the SIG's behalf.

## Install

```sh
bun add @suluk/builder
```

## The Suluk cycle

`@suluk/builder` is one station on the Suluk walk — author one v4 source, then **validate · audit ·
preview · generate · deploy** the whole stack from it. Explore the full toolchain in the
[main repository](https://github.com/MahmoodKhalil57/suluk) or drive it from the [VS Code cockpit](https://marketplace.visualstudio.com/items?itemName=MahmoodKhalil.suluk-vscode).

## License

Apache-2.0
