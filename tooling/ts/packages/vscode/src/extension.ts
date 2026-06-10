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
import { deflateSync } from "node:zlib";
import {
  validateSource, auditSource, previewHtml, looksLikeV4, type Diagnostic,
  buildCycle, type CycleModel, type CycleLayer, type CycleItem, type LayerStatus,
  entityNames, generateForm, generateTable, generateStoresModule, exportV4Json,
  buildBuilderModel, generateAppFiles, generateRegistryJson, type BuilderNode,
  deployPlan, deployMarkdown,
  diffContracts, formatMicroUsd, type ContractDiff,
  installModule, previewInstall, FIRST_PARTY_REGISTRY, type ModuleEntry, type InstallPreview,
  crossCut, defaultViewers, type CrossCut,
  convergeContract, type ConvergeReport,
  contractToD2, diagramViews, type DiagramView,
  componentReport, approveComponents, primitiveCss, type ComponentReport, type Baseline,
  PROVIDER_CATALOG, readProviders, swapProvider,
  parseRegistry, type RegistrySource,
  verifyRegistrySignature, isSignedEnvelope, generateSigningKeypair, signRegistry,
  composeModules, STACK_TEMPLATES, resolveTemplate, type ComposeResult, type StackTemplate,
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
let connectedEnvName: string | null = null; // the environment whose live contract was last connected
let connectedDocUri: string | null = null; // the document that holds that fetched contract
/** The env label ONLY while the active editor is the connected env's fetched contract — else null, so the lens
 *  and cross-cut header never claim a live environment while the cockpit is actually projecting a local file. */
function activeEnvName(): string | null {
  if (!connectedEnvName || !connectedDocUri) return null;
  return vscode.window.activeTextEditor?.document.uri.toString() === connectedDocUri ? connectedEnvName : null;
}
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
    case "providers": return { command: "suluk.swapProvider", title: `Swap the ${ref} provider`, arguments: [ref] };
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
  const CAP = 16_000_000;
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (Number(res.headers.get("content-length") ?? 0) > CAP) throw new Error("response too large (> 16 MB)");
    if (!res.body) return await res.text();
    // enforce the cap on BYTES ACTUALLY READ — a hostile server can omit content-length and stream forever
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "", total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > CAP) { ctl.abort(); throw new Error("response too large (> 16 MB)"); }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
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
// codicons ($(id)) render inside QuickPick/Tree labels — neutralize them in UNTRUSTED text (e.g. a remote
// module's name) so a hostile registry can't forge the $(verified) first-party trust badge in the picker.
function safeLabel(s: string): string {
  return s.replace(/\$\(/g, "\\$(");
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
 th{text-align:left;padding:3px 14px 3px 0;font-weight:600;color:var(--vscode-descriptionForeground)}
 .matrix td{padding:3px 16px 3px 0;text-align:center} .matrix td:first-child,.matrix th:first-child{text-align:left}
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
    + schGroup()
    + ((d.providers.added.length || d.providers.removed.length || d.providers.changed.length)
        ? `<div class="g"><h3>providers</h3>`
          + d.providers.added.map((p) => `<div class="row"><span class="k add">+ ${esc(p.facet)}</span><span class="d">${esc(p.impl)} (not deployed)</span></div>`).join("")
          + d.providers.removed.map((p) => `<div class="row"><span class="k rem">− ${esc(p.facet)}</span><span class="d">${esc(p.impl)} (live, not local)</span></div>`).join("")
          + d.providers.changed.map((p) => `<div class="row"><span class="k chg">~ ${esc(p.facet)}</span><span class="d">${esc(p.from)} → ${esc(p.to)}</span></div>`).join("")
          + `</div>`
        : "");
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
function crossCutHtml(cc: CrossCut, envName: string | null): string {
  const head = `<tr><th>operation</th>${cc.viewers.map((v) => `<th>${esc(v.label)}</th>`).join("")}</tr>`;
  const rows = cc.operations.map((o) => {
    const cells = cc.viewers.map((v) => (v.visible.includes(o.name) ? `<td class="add">✓</td>` : `<td class="d">·</td>`)).join("");
    return `<tr><td><span class="k">${esc(o.name)}</span><span class="d">${esc(o.detail)}</span></td>${cells}</tr>`;
  }).join("");
  const body = `<p class="sum">one contract${envName ? ` (deployed at ${esc(envName)})` : ""} — ${cc.operations.length} operations × ${cc.viewers.length} viewers · ${cc.gated.length} scope-gated. ✓ = this viewer can call it.</p>`
    + `<table class="matrix">${head}${rows}</table>`
    + (cc.gated.length ? `<div class="g"><h3>gated operations</h3>${cc.gated.map((g) => `<div class="row"><span class="k chg">${esc(g.operation)}</span><span class="d">${esc(g.detail)} — needs [${esc(g.requiredScopes.map((r) => r.join("+")).join(" | "))}], visible to ${esc(g.visibleTo.join(", "))}</span></div>`).join("")}</div>` : "");
  return htmlPage("View-as cross-cut", body);
}
function convergeBody(report: ConvergeReport): string {
  if (report.clean && !report.findings.length) return `<div class="row add">✓ converges clean — no coherence issues.</div>`;
  const cls = (sev: string) => (sev === "error" ? "rem" : sev === "warn" ? "chg" : "d");
  const group = (sev: "error" | "warn" | "info", title: string) => {
    const fs = report.findings.filter((f) => f.severity === sev);
    return fs.length ? `<div class="g"><h3 class="${sev === "info" ? "" : cls(sev)}">${esc(title)}</h3>${fs.map((f) => `<div class="row"><span class="k ${cls(sev)}">${esc(f.code)}</span><span class="d">${esc(f.message)}</span></div>`).join("")}</div>` : "";
  };
  return (report.clean ? `<div class="row add">✓ converges clean (no errors)</div>` : `<div class="row rem">✗ ${report.findings.filter((f) => f.severity === "error").length} contradiction(s)</div>`)
    + group("error", "contradictions") + group("warn", "warnings") + group("info", "notes");
}
/** Kroki renders D2 → SVG from a deflate+base64url-encoded source (constructed only; egress happens on click). */
function krokiD2Url(d2: string): string {
  try { return `https://kroki.io/d2/svg/${deflateSync(Buffer.from(d2, "utf8")).toString("base64url")}`; } catch { return ""; }
}
function diagramHtml(view: { id: DiagramView; title: string; description: string }, d2: string): string {
  const url = krokiD2Url(d2);
  const render = url ? ` Render it with the d2 CLI, the D2 VS Code extension, or <a href="${esc(url)}">kroki.io ↗</a> <span class="d">(sends the diagram to an external service)</span>.` : " Render it with the d2 CLI or the D2 VS Code extension.";
  return htmlPage(`${view.title} (D2)`, `<p class="sum">${esc(view.description)} — D2 source (d2lang.com).${render}</p><pre class="k">${esc(d2)}</pre>`);
}
function componentsHtml(report: ComponentReport): string {
  const c = report.confidence;
  const badge = (key: string) => c.approved.includes(key) ? '<span class="add">✓ confident</span>' : c.drifted.some((p) => p.key === key) ? '<span class="chg">~ drifted</span>' : '<span class="rem">? pending</span>';
  const summary = `${report.used.length} primitives · ${c.approved.length} confident · ${c.drifted.length} drifted · ${c.missing.length} pending · coverage ${Math.round(report.coverage * 100)}%`;
  // preview is first-party control markup from @suluk/visual (a fixed widget set) — safe to embed raw
  const prims = report.used.map((p) => `<div class="g"><div class="row"><span class="k">${esc(p.label ?? p.key)}</span> ${badge(p.key)}</div>${report.preview[p.key] ? `<div style="padding:6px 0">${report.preview[p.key]}</div>` : ""}</div>`).join("");
  const ents = report.entities.map((e) => `<div class="row"><span class="k">${esc(e.name)}</span><span class="d">form ${e.form.length} · table ${e.table.length}</span></div>`).join("");
  const body = `<style>${primitiveCss()}</style><p class="sum">${esc(summary)} — verify each primitive ONCE; confidence is then decided by content-hash, no re-screenshotting.</p><div class="g"><h3>primitives</h3>${prims}</div><div class="g"><h3>entities (form/table)</h3>${ents}</div>`;
  return htmlPage("Component pixel-confidence", body);
}
function convergeHtml(report: ConvergeReport): string {
  return htmlPage("Contract converge", `<p class="sum">a coherence audit over the whole contract — the contradictions a clean merge can still leave behind.</p>${convergeBody(report)}`);
}
function composeHtml(template: StackTemplate, r: ComposeResult): string {
  const stepRow = (s: ComposeResult["steps"][number]) =>
    `<div class="row"><span class="k ${s.installed ? "add" : "rem"}">${s.installed ? "✓" : "✗"} ${esc(s.module)}</span><span class="d">${s.installed ? `+${s.added.schemas.length} entities · +${s.added.operations.length} operations` : esc(s.conflicts[0] ?? "failed")}</span></div>`;
  const order = r.plan.order.map((m) => m.name);
  const installed = r.steps.filter((s) => s.installed).length;
  const body = `<p class="sum">${esc(template.description)} — install order (${order.length} module${order.length === 1 ? "" : "s"}): ${esc(order.join(" → ")) || "(none)"}.</p>`
    + (r.plan.unmet.length ? `<div class="g"><h3 class="rem">unmet requirements</h3>${r.plan.unmet.map((u) => `<div class="row rem">${esc(u.module)} needs <span class="k">${esc(u.requires)}</span> — add a module that provides it</div>`).join("")}</div>` : "")
    + (r.plan.collisions.length ? `<div class="g"><h3 class="rem">collisions</h3>${r.plan.collisions.map((c) => `<div class="row rem">${esc(c)}</div>`).join("")}</div>` : "")
    + (r.plan.unresolved.length ? `<div class="g"><h3 class="rem">could not be ordered</h3><div class="row rem">${esc(r.plan.unresolved.join(", "))} require each other (or sit behind a cycle)</div></div>` : "")
    + `<div class="g"><h3>install steps (${installed}/${r.steps.length})</h3>${r.steps.map(stepRow).join("") || '<div class="row d">nothing orderable — see above</div>'}</div>`
    + (r.ok ? `<div class="g"><h3 class="add">✓ composed</h3><div class="row">${Object.keys(r.doc.components?.schemas ?? {}).length} entities · ${Object.values(r.doc.paths ?? {}).reduce((n, pi) => n + Object.keys((pi as { requests?: object }).requests ?? {}).length, 0)} operations in the platform contract</div></div>` : "")
    + (r.ok ? `<div class="g"><h3>coherence (converge)</h3>${convergeBody(convergeContract(r.doc))}</div>` : "");
  return htmlPage(`Compose — ${template.name}`, body);
}
function modulePreviewHtml(entry: ModuleEntry, p: InstallPreview, prov: { registry: string; trust: "first-party" | "signed" | "unsigned"; url?: string; publisher?: string }): string {
  const gradeCls = p.grade.grade === "A" ? "add" : p.grade.grade === "B" ? "chg" : "rem";
  const banner = prov.trust === "first-party"
    ? `<div class="row"><span class="k add">✓ ${esc(prov.registry)}</span><span class="d">first-party — reviewed</span></div>`
    : prov.trust === "signed"
      ? `<div class="row"><span class="k add">✓ signed${prov.publisher ? ` by ${esc(prov.publisher)}` : ""}</span><span class="d">${esc(prov.registry)}${prov.url ? ` (${esc(prov.url)})` : ""} — signature verified against your pinned key</span></div>`
      : `<div class="g"><h3 class="rem">⚠ third-party module (unverified)</h3><div class="row rem">From <span class="k">${esc(prov.registry)}</span>${prov.url ? ` (${esc(prov.url)})` : ""}. It will merge the entities + operations below into your contract. Review them, then install — the merge still refuses on any collision. Pin the publisher's key to verify provenance.</div></div>`;
  const list = (cls: string, title: string, items: string[]) =>
    items.length ? `<div class="g"><h3 class="${cls === "d" ? "" : cls}">${esc(title)}</h3>${items.map((i) => `<div class="row"><span class="k ${cls === "d" ? "d" : cls}">${esc(i)}</span></div>`).join("")}</div>` : "";
  const body = `<p class="sum">${esc(entry.description)}<br><span class="${gradeCls}">grade ${esc(p.grade.grade)}</span>${p.grade.notes.length ? ` · ${esc(p.grade.notes.join(" · "))}` : " · every operation costed, no documentation warnings"}</p>`
    + banner
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

  // ── the LENS (M1): a status-bar indicator of the active {environment · viewer} the cockpit is projecting ──
  const lens = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  lens.command = "suluk.viewAs";
  context.subscriptions.push(lens);
  const updateLens = () => {
    if (!activeV4Source()) { lens.hide(); return; }
    const who = cycle.viewLabel();
    const env = activeEnvName();
    lens.text = `$(eye) Suluk: ${env ? `${env} · ` : ""}as ${who}`;
    lens.tooltip = `The cockpit is projecting every layer for the "${who}" viewer${env ? ` against the ${env} environment` : ""}.\nClick to change viewer (View as scopes); use "Compare viewers" for the full cross-cut.`;
    lens.show();
  };

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
    updateLens();
    void vscode.window.showInformationMessage(`Suluk: viewing as ${cycle.viewLabel()}.`);
  });

  // ── Compare viewers (M1): one contract refracted through every viewer — the scope-gated matrix (the moat) ──
  reg("suluk.compareViewers", () => {
    const src = activeV4Source();
    if (!src) { void vscode.window.showWarningMessage("Suluk: open a v4 contract first."); return; }
    try {
      const doc = parseDocument(src);
      const cc = crossCut(doc, defaultViewers(doc));
      const panel = vscode.window.createWebviewPanel("suluk.crossCut", "Suluk — View-as cross-cut", vscode.ViewColumn.Beside, {});
      panel.webview.html = crossCutHtml(cc, activeEnvName());
    } catch (e) { void vscode.window.showErrorMessage(`Suluk: ${(e as Error).message}`); }
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
  // component pixel-confidence (surfaces @suluk/visual): verify each primitive ONCE, then confidence is by hash
  const baselineUri = () => { const f = vscode.workspace.workspaceFolders?.[0]; return f ? vscode.Uri.joinPath(f.uri, "suluk-visual-baseline.json") : undefined; };
  const readBaseline = async (): Promise<Baseline> => {
    const uri = baselineUri(); if (!uri) return {};
    try { return JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(uri))) as Baseline; } catch { return {}; }
  };
  reg("suluk.previewComponents", async () => {
    const src = activeV4Source();
    if (!src) { void vscode.window.showWarningMessage("Suluk: open a v4 contract first."); return; }
    const baseline = await readBaseline();
    const report = componentReport(parseDocument(src), baseline);
    const panel = vscode.window.createWebviewPanel("suluk.components", "Suluk — component pixel-confidence", vscode.ViewColumn.Beside, {});
    panel.webview.html = componentsHtml(report);
    if (!report.used.length) return;
    if (report.confidence.confident) { void vscode.window.showInformationMessage("Suluk: components are pixel-confident ✓ — every primitive approved + unchanged."); return; }
    const pending = report.confidence.missing.length + report.confidence.drifted.length;
    const choice = await vscode.window.showInformationMessage(`Suluk: ${pending} component primitive(s) need a one-time pixel verification. Approve them now (after reviewing the preview)?`, "Approve all");
    if (choice !== "Approve all") return;
    const uri = baselineUri();
    if (!uri) { void vscode.window.showWarningMessage("Suluk: open a workspace folder to save the baseline."); return; }
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(JSON.stringify(approveComponents(report, baseline, Date.now()), null, 2)));
    void vscode.window.showInformationMessage("Suluk: approved — components are now pixel-confident. Commit suluk-visual-baseline.json so the team shares the verification.");
  });
  // converge: a coherence audit over the whole contract — the contradictions a clean merge can leave behind
  reg("suluk.convergeContract", () => {
    const src = activeV4Source();
    if (!src) { void vscode.window.showWarningMessage("Suluk: open a v4 contract first."); return; }
    try {
      const report = convergeContract(parseDocument(src));
      const panel = vscode.window.createWebviewPanel("suluk.converge", "Suluk — contract converge", vscode.ViewColumn.Beside, {});
      panel.webview.html = convergeHtml(report);
      const errs = report.findings.filter((f) => f.severity === "error").length;
      void vscode.window.showInformationMessage(errs ? `Suluk: ${errs} contradiction(s) — see the converge panel.` : "Suluk: contract converges clean ✓");
    } catch (e) { void vscode.window.showErrorMessage(`Suluk: ${(e as Error).message}`); }
  });
  // diagrams (D2): another projection from the one contract — an ERD, the declarative cycle, the operation surface
  reg("suluk.generateDiagram", async () => {
    const src = activeV4Source();
    if (!src) { void vscode.window.showWarningMessage("Suluk: open a v4 contract first."); return; }
    const pick = await vscode.window.showQuickPick(diagramViews().map((v) => ({ label: v.title, detail: v.description, v })), { placeHolder: "Generate a D2 diagram of…" });
    if (!pick) return;
    try {
      const d2 = contractToD2(parseDocument(src), pick.v.id);
      await openGenerated(d2, "plaintext"); // the .d2 source — editable, savable as .d2
      const panel = vscode.window.createWebviewPanel("suluk.diagram", `Suluk — ${pick.v.title} (D2)`, vscode.ViewColumn.Beside, {});
      panel.webview.html = diagramHtml(pick.v, d2);
    } catch (e) { void vscode.window.showErrorMessage(`Suluk: ${(e as Error).message}`); }
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
    if (env.name === connectedEnvName) { connectedEnvName = null; connectedDocUri = null; updateLens(); }
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
      connectedEnvName = env.name;
      connectedDocUri = doc.uri.toString();
      cycle.refresh(); builder.refresh(); updateLens();
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

  // ── Modules (C021 / M2 / L1): browse a registry (first-party OR a remote URL) → PREVIEW (contract-diff +
  // grade + provenance) → install through the refuse-on-collision gate. Remote registries are UNTRUSTED. ──
  interface ResolvedReg { name: string; modules: ModuleEntry[]; trust: "first-party" | "signed" | "unsigned"; url?: string; publisher?: string }
  const addRegistryFlow = async (): Promise<RegistrySource | undefined> => {
    const url = await vscode.window.showInputBox({ prompt: "Registry URL — a JSON ModuleRegistry (or a { registry, signature } envelope)", placeHolder: "https://example.com/suluk-registry.json", value: "https://" });
    if (!url || url === "https://") return undefined;
    const name = (await vscode.window.showInputBox({ prompt: "A name for this registry", value: url.replace(/^https?:\/\//, "").split("/")[0] })) || url;
    const keyJson = await vscode.window.showInputBox({ prompt: "Pin the publisher's public key (JWK) to verify the signature — leave blank for an unsigned registry", placeHolder: '{"kty":"EC","crv":"P-256",...}' });
    let publicKey: JsonWebKey | undefined;
    if (keyJson && keyJson.trim()) { try { publicKey = JSON.parse(keyJson) as JsonWebKey; } catch { void vscode.window.showWarningMessage("Suluk: the pinned key wasn't valid JSON — saving the registry without signature verification."); } }
    const src: RegistrySource = { name, url: url.replace(/\/+$/, ""), publicKey };
    const list = context.workspaceState.get<RegistrySource[]>("suluk.registries", []);
    await context.workspaceState.update("suluk.registries", [...list.filter((r) => r.url !== src.url), src]);
    return src;
  };
  const resolveRemote = async (s: RegistrySource): Promise<ResolvedReg | undefined> => {
    try {
      const payload: unknown = await fetchJson(s.url);
      let registryValue: unknown = payload;
      let trust: "signed" | "unsigned" = "unsigned";
      let publisher: string | undefined;
      if (isSignedEnvelope(payload)) {
        registryValue = payload.registry;
        publisher = payload.publisher;
        if (s.publicKey) {
          if (!(await verifyRegistrySignature(payload.registry, payload.signature, s.publicKey))) {
            void vscode.window.showErrorMessage(`Suluk: ${s.name} — SIGNATURE INVALID (tampered, or signed by a different key). Refusing to load it.`);
            return undefined;
          }
          trust = "signed";
        } else {
          void vscode.window.showWarningMessage(`Suluk: ${s.name} is signed but you pinned no public key — treating it as unverified. Re-add it with the publisher's key to verify.`);
        }
      }
      const parsed = parseRegistry(registryValue); // validate the UNTRUSTED payload, rejecting malformed entries
      if (parsed.rejected.length) void vscode.window.showWarningMessage(`Suluk: ${parsed.name} — ${parsed.rejected.length} module(s) rejected as malformed (${parsed.rejected.map((r) => r.title).join(", ")}).`);
      return { name: parsed.name, modules: parsed.modules, trust, url: s.url, publisher };
    } catch (e) { void vscode.window.showErrorMessage(`Suluk: couldn't load registry ${s.url} — ${(e as Error).message}`); return undefined; }
  };
  reg("suluk.addRegistry", async () => { const s = await addRegistryFlow(); if (s) void vscode.window.showInformationMessage(`Suluk: added registry "${s.name}"${s.publicKey ? " (signature-verified)" : ""}. Browse modules to install from it.`); });
  // publisher tool: sign the active ModuleRegistry → emit the { registry, signature } envelope + the public key to publish
  reg("suluk.signRegistry", async () => {
    const ed = vscode.window.activeTextEditor;
    if (!ed) { void vscode.window.showWarningMessage("Suluk: open a ModuleRegistry JSON ({ name, modules }) to sign."); return; }
    let registryValue: unknown;
    try { registryValue = JSON.parse(ed.document.getText()); } catch { void vscode.window.showErrorMessage("Suluk: the active document isn't valid JSON."); return; }
    const { publicKey, privateKey } = await generateSigningKeypair();
    const signature = await signRegistry(registryValue, privateKey);
    const out = {
      "// serve this envelope at your registry URL": "↓", signed: { registry: registryValue, signature, publisher: "me" },
      "// consumers pin THIS public key when adding your registry": "↓", publicKey,
      "// keep THIS private key secret — re-sign with it after every change": "↓", privateKey,
    };
    await openGenerated(JSON.stringify(out, null, 2), "json");
    void vscode.window.showInformationMessage("Suluk: signed. Serve the `signed` envelope at your URL; consumers pin `publicKey`. Keep the private key secret.");
  });
  reg("suluk.installModule", async () => {
    const local = activeV4Source();
    if (!local) { void vscode.window.showWarningMessage("Suluk: open your v4 contract first, then install a module into it."); return; }
    const doc = parseDocument(local);
    // 1. choose a registry source (first-party, a configured remote registry, or add a new URL)
    const registries = context.workspaceState.get<RegistrySource[]>("suluk.registries", []);
    type SrcItem = vscode.QuickPickItem & ({ srcKind: "fp" } | { srcKind: "remote"; src: RegistrySource } | { srcKind: "add" });
    const srcItems: SrcItem[] = [
      { label: "$(verified) Suluk first-party", detail: FIRST_PARTY_REGISTRY.name, srcKind: "fp" },
      ...registries.map((r): SrcItem => ({ label: `$(globe) ${safeLabel(r.name)}`, detail: r.url, srcKind: "remote", src: r })),
      { label: "$(add) Add a registry URL…", detail: "browse + install from a community / remote registry", srcKind: "add" },
    ];
    const srcPick = await vscode.window.showQuickPick(srcItems, { placeHolder: "Choose a module registry" });
    if (!srcPick) return;
    let resolved: ResolvedReg | undefined;
    if (srcPick.srcKind === "fp") resolved = { name: FIRST_PARTY_REGISTRY.name, modules: FIRST_PARTY_REGISTRY.modules, trust: "first-party" };
    else if (srcPick.srcKind === "remote") resolved = await resolveRemote(srcPick.src);
    else { const s = await addRegistryFlow(); if (!s) return; resolved = await resolveRemote(s); }
    if (!resolved) return;
    if (!resolved.modules.length) { void vscode.window.showWarningMessage(`Suluk: ${resolved.name} has no installable modules.`); return; }
    // 2. pick a module (grade in the list; a "remote" badge for untrusted sources). Names are codicon-sanitized
    //    (a hostile name can't forge $(verified)) and the grade is computed crash-safe (one bad entry ≠ dead list).
    const safeGrade = (e: ModuleEntry): string => { try { return previewInstall(doc, e.module).grade.grade; } catch { return "?"; } };
    const modPick = await vscode.window.showQuickPick(
      resolved.modules.map((e) => ({ label: `$(package) ${safeLabel(e.module.name)}`, description: `grade ${safeGrade(e)}${resolved!.trust === "first-party" ? "" : resolved!.trust === "signed" ? " · signed ✓" : " · remote"}`, detail: e.description, entry: e })),
      { placeHolder: `${resolved.name} — preview before installing`, matchOnDescription: true },
    );
    if (!modPick) return;
    const entry = modPick.entry;
    try {
      const preview = previewInstall(doc, entry.module);
      // 3. the trust gate — always show the contract-diff + grade + provenance before installing
      const panel = vscode.window.createWebviewPanel("suluk.modulePreview", `Suluk — ${entry.module.name}`, vscode.ViewColumn.Beside, {});
      panel.webview.html = modulePreviewHtml(entry, preview, { registry: resolved.name, trust: resolved.trust, url: resolved.url, publisher: resolved.publisher });
      if (!preview.willInstall) {
        void vscode.window.showWarningMessage(`Suluk: ${entry.module.name} can't be installed into this contract yet — ${preview.missingRequires.length ? `it needs ${preview.missingRequires.join(", ")}` : "see the preview for the conflicts"}.`);
        return;
      }
      const provenance = resolved.trust === "first-party" ? "" : resolved.trust === "signed" ? ` (signed${resolved.publisher ? ` by ${resolved.publisher}` : ""})` : ` from ${resolved.name} (third-party, unverified)`;
      const choice = await vscode.window.showInformationMessage(
        `Install ${entry.module.name}${provenance}? It merges ${preview.addsSchemas.length} entities + ${preview.addsOperations.length} operations into your contract · grade ${preview.grade.grade}.${resolved.trust === "unsigned" ? " Review the preview first." : ""}`,
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

  // ── Providers (M3): swap a facet binding (payments/auth/email/storage) for another impl of the same interface ──
  reg("suluk.swapProvider", async (facetArg?: string) => {
    const src = activeV4Source();
    if (!src) { void vscode.window.showWarningMessage("Suluk: open your v4 contract first."); return; }
    const doc = parseDocument(src);
    const bound = readProviders(doc);
    // choose the facet — from the clicked row, else from the facets the contract uses (else the whole catalog)
    let facet = facetArg;
    if (!facet) {
      const facets = bound.length ? bound.map((b) => b.facet) : Object.keys(PROVIDER_CATALOG);
      const pick = await vscode.window.showQuickPick(facets.map((f) => ({ label: f, description: bound.find((b) => b.facet === f)?.impl ?? "(unbound)" })), { placeHolder: "Which provider slot to swap?" });
      facet = pick?.label;
    }
    if (!facet) return;
    const impls = PROVIDER_CATALOG[facet];
    if (!impls) { void vscode.window.showWarningMessage(`Suluk: "${facet}" is not a known provider facet.`); return; }
    const current = bound.find((b) => b.facet === facet)?.impl;
    const chosen = await vscode.window.showQuickPick(
      impls.map((i) => ({ label: i.id === current ? `$(check) ${i.title}` : i.title, description: i.pkg ?? "", detail: i.description, id: i.id })),
      { placeHolder: `Bind ${facet} to… (current: ${current ?? "none"})`, matchOnDetail: true },
    );
    if (!chosen || chosen.id === current) return;
    // re-read the live contract — the user may have edited/switched editors during the pickers
    const liveDoc = parseDocument(activeV4Source() ?? src);
    const { doc: next, error } = swapProvider(liveDoc as unknown as Record<string, unknown>, facet, chosen.id);
    if (error) { void vscode.window.showErrorMessage(`Suluk: ${error}`); return; }
    const out = await vscode.workspace.openTextDocument({ content: JSON.stringify(next, null, 2), language: "json" });
    await vscode.window.showTextDocument(out);
    cycle.refresh(); builder.refresh();
    void vscode.window.showInformationMessage(`Suluk: bound ${facet} → ${chosen.id}. The contract is unchanged; only the runtime provider binding differs.`);
  });

  // ── Compose a platform (L2): the non-developer flow — pick a stack template → its modules install in
  //    dependency order → a whole working platform contract, no hand-wiring. ──
  reg("suluk.composePlatform", async () => {
    const pick = await vscode.window.showQuickPick(
      STACK_TEMPLATES.map((t) => ({ label: `$(layers) ${t.name}`, description: t.modules.join(" + "), detail: t.description, t })),
      { placeHolder: "Compose a platform from a stack template (creates a fresh contract)" },
    );
    if (!pick) return;
    const { modules, missing } = resolveTemplate(pick.t);
    if (missing.length) void vscode.window.showWarningMessage(`Suluk: template "${pick.t.name}" references unknown module(s): ${missing.join(", ")} — composing without them.`);
    const base = parseDocument(JSON.stringify({ openapi: "4.0.0-candidate", info: { title: pick.t.name, version: "0.1.0" }, paths: {}, components: { schemas: {} } }));
    const result = composeModules(base, modules);
    const panel = vscode.window.createWebviewPanel("suluk.compose", `Suluk — compose ${pick.t.name}`, vscode.ViewColumn.Beside, {});
    panel.webview.html = composeHtml(pick.t, result);
    if (!result.ok) { void vscode.window.showWarningMessage(`Suluk: "${pick.t.name}" couldn't fully compose — see the panel (an unmet requirement or a conflict).`); return; }
    const choice = await vscode.window.showInformationMessage(
      `Compose "${pick.t.name}"? ${result.steps.length} modules install in dependency order → ${Object.keys(result.doc.components?.schemas ?? {}).length} entities, no hand-wiring.`,
      { modal: true }, "Compose",
    );
    if (choice !== "Compose") return;
    const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(result.doc, null, 2), language: "json" });
    await vscode.window.showTextDocument(doc);
    cycle.refresh(); builder.refresh();
    void vscode.window.showInformationMessage(`Suluk: composed "${pick.t.name}" — the cockpit now projects the whole platform. A developer wires only the custom 20%.`);
  });

  const onChange = () => { cycle.refresh(); builder.refresh(); updateLens(); };
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => { refreshDiagnostics(doc, collection); onChange(); }),
    vscode.workspace.onDidSaveTextDocument((doc) => { refreshDiagnostics(doc, collection); onChange(); }),
    vscode.window.onDidChangeActiveTextEditor(onChange),
  );
  for (const doc of vscode.workspace.textDocuments) refreshDiagnostics(doc, collection);
  updateLens();
}

export function deactivate(): void { /* subscriptions disposed via context */ }
