/** llms.txt generation (llmstxt.org) — a curated, LLM-friendly map of the site: H1 title, blockquote summary,
 *  optional details, then `## Section` lists of `- [title](url): description` links. */

export interface LlmsLink { title: string; url: string; description?: string }
export interface LlmsSection { title: string; links: LlmsLink[] }
export interface LlmsTxtInput {
  title: string;
  /** One-line summary, rendered as a blockquote. */
  summary?: string;
  /** Free-form markdown paragraph(s) after the summary. */
  details?: string;
  sections?: LlmsSection[];
}

export function llmsTxt(i: LlmsTxtInput): string {
  const out: string[] = [`# ${i.title}`];
  if (i.summary) out.push("", `> ${i.summary}`);
  if (i.details) out.push("", i.details.trim());
  for (const s of i.sections ?? []) {
    out.push("", `## ${s.title}`, "");
    for (const l of s.links) out.push(`- [${l.title}](${l.url})${l.description ? `: ${l.description}` : ""}`);
  }
  return out.join("\n") + "\n";
}
