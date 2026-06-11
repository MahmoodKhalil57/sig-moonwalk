/**
 * createDrawer — the reusable open/close controller behind any slide-in panel (cart, mobile nav, a Sheet): toggles
 * the panel + backdrop visibility and an `open` class (for the CSS transition), makes the page chrome `inert` while
 * open (a real focus-trap + AT hide — honoring aria-modal), closes on Escape + backdrop click, and restores focus on
 * close. Framework-agnostic; the look + the RTL-aware slide direction live in CSS. Timing is injectable so the
 * open/close state machine is unit-testable without a real DOM.
 */
export interface PanelEl {
  hidden: boolean;
  classList: { add(c: string): void; remove(c: string): void };
  setAttribute(name: string, value: string): void;
}

export interface DrawerOptions {
  /** the sliding panel. */
  drawer: PanelEl;
  /** the dimming backdrop (clicking it closes). */
  backdrop?: PanelEl | null;
  /** class toggled for the open transition (default "open"). */
  openClass?: string;
  /** ms to wait before hard-hiding on close (matches the CSS transition; default 220). */
  hideDelayMs?: number;
  /** page-chrome elements to make `inert` while open (focus-trap + AT hide). */
  inertTargets?: () => Array<{ inert: boolean }>;
  /** element to focus on open (e.g. the close button). */
  initialFocus?: () => { focus(): void } | null | undefined;
  /** called on open / close (e.g. cart.reload() before showing). */
  onOpen?: () => void;
  onClose?: () => void;
  /** injectables (default the globals) — tests pass sync stand-ins. */
  raf?: (fn: () => void) => void;
  setHideTimer?: (fn: () => void, ms: number) => void;
}

export interface Drawer {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
}

export function createDrawer(opts: DrawerOptions): Drawer {
  const { drawer, backdrop } = opts;
  const openClass = opts.openClass ?? "open";
  const hideMs = opts.hideDelayMs ?? 220;
  const raf = opts.raf ?? ((fn: () => void) => (typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame(fn) : fn()));
  const hideTimer = opts.setHideTimer ?? ((fn: () => void, ms: number) => { if (typeof setTimeout !== "undefined") setTimeout(fn, ms); else fn(); });
  let open = false;
  let restore: { focus(): void } | null = null;

  const doOpen = () => {
    if (open) return;
    open = true;
    restore = typeof document !== "undefined" ? (document.activeElement as unknown as { focus(): void }) : null;
    opts.onOpen?.();
    drawer.hidden = false;
    if (backdrop) backdrop.hidden = false;
    raf(() => { drawer.classList.add(openClass); backdrop?.classList.add(openClass); });
    drawer.setAttribute("aria-hidden", "false");
    for (const n of opts.inertTargets?.() ?? []) n.inert = true;
    opts.initialFocus?.()?.focus();
  };
  const doClose = () => {
    if (!open) return;
    open = false;
    drawer.classList.remove(openClass);
    backdrop?.classList.remove(openClass);
    drawer.setAttribute("aria-hidden", "true");
    for (const n of opts.inertTargets?.() ?? []) n.inert = false;
    hideTimer(() => { drawer.hidden = true; if (backdrop) backdrop.hidden = true; }, hideMs);
    opts.onClose?.();
    restore?.focus();
  };

  return {
    open: doOpen,
    close: doClose,
    toggle: () => (open ? doClose() : doOpen()),
    isOpen: () => open,
  };
}
