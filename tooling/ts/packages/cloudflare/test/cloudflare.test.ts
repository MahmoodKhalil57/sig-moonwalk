import { test, expect, describe } from "bun:test";
import { CloudflareClient, CloudflareError, deploy, provisionD1, putSecrets, type AssetFile } from "../src/index";

/** A routing mock fetch: returns the CF `{success,result}` envelope; records every call. */
function mockCf(routes: [RegExp, unknown | ((ctx: { body: BodyInit | null | undefined }) => unknown)][]) {
  const calls: { method: string; path: string; query: Record<string, string>; body: BodyInit | null | undefined; token?: string }[] = [];
  const fetch = (async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const path = u.pathname.replace("/client/v4", ""); // match the logical path, not the API base prefix
    const method = init?.method ?? "GET";
    const auth = (init?.headers as Record<string, string>)?.authorization;
    calls.push({ method, path, query: Object.fromEntries(u.searchParams), body: init?.body, token: auth?.replace("Bearer ", "") });
    for (const [pat, handler] of routes) {
      if (pat.test(`${method} ${path}`)) {
        const result = typeof handler === "function" ? (handler as (c: { body: BodyInit | null | undefined }) => unknown)({ body: init?.body }) : handler;
        return new Response(JSON.stringify({ success: true, errors: [], result }), { status: 200 });
      }
    }
    return new Response(JSON.stringify({ success: false, errors: [{ code: 404, message: `no route: ${method} ${path}` }] }), { status: 404 });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

describe("CloudflareClient", () => {
  test("unwraps the result envelope + resolves the account id", async () => {
    const { fetch } = mockCf([[/GET \/accounts$/, [{ id: "acct_1", name: "Acme" }]]]);
    const cf = new CloudflareClient({ apiToken: "t", fetch });
    expect(await cf.resolveAccountId()).toBe("acct_1");
    expect(await cf.resolveAccountId()).toBe("acct_1"); // cached (no second call needed)
  });
  test("throws CloudflareError carrying the API's error codes on success:false", async () => {
    const fetch = (async () => new Response(JSON.stringify({ success: false, errors: [{ code: 10000, message: "Authentication error" }] }), { status: 403 })) as unknown as typeof globalThis.fetch;
    const cf = new CloudflareClient({ apiToken: "t", accountId: "a", fetch });
    await expect(cf.request("GET", "/x")).rejects.toThrow(CloudflareError);
    await expect(cf.request("GET", "/x")).rejects.toThrow("10000");
  });
});

describe("provisioners — idempotent create-or-get", () => {
  test("provisionD1 returns the existing DB (no create) when one matches", async () => {
    const { fetch, calls } = mockCf([[/GET .*\/d1\/database$/, [{ uuid: "db_existing", name: "saasuluk-db" }]]]);
    const cf = new CloudflareClient({ apiToken: "t", accountId: "a", fetch });
    const db = await provisionD1(cf, "saasuluk-db");
    expect(db.uuid).toBe("db_existing");
    expect(calls.some((c) => c.method === "POST" && /d1\/database$/.test(c.path))).toBe(false); // never created
  });
  test("provisionD1 creates when none matches", async () => {
    const { fetch } = mockCf([[/GET .*\/d1\/database$/, []], [/POST .*\/d1\/database$/, { uuid: "db_new", name: "saasuluk-db" }]]);
    const cf = new CloudflareClient({ apiToken: "t", accountId: "a", fetch });
    expect((await provisionD1(cf, "saasuluk-db")).uuid).toBe("db_new");
  });
  test("putSecrets sets the non-empty secrets only", async () => {
    const { fetch, calls } = mockCf([[/PUT .*\/secrets$/, {}]]);
    const cf = new CloudflareClient({ apiToken: "t", accountId: "a", fetch });
    const set = await putSecrets(cf, "saasuluk", { A: "1", B: "", C: undefined, D: "4" });
    expect(set).toEqual(["A", "D"]);
    expect(calls.filter((c) => /\/secrets$/.test(c.path)).length).toBe(2);
  });
});

describe("deploy() — full orchestration in dependency order", () => {
  test("provisions D1, migrates, uploads assets, deploys the worker (correct metadata), sets secrets + crons", async () => {
    const { fetch, calls } = mockCf([
      [/GET \/accounts$/, [{ id: "acct_1" }]],
      [/GET .*\/d1\/database$/, []],
      [/POST .*\/d1\/database$/, { uuid: "db_1", name: "saasuluk-db" }],
      [/POST .*\/d1\/database\/db_1\/query$/, [{ success: true }]],
      [/POST .*\/assets-upload-session$/, { jwt: "session_jwt", buckets: [] }], // all cached → completion = session jwt
      [/PUT .*\/workers\/scripts\/saasuluk$/, { id: "saasuluk" }],
      [/PUT .*\/workers\/scripts\/saasuluk\/secrets$/, {}],
      [/PUT .*\/workers\/scripts\/saasuluk\/schedules$/, []],
    ]);
    const cf = new CloudflareClient({ apiToken: "t", fetch });
    const assets: AssetFile[] = [{ path: "/index.html", bytes: new TextEncoder().encode("<!doctype html>"), contentType: "text/html" }];
    const res = await deploy(cf, {
      scriptName: "saasuluk",
      module: "export default { fetch(){ return new Response('ok') } }",
      compatibilityDate: "2026-06-01",
      compatibilityFlags: ["nodejs_compat"],
      d1: { binding: "DB", databaseName: "saasuluk-db", migrationsSql: ["CREATE TABLE t (id INTEGER);"] },
      assets,
      vars: { STRIPE_METER_EVENT_NAME: "saasuluk_cost" },
      secrets: { BETTER_AUTH_SECRET: "shh", MISSING: "" },
      crons: ["0 * * * *"],
      observability: true,
    });

    expect(res.d1).toEqual({ binding: "DB", id: "db_1" });
    expect(res.assetsUploaded).toBe(1);
    expect(res.secretsSet).toEqual(["BETTER_AUTH_SECRET"]);
    expect(res.crons).toEqual(["0 * * * *"]);

    // the worker PUT carried the right metadata (parse the multipart)
    const put = calls.find((c) => c.method === "PUT" && /\/workers\/scripts\/saasuluk$/.test(c.path))!;
    const meta = JSON.parse(await (put.body as FormData).get("metadata")!.text());
    expect(meta.main_module).toBe("worker.js");
    expect(meta.compatibility_flags).toEqual(["nodejs_compat"]);
    expect(meta.bindings).toContainEqual({ type: "d1", name: "DB", id: "db_1" });
    expect(meta.bindings).toContainEqual({ type: "plain_text", name: "STRIPE_METER_EVENT_NAME", text: "saasuluk_cost" });
    expect(meta.bindings).toContainEqual({ type: "assets", name: "ASSETS" });
    expect(meta.assets.jwt).toBe("session_jwt");
    expect(meta.keep_bindings).toContain("secret_text"); // secrets survive redeploys
    expect(meta.observability).toEqual({ enabled: true });

    // ordering: D1 provisioned + migrated BEFORE the worker deploy; secrets AFTER
    const idx = (re: RegExp) => calls.findIndex((c) => re.test(`${c.method} ${c.path}`));
    expect(idx(/POST .*\/d1\/database\/db_1\/query/)).toBeLessThan(idx(/PUT .*\/workers\/scripts\/saasuluk$/));
    expect(idx(/PUT .*\/workers\/scripts\/saasuluk$/)).toBeLessThan(idx(/\/secrets$/));
  });
});
