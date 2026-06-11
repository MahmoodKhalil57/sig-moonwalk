/**
 * createProgressBar — an asymptotic route/navigation progress bar as a framework-agnostic primitive (saastarter
 * parity: "top progress bar eases fast then crawls toward 90%, completes on load"). The STORE owns the value (0..1)
 * + the asymptotic step schedule via tick(); the CONSUMER drives the cadence (a setInterval, or Astro view-transition
 * events) and the completion. This keeps the timing logic pure + unit-testable while the visual look comes from
 * @suluk/theme's `.navprogress` CSS. Paints an optional element's width + `.active` class.
 */
import { atom, type ReadableAtom } from "nanostores";

export interface ProgressElement {
  style: { width: string };
  classList: { toggle(token: string, force: boolean): void };
}

export interface ProgressBarOptions {
  /** element to paint (its style.width = value% and toggles `.active` while 0<v<1). */
  el?: ProgressElement | null;
}

export interface ProgressBar {
  /** 0 (idle) … 1 (complete). Subscribe to drive any renderer. */
  $value: ReadableAtom<number>;
  /** begin — jump to a visible head (8%). */
  start(): void;
  /** advance one asymptotic step toward the 95% ceiling (call on an interval while loading). */
  tick(): void;
  /** complete — snap to 100% (consumer then resets after a fade). */
  done(): void;
  /** back to idle (0%). */
  reset(): void;
  /** set an explicit value (clamped 0..1). */
  set(value: number): void;
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function createProgressBar(opts: ProgressBarOptions = {}): ProgressBar {
  const $value = atom(0);
  const el = opts.el;
  if (el) $value.subscribe((v) => { el.style.width = (v * 100).toFixed(1) + "%"; el.classList.toggle("active", v > 0 && v < 1); });
  return {
    $value,
    start() { $value.set(0.08); },
    tick() {
      const v = $value.get();
      if (v <= 0 || v >= 0.95) return; // idle, or already crawling at the ceiling
      const step = v < 0.5 ? 0.06 : v < 0.8 ? 0.02 : 0.005; // big early, tiny near the top
      $value.set(Math.min(0.95, v + step));
    },
    done() { $value.set(1); },
    reset() { $value.set(0); },
    set(value) { $value.set(clamp(value)); },
  };
}
