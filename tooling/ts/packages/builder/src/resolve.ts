/**
 * Resolution — shared by the validator + renderer.
 *   resolveParams: a document's effective param values for one instantiation (defaults ← variant ← props).
 *   resolveList:   a `list` param's effective ordered selection, honouring the controls the spec allows.
 */
import type { DslDocument, ParamSpec } from "./dsl";

/** Effective param values: defaults, then a variant preset, then consumer props (only keys in `params`). */
export function resolveParams(
  doc: DslDocument,
  variant: string | undefined,
  props: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, spec] of Object.entries(doc.params ?? {})) {
    if ("default" in spec && spec.default !== undefined) out[k] = spec.default;
  }
  if (variant && doc.variants?.[variant]) Object.assign(out, doc.variants[variant]);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (k in (doc.params ?? {})) out[k] = v;
    }
  }
  return out;
}

/**
 * The effective ordered selection for a `list` param. The default is the spec default (or all options).
 * A consumer selection is applied only as far as the controls allow:
 *   include → may add options not in the default ; hide → may drop ; reorder → may change order ;
 *   repeat  → may list an option more than once.
 * Returns the resolved ordered list (catalog keys).
 */
export function resolveList(spec: Extract<ParamSpec, { type: "list" }>, selection: string[] | undefined): string[] {
  const base = spec.default ?? spec.options.slice();
  if (!selection) return base.slice();

  const can = (c: Parameters<typeof spec.controls.includes>[0]) => spec.controls.includes(c);
  // start from the consumer's order if reorder is allowed, else keep base order filtered by the selection
  let result = can("reorder") ? selection.slice() : base.filter((k) => selection.includes(k));

  // include: keep added options only if allowed; otherwise drop options not in base
  if (!can("include")) result = result.filter((k) => base.includes(k));
  // hide: if not allowed, every base option must remain present
  if (!can("hide")) for (const k of base) if (!result.includes(k)) result.push(k);
  // repeat: if not allowed, dedup
  if (!can("repeat")) result = [...new Set(result)];

  // never admit a key outside the catalog options
  return result.filter((k) => spec.options.includes(k));
}
