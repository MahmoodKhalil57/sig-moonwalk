<p align="center">
  <a href="https://github.com/MahmoodKhalil57/suluk">
    <img src="https://raw.githubusercontent.com/MahmoodKhalil57/suluk/main/branding/export/wordmark.png" alt="Suluk" width="360" />
  </a>
</p>

<h1 align="center">suluk-core</h1>

<p align="center"><b>Performance core for the OpenAPI v4.0 "Suluk" candidate: parse, signature, and reverse-parse uriTemplate matching.</b></p>

<p align="center">
  <em>Part of <a href="https://github.com/MahmoodKhalil57/suluk">Suluk</a> — one typed OpenAPI v4 contract projecting into every full-stack layer.</em>
</p>

---

> **CANDIDATE tooling — not official OpenAPI.** Suluk is a single-contributor candidate for
> OpenAPI Specification v4.0 ("Moonwalk"), unaffiliated with the OpenAPI Initiative and unable
> to ratify anything on the SIG's behalf.

A Rust counterpart to [`@suluk/core`](https://github.com/MahmoodKhalil57/suluk)'s portable
algorithms: parse a v4 document, compute canonical request **signatures**, reverse-parse
**uriTemplates**, and match concrete requests to operations (the ADA). A second, independent
implementation is part of what makes the spec's algorithms a *standard* rather than a single
codebase.

## Install

```sh
cargo add suluk-core
```

## The Suluk cycle

`suluk-core` is the native station on the Suluk walk — author one v4 source, then **validate ·
audit · preview · generate · deploy** the whole stack from it. Explore the full toolchain in the
[main repository](https://github.com/MahmoodKhalil57/suluk).

## License

Apache-2.0
