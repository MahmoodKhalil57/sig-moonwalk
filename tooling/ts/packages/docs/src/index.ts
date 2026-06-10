/**
 * @suluk/docs — generate an intuitive static documentation site for a Bun/TS monorepo, straight from source
 * (package.json + the leading doc-comments + exports + ARCHITECTURE/README). The output is plain HTML + one
 * stylesheet, deployable to GitHub Pages with zero build. Suluk documents itself with it. CANDIDATE tooling.
 */
export { harvest, harvestPackage, firstBlockComment, parseExports, type FrameworkDoc, type PackageDoc, type ModuleDoc, type HarvestOptions } from "./harvest";
export { generateSite, type SiteOptions } from "./site";
export { renderIndex, renderPackage, renderMarkdownPage, STYLE, type SiteFile } from "./render";
export { mdToHtml, inline, escapeHtml } from "./md";
export { packageGraphD2, krokiD2Url } from "./diagram";
