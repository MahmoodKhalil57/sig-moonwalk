/** robots.txt generation — user-agent groups with allow/disallow/crawl-delay, plus sitemap + host directives. */

export interface RobotsGroup {
  userAgent: string | string[];
  allow?: string[];
  disallow?: string[];
  crawlDelay?: number;
}
export interface RobotsOptions {
  /** Groups; defaults to a single `User-agent: *` / `Allow: /` group. */
  groups?: RobotsGroup[];
  /** Absolute sitemap URLs to advertise. */
  sitemaps?: string[];
  /** Optional `Host:` directive (canonical host). */
  host?: string;
}

const DEFAULT_GROUP: RobotsGroup = { userAgent: "*", allow: ["/"] };

export function robotsTxt(opts: RobotsOptions = {}): string {
  const groups = opts.groups?.length ? opts.groups : [DEFAULT_GROUP];
  const out: string[] = [];
  for (const g of groups) {
    for (const ua of Array.isArray(g.userAgent) ? g.userAgent : [g.userAgent]) out.push(`User-agent: ${ua}`);
    for (const a of g.allow ?? []) out.push(`Allow: ${a}`);
    for (const d of g.disallow ?? []) out.push(`Disallow: ${d}`);
    if (g.crawlDelay != null) out.push(`Crawl-delay: ${g.crawlDelay}`);
    out.push("");
  }
  if (opts.host) out.push(`Host: ${opts.host}`);
  for (const s of opts.sitemaps ?? []) out.push(`Sitemap: ${s}`);
  out.push("");
  return out.join("\n");
}
