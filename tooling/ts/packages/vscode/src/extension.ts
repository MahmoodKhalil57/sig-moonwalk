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
  diffContracts, formatMicroUsd, type ContractDiff,
  installModule, previewInstall, FIRST_PARTY_REGISTRY, type ModuleEntry, type InstallPreview,
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
let pinnedV4IsFile = false; // was the pinned source a real on-disk file (vs a fetched/connected untitled doc)?
function activeV4Source(): string | null {
  const ed = vscode.window.activeTextEditor;
  if (ed && SUPPORTED.has(ed.document.languageId)) {
    const text = ed.document.getText();
    if (isV4Source(text)) { pinnedV4Source = text; pinnedV4IsFile = ed.document.uri.scheme === "file"; return text; }
  }
  return pinnedV4Source;
}
/**
 * The LOCAL authored contract for a drift check — must be a real on-disk FILE, never a fetched/connected
 * (untitled) doc. Otherwise "Diff vs env" right after "Connect" would compare the deployed contract against
 * itself and falsely report "in sync".
 */
function localContractSource(): string | null {
  const ed = vscode.window.activeTextEditor;
  if (ed && ed.document.uri.scheme === "file" && SUPPORTED.has(ed.document.languageId)) {
    const text = ed.document.getText();
    if (isV4Source(text)) return text;
  }
  return pinnedV4IsFile ? pinnedV4Source : null;
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

// ── Environments (OBSERVE side, C020) ─────────────────────────────────────────────────────────────────
// An environment is just a base URL whose live Worker serves /openapi.json, /cost, /api/health, /superadmin,
// /scalar. The extension is a read-only CLIENT of these — it never holds credentials and never mutates prod
// (writing to prod is a deploy, in your terminal). "Connect" loads the live contract into the cockpit; "Diff"
// compares your LOCAL contract against the deployed one (the free "what's drifted in prod" view).
interface SulukEnv { name: string; baseUrl: string; }
const DEFAULT_ENVS: SulukEnv[] = [
  { name: "prod", baseUrl: "https://saasuluk.saastemly.com" },
  { name: "local", baseUrl: "http://localhost:8787" },
];
type Health = "ok" | "down" | "checking";

async function fetchText(url: string, ms = 7000): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (Number(res.headers.get("content-length") ?? 0) > 16_000_000) throw new Error("response too large (> 16 MB)");
    return await res.text();
  } finally { clearTimeout(timer); }
}
async function fetchJson(url: string, ms = 7000): Promise<unknown> { return JSON.parse(await fetchText(url, ms)); }

class EnvironmentsProvider implements vscode.TreeDataProvider<SulukEnv> {
  private readonly _onDidChange = new vscode.EventEmitter<SulukEnv | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  private readonly health = new Map<string, Health>();
  constructor(private readonly ctx: vscode.ExtensionContext) {}

  list(): SulukEnv[] { return this.ctx.workspaceState.get<SulukEnv[]>("suluk.environments", DEFAULT_ENVS); }
  async save(envs: SulukEnv[]): Promise<void> { await this.ctx.workspaceState.update("suluk.environments", envs); this.refresh(); }
  refresh(): void { this._onDidChange.fire(); }

  /** Probe each environment's /api/health and recolour its dot. Never throws. */
  async checkAll(): Promise<void> {
    const envs = this.list();
    for (const e of envs) this.health.set(e.baseUrl, "checking");
    this.refresh();
    await Promise.all(envs.map(async (e) => {
      try { await fetchJson(`${e.baseUrl}/api/health`, 5000); this.health.set(e.baseUrl, "ok"); }
      catch { this.health.set(e.baseUrl, "down"); }
    }));
    this.refresh();
  }

  getTreeItem(env: SulukEnv): vscode.TreeItem {
    const ti = new vscode.TreeItem(env.name, vscode.TreeItemCollapsibleState.None);
    const h = this.health.get(env.baseUrl);
    ti.description = env.baseUrl;
    ti.tooltip = `${env.baseUrl}\nClick to connect (load the live contract into the cockpit).${h && h !== "checking" ? `\nHealth: ${h}` : ""}`;
    ti.iconPath = h === "ok"
      ? new vscode.ThemeIcon("circle-filled", new vscode.ThemeColor("charts.green"))
      : h === "down"
        ? new vscode.ThemeIcon("circle-outline", new vscode.ThemeColor("charts.red"))
        : new vscode.ThemeIcon("loading~spin");
    ti.contextValue = "suluk.env";
    ti.command = { command: "suluk.connectEnvironment", title: "Connect", arguments: [env] };
    return ti;
  }
  getChildren(): SulukEnv[] { return this.list(); }
}

// ── webview rendering (host-rendered HTML, no scripts → enableScripts stays off; all values escaped) ──
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}
function htmlPage(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<style>
 body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);padding:12px 18px;font-size:13px}
 h2{margin:0 0 4px;font-size:15px} .sum{color:var(--vscode-descriptionForeground);margin:0 0 14px}
 .g{margin:12px 0} .g h3{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--vscode-descriptionForeground)}
 .row{padding:2px 0} .k{font-family:var(--vscode-editor-font-family)} .d{color:var(--vscode-descriptionForeground);margin-left:8px}
 .add{color:var(--vscode-charts-green)} .rem{color:var(--vscode-charts-red)} .chg{color:var(--vscode-charts-yellow)}
 table{border-collapse:collapse} td{padding:2px 16px 2px 0} pre{white-space:pre-wrap}
</style></head><body><h2>${esc(title)}</h2>${body}</body></html>`;
}
function driftHtml(d: ContractDiff, env: SulukEnv): string {
  if (d.identical) return htmlPage(`Drift vs ${env.name}`, `<p class="sum">✓ in sync — your local contract matches what's deployed at ${esc(env.baseUrl)}.</p>`);
  const opGroup = (cls: string, title: string, rows: { name: string; tail: string }[]) =>
    rows.length ? `<div class="g"><h3 class="${cls}">${esc(title)}</h3>${rows.map((r) => `<div class="row"><span class="k ${cls}">${esc(r.name)}</span><span class="d">${esc(r.tail)}</span></div>`).join("")}</div>` : "";
  const schGroup = () => {
    const { added, removed, changed } = d.schemas;
    if (!added.length && !removed.length && !changed.length) return "";
    const line = (cls: string, sign: string, n: string) => `<div class="row"><span class="k ${cls}">${sign} ${esc(n)}</span></div>`;
    return `<div class="g"><h3>schemas</h3>${added.map((s) => line("add", "+", s)).join("")}${removed.map((s) => line("rem", "−", s)).join("")}${changed.map((s) => line("chg", "~", s)).join("")}</div>`;
  };
  const body = `<p class="sum">${esc(d.summary)} — local (your contract) vs deployed (${esc(env.name)})</p>`
    + opGroup("add", "added — authored locally, not yet deployed", d.operations.added.map((o) => ({ name: o.name, tail: o.detail })))
    + opGroup("rem", "removed — deleted locally, still live in prod", d.operations.removed.map((o) => ({ name: o.name, tail: o.detail })))
    + opGroup("chg", "changed — drift between local and deployed", d.operations.changed.map((o) => ({ name: o.name, tail: o.changes.join(" · ") })))
    + schGroup();
  return htmlPage(`Drift vs ${env.name}`, body);
}
function costHtml(data: unknown, env: SulukEnv): string {
  const d = data as { total?: number; byPrincipal?: Record<string, number>; byAction?: Record<string, number>; bySource?: Record<string, number> };
  const money = (v: unknown): string => { const n = Number(v); return Number.isFinite(n) ? formatMicroUsd(n) : "—"; };
  if (d && Number.isFinite(d.total)) {
    const tbl = (label: string, obj?: Record<string, number>) =>
      obj && Object.keys(obj).length ? `<div class="g"><h3>${esc(label)}</h3><table>${Object.entries(obj).map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(money(v))}</td></tr>`).join("")}</table></div>` : "";
    const body = `<p class="sum">live metered spend at ${esc(env.baseUrl)}/cost</p>`
      + `<div class="g"><h3>total</h3><div class="row k">${esc(money(d.total))}</div></div>`
      + tbl("by principal", d.byPrincipal) + tbl("by action", d.byAction) + tbl("by source", d.bySource);
    return htmlPage(`Cost — ${env.name}`, body);
  }
  return htmlPage(`Cost — ${env.name}`, `<p class="sum">live /cost response from ${esc(env.baseUrl)}</p><pre class="k">${esc(JSON.stringify(data, null, 2))}</pre>`);
}
function modulePreviewHtml(entry: ModuleEntry, p: InstallPreview): string {
  const gradeCls = p.grade.grade === "A" ? "add" : p.grade.grade === "B" ? "chg" : "rem";
  const list = (cls: string, title: string, items: string[]) =>
    items.length ? `<div class="g"><h3 class="${cls === "d" ? "" : cls}">${esc(title)}</h3>${items.map((i) => `<div class="row"><span class="k ${cls === "d" ? "d" : cls}">${esc(i)}</span></div>`).join("")}</div>` : "";
  const body = `<p class="sum">${esc(entry.description)}<br><span class="${gradeCls}">grade ${esc(p.grade.grade)}</span>${p.grade.notes.length ? ` · ${esc(p.grade.notes.join(" · "))}` : " · every operation costed, no documentation warnings"}</p>`
    + (p.willInstall ? "" : `<div class="g"><h3 class="rem">cannot install yet</h3>${p.conflicts.map((c) => `<div class="row rem">• ${esc(c)}</div>`).join("")}</div>`)
    + list("rem", "requires (missing — install its provider first)", p.missingRequires)
    + list("d", "requires", p.requires.filter((r) => !p.missingRequires.includes(r)))
    + list("add", `adds ${p.addsSchemas.length} entities`, p.addsSchemas)
    + list("add", `adds ${p.addsOperations.length} operations`, p.addsOperations)
    + (p.cost.length ? `<div class="g"><h3>declared cost</h3><table>${p.cost.map((c) => `<tr><td class="k">${esc(c.operation)}</td><td>${esc(formatMicroUsd(c.estimateMicroUsd))}</td></tr>`).join("")}</table></div>` : "");
  return htmlPage(`${entry.module.name} — install preview`, body);
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
  const envs = new EnvironmentsProvider(context);
  context.subscriptions.push(
    collection,
    vscode.window.registerTreeDataProvider("suluk.cycle", cycle),
    vscode.window.registerTreeDataProvider("suluk.builder", builder),
    vscode.window.registerTreeDataProvider("suluk.environments", envs),
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

  // ── Environments (OBSERVE) commands ──
  const pickEnv = async (): Promise<SulukEnv | undefined> => {
    const items = envs.list().map((e) => ({ label: e.name, description: e.baseUrl, env: e }));
    if (!items.length) { void vscode.window.showWarningMessage("Suluk: no environments configured — add one first."); return undefined; }
    return (await vscode.window.showQuickPick(items, { placeHolder: "Environment" }))?.env;
  };
  reg("suluk.refreshEnvironments", () => void envs.checkAll());
  reg("suluk.addEnvironment", async () => {
    const name = await vscode.window.showInputBox({ prompt: "Environment name", placeHolder: "staging" });
    if (!name) return;
    const baseUrl = await vscode.window.showInputBox({ prompt: "Base URL of the deployed Worker", placeHolder: "https://staging.example.com", value: "https://" });
    if (!baseUrl || baseUrl === "https://") return;
    await envs.save([...envs.list(), { name, baseUrl: baseUrl.replace(/\/+$/, "") }]);
    void envs.checkAll();
  });
  reg("suluk.removeEnvironment", async (env?: SulukEnv) => {
    env = env ?? await pickEnv(); if (!env) return;
    let dropped = false; // drop only ONE matching entry, not every env that happens to share a baseUrl
    await envs.save(envs.list().filter((e) => {
      if (!dropped && e.name === env!.name && e.baseUrl === env!.baseUrl) { dropped = true; return false; }
      return true;
    }));
  });
  // Connect = load the live contract into the cockpit (the trees re-project against what's deployed).
  reg("suluk.connectEnvironment", async (env?: SulukEnv) => {
    env = env ?? await pickEnv(); if (!env) return;
    try {
      const text = await fetchText(`${env.baseUrl}/openapi.json`);
      const doc = await vscode.workspace.openTextDocument({ content: text, language: "json" });
      await vscode.window.showTextDocument(doc);
      cycle.refresh(); builder.refresh();
      if (!isV4Source(text)) void vscode.window.showWarningMessage(`Suluk: ${env.baseUrl}/openapi.json loaded but doesn't look like v4.`);
      else void vscode.window.showInformationMessage(`Suluk: connected to ${env.name} — the cockpit now projects the live contract from ${env.baseUrl}.`);
    } catch (e) { void vscode.window.showErrorMessage(`Suluk: couldn't reach ${env.baseUrl}/openapi.json — ${(e as Error).message}`); }
  });
  // Diff = compare your LOCAL contract against the DEPLOYED one (the free "what's drifted in prod" view).
  reg("suluk.diffEnvironment", async (env?: SulukEnv) => {
    env = env ?? await pickEnv(); if (!env) return;
    const local = localContractSource();
    if (!local) { void vscode.window.showWarningMessage("Suluk: open your local contract FILE first (a saved .yaml/.json) — a connected/fetched doc can't be the local side of a drift check."); return; }
    try {
      const deployed = await fetchText(`${env.baseUrl}/openapi.json`);
      if (!isV4Source(deployed)) { void vscode.window.showErrorMessage(`Suluk: ${env.baseUrl}/openapi.json did not return a v4 contract.`); return; }
      const diff = diffContracts(parseDocument(local), parseDocument(deployed));
      const panel = vscode.window.createWebviewPanel("suluk.drift", `Suluk — drift vs ${env.name}`, vscode.ViewColumn.Beside, {});
      panel.webview.html = driftHtml(diff, env);
    } catch (e) { void vscode.window.showErrorMessage(`Suluk: drift check vs ${env.name} failed — ${(e as Error).message}`); }
  });
  reg("suluk.openCostLedger", async (env?: SulukEnv) => {
    env = env ?? await pickEnv(); if (!env) return;
    try {
      const data = await fetchJson(`${env.baseUrl}/cost`);
      const panel = vscode.window.createWebviewPanel("suluk.cost", `Suluk — cost (${env.name})`, vscode.ViewColumn.Beside, {});
      panel.webview.html = costHtml(data, env);
    } catch (e) { void vscode.window.showErrorMessage(`Suluk: couldn't read ${env.baseUrl}/cost — ${(e as Error).message}`); }
  });
  // OBSERVE/operate surfaces live in the browser (the no-creds charter), not reimplemented in the extension.
  reg("suluk.openLiveApp", async (env?: SulukEnv) => { env = env ?? await pickEnv(); if (env) void vscode.env.openExternal(vscode.Uri.parse(env.baseUrl)); });
  reg("suluk.openSuperadmin", async (env?: SulukEnv) => { env = env ?? await pickEnv(); if (env) void vscode.env.openExternal(vscode.Uri.parse(`${env.baseUrl}/superadmin`)); });
  reg("suluk.openScalarLive", async (env?: SulukEnv) => { env = env ?? await pickEnv(); if (env) void vscode.env.openExternal(vscode.Uri.parse(`${env.baseUrl}/scalar`)); });
  void envs.checkAll(); // initial health probe

  // ── Modules (C021 / M2): browse the curated registry → PREVIEW (contract-diff + grade) → install ──
  reg("suluk.installModule", async () => {
    const local = activeV4Source();
    if (!local) { void vscode.window.showWarningMessage("Suluk: open your v4 contract first, then install a module into it."); return; }
    const doc = parseDocument(local);
    const pick = await vscode.window.showQuickPick(
      FIRST_PARTY_REGISTRY.modules.map((e) => ({ label: `$(package) ${e.module.name}`, description: `grade ${previewInstall(doc, e.module).grade.grade}`, detail: e.description, entry: e })),
      { placeHolder: `Browse ${FIRST_PARTY_REGISTRY.name} — preview before installing`, matchOnDescription: true },
    );
    if (!pick) return;
    const entry = pick.entry;
    try {
      const preview = previewInstall(doc, entry.module);
      // always show the contract-diff-on-install preview (what it adds, requires, grade, conflicts)
      const panel = vscode.window.createWebviewPanel("suluk.modulePreview", `Suluk — ${entry.module.name}`, vscode.ViewColumn.Beside, {});
      panel.webview.html = modulePreviewHtml(entry, preview);
      if (!preview.willInstall) {
        void vscode.window.showWarningMessage(`Suluk: ${entry.module.name} can't be installed into this contract yet — ${preview.missingRequires.length ? `it needs ${preview.missingRequires.join(", ")}` : "see the preview for the conflicts"}.`);
        return;
      }
      const choice = await vscode.window.showInformationMessage(
        `Install ${entry.module.name}? Adds ${preview.addsSchemas.length} entities + ${preview.addsOperations.length} operations · grade ${preview.grade.grade}.`,
        { modal: true }, "Install",
      );
      if (choice !== "Install") return;
      // re-read the live contract — the user may have edited/switched editors during the preview + modal
      const liveSource = activeV4Source();
      const result = installModule(parseDocument(liveSource ?? local), entry.module);
      if (!result.installed) { void vscode.window.showWarningMessage(`Suluk: ${entry.module.name} no longer installs cleanly (the document changed): ${result.conflicts[0] ?? "conflict"}.`); return; }
      const merged = await vscode.workspace.openTextDocument({ content: JSON.stringify(result.doc, null, 2), language: "json" });
      await vscode.window.showTextDocument(merged);
      cycle.refresh(); builder.refresh();
      void vscode.window.showInformationMessage(`Suluk: installed ${entry.module.name} — the cockpit now projects the merged contract.`);
    } catch (e) { void vscode.window.showErrorMessage(`Suluk: install of ${entry.module.name} failed — ${(e as Error).message}`); }
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
