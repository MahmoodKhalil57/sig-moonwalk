import { test, expect, describe, beforeAll } from "bun:test";
import { app , resetDemo } from "../src/app";

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

beforeAll(resetDemo);

describe("cost tracking — frontend action → operation → per-user cost (display as-is)", () => {
  test("the v4 document carries x-suluk-cost (so it bubbles to Scalar + /superadmin)", async () => {
    const doc = await (await app.request("/openapi.json")).json() as any;
    expect(doc.paths["pet"].requests.createPet["x-suluk-cost"].components.length).toBeGreaterThan(0);
  });

  test("a write is metered + attributed to the user AND the frontend action", async () => {
    await post("/pet", { name: "Rex", status: "available" }, { "x-user": "user_7", "x-suluk-action": "add-pet-button" });
    const s = await (await app.request("/cost")).json() as any;
    expect(s.byPrincipal["user_7"]).toBe(130);       // createPet = compute 100 + db-write 30
    expect(s.byAction["add-pet-button"]).toBe(130);   // traced back to the button
    expect(s.bySource["compute"]).toBe(100);          // and back to the third party / resource
  });

  test("a read costs less than a write (the data shown as it is)", async () => {
    await app.request("/pet", { headers: { "x-user": "user_7" } }); // listPet = db-read 12
    const s = await (await app.request("/cost")).json() as any;
    expect(s.byOperation["listPet"]).toBe(12);
    expect(s.total).toBe(142); // 130 (write) + 12 (read)
  });

  test("docs/openapi/cost endpoints are NOT metered (only real operations are)", async () => {
    const before = (await (await app.request("/cost")).json() as any).count;
    await app.request("/openapi.json"); await app.request("/scalar");
    expect((await (await app.request("/cost")).json() as any).count).toBe(before);
  });
});
