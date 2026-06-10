import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateSource, auditSource, previewHtml, looksLikeV4 } from "../src/logic";
import { parseDocument } from "@suluk/core";

const petstoreSrc = readFileSync(
  join(import.meta.dir, "..", "..", "core", "test", "conformance", "valid", "01-petstore.yaml"),
  "utf8",
);

describe("validateSource — the editor's diagnostics source", () => {
  test("a valid v4 document yields no error diagnostics", () => {
    const r = validateSource(petstoreSrc);
    expect(r.ok).toBe(true);
    expect(r.diagnostics).toEqual([]);
  });
  test("a malformed v4 document yields error diagnostics", () => {
    const bad = `openapi: 4.0.0-candidate\ninfo: { title: t, version: "1" }\npaths:\n  "pet":\n    requests:\n      x: { responses: { ok: { status: 200 } } }\n`; // request missing `method`
    const r = validateSource(bad);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.length).toBeGreaterThan(0);
  });
  test("a YAML parse error becomes a single error diagnostic", () => {
    const r = validateSource("openapi: 4.0\n  bad: : :\n:");
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0].severity).toBe("error");
  });
  test("a non-v4 document is recognized and skipped (info, not error)", () => {
    const r = validateSource(`openapi: 3.1.0\ninfo: { title: t, version: "1" }\npaths: {}`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0].severity).toBe("info");
  });
});

describe("looksLikeV4", () => {
  test("accepts a 4.x document, rejects 3.x and junk", () => {
    expect(looksLikeV4(parseDocument(petstoreSrc))).toBe(true);
    expect(looksLikeV4({ openapi: "3.1.0" })).toBe(false);
    expect(looksLikeV4({})).toBe(false);
    expect(looksLikeV4(null)).toBe(false);
  });
});

describe("auditSource — documentation coverage in the editor", () => {
  test("returns findings as warning/info diagnostics for an under-documented doc", () => {
    const sparse = `openapi: 4.0.0-candidate\ninfo: { title: t, version: "1" }\npaths:\n  "x":\n    requests:\n      doThing: { method: get, responses: { ok: { status: 200 } } }\n`;
    const { findings, diagnostics } = auditSource(sparse);
    expect(findings.length).toBeGreaterThan(0);
    expect(diagnostics.some((d) => d.severity === "warning")).toBe(true); // missing-doc
  });
});

describe("previewHtml — the webview content", () => {
  test("scalar preview embeds the spec + loads Scalar", () => {
    const { html } = previewHtml(petstoreSrc, "scalar");
    expect(html).toContain("Scalar.createApiReference");
    expect(html).toContain('"openapi":"3.1.0"');
  });
  test("swagger preview embeds the spec + loads Swagger UI", () => {
    const { html } = previewHtml(petstoreSrc, "swagger");
    expect(html).toContain("SwaggerUIBundle");
    expect(html).toContain("swagger-ui-dist");
  });
  test("previewing a non-v4 doc throws a clear error", () => {
    expect(() => previewHtml(`openapi: 3.1.0\ninfo: { title: t, version: "1" }\npaths: {}`, "scalar")).toThrow();
  });
});
