/**
 * The verify-once GATE input: render ONE primitive in isolation as a standalone HTML page, so a screenshot
 * tool (Playwright, etc.) can capture its golden pixels exactly once. The flow is:
 *   renderPrimitiveHtml(widget)  →  screenshot → snapshotHash(bytes)  →  approve([{key, contentHash, snapshotHash}])
 * After that, checkConfidence trusts the primitive (at that content hash) forever — no re-screenshotting.
 */

const CONTROLS: Record<string, string> = {
  text: `<input class="ctl" type="text" value="Sample" />`,
  email: `<input class="ctl" type="email" value="a@b.com" />`,
  url: `<input class="ctl" type="url" value="https://x.com" />`,
  number: `<input class="ctl" type="number" value="42" />`,
  date: `<input class="ctl" type="date" />`,
  textarea: `<textarea class="ctl">Sample text</textarea>`,
  switch: `<label class="sw"><input type="checkbox" checked /><span>on</span></label>`,
  checkbox: `<input type="checkbox" checked />`,
  select: `<select class="ctl"><option>available</option><option>pending</option><option>sold</option></select>`,
};

const DEFAULT_CSS = `
body{margin:0;font:14px ui-sans-serif,system-ui;background:#fff;color:#0b0e14}
#primitive{padding:16px;display:inline-block}
.ctl{border:1px solid #cbd5e1;border-radius:6px;padding:6px 9px;min-width:200px}
.sw{display:inline-flex;gap:6px;align-items:center}`;

/** A self-contained HTML page that renders exactly one primitive — the thing you screenshot to approve it. */
export function renderPrimitiveHtml(opts: { widget: string; css?: string }): string {
  const control = CONTROLS[opts.widget] ?? `<div class="ctl">${opts.widget}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${opts.css ?? DEFAULT_CSS}</style></head>` +
    `<body><div id="primitive" data-widget="${opts.widget}">${control}</div></body></html>`;
}

/** The widget primitives this package knows how to render in isolation (for the verify-once gate). */
export function knownWidgets(): string[] {
  return Object.keys(CONTROLS);
}

/** Just the control fragment (no surrounding page) — for an inline preview in a host UI (the cockpit webview). */
export function primitiveControl(widget: string): string {
  return CONTROLS[widget] ?? `<div class="ctl">${widget}</div>`;
}

/** A small stylesheet for the control fragments above — so a host can render `primitiveControl` inline. */
export function primitiveCss(): string {
  return DEFAULT_CSS;
}
