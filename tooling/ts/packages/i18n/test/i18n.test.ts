import { test, expect, describe } from "bun:test";
import {
  defineLocales, localeCodes, isSupportedLocale, dirOf, resolveLocale,
  readCookie, localeFromCookie, negotiateLocale, localeFromRequest,
  t, translator, loadMessages, gradeCompleteness, type LocaleCode,
  formatNumber, formatCurrency, formatDate,
} from "../src/index";
import { i18nMiddleware, type I18nAstroContext } from "../src/astro";

const LOCALES = defineLocales({
  locales: [
    { code: "en", label: "English" },
    { code: "ar", label: "العربية", dir: "rtl", numberingSystem: "arab" },
    { code: "es", label: "Español" },
  ],
  default: "en",
});
// compile-time: the union is derived from the config
type App = LocaleCode<typeof LOCALES>;
const _typecheck: App = "ar"; void _typecheck;

describe("locale + direction model", () => {
  test("localeCodes + isSupportedLocale", () => {
    expect(localeCodes(LOCALES)).toEqual(["en", "ar", "es"]);
    expect(isSupportedLocale(LOCALES, "ar")).toBe(true);
    expect(isSupportedLocale(LOCALES, "de")).toBe(false);
    expect(isSupportedLocale(LOCALES, null)).toBe(false);
  });

  test("dirOf — ar is rtl, others default to ltr", () => {
    expect(dirOf(LOCALES, "ar")).toBe("rtl");
    expect(dirOf(LOCALES, "en")).toBe("ltr");
    expect(dirOf(LOCALES, "unknown")).toBe("ltr");
  });

  test("resolveLocale falls back to the default for an unsupported candidate", () => {
    expect(resolveLocale(LOCALES, "es")).toBe("es");
    expect(resolveLocale(LOCALES, "de")).toBe("en");
    expect(resolveLocale(LOCALES, undefined)).toBe("en");
  });
});

describe("Workers-safe cookie + request resolution (no next/headers)", () => {
  test("readCookie parses a value out of a Cookie header", () => {
    expect(readCookie("theme=dark; locale=ar; x=1", "locale")).toBe("ar");
    expect(readCookie("locale=es", "locale")).toBe("es");
    expect(readCookie("", "locale")).toBeUndefined();
    expect(readCookie(null, "locale")).toBeUndefined();
  });

  test("localeFromCookie resolves + falls back", () => {
    expect(localeFromCookie(LOCALES, "locale=ar")).toBe("ar");
    expect(localeFromCookie(LOCALES, "locale=de")).toBe("en"); // unsupported → default
    expect(localeFromCookie(LOCALES, "nope=1")).toBe("en");
  });

  test("negotiateLocale picks the best Accept-Language match (q-weighted, primary-subtag)", () => {
    expect(negotiateLocale(LOCALES, "ar-EG,ar;q=0.9,en;q=0.5")).toBe("ar"); // primary-subtag match
    expect(negotiateLocale(LOCALES, "fr;q=1.0,es;q=0.8")).toBe("es");       // skips unsupported fr
    expect(negotiateLocale(LOCALES, "de")).toBe("en");                       // none → default
    expect(negotiateLocale(LOCALES, null)).toBe("en");
  });

  test("localeFromRequest: cookie wins, else negotiate", () => {
    const cookied = new Request("https://x", { headers: { cookie: "locale=es", "accept-language": "ar" } });
    expect(localeFromRequest(LOCALES, cookied)).toBe("es"); // cookie beats Accept-Language
    const negotiated = new Request("https://x", { headers: { "accept-language": "ar,en;q=0.5" } });
    expect(localeFromRequest(LOCALES, negotiated)).toBe("ar");
  });
});

describe("messages: interpolation, loader fallback, completeness", () => {
  const en = { greeting: "Hello {name}", bye: "Bye" };

  test("t interpolates {tokens}; unknown key returns the key", () => {
    expect(t(en, "greeting", { name: "Sam" })).toBe("Hello Sam");
    expect(t(en, "bye")).toBe("Bye");
    expect(t(en, "missing")).toBe("missing");
  });

  test("translator binds a catalog", () => {
    const tt = translator(en);
    expect(tt("greeting", { name: "Lina" })).toBe("Hello Lina");
  });

  test("loadMessages loads the locale, else falls back to the default locale's chunk", async () => {
    const loaders = {
      en: async () => ({ default: en }),
      ar: async () => ({ default: { greeting: "مرحبا {name}", bye: "وداعا" } }),
    };
    expect((await loadMessages(loaders, "ar", "en")).greeting).toBe("مرحبا {name}");
    expect((await loadMessages(loaders, "es", "en")).bye).toBe("Bye"); // es missing → en fallback
    await expect(loadMessages({}, "en", "en")).rejects.toThrow();      // no loader at all → config bug
  });

  test("gradeCompleteness reports missing/extra + a 0-1 grade", () => {
    const g = gradeCompleteness(en, { greeting: "Hola {name}", stale: "x" }, "es");
    expect(g.total).toBe(2);
    expect(g.translated).toBe(1);
    expect(g.missing).toEqual(["bye"]);
    expect(g.extra).toEqual(["stale"]);
    expect(g.grade).toBe(0.5);
    // an empty value counts as missing, not translated
    expect(gradeCompleteness(en, { greeting: "", bye: "Adiós" }, "es").missing).toEqual(["greeting"]);
  });
});

describe("Intl formatting — locale numbering systems (Eastern-Arabic numerals)", () => {
  test("formatNumber honors the locale's numberingSystem", () => {
    expect(formatNumber(LOCALES, "en", 123)).toBe("123");
    expect(formatNumber(LOCALES, "ar", 123)).toBe("١٢٣"); // arab numbering → ٠١٢٣
  });

  test("formatCurrency renders money in the locale's conventions", () => {
    expect(formatCurrency(LOCALES, "en", 19.99, "USD")).toContain("19.99");
    // ar uses arab numerals for the amount
    expect(formatCurrency(LOCALES, "ar", 5, "USD")).toMatch(/[٠-٩]/);
  });

  test("formatDate honors the numbering system", () => {
    const d = new Date(Date.UTC(2026, 0, 15));
    expect(formatDate(LOCALES, "en", d, { year: "numeric", timeZone: "UTC" })).toBe("2026");
    expect(formatDate(LOCALES, "ar", d, { year: "numeric", timeZone: "UTC" })).toMatch(/[٠-٩]/);
  });
});

describe("astro middleware glue", () => {
  test("stamps locale + dir onto context.locals and calls next", async () => {
    const onRequest = i18nMiddleware(LOCALES);
    const ctx: I18nAstroContext = {
      request: new Request("https://x", { headers: { cookie: "locale=ar" } }),
      locals: {},
    };
    const res = new Response("ok");
    const out = await onRequest(ctx, async () => res);
    expect(ctx.locals.locale).toBe("ar");
    expect(ctx.locals.dir).toBe("rtl");
    expect(out).toBe(res);
  });
});
