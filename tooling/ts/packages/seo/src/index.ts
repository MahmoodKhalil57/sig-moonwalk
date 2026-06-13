/**
 * @suluk/seo — a complete, framework-agnostic SEO toolkit for a Suluk app, inspired by the Nuxt SEO suite but
 * pure + Cloudflare-safe (no runtime deps, no argless Date). It generates: robots.txt, sitemaps (with image +
 * hreflang entries, plus a sitemap index), schema.org JSON-LD (the ecommerce graph), head meta (OpenGraph /
 * Twitter / canonical / hreflang / robots), llms.txt, an OG-image SVG, the PWA web manifest, and deploy
 * skew-protection. One import → every SEO surface a real ecommerce template needs. CANDIDATE tooling.
 */
export { robotsTxt, type RobotsGroup, type RobotsOptions } from "./robots";
export {
  sitemapXml, sitemapIndex,
  type SitemapUrl, type SitemapImage, type SitemapAlternate, type ChangeFreq,
} from "./sitemap";
export {
  organization, website, breadcrumb, offer, aggregateRating, product, faqPage, article, itemList, graph, ld,
  type OfferInput, type ProductInput, type ArticleInput,
} from "./schema";
export {
  seoTags, renderTags, resolveTitle,
  type SeoTagsInput, type Tag, type Alternate, type RobotsMeta,
} from "./meta";
export { llmsTxt, type LlmsTxtInput, type LlmsSection, type LlmsLink } from "./llms";
export { ogImageSvg, type OgImageInput } from "./og";
export { webManifest, type WebManifestInput, type ManifestIcon, type ManifestShortcut } from "./manifest";
export { deploymentMeta, skewGuardScript, DEPLOYMENT_HEADER, type SkewGuardOptions } from "./skew";
