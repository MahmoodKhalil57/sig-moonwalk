import { test, expect, describe } from "bun:test";
import { validateDocument } from "@suluk/core";
import { validate31, downgrade } from "@suluk/openapi-compat";
import { app, built } from "../src/app";

const json = (body: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("petshop — one source (Drizzle entities) boots the whole stack", () => {
  test("the composition is sound (no DSL contract violations)", () => {
    expect(built.errors).toEqual([]);
  });

  test("GET /openapi.json serves a valid v4 document that also downgrades to valid 3.1", async () => {
    const r = await app.request("/openapi.json");
    expect(r.status).toBe(200);
    const doc = await r.json();
    expect(validateDocument(doc).valid).toBe(true);
    expect(validate31(downgrade(doc).document).valid).toBe(true);
  });

  test("GET /scalar serves the rendered docs page", async () => {
    const r = await app.request("/scalar");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/html");
    expect(await r.text()).toContain("Scalar.createApiReference");
  });

  test("CRUD round-trips through the contract-generated + validated routes", async () => {
    // starts empty
    expect(await (await app.request("/pet")).json()).toEqual([]);

    // request validation comes from the contract: a body missing the required `name` is rejected
    expect((await app.request("/pet", json({ status: "available" }))).status).toBe(400);

    // valid create
    const created = await app.request("/pet", json({ name: "Rex", status: "available" }));
    expect(created.status).toBe(201);
    const pet = (await created.json()) as { id: number; name: string };
    expect(pet.name).toBe("Rex");
    expect(typeof pet.id).toBe("number");

    // get by id, list reflects it
    expect((await app.request(`/pet/${pet.id}`)).status).toBe(200);
    expect(((await (await app.request("/pet")).json()) as unknown[]).length).toBe(1);

    // a second resource type works the same way (proves it's general, not hand-wired)
    expect((await app.request("/category", json({ name: "Dogs" }))).status).toBe(201);

    // delete
    expect((await app.request(`/pet/${pet.id}`, { method: "DELETE" })).status).toBe(204);
    expect(await (await app.request("/pet")).json()).toEqual([]);
  });

  test("the frontend was generated from the SAME source (components + a page wired to the stores)", () => {
    const names = built.frontend.components.map((c) => c.name).sort();
    expect(names).toEqual(["CategoryForm", "CategoryTable", "PetForm", "PetTable"]);
    const page = built.frontend.pages[0];
    expect(page.tsx).toContain("<PetTable />");
    expect(page.tsx).toContain("<CategoryForm />");
  });

  test("the /superadmin web panel is mounted, gated, and mirrors the cockpit", async () => {
    expect((await app.request("/superadmin")).status).toBe(403); // gated
    const r = await app.request("/superadmin", { headers: { "x-role": "superadmin" } });
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("SULUK · SUPERADMIN");
  });
});
