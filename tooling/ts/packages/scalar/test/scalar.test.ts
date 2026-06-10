import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "@suluk/core";
import { validate31 } from "@suluk/openapi-compat";
import { scalarHtml, scalarResponse } from "../src/index";

const petstore = parseDocument(
  readFileSync(join(import.meta.dir, "..", "..", "core", "test", "conformance", "valid", "01-petstore.yaml"), "utf8"),
);

/** Extract the first balanced `{...}` object literal after a marker, undoing the <-escaping. */
function extractObjAfter(html: string, marker: string): any {
  const start = html.indexOf("{", html.indexOf(marker));
  let depth = 0, inStr = false, esc = false, i = start;
  for (; i < html.length; i++) {
    const c = html[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; }
    else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) { i++; break; }
  }
  return JSON.parse(html.slice(start, i).replace(/\\u003c/g, "<"));
}

describe("@suluk/scalar renders a v4 doc", () => {
  const { html } = scalarHtml(petstore);

  test("produces a self-contained page that loads Scalar from the CDN", () => {
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("@scalar/api-reference");
    expect(html).toContain("Scalar.createApiReference('#app'");
  });

  test("uses the document title and embeds the spec as inline content", () => {
    expect(html).toContain("Petstore");
    expect(html).toContain('"openapi":"3.1.0"');
    expect(html).toContain('"content":');
  });

  test("the embedded spec is valid OpenAPI 3.1 (so Scalar will render it)", () => {
    const spec = extractObjAfter(html, "createApiReference").content;
    expect(validate31(spec).valid).toBe(true);
  });

  test("neutralizes </script> breakout in embedded content", () => {
    const evil = parseDocument(`
openapi: 4.0.0-candidate
info: { title: "x</script><script>alert(1)</script>", version: "1" }
paths: {}
`);
    expect(scalarHtml(evil).html).not.toContain("</script><script>alert(1)");
  });

  test("scalarResponse returns text/html", () => {
    const r = scalarResponse(petstore);
    expect(r.headers.get("content-type")).toContain("text/html");
  });
});
