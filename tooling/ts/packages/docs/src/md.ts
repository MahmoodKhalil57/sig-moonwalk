/**
 * A small, dependency-free Markdown → HTML renderer — enough for the constructs the Suluk docs use: fenced
 * code, ATX headings, tables, lists, blockquotes, rules, paragraphs, and inline code / bold / italic / links.
 * Not a full CommonMark engine; it is deliberately small and predictable (and reusable for READMEs).
 */

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

/** Inline spans: `code`, ![alt](url) image, [text](url), **bold**, *italic*. Escapes first, then injects safe tags. */
export function inline(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, a, u) => `<img src="${u}" alt="${a}" loading="lazy">`); // before the link rule, so `!` is consumed
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, (_, b) => `<strong>${b}</strong>`);
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, (_, pre, i) => `${pre}<em>${i}</em>`);
  return s;
}

function tableRow(line: string, cell: "td" | "th"): string {
  const cells = line.replace(/^\||\|$/g, "").split("|").map((c) => `<${cell}>${inline(c.trim())}</${cell}>`).join("");
  return `<tr>${cells}</tr>`;
}

export function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  let listType: "ul" | "ol" | null = null;
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    if (/^```/.test(line)) {
      closeList();
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence
      out.push(`<pre><code${lang ? ` class="lang-${escapeHtml(lang)}"` : ""}>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }

    // table: a header row followed by a separator row of dashes
    if (/^\|.*\|/.test(line) && i + 1 < lines.length && /^\|?[\s:-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      closeList();
      out.push("<table>", "<thead>", tableRow(line, "th"), "</thead>", "<tbody>");
      i += 2;
      while (i < lines.length && /^\|.*\|/.test(lines[i])) out.push(tableRow(lines[i++], "td"));
      out.push("</tbody>", "</table>");
      continue;
    }

    // heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { closeList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }

    // horizontal rule
    if (/^(---|\*\*\*|___)\s*$/.test(line)) { closeList(); out.push("<hr/>"); i++; continue; }

    // blockquote
    if (/^>\s?/.test(line)) {
      closeList();
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }

    // list items
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ul || ol) {
      const want = ul ? "ul" : "ol";
      if (listType !== want) { closeList(); listType = want; out.push(`<${want}>`); }
      out.push(`<li>${inline((ul ?? ol)![1])}</li>`);
      i++;
      continue;
    }

    // blank line
    if (line.trim() === "") { closeList(); i++; continue; }

    // paragraph (gather consecutive non-empty, non-special lines)
    closeList();
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6}\s|```|>\s?|[-*]\s|\d+\.\s|---|\|)/.test(lines[i])) {
      para.push(lines[i++]);
    }
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    else if (i < lines.length) i++; // safety: avoid infinite loop on an unmatched special line
  }
  closeList();
  return out.join("\n");
}
