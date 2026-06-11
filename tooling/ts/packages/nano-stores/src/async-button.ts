/**
 * asyncHandler / bindAsyncButton — promise-aware double-submit safety as a primitive, so builders write a normal
 * async handler and get race-safety for free instead of hand-rolling `btn.disabled = true; try {...} finally {...}`
 * on every form (saastarter parity: "every async action auto-disables its trigger + shows pending"). Wraps a
 * handler so the element is disabled + aria-busy (+ an optional pending label) for the in-flight window and
 * restored on settle, with a re-entry guard. Framework-agnostic; works on any element-like with disabled/textContent.
 */
export interface AsyncBindOptions {
  /** text to show while in-flight (restored after). */
  pendingLabel?: string;
  /** set aria-busy="true" during the call (default true). */
  ariaBusy?: boolean;
}

interface ElementLike {
  disabled: boolean;
  textContent: string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/** Wrap an async (or sync) handler with auto-disable + aria-busy + optional pending label + re-entry guard. Returns
 *  the wrapped handler — attach it yourself (composes with addEventListener / onClick). */
export function asyncHandler<E = unknown>(
  el: ElementLike,
  handler: (e: E) => Promise<unknown> | unknown,
  opts: AsyncBindOptions = {},
): (e: E) => Promise<void> {
  let inFlight = false;
  return async (e: E) => {
    if (inFlight || el.disabled) return; // guard double-submit + re-entry
    inFlight = true;
    const prev = el.textContent;
    el.disabled = true;
    if (opts.ariaBusy !== false) el.setAttribute("aria-busy", "true");
    if (opts.pendingLabel != null) el.textContent = opts.pendingLabel;
    try {
      await handler(e);
    } finally {
      inFlight = false;
      el.disabled = false;
      if (opts.ariaBusy !== false) el.removeAttribute("aria-busy");
      if (opts.pendingLabel != null) el.textContent = prev;
    }
  };
}

/** Convenience: attach an auto-pending async handler to an element's event (default "click"). */
export function bindAsyncButton<E = unknown>(
  el: ElementLike & { addEventListener(type: string, fn: (e: E) => void): void },
  handler: (e: E) => Promise<unknown> | unknown,
  opts: AsyncBindOptions & { event?: string } = {},
): void {
  el.addEventListener(opts.event ?? "click", asyncHandler(el, handler, opts));
}
