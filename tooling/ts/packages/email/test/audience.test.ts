import { test, expect, describe } from "bun:test";
import { consoleAudience, resendAudience, syncNewsletter, type NewsletterRow } from "../src/index";

describe("AudienceProvider — the swappable audience binding", () => {
  test("consoleAudience logs, never sends, returns ok", async () => {
    const lines: string[] = [];
    const a = consoleAudience({ log: (l) => lines.push(l) });
    expect((await a.upsert("aud_1", { email: "x@y.co" })).ok).toBe(true);
    expect(lines[0]).toContain("x@y.co");
  });

  test("resendAudience POSTs an upsert + DELETEs a removal via the REST API (Workers-safe, no SDK)", async () => {
    const calls: { url: string; method?: string; body?: string }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method, body: init.body as string });
      return new Response(JSON.stringify({ id: "ct_1" }), { status: 200 });
    }) as unknown as typeof fetch;
    const a = resendAudience({ apiKey: "key_X", fetch: fakeFetch });

    const up = await a.upsert("aud_1", { email: "a@b.co", firstName: "Sam" });
    expect(up).toMatchObject({ ok: true, id: "ct_1" });
    expect(calls[0]).toMatchObject({ url: "https://api.resend.com/audiences/aud_1/contacts", method: "POST" });
    expect(JSON.parse(calls[0].body!)).toMatchObject({ email: "a@b.co", unsubscribed: false, first_name: "Sam" });

    await a.remove("aud_1", "a@b.co");
    expect(calls[1]).toMatchObject({ url: "https://api.resend.com/audiences/aud_1/contacts/a%40b.co", method: "DELETE" });
  });

  test("resendAudience returns ok:false on a non-2xx and never throws on a transport error", async () => {
    const bad = (async () => new Response("nope", { status: 422 })) as unknown as typeof fetch;
    expect((await resendAudience({ apiKey: "k", fetch: bad }).upsert("a", { email: "x" })).ok).toBe(false);
    const thrower = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    const r = await resendAudience({ apiKey: "k", fetch: thrower }).upsert("a", { email: "x" });
    expect(r).toMatchObject({ ok: false });
    expect(r.error).toContain("offline");
  });
});

describe("syncNewsletter — reconcile Newsletter rows → audience (subscribed upsert, unsubscribed remove)", () => {
  const rows: NewsletterRow[] = [
    { email: "a@b.co", status: "subscribed" },
    { email: "c@d.co" }, // no status → treated as subscribed
    { email: "e@f.co", status: "unsubscribed" },
  ];

  test("drives the audience from the rows + tallies the result", async () => {
    const ops: string[] = [];
    const provider = {
      id: "fake",
      async upsert(_a: string, c: { email: string }) { ops.push("upsert:" + c.email); return { ok: true }; },
      async remove(_a: string, e: string) { ops.push("remove:" + e); return { ok: true }; },
    };
    const result = await syncNewsletter(provider, "aud_1", rows);
    expect(result).toEqual({ upserted: 2, removed: 1, failed: 0 });
    expect(ops).toEqual(["upsert:a@b.co", "upsert:c@d.co", "remove:e@f.co"]);
  });

  test("a provider failure is counted, not thrown", async () => {
    const provider = { id: "fake", async upsert() { return { ok: false, error: "x" }; }, async remove() { return { ok: true }; } };
    expect(await syncNewsletter(provider, "aud_1", [{ email: "a@b.co", status: "subscribed" }])).toEqual({ upserted: 0, removed: 0, failed: 1 });
  });
});
