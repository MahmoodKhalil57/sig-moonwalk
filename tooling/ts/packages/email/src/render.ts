/**
 * renderEmailHtml — the pure branded-email generator (saastarter-parity Phase 1), the email analogue of
 * @suluk/shadcn's render-form. Ported from saastarter `brandedEmailHtml` (src/lib/email/template.ts) with two
 * changes that make it reusable: the BRANDING (colors/logo/name/baseUrl, hardcoded there) is a parameter, and the
 * STRINGS are injected via an @suluk/i18n catalog instead of a module-scoped `getMessages` — so one render call
 * serves any brand in any locale (incl. RTL: the `<html dir>` is set from the locale, PARITY §RTL "dir set server-side").
 */
import { t, type Catalog } from "@suluk/i18n";

/** The brand surface an email needs — defaults reproduce saastarter's terracotta look. */
export interface EmailBrand {
  brandName: string;
  baseUrl: string;
  /** banner gradient start + CTA fill (default "#d4722a"). */
  accentFrom?: string;
  /** banner gradient end (default "#e8944d"). */
  accentTo?: string;
  /** page background (default "#f5f3f0"). */
  pageBg?: string;
  /** card background (default "#ffffff"). */
  cardBg?: string;
  /** an <img> logo URL; when omitted the brandName renders as a serif wordmark (saastarter behavior). */
  logoUrl?: string;
}

export interface BrandedEmailOptions {
  /** header-banner icon (emoji or HTML entity). */
  icon: string;
  heading: string;
  subheading?: string;
  /** the inner body HTML (placed inside the card). */
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** preview text (shown in the client's preview line, hidden in the body). */
  preheader?: string;
}

export interface RenderContext {
  brand: EmailBrand;
  /** the email-namespace catalog for the active locale (@suluk/i18n); merged over English defaults. */
  messages?: Catalog;
  /** writing direction for <html dir> (default "ltr"). */
  dir?: "ltr" | "rtl";
  /** BCP-47 lang for <html lang> (default "en"). */
  lang?: string;
  /** footer copyright year (default: current year). */
  year?: number;
}

/** English fallbacks for the chrome strings, so a render works before any catalog is authored. */
export const DEFAULT_EMAIL_STRINGS: Catalog = {
  didNotRequest: "If you didn't request this, you can safely ignore this email.",
  allRightsReserved: "© {year} {brand}. All rights reserved.",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderEmailHtml(options: BrandedEmailOptions, ctx: RenderContext): string {
  const { brand } = ctx;
  const accentFrom = brand.accentFrom ?? "#d4722a";
  const accentTo = brand.accentTo ?? "#e8944d";
  const pageBg = brand.pageBg ?? "#f5f3f0";
  const cardBg = brand.cardBg ?? "#ffffff";
  const dir = ctx.dir ?? "ltr";
  const lang = ctx.lang ?? "en";
  const year = ctx.year ?? new Date().getFullYear();
  const msg: Catalog = { ...DEFAULT_EMAIL_STRINGS, ...(ctx.messages ?? {}) };

  const logo = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.brandName)}" height="28" style="display:inline-block;border:0;" />`
    : `<span style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.5px;">${esc(brand.brandName)}</span>`;

  const ctaHtml = options.ctaLabel && options.ctaUrl
    ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 28px;">
          <tr><td align="center">
            <a href="${esc(options.ctaUrl)}" style="display: inline-block; padding: 14px 32px; background: ${accentFrom}; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 12px; letter-spacing: 0.3px;">${esc(options.ctaLabel)}</a>
          </td></tr>
        </table>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 16px;">
          <tr><td align="center">
            <p style="margin: 0; font-size: 12px; color: #8a8a8a; line-height: 1.6; word-break: break-all;">${esc(options.ctaUrl)}</p>
          </td></tr>
        </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="${esc(lang)}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(options.heading)} - ${esc(brand.brandName)}</title>
</head>
<body dir="${dir}" style="margin: 0; padding: 0; background-color: ${pageBg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  ${options.preheader ? `<div style="display: none; max-height: 0; overflow: hidden;">${esc(options.preheader)}</div>` : ""}
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${pageBg};">
    <tr><td align="center" style="padding: 40px 16px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 560px;">
        <tr><td align="center" style="padding-bottom: 32px;">
          <a href="${esc(brand.baseUrl)}" style="text-decoration: none;">${logo}</a>
        </td></tr>
        <tr><td style="background: ${cardBg}; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="background: linear-gradient(135deg, ${accentFrom} 0%, ${accentTo} 100%); padding: 36px 32px; text-align: center;">
              <div style="width: 56px; height: 56px; margin: 0 auto 16px; background: rgba(255,255,255,0.2); border-radius: 50%; line-height: 56px; font-size: 24px;">${options.icon}</div>
              <h1 style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 700; color: #ffffff; line-height: 1.3;">${esc(options.heading)}</h1>
              ${options.subheading ? `<p style="margin: 8px 0 0; font-size: 15px; color: rgba(255,255,255,0.9);">${esc(options.subheading)}</p>` : ""}
            </td></tr>
          </table>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="padding: 32px;">
              ${options.body}
              ${ctaHtml}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding: 32px 16px; text-align: center;">
          <p style="margin: 0; font-size: 13px; color: #8a8a8a; line-height: 1.6;">${t(msg, "didNotRequest")}</p>
          <p style="margin: 16px 0 0; font-size: 12px; color: #b0b0b0;">${t(msg, "allRightsReserved", { year: String(year), brand: brand.brandName })}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
