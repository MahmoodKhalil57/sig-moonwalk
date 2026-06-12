import { test, expect, describe } from "bun:test";
import { intersectScope, analyzeScopes, lintAgents } from "../src/index";
import { coninDoc, escalationDoc } from "./fixtures/conin";

describe("C027 scope intersection (least-privilege by construction)", () => {
  test("intersectScope treats null as unconstrained", () => {
    expect(intersectScope(null, ["a", "b"])).toEqual(["a", "b"]);
    expect(intersectScope(["a", "b"], null)).toEqual(["a", "b"]);
    expect(intersectScope(["a", "b", "c"], ["b", "c", "d"])).toEqual(["b", "c"]);
    expect(intersectScope(null, null)).toBeNull();
  });

  test("a child's effective scope is the intersection with its caller's", () => {
    const { effective, escalations } = analyzeScopes(coninDoc, "conin");
    expect(escalations).toEqual([]);
    expect(effective["conin"]).toEqual(["project:read", "deliverable:write", "library:read"]);
    // retrieval declares only library:read; caller grants it → effective = library:read
    expect(effective["coninRetrieval"]).toEqual(["library:read"]);
  });

  test("NAMED failure: a child needing a permission the caller doesn't grant is an escalation (confused-deputy)", () => {
    const { escalations } = analyzeScopes(escalationDoc(), "conin");
    expect(escalations).toEqual([{ parent: "conin", childLocal: "retrieval", child: "coninRetrieval", perms: ["library:read"] }]);
    // and it blocks installation (an error-severity lint)
    expect(lintAgents(escalationDoc()).some((f) => f.severity === "error" && f.code === "scope-escalation")).toBe(true);
  });
});
