import { test, expect, describe } from "bun:test";
import { renderShadcnTheme, renderGlobalsCss, renderComponentsJson } from "../src/index";
import { terracotta, themeFromLight } from "@suluk/theme";

describe("@suluk/shadcn ← @suluk/theme — TokenSpec → shadcn project files", () => {
  test("renderGlobalsCss emits the tailwind import, token vars (light+dark), and the @theme block", () => {
    const css = renderGlobalsCss(terracotta);
    expect(css).toStartWith('@import "tailwindcss";');
    expect(css).toContain("@custom-variant dark (&:is(.dark *));");
    expect(css).toContain(":root {");
    expect(css).toContain(".dark {");                                   // dark scheme (derived from light)
    expect(css).toContain("--primary: oklch(0.6397 0.172 36.44);");     // the terracotta token
    expect(css).toContain("@theme inline {");
    expect(css).toContain("--color-primary: var(--primary);");
    expect(css).toContain("border-color: var(--border);");             // base layer applies the tokens
  });

  test("a full ThemeSpec is accepted as-is (no re-derivation)", () => {
    const css = renderGlobalsCss(themeFromLight(terracotta), { darkSelector: "[data-theme='dark']" });
    expect(css).toContain("[data-theme='dark'] {");
    expect(css).toContain("@custom-variant dark (&:is([data-theme='dark'] *));");
  });

  test("renderComponentsJson is valid shadcn config with cssVariables on", () => {
    const json = JSON.parse(renderComponentsJson({ baseColor: "stone", style: "default" }));
    expect(json.style).toBe("default");
    expect(json.tailwind.baseColor).toBe("stone");
    expect(json.tailwind.cssVariables).toBe(true);
    expect(json.aliases.ui).toBe("@/components/ui");
  });

  test("renderShadcnTheme returns both files keyed by their paths", () => {
    const files = renderShadcnTheme(terracotta, { cssPath: "app/globals.css" });
    expect(Object.keys(files).sort()).toEqual(["app/globals.css", "components.json"]);
    expect(files["app/globals.css"]).toContain("@import");
    expect(JSON.parse(files["components.json"]).tailwind.css).toBe("app/globals.css");
  });
});
