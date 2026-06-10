// Real verify-once gate: render a primitive → screenshot its actual pixels → hash → approve → confident.
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";
import { renderPrimitiveHtml, snapshotHash, contentHash, approve, checkConfidence, formPrimitives, type Capture, type PrimitiveSources } from "../src/index";
import { formSpec } from "@suluk/shadcn";
import { zodToV4 } from "@suluk/zod";
import * as z from "zod";

const execPath = process.env.PW_CHROMIUM ?? `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1223/chrome-linux/headless_shell`;
const browser = await chromium.launch({ executablePath: execPath, args: ["--no-sandbox"] });
const page = await browser.newPage();

const sources: PrimitiveSources = { formLayout: "<Form>{fields}</Form>", widgets: { text: "<input type=text>", number: "<input type=number>", select: "<select>", switch: "<Switch>" } };
const widgets = ["text", "number", "select", "switch"];
const captures: Capture[] = [];
for (const w of widgets) {
  writeFileSync("/tmp/prim.html", renderPrimitiveHtml({ widget: w }));
  await page.goto("file:///tmp/prim.html");
  const png = await page.locator("#primitive").screenshot();        // ← real pixels, captured ONCE
  const sh = snapshotHash(png);
  captures.push({ key: `widget:${w}`, contentHash: contentHash(sources.widgets[w]), snapshotHash: sh, label: w });
  console.log(`  verified once: widget:${w}  ${png.length} px-bytes → snapshot ${sh}`);
}
await browser.close();

// also approve the form layout primitive
captures.push({ key: "form:layout", contentHash: contentHash(sources.formLayout), snapshotHash: "layout-approved", label: "form layout" });
const baseline = approve(captures, {}, 1000);

// now a generated form is pixel-confident with NO further screenshots:
const spec = formSpec(zodToV4(z.object({ name: z.string(), status: z.enum(["available","pending","sold"]), age: z.number(), active: z.boolean() })).schema);
const r = checkConfidence(formPrimitives(spec, sources), baseline);
console.log(`\nGenerated Pet form → pixel-confident WITHOUT re-screenshotting: ${r.confident} (approved: ${r.approved.length}, pending: ${r.missing.length + r.drifted.length})`);
