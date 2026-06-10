import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";

// The vscode package has no mock harness (the extension activates the whole vscode API). The security-critical
// guarantees of the role-preview path are otherwise unwitnessed, so we assert them against the SOURCE: a real
// regression guard that fails the build if someone wires a token/webview onto the credentialed surface.
const src = readFileSync(`${import.meta.dir}/../src/extension.ts`, "utf8");

/** the body of one reg("suluk.X", ...) command, up to the next reg( registration. */
function commandBody(id: string): string {
  const start = src.indexOf(`reg("${id}"`);
  expect(start).toBeGreaterThan(-1);
  const next = src.indexOf("\n  reg(", start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

describe("suluk.previewAsRole — the credentialed surface stays charter-bounded (INV-05/06/07/08)", () => {
  const body = commandBody("suluk.previewAsRole");
  test("opens in the BROWSER via openExternal (INV-07) and uses the pure guard (INV-08)", () => {
    expect(body).toContain("openExternal");
    expect(body).toContain("previewLaunchUrl");
    expect(body).toContain("isPreviewEnv"); // the preview-only guard is present on this path
  });
  test("NEVER renders a webview on this path (no cross-origin iframe role-spoof)", () => {
    expect(body).not.toContain("createWebviewPanel");
    expect(body).not.toContain("WebviewPanel");
  });
  test("holds NO token: touches no secrets API and persists nothing on this path (INV-05/06)", () => {
    expect(body).not.toContain("secrets");
    expect(body).not.toContain("workspaceState.update");
    expect(body).not.toContain("globalState.update");
  });
});

describe("suluk.deployCloudflare — surfaces the preview backdoor before a PROD deploy (supply-chain)", () => {
  const body = commandBody("suluk.deployCloudflare");
  test("runs converge and BLOCKS on a preview-only op with a modal before writing files", () => {
    expect(body).toContain("convergeContract");
    expect(body).toContain("preview-op-exposed");
    expect(body).toContain("modal: true");
    expect(body).toContain("Deploy anyway");
  });
});
