/**
 * Code-sample generators. They consume the IR's NormalizedRequest + a sample body, so curl / JS-fetch / Python —
 * and (later) the try-it executor — all stringify the SAME request object and cannot drift. Pure string builders.
 */
import type { NormalizedOperation } from "./ir";

export interface CodeSample { lang: string; label: string; code: string }

function url(server: string, op: NormalizedOperation): string {
  // fill path params with a :placeholder; append query params as a template
  let p = op.path.replace(/\{[?&][^}]*\}/g, "");
  for (const param of op.request.params.filter((x) => x.in === "path")) p = p.replace(new RegExp(`\\{\\+?${param.name}\\}`), `:${param.name}`);
  if (!p.startsWith("/")) p = "/" + p;
  const q = op.request.params.filter((x) => x.in === "query").map((x) => `${x.name}=`).join("&");
  return `${server}${p}${q ? "?" + q : ""}`;
}

const headerParams = (op: NormalizedOperation): Record<string, string> => {
  const h: Record<string, string> = {};
  for (const p of op.request.params.filter((x) => x.in === "header")) h[p.name] = "";
  if (op.request.body) h["content-type"] = op.request.body.contentType;
  if (op.security.length) h["authorization"] = "Bearer <token>";
  return h;
};

export function codeSamples(server: string, op: NormalizedOperation, bodySample: unknown): CodeSample[] {
  const u = url(server, op);
  const method = op.method.toUpperCase();
  const headers = headerParams(op);
  const hasBody = op.request.body != null && method !== "GET" && method !== "HEAD";
  const body = hasBody ? JSON.stringify(bodySample, null, 2) : "";

  // curl
  let curl = `curl -X ${method} "${u}"`;
  for (const [k, v] of Object.entries(headers)) curl += ` \\\n  -H "${k}: ${v}"`;
  if (hasBody) curl += ` \\\n  -d '${JSON.stringify(bodySample)}'`;

  // JavaScript (fetch)
  const jsHeaders = Object.keys(headers).length ? `,\n  headers: ${JSON.stringify(headers, null, 2).replace(/\n/g, "\n  ")}` : "";
  const jsBody = hasBody ? `,\n  body: JSON.stringify(${body.replace(/\n/g, "\n  ")})` : "";
  const js = `const res = await fetch("${u}", {\n  method: "${method}"${jsHeaders}${jsBody}\n});\nconst data = await res.json();`;

  // Python (requests)
  const pyHeaders = Object.keys(headers).length ? `, headers=${pyDict(headers)}` : "";
  const pyBody = hasBody ? `, json=${body.replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False").replace(/\bnull\b/g, "None")}` : "";
  const py = `import requests\nres = requests.${op.method.toLowerCase()}("${u}"${pyHeaders}${pyBody})\ndata = res.json()`;

  return [
    { lang: "curl", label: "curl", code: curl },
    { lang: "js", label: "JavaScript", code: js },
    { lang: "python", label: "Python", code: py },
  ];
}

function pyDict(h: Record<string, string>): string {
  return `{${Object.entries(h).map(([k, v]) => `"${k}": "${v}"`).join(", ")}}`;
}
