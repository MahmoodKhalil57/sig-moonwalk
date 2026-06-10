/**
 * uriTemplate compile + match + reverse-parse — the RFC6570 parseable-profile tooling default (C005, C019 §A.4).
 * Buildable subset: literal segments, single-segment `{var}`, leading-slash multi-segment `{+var}`, and a
 * query key-set (`{?a,b}`, `{&a}`, or `?a={a}`). Split-BEFORE-decode (the §2.4 bug-fix). Provisional @0.62.
 */

export type PathSegment =
  | { kind: "literal"; value: string }
  | { kind: "var"; name: string; multi: boolean };

export interface CompiledTemplate {
  raw: string;
  pathSegments: PathSegment[];
  /** Query parameter names that appear in the template (identity-bearing; key-set, order-insensitive). */
  queryKeys: string[];
}

const VAR_SEG = /^\{(\+?)([^}]+)\}$/;

export function compileTemplate(tmpl: string): CompiledTemplate {
  // Split path vs query on the first query marker: `{?`, `{&`, or a bare `?`.
  const qIdx = tmpl.search(/\{[?&]|\?/);
  const pathPart = qIdx >= 0 ? tmpl.slice(0, qIdx) : tmpl;
  const queryPart = qIdx >= 0 ? tmpl.slice(qIdx) : "";

  const queryKeys: string[] = [];
  for (const m of queryPart.matchAll(/\{[?&]([^}]+)\}/g)) {
    for (const n of m[1].split(",")) queryKeys.push(n.trim());
  }
  for (const m of queryPart.matchAll(/[?&]([A-Za-z0-9_.-]+)=\{([^}]+)\}/g)) queryKeys.push(m[1]);

  // Split path on '/' BEFORE percent-decoding (a captured value may contain an escaped '/').
  const rawSegs = pathPart.replace(/^\//, "").split("/").filter((s, i, a) => !(s === "" && a.length === 1 ? false : s === "" && i === a.length - 1));
  const pathSegments: PathSegment[] = (pathPart.replace(/^\//, "") === "" ? [] : rawSegs).map((seg) => {
    const mv = seg.match(VAR_SEG);
    if (mv) return { kind: "var", name: mv[2], multi: mv[1] === "+" };
    return { kind: "literal", value: seg };
  });
  return { raw: tmpl, pathSegments, queryKeys };
}

/** Number of variable segments (for concrete-over-variable precedence ranking). */
export function variableCount(c: CompiledTemplate): number {
  return c.pathSegments.filter((s) => s.kind === "var").length;
}

/**
 * Reverse-parse: match a concrete URL path against the template. Returns captured path variables, or null
 * if no match. Split on '/' first, then percent-decode captures (RFC3986 §2.1). Deterministic / injective
 * within the profile (no operator can yield two interpretations).
 */
export function matchPath(c: CompiledTemplate, urlPath: string): Record<string, string> | null {
  const parts = urlPath.replace(/^\//, "").split("/").filter((s, i, a) => !(s === "" && i === a.length - 1 && a.length > 1));
  const isRoot = c.pathSegments.length === 0;
  if (isRoot) return parts.length === 1 && parts[0] === "" ? {} : parts.join("") === "" ? {} : null;

  const captures: Record<string, string> = {};
  let i = 0;
  for (const seg of c.pathSegments) {
    if (seg.kind === "literal") {
      if (i >= parts.length || decodeURIComponent(parts[i]) !== seg.value) return null;
      i++;
    } else if (seg.multi) {
      captures[seg.name] = parts.slice(i).map(decodeURIComponent).join("/");
      i = parts.length;
    } else {
      if (i >= parts.length) return null;
      captures[seg.name] = decodeURIComponent(parts[i]);
      i++;
    }
  }
  return i === parts.length ? captures : null;
}
