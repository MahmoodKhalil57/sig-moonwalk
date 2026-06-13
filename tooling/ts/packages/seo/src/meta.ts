/** Head meta generation — title (templated), description, canonical, robots, hreflang, OpenGraph + Twitter cards.
 *  Returns structured tag descriptors (so a framework can render them) + `renderTags` for plain SSR head HTML. */
import { escXml } from "./util";

export interface Alternate { hreflang: string; href: string }
export interface RobotsMeta { index?: boolean; follow?: boolean; noarchive?: boolean; maxSnippet?: number; maxImagePreview?: "none" | "standard" | "large" }
export interface SeoTagsInput {
  title?: string;
  /** A template containing `%s`, e.g. "%s — saasuluk". */
  titleTemplate?: string;
  description?: string;
  canonical?: string;
  url?: string;
  image?: string;
  imageAlt?: string;
  type?: string;
  siteName?: string;
  locale?: string;
  twitterCard?: "summary" | "summary_large_image";
  twitterSite?: string;
  twitterCreator?: string;
  robots?: string | RobotsMeta;
  noindex?: boolean;
  alternates?: Alternate[];
  themeColor?: string;
  keywords?: string[];
  publishedTime?: string;
  modifiedTime?: string;
}
export interface Tag { tag: "title" | "meta" | "link"; attrs: Record<string, string>; text?: string }

export function resolveTitle(title: string | undefined, template?: string): string {
  if (title && template && template.includes("%s")) return template.replace("%s", title);
  if (title) return title;
  return template ? template.replace(/\s*[%]s\s*[|·—-]?\s*/g, "").trim() : "";
}

function robotsContent(r: string | RobotsMeta | undefined, noindex?: boolean): string | undefined {
  if (noindex) return "noindex, nofollow";
  if (typeof r === "string") return r;
  if (!r) return undefined;
  const parts = [r.index === false ? "noindex" : "index", r.follow === false ? "nofollow" : "follow"];
  if (r.noarchive) parts.push("noarchive");
  if (r.maxSnippet != null) parts.push(`max-snippet:${r.maxSnippet}`);
  if (r.maxImagePreview) parts.push(`max-image-preview:${r.maxImagePreview}`);
  return parts.join(", ");
}

export function seoTags(i: SeoTagsInput): Tag[] {
  const tags: Tag[] = [];
  const title = resolveTitle(i.title, i.titleTemplate);
  const meta = (key: string, content: string | undefined, property = false) => {
    if (content != null && content !== "") tags.push({ tag: "meta", attrs: property ? { property: key, content } : { name: key, content } });
  };
  if (title) tags.push({ tag: "title", attrs: {}, text: title });
  meta("description", i.description);
  if (i.keywords?.length) meta("keywords", i.keywords.join(", "));
  const rc = robotsContent(i.robots, i.noindex); if (rc) meta("robots", rc);
  if (i.themeColor) meta("theme-color", i.themeColor);
  if (i.canonical) tags.push({ tag: "link", attrs: { rel: "canonical", href: i.canonical } });
  for (const a of i.alternates ?? []) tags.push({ tag: "link", attrs: { rel: "alternate", hreflang: a.hreflang, href: a.href } });

  // OpenGraph
  meta("og:title", title || undefined, true);
  meta("og:description", i.description, true);
  meta("og:type", i.type ?? "website", true);
  meta("og:url", i.url ?? i.canonical, true);
  meta("og:site_name", i.siteName, true);
  meta("og:locale", i.locale, true);
  if (i.image) { meta("og:image", i.image, true); meta("og:image:alt", i.imageAlt, true); }
  meta("article:published_time", i.publishedTime, true);
  meta("article:modified_time", i.modifiedTime, true);

  // Twitter
  meta("twitter:card", i.twitterCard ?? (i.image ? "summary_large_image" : "summary"));
  meta("twitter:site", i.twitterSite);
  meta("twitter:creator", i.twitterCreator);
  meta("twitter:title", title || undefined);
  meta("twitter:description", i.description);
  if (i.image) meta("twitter:image", i.image);
  return tags;
}

/** Render tag descriptors to an HTML string (for an SSR <head>). */
export function renderTags(tags: Tag[]): string {
  return tags.map((t) => {
    if (t.tag === "title") return `<title>${escXml(t.text ?? "")}</title>`;
    const attrs = Object.entries(t.attrs).map(([k, v]) => `${k}="${escXml(v)}"`).join(" ");
    return `<${t.tag} ${attrs}>`;
  }).join("\n");
}
