# Suluk — brand assets

One mark, used everywhere. The Suluk **"S" is drawn as a single continuous path** (the *walk* —
سلوك, wayfaring) with a mint **waypoint** node marking the start of the route.

## Palette

| Token | Hex | Use |
|---|---|---|
| Night (tile top) | `#1b1e3a` | icon tile gradient start |
| Night (tile base) | `#0c0e1f` | icon tile gradient end · `galleryBanner` color |
| Indigo light | `#a5b4fc` | stroke gradient start (on dark) |
| Indigo | `#6366f1` | stroke gradient mid |
| Indigo deep | `#4f46e5` | stroke gradient end · mono default |
| Mint waypoint | `#5eead4` | the single accent dot |

On light backgrounds the mark uses a deeper stroke (`#818cf8 → #4f46e5`) so it holds contrast.

## Masters (edit these)

| File | What |
|---|---|
| `suluk-icon.svg` | App-icon tile (rounded square, dark) — the primary mark |
| `suluk-mark.svg` | Transparent glyph (reads on light or dark) |
| `suluk-mark-mono.svg` | Single-colour glyph (`currentColor`) |
| `suluk-activitybar.svg` | 24px monochrome glyph for the VS Code activity bar |
| `suluk-wordmark.svg` | Horizontal lockup: tile + "suluk" (monoline lowercase) |

## Exports (generated — do not hand-edit)

`export/` holds the rendered set: `icon-{16,32,48,64,128,180,256,512,1024}.png`,
`mark-{128,256,512}.png`, `wordmark.png` + `@2x`, `social-card.png` (1200×630, OG / GitHub
social preview), `favicon.ico` (16/32/48), `favicon.svg`, `apple-touch-icon.png`.

Rebuild after editing any master:

```bash
cd branding/.render && bun build.ts
```

The one-time wiring scripts that fanned the brand into the repo also live in `.render/`:
`wire.ts` (per-package READMEs + metadata), `patch-publish.ts` (`publishConfig.access`), and
`inject-head.ts` (favicon + og tags into the committed `docs/` site, head-only).

## Where each asset goes

- **VS Code Marketplace** — `icon.png` (128px) wired via `package.json` `icon` field in
  `tooling/ts/packages/vscode`. Re-copy after a rebuild: `cp branding/export/icon-128.png
  tooling/ts/packages/vscode/icon.png`. Republish to refresh the listing.
- **VS Code activity bar** — `media/suluk-activitybar.svg` in the extension (`viewsContainers`).
- **Web / favicon** — `favicon.svg` (modern) + `favicon.ico` (legacy) + `apple-touch-icon.png`.
- **npm READMEs** — `wordmark.png` / `mark-256.png` (absolute raw-GitHub URLs).
- **crates.io / docs.rs** — `suluk-core` README (`wordmark.png`) + `html_logo_url` (`mark-256.png`).
- **Social cards** — `social-card.png` (1200×630) drives `og:image` / `twitter:image` on the docs,
  admin, petshop, scalar, and swagger pages. Also upload it manually at **GitHub repo Settings →
  Social preview** for the repository link card.
