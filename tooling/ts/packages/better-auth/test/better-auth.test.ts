import { test, expect, describe } from "bun:test";
import { validateDocument } from "@suluk/core";
import { emitV4, contract } from "@suluk/hono";
import * as z from "zod";
import { authSecuritySchemes, normalizeOas30, ingestAuthOpenAPI, mergeAuth, principalFromSession } from "../src/index";

/** A realistic slice of what Better Auth's generateOpenAPISchema() emits (OpenAPI 3.0, with a nullable field). */
const betterAuthOpenAPI30: Record<string, unknown> = {
  openapi: "3.0.3",
  info: { title: "Better Auth", version: "1.0.0" },
  paths: {
    "/sign-up/email": {
      post: {
        operationId: "signUpEmail",
        requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/SignUpBody" } } } },
        responses: { "200": { description: "Session", content: { "application/json": { schema: { $ref: "#/components/schemas/Session" } } } } },
      },
    },
    "/get-session": {
      get: {
        operationId: "getSession",
        responses: { "200": { description: "Current session", content: { "application/json": { schema: { $ref: "#/components/schemas/Session" } } } } },
      },
    },
  },
  components: {
    schemas: {
      SignUpBody: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string" }, name: { type: "string", nullable: true } } },
      Session: { type: "object", properties: { token: { type: "string" }, user: { type: "object", properties: { id: { type: "string" }, image: { type: "string", nullable: true } } } } },
    },
  },
};

describe("authSecuritySchemes — auth methods → v4 securitySchemes (C014)", () => {
  test("session → cookie, bearer → http bearer, apiKey → header", () => {
    const { securitySchemes, names } = authSecuritySchemes({ session: true, bearer: true, apiKey: true });
    expect(securitySchemes.sessionCookie).toEqual({ type: "apiKey", in: "cookie", name: "better-auth.session_token" });
    expect(securitySchemes.bearerAuth).toEqual({ type: "http", scheme: "bearer" });
    expect(securitySchemes.apiKey).toEqual({ type: "apiKey", in: "header", name: "x-api-key" });
    expect(names.sort()).toEqual(["apiKey", "bearerAuth", "sessionCookie"]);
  });
  test("custom names are honored", () => {
    const { securitySchemes } = authSecuritySchemes({ session: { cookieName: "myapp.sid" }, apiKey: { header: "X-Key" } });
    expect((securitySchemes.sessionCookie as any).name).toBe("myapp.sid");
    expect((securitySchemes.apiKey as any).name).toBe("X-Key");
  });
});

describe("normalizeOas30 — 3.0 Schema dialect → JSON Schema 2020-12", () => {
  test("nullable:true folds 'null' into the type", () => {
    expect(normalizeOas30({ type: "string", nullable: true })).toEqual({ type: ["string", "null"] });
  });
  test("boolean exclusiveMinimum → numeric form", () => {
    expect(normalizeOas30({ type: "number", minimum: 0, exclusiveMinimum: true })).toEqual({ type: "number", exclusiveMinimum: 0 });
  });
});

describe("ingestAuthOpenAPI — Better Auth 3.0 → v4", () => {
  const v4 = ingestAuthOpenAPI(betterAuthOpenAPI30, { basePath: "/api/auth" });

  test("lifts to a structurally valid v4 document", () => {
    const r = validateDocument(v4);
    if (!r.valid) console.error(r.errors);
    expect(r.valid).toBe(true);
  });
  test("prefixes auth paths under the mount base", () => {
    expect(Object.keys(v4.paths)).toContain("api/auth/sign-up/email");
    expect(Object.keys(v4.paths)).toContain("api/auth/get-session");
  });
  test("the nullable 3.0 field became a 2020-12 type array (no leftover 'nullable')", () => {
    const name = (v4.components!.schemas!.SignUpBody as any).properties.name;
    expect(name.type).toEqual(["string", "null"]);
    expect(name.nullable).toBeUndefined();
  });
  test("preserves the operation by-name handle (operationId → request name)", () => {
    const reqs = v4.paths["api/auth/sign-up/email"].requests;
    expect(Object.keys(reqs)).toContain("signUpEmail");
  });
});

describe("mergeAuth — fold the auth surface into an app's v4 doc", () => {
  test("merged document (app routes + auth routes + securitySchemes) is valid v4", () => {
    const appRoutes = contract([
      { method: "get", path: "/pet", name: "listPets", summary: "List", responses: [{ status: 200, description: "ok", schema: z.array(z.object({ name: z.string() })) }] },
    ]);
    const { document: appDoc } = emitV4(appRoutes, { info: { title: "Pets", version: "1.0.0" } });
    const authV4 = ingestAuthOpenAPI(betterAuthOpenAPI30, { basePath: "/api/auth" });
    const { securitySchemes } = authSecuritySchemes({ session: true, bearer: true });

    const merged = mergeAuth(appDoc, authV4, { securitySchemes });
    expect(validateDocument(merged).valid).toBe(true);
    // both surfaces present
    expect(Object.keys(merged.paths)).toContain("pet");
    expect(Object.keys(merged.paths)).toContain("api/auth/sign-up/email");
    // securitySchemes carried (C014 anchor)
    expect(merged.components!.securitySchemes!.sessionCookie).toBeDefined();
    expect(merged.components!.schemas!.Session).toBeDefined();
  });
});

describe("principalFromSession — the per-viewer loop closer", () => {
  test("maps role → scopes via the provided map", () => {
    const p = principalFromSession({ user: { role: "admin" } }, { roleScopes: { admin: ["read:pets", "write:pets"] } });
    expect(p.scopes.sort()).toEqual(["read:pets", "write:pets"]);
  });
  test("collects scopes from session, user, and apiKey permissions", () => {
    const p = principalFromSession({ scopes: ["a"], user: { scopes: ["b"] }, apiKey: { permissions: { pets: ["write:pets"] } } });
    expect(p.scopes.sort()).toEqual(["a", "b", "write:pets"]);
  });
  test("a writer principal sees a scope-gated operation that an anonymous viewer does not", () => {
    const routes = contract([
      { method: "post", path: "/pet", name: "createPet", scopes: ["write:pets"], request: { json: z.object({ name: z.string() }) }, responses: [{ status: 201, description: "created" }] },
    ]);
    const anon = principalFromSession(null);
    const writer = principalFromSession({ user: { role: "admin" } }, { roleScopes: { admin: ["write:pets"] } });
    const anonNames = Object.values(emitV4(routes, { principal: anon }).document.paths).flatMap((pi) => Object.keys(pi.requests));
    const writerNames = Object.values(emitV4(routes, { principal: writer }).document.paths).flatMap((pi) => Object.keys(pi.requests));
    expect(anonNames).not.toContain("createPet");
    expect(writerNames).toContain("createPet");
  });
});
