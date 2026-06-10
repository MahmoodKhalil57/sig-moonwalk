/**
 * The VSCode extension shell — wires editor events + webviews to the pure logic in ./logic.ts.
 * Commands: Suluk: Validate · Suluk: Audit documentation coverage · Suluk: Preview in Scalar/Swagger.
 * Validation runs automatically on open/save for v4 documents. This file imports the vscode API and is
 * typechecked (not bun-tested — it needs the VSCode host); all real logic lives in ./logic.ts (tested).
 */
import * as vscode from "vscode";
import { validateSource, auditSource, previewHtml, looksLikeV4, type Diagnostic } from "./logic";
import { parseDocument } from "@suluk/core";

const SUPPORTED = new Set(["yaml", "json", "yml"]);

function toVsDiagnostics(diags: Diagnostic[]): vscode.Diagnostic[] {
  const sev: Record<Diagnostic["severity"], vscode.DiagnosticSeverity> = {
    error: vscode.DiagnosticSeverity.Error,
    warning: vscode.DiagnosticSeverity.Warning,
    info: vscode.DiagnosticSeverity.Information,
  };
  return diags.map((d) => {
    const diag = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), `[${d.path}] ${d.message}`, sev[d.severity]);
    diag.source = "suluk";
    return diag;
  });
}

/** Only act on documents that parse as a v4 "Suluk" doc. */
function isV4Document(doc: vscode.TextDocument): boolean {
  if (!SUPPORTED.has(doc.languageId)) return false;
  try {
    return looksLikeV4(parseDocument(doc.getText()));
  } catch {
    return false;
  }
}

function refreshDiagnostics(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
  if (!isV4Document(doc)) {
    collection.delete(doc.uri);
    return;
  }
  const { diagnostics } = validateSource(doc.getText());
  const { diagnostics: auditDiags } = auditSource(doc.getText());
  collection.set(doc.uri, toVsDiagnostics([...diagnostics, ...auditDiags]));
}

function openPreview(ui: "scalar" | "swagger"): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage("Suluk: open an OpenAPI v4 document first.");
    return;
  }
  try {
    const { html, diagnostics } = previewHtml(editor.document.getText(), ui);
    const panel = vscode.window.createWebviewPanel(
      `suluk.preview.${ui}`,
      `Suluk — ${ui === "scalar" ? "Scalar" : "Swagger"} Preview`,
      vscode.ViewColumn.Beside,
      { enableScripts: true },
    );
    panel.webview.html = html;
    if (diagnostics.length) void vscode.window.showInformationMessage(`Suluk: ${diagnostics.length} lossy-conversion note(s) — ${diagnostics[0].message}`);
  } catch (e) {
    void vscode.window.showErrorMessage(`Suluk: ${(e as Error).message}`);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection("suluk");
  context.subscriptions.push(collection);

  context.subscriptions.push(
    vscode.commands.registerCommand("suluk.validate", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      refreshDiagnostics(editor.document, collection);
      const { ok } = validateSource(editor.document.getText());
      void vscode.window.showInformationMessage(ok ? "Suluk: document is valid v4 ✓" : "Suluk: validation errors — see Problems panel.");
    }),
    vscode.commands.registerCommand("suluk.audit", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const { findings } = auditSource(editor.document.getText());
      void vscode.window.showInformationMessage(`Suluk: ${findings.length} documentation finding(s).`);
    }),
    vscode.commands.registerCommand("suluk.previewScalar", () => openPreview("scalar")),
    vscode.commands.registerCommand("suluk.previewSwagger", () => openPreview("swagger")),
    vscode.workspace.onDidOpenTextDocument((doc) => refreshDiagnostics(doc, collection)),
    vscode.workspace.onDidSaveTextDocument((doc) => refreshDiagnostics(doc, collection)),
  );

  // validate whatever is already open
  for (const doc of vscode.workspace.textDocuments) refreshDiagnostics(doc, collection);
}

export function deactivate(): void {
  /* diagnostics collection is disposed via context.subscriptions */
}
