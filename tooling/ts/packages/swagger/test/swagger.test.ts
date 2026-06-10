import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "@suluk/core";
import { validate31 } from "@suluk/openapi-compat";
import { swaggerHtml, swaggerResponse } from "../src/index";

const petstore = parseDocument(
  readFileSync(join(import.meta.dir, "..", "..", "core", "test", "conformance", "valid", "01-petstore.yaml"), "utf8"),
);

describe("@suluk/swagger renders a v4 doc", () => {
  const { html } = swaggerHtml(petstore);

  test("produces a self-contained page that loads swagger-ui-dist from the CDN", () => {
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("swagger-ui-dist");
    expect(html).toContain("swagger-ui.css");
    expect(html).toContain("SwaggerUIBundle(");
  });

  test("embeds the downgraded spec inline (not a URL)", () => {
    expect(html).toContain('"spec":');
    expect(html).toContain('"openapi":"3.1.0"');
  });

  test("the embedded spec is valid OpenAPI 3.1", () => {
    const start = html.indexOf("Object.assign(") + "Object.assign(".length;
    const json = html.slice(start);
    const spec = JSON.parse(json.slice(0, json.indexOf(", {")).trim()).spec;
    expect(validate31(spec).valid).toBe(true);
  });

  test("honors a pinned version", () => {
    expect(swaggerHtml(petstore, { version: "5.11.0" }).html).toContain("swagger-ui-dist@5.11.0");
  });

  test("neutralizes </script> breakout in the embedded spec", () => {
    const evil = parseDocument(`
openapi: 4.0.0-candidate
info: { title: "x</script><script>alert(1)</script>", version: "1" }
paths: {}
`);
    expect(swaggerHtml(evil).html).not.toContain("</script><script>alert(1)");
  });

  test("swaggerResponse returns text/html", () => {
    expect(swaggerResponse(petstore).headers.get("content-type")).toContain("text/html");
  });
});
