/**
 * The VSCode extension shell — the UNIFYING COCKPIT. One v4 "Suluk" document is the hub, and this surface
 * makes every projection of the cycle visible + actionable from one place:
 *   - the "Suluk · Cycle" TreeView (data → contract → auth → document → docs → state → ui → tests), live
 *   - "View as" (principal scopes) re-projects the whole tree to what that viewer sees (the per-WHO axis)
 *   - actions that LAND files: generate shadcn form/table, generate the Nano Stores client, export v4
 *   - previews (Scalar/Swagger webviews), validation + audit diagnostics in the Problems panel
 * All real logic lives in ./cycle, ./codegen, ./logic (bun-tested); this file is the thin vscode wiring.
 */
import * as vscode from "vscode";
import {
  validateSource, auditSource, previewHtml, looksLikeV4, type Diagnostic,
  buildCycle, type CycleModel, type CycleLayer, type CycleItem, type LayerStatus,
  entityNames, generateForm, generateTable, generateStoresModule, exportV4Json,
  buildBuilderModel, generateAppFiles, generateRegistryJson, type BuilderNode,
  deployPlan, deployMarkdown,
} from "@suluk/cockpit";
import { parseDocument } from "@suluk/core";
import { SAMPLE_V4 } from "./sample";

const SUPPORTED = new Set(["yaml", "json", "yml"]);

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────
function isV4Source(text: string): boolean {
  try { return looksLikeV4(parseDocument(text)); } catch { return false; }
}

// The cockpit follows the active editor, but PINS the last v4 doc seen — so generating an artifact
// (which opens a .tsx/.ts beside and steals focus) does NOT blank the trees. They keep showing the API.
let pinnedV4Source: string | null = null;
function activeV4Source(): string | null {
  const ed = vscode.window.activeTextEditor;
  if (ed && SUPPORTED.has(ed.document.languageId)) {
    const text = ed.document.getText();
    if (isV4Source(text)) { pinnedV4Source = text; return text; }
  }
  return pinnedV4Source;
}

async function openGenerated(content: string, language: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({ content, language });
  await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
}

function themeIcon(status?: LayerStatus): vscode.ThemeIcon | undefined {
  switch (status) {
    case "error": return new vscode.ThemeIcon("error");
    case "warn": return new vscode.ThemeIcon("warning");
    case "ok": return new vscode.ThemeIcon("pass");
    case "info": return new vscode.ThemeIcon("info");
    default: return undefined;
  }
}

// What a Cycle row DOES when you click it — each layer maps to the most natural action, so the tree is a
// control surface, not just a read-out. Nothing here writes to disk; results open in a beside editor.
function cycleItemCommand(layerId: CycleLayer["id"], item: CycleItem): vscode.Command | undefined {
  const ref = item.ref ?? item.label;
  const reveal = (title: string): vscode.Command => ({ command: "suluk.reveal", title, arguments: [ref] });
  switch (layerId) {
    case "data":     return reveal(`Reveal the ${ref} schema in source`);
    case "contract": return reveal(`Reveal operation ${ref} in source`);
    case "auth":     return reveal(`Reveal security scheme ${ref} in source`);
    case "cost":     return reveal(`Reveal ${ref} (and its x-suluk-cost) in source`);
    case "document": return { command: "suluk.validate", title: "Validate against the v4 meta-schema" };
    case "docs":     return /scalar/i.test(item.label)
                       ? { command: "suluk.previewScalar", title: "Open the Scalar preview" }
                       : { command: "suluk.previewSwagger", title: "Open the Swagger UI preview" };
    case "state":    return { command: "suluk.generateStores", title: "Generate the Nano Stores client" };
    case "ui":       return { command: "suluk.generateUi", title: `Generate shadcn form/table for ${ref}`, arguments: [ref] };
    case "tests":    return { command: "suluk.runChecks", title: "Run the contract checks" };
    default:         return undefined;
  }
}

// Builder rows are actionable at the block tier — its label encodes entity + artifact (e.g. "ProjectForm").
function builderNodeCommand(node: BuilderNode): vscode.Command | undefined {
  if (node.tier !== "block") return undefined;
  if (node.label.endsWith("Form"))  return { command: "suluk.generateForm",  title: `Generate the ${node.label}`,  arguments: [node.label.slice(0, -4)] };
  if (node.label.endsWith("Table")) return { command: "suluk.generateTable", title: `Generate the ${node.label}`, arguments: [node.label.slice(0, -5)] };
  return undefined;
}

// ── the Cycle TreeView ──────────────────────────────────────────────────────────────────────────────
type Node = { kind: "layer"; layer: CycleLayer } | { kind: "item"; item: CycleItem; layerId: CycleLayer["id"] };

class CycleProvider implements vscode.TreeDataProvider<Node> {
  private readonly _onDidChange = new vscode.EventEmitter<Node | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  private principalScopes: string[] | undefined;

  /** undefined ⇒ full/public view; [] ⇒ anonymous (no scopes); [..] ⇒ that principal. */
  setPrincipal(scopes: string[] | undefined): void {
    this.principalScopes = scopes;
    this.refresh();
  }
  viewLabel(): string {
    if (this.principalScopes === undefined) return "full";
    return this.principalScopes.length ? this.principalScopes.join(", ") : "anonymous";
  }
  refresh(): void { this._onDidChange.fire(); }

  private model(): CycleModel | null {
    const src = activeV4Source();
    if (!src) return null;
    try {
      return buildCycle(parseDocument(src), this.principalScopes !== undefined ? { principal: { scopes: this.principalScopes } } : {});
    } catch {
      return null;
    }
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if (node.kind === "layer") {
      const ti = new vscode.TreeItem(node.layer.title, node.layer.items.length ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
      ti.description = node.layer.summary;
      ti.iconPath = themeIcon(node.layer.status);
      ti.contextValue = `suluk.layer.${node.layer.id}`;
      return ti;
    }
    const ti = new vscode.TreeItem(node.item.label, vscode.TreeItemCollapsibleState.None);
    ti.description = node.item.detail;
    ti.iconPath = themeIcon(node.item.status);
    if (node.item.ref) ti.contextValue = "suluk.item";
    const cmd = cycleItemCommand(node.layerId, node.item);
    if (cmd) { ti.command = cmd; ti.tooltip = cmd.title; }
    return ti;
  }

  getChildren(node?: Node): Node[] {
    const model = this.model();
    if (!model) return [];
    if (!node) return model.layers.map((layer) => ({ kind: "layer", layer }));
    if (node.kind === "layer") return node.layer.items.map((item) => ({ kind: "item", item, layerId: node.layer.id }));
    return [];
  }
}

// ── the Builder TreeView (pages → sections → blocks → components, with each tier's param contract) ─────
class BuilderProvider implements vscode.TreeDataProvider<BuilderNode> {
  private readonly _onDidChange = new vscode.EventEmitter<BuilderNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  refresh(): void { this._onDidChange.fire(); }

  private roots(): BuilderNode[] {
    const src = activeV4Source();
    if (!src) return [];
    try { return buildBuilderModel(parseDocument(src)).tree; } catch { return []; }
  }

  getTreeItem(node: BuilderNode): vscode.TreeItem {
    const ti = new vscode.TreeItem(node.label, node.children.length ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
    // surface the contract-narrowing right on the node: what this tier may set upward
    ti.description = node.contract.length ? `${node.tier} · may set { ${node.contract.join(", ")} }` : node.tier;
    ti.iconPath = new vscode.ThemeIcon({ page: "browser", section: "symbol-namespace", block: "symbol-method", component: "symbol-field" }[node.tier] ?? "circle-outline");
    ti.contextValue = `suluk.builder.${node.tier}`;
    const cmd = builderNodeCommand(node);
    if (cmd) { ti.command = cmd; ti.tooltip = cmd.title; }
    return ti;
  }
  getChildren(node?: BuilderNode): BuilderNode[] {
    return node ? node.children : this.roots();
  }
}

// ── diagnostics ─────────────────────────────────────────────────────────────────────────────────────
function toVsDiagnostics(diags: Diagnostic[]): vscode.Diagnostic[] {
  const sev: Record<Diagnostic["severity"], vscode.DiagnosticSeverity> = {
    error: vscode.DiagnosticSeverity.Error, warning: vscode.DiagnosticSeverity.Warning, info: vscode.DiagnosticSeverity.Information,
  };
  return diags.map((d) => {
    const diag = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), `[${d.path}] ${d.message}`, sev[d.severity]);
    diag.source = "suluk";
    return diag;
  });
}

function refreshDiagnostics(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
  if (!SUPPORTED.has(doc.languageId) || !isV4Source(doc.getText())) { collection.delete(doc.uri); return; }
  const { diagnostics } = validateSource(doc.getText());
  const { diagnostics: auditDiags } = auditSource(doc.getText());
  collection.set(doc.uri, toVsDiagnostics([...diagnostics, ...auditDiags]));
}

function openPreview(ui: "scalar" | "swagger"): void {
  const src = activeV4Source();
  if (!src) { void vscode.window.showWarningMessage("Suluk: open an OpenAPI v4 document first."); return; }
  try {
    const { html, diagnostics } = previewHtml(src, ui);
    const panel = vscode.window.createWebviewPanel(`suluk.preview.${ui}`, `Suluk — ${ui === "scalar" ? "Scalar" : "Swagger"} Preview`, vscode.ViewColumn.Beside, { enableScripts: true });
    panel.webview.html = html;
    if (diagnostics.length) void vscode.window.showInformationMessage(`Suluk: ${diagnostics.length} lossy-conversion note(s) — ${diagnostics[0].message}`);
  } catch (e) { void vscode.window.showErrorMessage(`Suluk: ${(e as Error).message}`); }
}

async function pickEntity(): Promise<string | undefined> {
  const src = activeV4Source();
  if (!src) { void vscode.window.showWarningMessage("Suluk: open an OpenAPI v4 document first."); return undefined; }
  const names = entityNames(parseDocument(src));
  if (!names.length) { void vscode.window.showWarningMessage("Suluk: this document has no components.schemas entities."); return undefined; }
  return vscode.window.showQuickPick(names, { placeHolder: "Entity to generate from" });
}

// ── activate ────────────────────────────────────────────────────────────────────────────────────────
export function activate(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection("suluk");
  const cycle = new CycleProvider();
  const builder = new BuilderProvider();
  context.subscriptions.push(
    collection,
    vscode.window.registerTreeDataProvider("suluk.cycle", cycle),
    vscode.window.registerTreeDataProvider("suluk.builder", builder),
  );

  const reg = (id: string, fn: (...a: never[]) => unknown) => context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  // ── onboarding: get a v4 document in front of the cockpit so the views fill up ──
  reg("suluk.openSample", async () => {
    const doc = await vscode.workspace.openTextDocument({ content: SAMPLE_V4, language: "yaml" });
    await vscode.window.showTextDocument(doc);
    cycle.refresh(); builder.refresh();
    void vscode.window.showInformationMessage("Suluk: sample loaded — open the Suluk sidebar to explore the Cycle & Builder. Try 'View as' and the Generate actions.");
  });
  reg("suluk.openFromUrl", async () => {
    const url = await vscode.window.showInputBox({
      prompt: "URL of an OpenAPI v4 document (e.g. a running app's /openapi.json)",
      placeHolder: "https://saasuluk.saastemly.com/openapi.json",
      value: "https://saasuluk.saastemly.com/openapi.json",
    });
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const doc = await vscode.workspace.openTextDocument({ content: text, language: url.endsWith(".yaml") || url.endsWith(".yml") ? "yaml" : "json" });
      await vscode.window.showTextDocument(doc);
      cycle.refresh(); builder.refresh();
      if (!isV4Source(text)) void vscode.window.showWarningMessage("Suluk: loaded, but it doesn't look like an OpenAPI v4 document (its `openapi` should start with \"4\").");
    } catch (e) {
      void vscode.window.showErrorMessage(`Suluk: couldn't load ${url} — ${(e as Error).message}`);
    }
  });

  reg("suluk.validate", () => {
    const ed = vscode.window.activeTextEditor; if (!ed) return;
    refreshDiagnostics(ed.document, collection);
    const { ok } = validateSource(ed.document.getText());
    void vscode.window.showInformationMessage(ok ? "Suluk: document is valid v4 ✓" : "Suluk: validation errors — see Problems panel.");
  });
  reg("suluk.audit", () => {
    const src = activeV4Source(); if (!src) return;
    const { findings } = auditSource(src);
    void vscode.window.showInformationMessage(`Suluk: ${findings.length} documentation finding(s).`);
  });
  reg("suluk.previewScalar", () => openPreview("scalar"));
  reg("suluk.previewSwagger", () => openPreview("swagger"));
  reg("suluk.refreshCycle", () => cycle.refresh());

  reg("suluk.viewAs", async () => {
    const input = await vscode.window.showInputBox({
      prompt: "View the cycle AS a principal — comma-separated scopes. Empty = full view; 'anonymous' = no scopes.",
      placeHolder: "e.g. write:pets, read:pets",
      value: cycle.viewLabel() === "full" ? "" : cycle.viewLabel(),
    });
    if (input === undefined) return; // cancelled
    const trimmed = input.trim();
    if (trimmed === "") cycle.setPrincipal(undefined);
    else if (trimmed.toLowerCase() === "anonymous") cycle.setPrincipal([]);
    else cycle.setPrincipal(trimmed.split(",").map((s) => s.trim()).filter(Boolean));
    void vscode.window.showInformationMessage(`Suluk: viewing as ${cycle.viewLabel()}.`);
  });

  // jump to where a thing (entity/operation/scheme) is DEFINED in the active source — the tree as a map.
  reg("suluk.reveal", (needle?: string) => {
    const ed = vscode.window.activeTextEditor;
    if (!ed || typeof needle !== "string") return;
    const text = ed.document.getText();
    let idx = -1;
    for (const pat of [`"${needle}":`, `${needle}:`, `"${needle}"`, needle]) { idx = text.indexOf(pat); if (idx >= 0) { if (text[idx] === '"') idx += 1; break; } }
    if (idx < 0) { void vscode.window.showInformationMessage(`Suluk: couldn't locate "${needle}" in the active document.`); return; }
    const start = ed.document.positionAt(idx), end = ed.document.positionAt(idx + needle.length);
    ed.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);
    ed.selection = new vscode.Selection(start, end);
  });
  reg("suluk.generateForm", async (name?: string) => {
    name = typeof name === "string" ? name : await pickEntity(); if (!name) return;
    try { await openGenerated(generateForm(parseDocument(activeV4Source()!), name), "typescriptreact"); }
    catch (e) { void vscode.window.showErrorMessage(`Suluk: ${(e as Error).message}`); }
  });
  reg("suluk.generateTable", async (name?: string) => {
    name = typeof name === "string" ? name : await pickEntity(); if (!name) return;
    try { await openGenerated(generateTable(parseDocument(activeV4Source()!), name), "typescriptreact"); }
    catch (e) { void vscode.window.showErrorMessage(`Suluk: ${(e as Error).message}`); }
  });
  // the UI row covers both form + table for an entity — ask which, then generate it.
  reg("suluk.generateUi", async (name?: string) => {
    name = typeof name === "string" ? name : await pickEntity(); if (!name) return;
    const which = await vscode.window.showQuickPick(["Form", "Table"], { placeHolder: `Generate a shadcn component for ${name}` });
    if (!which) return;
    try {
      const doc = parseDocument(activeV4Source()!);
      await openGenerated(which === "Form" ? generateForm(doc, name) : generateTable(doc, name), "typescriptreact");
    } catch (e) { void vscode.window.showErrorMessage(`Suluk: ${(e as Error).message}`); }
  });
  reg("suluk.generateStores", async () => {
    const src = activeV4Source(); if (!src) { void vscode.window.showWarningMessage("Suluk: open an OpenAPI v4 document first."); return; }
    await openGenerated(generateStoresModule(parseDocument(src)), "typescript");
  });
  reg("suluk.exportV4", async () => {
    const src = activeV4Source(); if (!src) { void vscode.window.showWarningMessage("Suluk: open an OpenAPI v4 document first."); return; }
    await openGenerated(exportV4Json(src), "json");
  });
  reg("suluk.runChecks", () => {
    const src = activeV4Source(); if (!src) return;
    const model = buildCycle(parseDocument(src));
    const tests = model.layers.find((l) => l.id === "tests");
    const passed = (tests?.items ?? []).filter((i) => i.status === "ok").length;
    void vscode.window.showInformationMessage(`Suluk: contract checks ${passed}/${tests?.items.length ?? 0} ✓`);
  });

  // ── Builder commands ──
  reg("suluk.refreshBuilder", () => builder.refresh());
  reg("suluk.exportRegistry", async () => {
    const src = activeV4Source(); if (!src) { void vscode.window.showWarningMessage("Suluk: open an OpenAPI v4 document first."); return; }
    await openGenerated(generateRegistryJson(parseDocument(src)), "json");
  });
  reg("suluk.generateApp", async () => {
    const src = activeV4Source(); if (!src) { void vscode.window.showWarningMessage("Suluk: open an OpenAPI v4 document first."); return; }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { void vscode.window.showWarningMessage("Suluk: open a workspace folder to generate into."); return; }
    const files = generateAppFiles(parseDocument(src));
    const root = vscode.Uri.joinPath(folder.uri, "suluk-generated");
    for (const f of files) {
      const uri = vscode.Uri.joinPath(root, f.path);
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, ".."));
      await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(f.content));
    }
    void vscode.window.showInformationMessage(`Suluk: generated ${files.length} files (backend + frontend + shadcn registry) into suluk-generated/.`);
  });
  reg("suluk.deployCloudflare", async () => {
    const src = activeV4Source(); if (!src) { void vscode.window.showWarningMessage("Suluk: open an OpenAPI v4 document first."); return; }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { void vscode.window.showWarningMessage("Suluk: open a workspace folder to deploy."); return; }
    const plan = deployPlan(parseDocument(src));
    const root = vscode.Uri.joinPath(folder.uri, "suluk-deploy");
    await vscode.workspace.fs.createDirectory(root);
    for (const f of plan.files) {
      await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(root, f.path), new TextEncoder().encode(f.content));
    }
    const md = vscode.Uri.joinPath(root, "DEPLOY.md");
    await vscode.workspace.fs.writeFile(md, new TextEncoder().encode(deployMarkdown(plan)));
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(md), vscode.ViewColumn.Beside);
    // open a terminal at the deploy dir so the user runs the steps themselves (OAuth login happens here)
    const term = vscode.window.createTerminal({ name: "Suluk · Cloudflare", cwd: root.fsPath });
    term.show();
    term.sendText("# Suluk: run the steps from DEPLOY.md. First: wrangler login", false);
    void vscode.window.showInformationMessage(`Suluk: deploy files written to suluk-deploy/ — follow DEPLOY.md (${plan.steps.length} steps). Suluk won't run wrangler for you; log in in the terminal.`);
  });

  const onChange = () => { cycle.refresh(); builder.refresh(); };
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => { refreshDiagnostics(doc, collection); onChange(); }),
    vscode.workspace.onDidSaveTextDocument((doc) => { refreshDiagnostics(doc, collection); onChange(); }),
    vscode.window.onDidChangeActiveTextEditor(onChange),
  );
  for (const doc of vscode.workspace.textDocuments) refreshDiagnostics(doc, collection);
}

export function deactivate(): void { /* subscriptions disposed via context */ }
