/**
 * Form-error feedback primitives (saastarter parity: "invalid fields ring red + shake", "errors clear as you type").
 * Framework-agnostic — they toggle the SEMANTIC contract (aria-invalid + the .shake class); the LOOK is @suluk/theme
 * base CSS ([aria-invalid] destructive ring + @keyframes shake). So a hand-written form gets accessible, animated
 * validation feedback without a component framework.
 */
export interface FieldLike {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  classList?: { add(c: string): void; remove(c: string): void };
}

/** Mark a field invalid: aria-invalid="true" (the theme rings it red) + a brief shake. */
export function markInvalid(field: FieldLike, opts: { shake?: boolean; shakeMs?: number; setTimer?: (fn: () => void, ms: number) => void } = {}): void {
  field.setAttribute("aria-invalid", "true");
  if (opts.shake !== false && field.classList) {
    field.classList.add("shake");
    const timer = opts.setTimer ?? ((fn: () => void, ms: number) => { if (typeof setTimeout !== "undefined") setTimeout(fn, ms); else fn(); });
    timer(() => field.classList!.remove("shake"), opts.shakeMs ?? 450);
  }
}

/** Clear a field's invalid state. */
export function clearInvalid(field: FieldLike): void {
  field.removeAttribute("aria-invalid");
}

/** Attach real-time clearing: editing a field clears its invalid state (so the red ring disappears as the user fixes
 *  it, instead of lingering until the next submit). Returns a cleanup. */
export function clearInvalidOnInput(form: { addEventListener(t: string, fn: (e: Event) => void): void; removeEventListener?(t: string, fn: (e: Event) => void): void }): () => void {
  const onInput = (e: Event) => {
    const t = e.target as FieldLike | null;
    if (t && typeof t.removeAttribute === "function") t.removeAttribute("aria-invalid");
  };
  form.addEventListener("input", onInput);
  return () => form.removeEventListener?.("input", onInput);
}
