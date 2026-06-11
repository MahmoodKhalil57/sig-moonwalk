import { test, expect, describe } from "bun:test";
import {
  consoleProvider, resendProvider, pickProvider,
  renderEmailHtml, type EmailBrand,
  verifyEmail, deleteAccountEmail, orderConfirmationEmail, orderStatusEmail,
} from "../src/index";

const brand: EmailBrand = { brandName: "Acme", baseUrl: "https://acme.test" };
const ctx = { brand };

describe("providers — the swappable EmailProvider binding", () => {
  test("consoleProvider logs a summary, never sends, reports zero cost", async () => {
    const lines: string[] = [];
    const p = consoleProvider({ log: (l) => lines.push(l) });
    const r = await p.send({ to: "a@b.co", subject: "Hi", html: "<p>x</p>" });
    expect(p.id).toBe("console");
    expect(r).toMatchObject({ ok: true, costMicroUsd: 0 });
    expect(lines[0]).toContain("a@b.co");
  });

  test("resendProvider POSTs to the Resend REST API with Bearer + the message (Workers-safe, no SDK)", async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(JSON.stringify({ id: "re_123" }), { status: 200 });
    }) as unknown as typeof fetch;
    const p = resendProvider({ apiKey: "key_X", from: "Acme <no@acme.test>", fetch: fakeFetch, costMicroUsd: 100 });
    const r = await p.send({ to: "a@b.co", subject: "Hi", html: "<p>x</p>" });
    expect(r).toMatchObject({ ok: true, id: "re_123", costMicroUsd: 100 });
    expect(captured!.url).toBe("https://api.resend.com/emails");
    expect((captured!.init.headers as Record<string, string>).authorization).toBe("Bearer key_X");
    const body = JSON.parse(captured!.init.body as string);
    expect(body).toMatchObject({ from: "Acme <no@acme.test>", to: ["a@b.co"], subject: "Hi" });
  });

  test("resendProvider returns ok:false on a non-2xx and never throws on a transport error", async () => {
    const bad = (async () => new Response("nope", { status: 422 })) as unknown as typeof fetch;
    expect((await resendProvider({ apiKey: "k", from: "f", fetch: bad }).send({ to: "x", subject: "s", html: "h" })).ok).toBe(false);
    const thrower = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    const r = await resendProvider({ apiKey: "k", from: "f", fetch: thrower }).send({ to: "x", subject: "s", html: "h" });
    expect(r).toMatchObject({ ok: false });
    expect(r.error).toContain("offline");
  });

  test("pickProvider mirrors saastarter's isLocal switch", () => {
    expect(pickProvider({ dev: true }).id).toBe("console");
    expect(pickProvider({ dev: false, apiKey: "k", from: "f" }).id).toBe("resend");
    expect(pickProvider({ dev: false }).id).toBe("console"); // missing key ⇒ safe dev fallback
  });
});

describe("renderEmailHtml — branded, parameterized, localized", () => {
  test("renders the brand wordmark, heading, CTA, and a valid html doc", () => {
    const html = renderEmailHtml({ icon: "✉", heading: "Verify", body: "<p>hi</p>", ctaLabel: "Go", ctaUrl: "https://acme.test/v?t=1" }, ctx);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Acme");
    expect(html).toContain("Verify");
    expect(html).toContain("https://acme.test/v?t=1");
  });

  test("the accent color is parameterized (not hardcoded terracotta)", () => {
    const html = renderEmailHtml({ icon: "✉", heading: "H", body: "x" }, { brand: { ...brand, accentFrom: "#0066ff" } });
    expect(html).toContain("#0066ff");
    expect(html).not.toContain("#d4722a"); // the saastarter default is overridden
  });

  test("RTL: <html dir> + <body dir> come from the locale", () => {
    const html = renderEmailHtml({ icon: "✉", heading: "H", body: "x" }, { brand, dir: "rtl", lang: "ar" });
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain('<body dir="rtl"');
  });

  test("footer strings use English defaults, overridable by an i18n catalog", () => {
    expect(renderEmailHtml({ icon: "✉", heading: "H", body: "x" }, ctx)).toContain("safely ignore");
    const localized = renderEmailHtml({ icon: "✉", heading: "H", body: "x" }, { brand, messages: { didNotRequest: "لم تطلب هذا؟" } });
    expect(localized).toContain("لم تطلب هذا؟");
  });
});

describe("template set — auth lifecycle + ecommerce", () => {
  test("verifyEmail: subject + CTA to the verify URL", () => {
    const m = verifyEmail({ verifyUrl: "https://acme.test/verify?t=abc", userName: "Sam" }, ctx);
    expect(m.subject).toBe("Verify your email");
    expect(m.html).toContain("https://acme.test/verify?t=abc");
    expect(m.html).toContain("Hi Sam");
  });

  test("deleteAccountEmail carries the permanence warning (saastarter parity)", () => {
    const m = deleteAccountEmail({ confirmUrl: "https://acme.test/del?t=1" }, ctx);
    expect(m.subject).toBe("Confirm account deletion");
    expect(m.html).toContain("#fef2f2");       // the red warning panel
    expect(m.html).toContain("permanent");
  });

  test("orderConfirmationEmail renders line items + a formatted total", () => {
    const m = orderConfirmationEmail({
      orderNumber: "1042",
      items: [{ name: "Widget", qty: 2, totalCents: 3998 }, { name: "Gadget", qty: 1, totalCents: 500 }],
      totalCents: 4498, currency: "USD", locale: "en-US",
    }, ctx);
    expect(m.subject).toBe("Order 1042 confirmed");
    expect(m.html).toContain("Widget");
    expect(m.html).toContain("$44.98"); // total formatted via Intl
  });

  test("localization: an Arabic catalog overrides the subject", () => {
    const m = orderStatusEmail({ orderNumber: "1042", status: "shipped" },
      { brand, messages: { orderStatusSubject: "الطلب {number}: {status}" }, dir: "rtl", lang: "ar" });
    expect(m.subject).toBe("الطلب 1042: shipped");
  });
});
