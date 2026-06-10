import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { parseDocument } from "@suluk/core";
import { adminApp } from "../src/index";

const petstore = parseDocument(
  readFileSync(join(import.meta.dir, "..", "..", "core", "test", "conformance", "valid", "01-petstore.yaml"), "utf8"),
);

// a superadmin gate driven by a header (in real use: principalFromSession(...).scopes.includes(...) / role check)
const authorize = (c: { req: { header(n: string): string | undefined } }) => c.req.header("x-role") === "superadmin";
const su = { headers: { "x-role": "superadmin" } };

describe("@suluk/admin — the /superadmin panel mirrors the cockpit", () => {
  const app = adminApp({ document: petstore, authorize, title: "Petshop" });

  test("the gate denies non-superadmins on every admin route (default-deny)", async () => {
    expect((await app.request("/superadmin")).status).toBe(403);
    expect((await app.request("/superadmin/builder")).status).toBe(403);
    // a panel built with NO authorize denies even with the header (privileged by default)
    const locked = adminApp({ document: petstore });
    expect((await locked.request("/superadmin", su)).status).toBe(403);
  });

  test("overview renders the cycle model as HTML", async () => {
    const r = await app.request("/superadmin", su);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/html");
    const html = await r.text();
    expect(html).toContain("SULUK · SUPERADMIN");
    expect(html).toContain("Cycle");
    expect(html).toContain("Contract (API)");
  });

  test("the builder page shows the tier tree WITH the contract-narrowing", async () => {
    const html = await (await app.request("/superadmin/builder", su)).text();
    expect(html).toContain("PetCrud");
    expect(html).toContain("may set {"); // the contract surfaced, like the vscode tree
  });

  test("the docs page serves Scalar over the downgraded spec", async () => {
    const html = await (await app.request("/superadmin/docs", su)).text();
    expect(html).toContain("Scalar.createApiReference");
  });

  test("the deploy page renders the Cloudflare plan", async () => {
    const html = await (await app.request("/superadmin/deploy", su)).text();
    expect(html).toContain("wrangler login");
    expect(html).toContain("wrangler deploy");
  });

  test("the checks page renders the contract checks", async () => {
    const html = await (await app.request("/superadmin/checks", su)).text();
    expect(html).toContain("Contract checks");
    expect(html).toContain("meta-schema");
  });

  test("mounts cleanly onto a host app", async () => {
    const host = new Hono();
    host.get("/", (c) => c.text("home"));
    host.route("/", adminApp({ document: petstore, authorize }));
    expect((await host.request("/")).status).toBe(200);
    expect((await host.request("/superadmin", su)).status).toBe(200);
  });
});
