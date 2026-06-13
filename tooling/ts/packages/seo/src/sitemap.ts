/** sitemap.xml + sitemap-index generation — with image entries and hreflang alternates (the SEO-complete form). */
import { escXml, isoDate } from "./util";

export type ChangeFreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
export interface SitemapImage { loc: string; title?: string; caption?: string }
export interface SitemapAlternate { hreflang: string; href: string }
export interface SitemapUrl {
  loc: string;
  lastmod?: string | number | Date;
  changefreq?: ChangeFreq;
  priority?: number;
  images?: SitemapImage[];
  alternates?: SitemapAlternate[];
}

export function sitemapXml(urls: SitemapUrl[]): string {
  const hasImg = urls.some((u) => u.images?.length);
  const hasAlt = urls.some((u) => u.alternates?.length);
  const ns = ['xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'];
  if (hasImg) ns.push('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
  if (hasAlt) ns.push('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  const body = urls.map((u) => {
    const p: string[] = [`<loc>${escXml(u.loc)}</loc>`];
    const lm = isoDate(u.lastmod); if (lm) p.push(`<lastmod>${lm}</lastmod>`);
    if (u.changefreq) p.push(`<changefreq>${u.changefreq}</changefreq>`);
    if (u.priority != null) p.push(`<priority>${Math.max(0, Math.min(1, u.priority)).toFixed(1)}</priority>`);
    for (const a of u.alternates ?? []) p.push(`<xhtml:link rel="alternate" hreflang="${escXml(a.hreflang)}" href="${escXml(a.href)}"/>`);
    for (const im of u.images ?? []) p.push(`<image:image><image:loc>${escXml(im.loc)}</image:loc>${im.title ? `<image:title>${escXml(im.title)}</image:title>` : ""}${im.caption ? `<image:caption>${escXml(im.caption)}</image:caption>` : ""}</image:image>`);
    return `  <url>${p.join("")}</url>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${ns.join(" ")}>\n${body}\n</urlset>\n`;
}

export function sitemapIndex(sitemaps: { loc: string; lastmod?: string | number | Date }[]): string {
  const body = sitemaps.map((s) => {
    const lm = isoDate(s.lastmod);
    return `  <sitemap><loc>${escXml(s.loc)}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ""}</sitemap>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}
