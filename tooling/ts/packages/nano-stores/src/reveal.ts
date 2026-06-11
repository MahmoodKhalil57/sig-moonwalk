/**
 * revealOnScroll — staggered scroll-triggered reveal for lists as a framework-agnostic primitive (saastarter parity:
 * "list items fade/slide in as they enter the viewport, staggered"). One IntersectionObserver toggles the reveal
 * class on `[data-reveal]` elements as they enter view; the look (initial hidden + transition + the `--i` stagger
 * delay) is @suluk/theme base CSS. Degrades gracefully: with no IntersectionObserver (SSR/old) it reveals everything
 * immediately, and reduced-motion is handled by the CSS, so content is NEVER stuck hidden.
 */
export interface RevealOptions {
  /** elements to reveal (default "[data-reveal]"). */
  selector?: string;
  /** class added on reveal (default "reveal-in"). */
  revealedClass?: string;
  /** query root (default document). */
  root?: { querySelectorAll(s: string): ArrayLike<Element> } | null;
  /** injectable IntersectionObserver ctor (default global; absent → reveal-all fallback). */
  observer?: typeof IntersectionObserver;
  /** set `--i` (index, capped) on each element for the CSS stagger (default true). */
  stagger?: boolean;
  /** max stagger index before wrapping (default 12). */
  staggerCap?: number;
}

/** Start revealing; returns a cleanup that disconnects the observer. */
export function revealOnScroll(opts: RevealOptions = {}): () => void {
  const sel = opts.selector ?? "[data-reveal]";
  const cls = opts.revealedClass ?? "reveal-in";
  const root = opts.root ?? (typeof document !== "undefined" ? (document as unknown as { querySelectorAll(s: string): ArrayLike<Element> }) : null);
  if (!root) return () => {};
  const els = Array.from(root.querySelectorAll(sel)) as HTMLElement[];
  const cap = opts.staggerCap ?? 12;
  if (opts.stagger !== false) els.forEach((el, i) => el.style?.setProperty?.("--i", String(i % cap)));
  const IO = opts.observer ?? (typeof IntersectionObserver !== "undefined" ? IntersectionObserver : undefined);
  if (!IO) {
    els.forEach((el) => el.classList.add(cls)); // graceful: no observer → show everything
    return () => {};
  }
  const io = new IO(
    (entries, obs) => {
      for (const e of entries) if (e.isIntersecting) { (e.target as HTMLElement).classList.add(cls); obs.unobserve(e.target); }
    },
    { rootMargin: "0px 0px -10% 0px" },
  );
  els.forEach((el) => io.observe(el));
  return () => io.disconnect();
}
