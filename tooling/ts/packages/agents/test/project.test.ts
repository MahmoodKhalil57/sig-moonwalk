import { test, expect, describe } from "bun:test";
import { projectClaudePlugin, projectOpenRouter, contentHash } from "../src/index";
import { coninDoc, coninInstructions, coninDayOne } from "./fixtures/conin";

describe("C027 Claude-plugin projection", () => {
  const plug = projectClaudePlugin(coninDoc, "conin", {
    mcpUrl: "https://construction-intelligence.saastemly.com/mcp",
    version: "1.0.0",
    homepage: "https://construction-intelligence.saastemly.com",
    instructions: coninInstructions,
  });

  test("emits plugin.json + .mcp.json + a generated SKILL.md", () => {
    expect(Object.keys(plug.files).sort()).toEqual([".mcp.json", "plugin.json", "skills/operate/SKILL.md"]);
    const pj = JSON.parse(plug.files["plugin.json"]);
    expect(pj.name).toBe("conin");
    expect(pj.mcpServers).toBe("./.mcp.json");
    expect(pj.description.length).toBeGreaterThan(10);
  });

  test(".mcp.json is HTTP MCP with host-side OAuth and NO embedded credential", () => {
    const mj = JSON.parse(plug.files[".mcp.json"]);
    expect(mj.mcpServers.conin.type).toBe("http");
    expect(mj.mcpServers.conin.url).toContain("/mcp");
    expect(mj.mcpServers.conin.oauth).toEqual({});
    // no token / bearer / secret may ever appear in a projected artifact
    expect(plug.files[".mcp.json"]).not.toMatch(/bearer|token|secret|api[_-]?key/i);
  });

  test("SKILL.md carries the contentHash + version staleness stamp (the genuinely-missing feature)", () => {
    const md = plug.files["skills/operate/SKILL.md"];
    expect(md).toContain("name: operate");
    expect(md).toContain(`contentHash: ${contentHash(coninInstructions.operate)}`);
    expect(md).toContain("version: 2026-06-11");
    expect(md).toContain("source: https://construction-intelligence.saastemly.com/v1/instructions");
    expect(md.trimEnd().endsWith(coninInstructions.operate)).toBe(true);
  });

  test("projection is a PURE FUNCTION — same contract in, byte-identical artifacts out", () => {
    const again = projectClaudePlugin(coninDoc, "conin", {
      mcpUrl: "https://construction-intelligence.saastemly.com/mcp",
      version: "1.0.0",
      homepage: "https://construction-intelligence.saastemly.com",
      instructions: coninInstructions,
    });
    expect(again).toEqual(plug);
  });
});

describe("C027 OpenRouter projection", () => {
  const m = projectOpenRouter(coninDoc, "conin", { instructions: coninInstructions });

  test("routes → function tools keyed by the wire id; model preference from the primary skill", () => {
    expect(m.model).toEqual(["anthropic/claude-opus-4", "google/gemini-2.5-flash"]);
    expect(m.tier).toBe("cold-tail");
    expect(m.tools.map((t) => t.function.name).sort()).toEqual(["generate_deliverable", "run_core_primitive"]);
    expect(m.tools.every((t) => t.type === "function")).toBe(true);
  });

  test("instructions is a pointer + a pinned contentHash, never the raw text by default", () => {
    expect(m.instructions.source).toContain("/v1/instructions");
    expect(m.instructions.contentHash).toBe(contentHash(coninInstructions.operate));
    expect(m.instructions.version).toBe("2026-06-11");
  });

  test("sub-agents surface as front-door dispatch targets, by name", () => {
    expect(m.subAgents).toEqual([{ name: "retrieval", ref: "#/x-suluk-agents/coninRetrieval" }]);
  });

  test("deterministic — twice equal", () => {
    expect(projectOpenRouter(coninDoc, "conin", { instructions: coninInstructions })).toEqual(m);
  });
});

describe("projection refuses a non-installable agent (fail-loud, not a broken artifact)", () => {
  test("Conin's day-one dangling operationRef throws on BOTH targets", () => {
    expect(() => projectOpenRouter(coninDayOne(), "conin")).toThrow(/does not install|run_core_primitive|dangling/);
    expect(() => projectClaudePlugin(coninDayOne(), "conin", { mcpUrl: "https://x/mcp" })).toThrow(/does not install|run_core_primitive|dangling/);
  });
});
