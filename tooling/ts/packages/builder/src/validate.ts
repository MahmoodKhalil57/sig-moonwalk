/**
 * Validation — the tier rule + the contract-narrowing. This is the load-bearing check: a consumer may set
 * ONLY the keys in the target's `params`. An out-of-contract key is rejected exactly like an unknown key —
 * the narrowing is the safety surface. (Mirrors multivendorbuilder's validateRef, on the Suluk model.)
 */
import type { DslDocument, DslNode, DslChild } from "./dsl";
import { isBind, isEach, isSlot, COMPOSES } from "./dsl";
import { allowedTypes, findDoc, type Registry } from "./registry";

export interface DslError {
  doc: string;
  path: string;
  message: string;
}

function eachChild(children: DslNode["children"]): DslChild[] {
  if (children == null) return [];
  return Array.isArray(children) ? children : [children];
}

/** Universal structural containers — valid at ANY tier; their children stay in the doc's composed tier. They
 *  carry no param contract (the narrowing is about content refs, not layout), enabling multi-child sections/pages. */
export const LAYOUT = new Set(["Stack", "Grid", "Panel", "Row", "Col"]);

/** Validate a node's reference to a target document against that target's contract. */
function validateRef(node: DslNode, target: DslDocument, current: DslDocument, path: string, errors: DslError[]): void {
  const docName = `${current.tier}/${current.name}`;
  const params = target.params ?? {};

  if (node.variant && !target.variants?.[node.variant]) {
    errors.push({ doc: docName, path: `${path}.variant`, message: `\`${node.variant}\` is not a variant of ${target.name} (have: ${Object.keys(target.variants ?? {}).join(", ") || "none"})` });
  }

  const provided = node.props ?? {};
  for (const [key, value] of Object.entries(provided)) {
    const spec = params[key];
    if (!spec) {
      // THE NARROWING: the key simply isn't in the target's contract.
      errors.push({ doc: docName, path: `${path}.props.${key}`, message: `\`${key}\` is not part of ${target.name}'s contract. ${current.tier} may only set: ${Object.keys(params).join(", ") || "(nothing)"}.` });
      continue;
    }
    if (isBind(value)) {
      if (!(value.$bind in (current.params ?? {}))) {
        errors.push({ doc: docName, path: `${path}.props.${key}.$bind`, message: `\`${value.$bind}\` is not a param of ${current.name}, so it cannot be forwarded.` });
      }
      continue;
    }
    if (spec.type === "enum" && typeof value === "string" && !spec.options.includes(value)) {
      errors.push({ doc: docName, path: `${path}.props.${key}`, message: `\`${value}\` is not an option of ${key} (${spec.options.join(", ")}).` });
    }
    if (spec.type === "list" && Array.isArray(value)) {
      for (const k of value) if (typeof k === "string" && !spec.options.includes(k)) {
        errors.push({ doc: docName, path: `${path}.props.${key}`, message: `\`${k}\` is not a catalog option of ${key} (${spec.options.join(", ")}).` });
      }
    }
  }

  // required params with no default and not supplied (by props or variant) are missing.
  const variantKeys = node.variant ? Object.keys(target.variants?.[node.variant] ?? {}) : [];
  for (const [key, spec] of Object.entries(params)) {
    const hasDefault = "default" in spec && spec.default !== undefined;
    const supplied = key in provided || variantKeys.includes(key);
    if ((spec as { required?: boolean }).required && !hasDefault && !supplied) {
      errors.push({ doc: docName, path: `${path}.props.${key}`, message: `\`${key}\` is required by ${target.name} but was not set.` });
    }
  }
}

/** Validate one node (and its subtree) of `current` against the registry. */
function validateNode(node: DslNode, current: DslDocument, reg: Registry, path: string, errors: DslError[]): void {
  const docName = `${current.tier}/${current.name}`;
  const allowed = allowedTypes(reg, current.tier);
  const composed = current.tier === "components" ? "components" : COMPOSES[current.tier];

  if (LAYOUT.has(node.type)) {
    // a structural container: no contract; children stay in the same composed tier
    eachChild(node.children).forEach((c, i) => {
      if (typeof c === "string" || typeof c === "number" || isEach(c) || isSlot(c)) return;
      validateNode(c, current, reg, `${path}.children[${i}]`, errors);
    });
    return;
  }

  if (composed === "components") {
    // a block composing leaf components — the type must be a known component; props are real UI props (not contract-checked)
    if (!reg.components.has(node.type)) {
      errors.push({ doc: docName, path, message: `\`${node.type}\` is not a known component. ${current.tier} may use: ${[...reg.components].join(", ") || "(none)"}.` });
    }
  } else {
    const target = findDoc(reg, node.type);
    if (!target || !allowed.has(node.type)) {
      errors.push({ doc: docName, path, message: `\`${node.type}\` is not a ${composed} ${current.tier} may compose. Allowed: ${[...allowed].join(", ") || "(none)"}.` });
    } else {
      validateRef(node, target, current, path, errors);
    }
  }

  // recurse children (same composed tier); $each / $slot / scalars are fine
  eachChild(node.children).forEach((c, i) => {
    if (typeof c === "string" || typeof c === "number" || isEach(c) || isSlot(c)) return;
    validateNode(c, current, reg, `${path}.children[${i}]`, errors);
  });
}

/** Validate one document against the registry. */
export function validateDocument(doc: DslDocument, reg: Registry): DslError[] {
  const errors: DslError[] = [];
  validateNode(doc.root, doc, reg, "root", errors);
  for (const [key, node] of Object.entries(doc.catalog ?? {})) {
    validateNode(node, doc, reg, `catalog.${key}`, errors);
  }
  return errors;
}

/** Validate every page / section / block in the registry. */
export function validateAll(reg: Registry): DslError[] {
  const errors: DslError[] = [];
  for (const tier of ["blocks", "sections", "pages"] as const) {
    for (const doc of Object.values(reg[tier])) errors.push(...validateDocument(doc, reg));
  }
  return errors;
}
