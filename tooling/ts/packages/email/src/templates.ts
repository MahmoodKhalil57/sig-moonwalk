/**
 * The per-event branded template set (saastarter-parity Phase 1). Each builder composes {@link renderEmailHtml}
 * with the right icon/heading/body/CTA and returns a sendable {@link EmailMessage} — the auth lifecycle saastarter
 * ships (verify / reset / change-email / delete-account, options.ts + email/) plus the ecommerce + marketing events
 * the roadmap names (order-confirmation / order-status / newsletter). All strings flow through @suluk/i18n with
 * English defaults, so a template works out-of-the-box and localizes per-locale (incl. RTL) when a catalog is supplied.
 */
import { t, translator, type Catalog } from "@suluk/i18n";
import { renderEmailHtml, type EmailBrand } from "./render";
import type { RenderedEmail } from "./provider";

/** Shared context for every template — the brand + the active-locale catalog (merged over English defaults). */
export interface TemplateContext {
  brand: EmailBrand;
  /** the email-namespace catalog for the active locale (@suluk/i18n). */
  messages?: Catalog;
  dir?: "ltr" | "rtl";
  lang?: string;
  year?: number;
}

/** English defaults for every template string, so the set is usable before any catalog is authored. */
export const TEMPLATE_STRINGS: Catalog = {
  didNotRequest: "If you didn't request this, you can safely ignore this email.",
  allRightsReserved: "© {year} {brand}. All rights reserved.",
  // verify
  verifySubject: "Verify your email",
  verifyHeading: "Verify your email",
  verifySubheading: "One last step to activate your account.",
  verifyBody: "Confirm your email address to finish setting up your account.",
  verifyCta: "Verify Email",
  // reset password
  resetSubject: "Reset your password",
  resetHeading: "Reset your password",
  resetBody: "We received a request to reset your password. Click below to choose a new one.",
  resetCta: "Reset Password",
  // change email
  changeEmailSubject: "Confirm your new email",
  changeEmailHeading: "Confirm your new email",
  changeEmailBody: "Confirm {email} as the new address for your account.",
  changeEmailCta: "Confirm Email",
  // delete account
  deleteSubject: "Confirm account deletion",
  deleteHeading: "Confirm account deletion",
  deleteSubheading: "This action is permanent.",
  deleteBody: "You requested to permanently delete your account. This cannot be undone and all your data will be removed.",
  deleteCta: "Delete My Account",
  // order confirmation
  orderConfirmSubject: "Order {number} confirmed",
  orderConfirmHeading: "Order confirmed",
  orderConfirmSubheading: "Thanks for your order!",
  orderConfirmIntro: "We've received your order {number}. Here's what's on the way:",
  orderTotal: "Total",
  // order status
  orderStatusSubject: "Order {number}: {status}",
  orderStatusHeading: "Order {status}",
  orderStatusBody: "Your order {number} is now {status}.",
  orderTrackCta: "Track Order",
  // newsletter
  newsletterUnsubscribe: "Unsubscribe",
};

function ctxFor(ctx: TemplateContext) {
  const messages: Catalog = { ...TEMPLATE_STRINGS, ...(ctx.messages ?? {}) };
  return { tr: translator(messages), render: { brand: ctx.brand, messages, dir: ctx.dir, lang: ctx.lang, year: ctx.year } };
}

const para = (html: string) => `<p style="margin: 0; font-size: 15px; color: #4a4a4a; line-height: 1.7;">${html}</p>`;

/** Email-verification (Better Auth sendVerificationEmail). */
export function verifyEmail(params: { verifyUrl: string; userName?: string }, ctx: TemplateContext): RenderedEmail {
  const { tr, render } = ctxFor(ctx);
  return {
    subject: tr("verifySubject"),
    html: renderEmailHtml({
      icon: "&#9993;", heading: tr("verifyHeading"), subheading: tr("verifySubheading"),
      preheader: tr("verifyBody"),
      body: para(params.userName ? `Hi ${params.userName}, ${tr("verifyBody")}` : tr("verifyBody")),
      ctaLabel: tr("verifyCta"), ctaUrl: params.verifyUrl,
    }, render),
  };
}

/** Password reset. */
export function resetPasswordEmail(params: { resetUrl: string; userName?: string }, ctx: TemplateContext): RenderedEmail {
  const { tr, render } = ctxFor(ctx);
  return {
    subject: tr("resetSubject"),
    html: renderEmailHtml({
      icon: "&#128273;", heading: tr("resetHeading"), preheader: tr("resetBody"),
      body: para(tr("resetBody")), ctaLabel: tr("resetCta"), ctaUrl: params.resetUrl,
    }, render),
  };
}

/** Change-email confirmation. */
export function changeEmailEmail(params: { confirmUrl: string; newEmail: string }, ctx: TemplateContext): RenderedEmail {
  const { tr, render } = ctxFor(ctx);
  return {
    subject: tr("changeEmailSubject"),
    html: renderEmailHtml({
      icon: "&#9993;", heading: tr("changeEmailHeading"),
      preheader: t(render.messages, "changeEmailBody", { email: params.newEmail }),
      body: para(t(render.messages, "changeEmailBody", { email: `<strong>${params.newEmail}</strong>` })),
      ctaLabel: tr("changeEmailCta"), ctaUrl: params.confirmUrl,
    }, render),
  };
}

/** Account-deletion confirmation (saastarter options.ts:100-125). */
export function deleteAccountEmail(params: { confirmUrl: string; userName?: string }, ctx: TemplateContext): RenderedEmail {
  const { tr, render } = ctxFor(ctx);
  const warn = `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:16px;"><tr><td style="padding:12px 16px;background:#fef2f2;border-radius:8px;"><p style="margin:0;font-size:14px;color:#dc2626;line-height:1.6;">&#9888; ${tr("deleteBody")}</p></td></tr></table>`;
  return {
    subject: tr("deleteSubject"),
    html: renderEmailHtml({
      icon: "&#9888;", heading: tr("deleteHeading"), subheading: tr("deleteSubheading"),
      preheader: tr("deleteBody"),
      body: para(params.userName ? `Hi ${params.userName}, this action is permanent.` : "This action is permanent.") + warn,
      ctaLabel: tr("deleteCta"), ctaUrl: params.confirmUrl,
    }, render),
  };
}

export interface OrderLine { name: string; qty: number; totalCents: number }

/** Order confirmation — renders a line-item table + total (amounts formatted via Intl in the given locale). */
export function orderConfirmationEmail(
  params: { orderNumber: string; items: OrderLine[]; totalCents: number; currency: string; locale?: string; orderUrl?: string },
  ctx: TemplateContext,
): RenderedEmail {
  const { tr, render } = ctxFor(ctx);
  const money = (cents: number) =>
    new Intl.NumberFormat(params.locale ?? ctx.lang ?? "en", { style: "currency", currency: params.currency }).format(cents / 100);
  const rows = params.items.map((l) =>
    `<tr><td style="padding:8px 0;font-size:14px;color:#1a1a1a;">${l.name} <span style="color:#8a8a8a;">× ${l.qty}</span></td><td align="right" style="padding:8px 0;font-size:14px;color:#1a1a1a;">${money(l.totalCents)}</td></tr>`).join("");
  const table = `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:16px;border-top:1px solid #eee;">${rows}<tr><td style="padding:12px 0 0;font-size:15px;font-weight:700;color:#1a1a1a;border-top:1px solid #eee;">${tr("orderTotal")}</td><td align="right" style="padding:12px 0 0;font-size:15px;font-weight:700;color:#1a1a1a;border-top:1px solid #eee;">${money(params.totalCents)}</td></tr></table>`;
  return {
    subject: t(render.messages, "orderConfirmSubject", { number: params.orderNumber }),
    html: renderEmailHtml({
      icon: "&#128717;", heading: tr("orderConfirmHeading"), subheading: tr("orderConfirmSubheading"),
      preheader: t(render.messages, "orderConfirmSubject", { number: params.orderNumber }),
      body: para(t(render.messages, "orderConfirmIntro", { number: `<strong>${params.orderNumber}</strong>` })) + table,
      ...(params.orderUrl ? { ctaLabel: "View Order", ctaUrl: params.orderUrl } : {}),
    }, render),
  };
}

/** Order-status update. */
export function orderStatusEmail(
  params: { orderNumber: string; status: string; trackingUrl?: string },
  ctx: TemplateContext,
): RenderedEmail {
  const { tr, render } = ctxFor(ctx);
  return {
    subject: t(render.messages, "orderStatusSubject", { number: params.orderNumber, status: params.status }),
    html: renderEmailHtml({
      icon: "&#128230;", heading: t(render.messages, "orderStatusHeading", { status: params.status }),
      preheader: t(render.messages, "orderStatusBody", { number: params.orderNumber, status: params.status }),
      body: para(t(render.messages, "orderStatusBody", { number: `<strong>${params.orderNumber}</strong>`, status: params.status })),
      ...(params.trackingUrl ? { ctaLabel: tr("orderTrackCta"), ctaUrl: params.trackingUrl } : {}),
    }, render),
  };
}

/** Newsletter — a branded wrapper around app-supplied marketing HTML, with an unsubscribe footer link. */
export function newsletterEmail(
  params: { subject: string; heading: string; bodyHtml: string; unsubscribeUrl?: string },
  ctx: TemplateContext,
): RenderedEmail {
  const { tr, render } = ctxFor(ctx);
  const unsub = params.unsubscribeUrl
    ? `<p style="margin:24px 0 0;font-size:12px;color:#b0b0b0;text-align:center;"><a href="${params.unsubscribeUrl}" style="color:#b0b0b0;">${tr("newsletterUnsubscribe")}</a></p>`
    : "";
  return {
    subject: params.subject,
    html: renderEmailHtml({ icon: "&#128226;", heading: params.heading, body: params.bodyHtml + unsub }, render),
  };
}
