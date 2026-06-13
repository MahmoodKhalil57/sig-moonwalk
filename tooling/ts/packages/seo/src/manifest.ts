/** PWA web app manifest generation (W3C). Pure JSON-string builder with sane defaults. */

export interface ManifestIcon { src: string; sizes: string; type?: string; purpose?: string }
export interface ManifestShortcut { name: string; url: string; description?: string; icons?: ManifestIcon[] }
export interface WebManifestInput {
  name: string;
  shortName?: string;
  description?: string;
  startUrl?: string;
  scope?: string;
  display?: "fullscreen" | "standalone" | "minimal-ui" | "browser";
  orientation?: string;
  themeColor?: string;
  backgroundColor?: string;
  lang?: string;
  dir?: "ltr" | "rtl" | "auto";
  categories?: string[];
  icons?: ManifestIcon[];
  shortcuts?: ManifestShortcut[];
}

export function webManifest(i: WebManifestInput): string {
  const m: Record<string, unknown> = {
    name: i.name,
    short_name: i.shortName ?? i.name,
    ...(i.description ? { description: i.description } : {}),
    start_url: i.startUrl ?? "/",
    scope: i.scope ?? "/",
    display: i.display ?? "standalone",
    ...(i.orientation ? { orientation: i.orientation } : {}),
    theme_color: i.themeColor ?? "#ffffff",
    background_color: i.backgroundColor ?? "#ffffff",
    ...(i.lang ? { lang: i.lang } : {}),
    ...(i.dir ? { dir: i.dir } : {}),
    ...(i.categories?.length ? { categories: i.categories } : {}),
    icons: i.icons ?? [],
    ...(i.shortcuts?.length ? { shortcuts: i.shortcuts } : {}),
  };
  return JSON.stringify(m, null, 2);
}
