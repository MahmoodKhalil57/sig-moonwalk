#!/usr/bin/env bun
// Download all issues and PRs from a GitHub repo as local markdown files.
import { $ } from "bun";
import { mkdir } from "node:fs/promises";

const REPO = "OAI/sig-moonwalk";
const OUT = new URL("./", import.meta.url).pathname;

function fmtDate(d?: string | null) {
  return d ? new Date(d).toISOString().replace("T", " ").slice(0, 16) + "Z" : "";
}

function labelList(labels?: { name: string }[]) {
  return labels?.length ? labels.map((l) => l.name).join(", ") : "—";
}

function renderComments(comments?: { author?: { login?: string }; createdAt?: string; body?: string }[]) {
  if (!comments?.length) return "_No comments._\n";
  return comments
    .map((c, i) => {
      const who = c.author?.login ?? "ghost";
      return `### Comment ${i + 1} — @${who} · ${fmtDate(c.createdAt)}\n\n${c.body?.trim() || "_(empty)_"}\n`;
    })
    .join("\n---\n\n");
}

async function exportIssues() {
  await mkdir(`${OUT}issues`, { recursive: true });
  const numbers: number[] = await $`gh issue list --repo ${REPO} --state all --limit 2000 --json number --jq '[.[].number]'`.json();
  console.log(`Issues: ${numbers.length}`);
  const index: string[] = ["# Issues\n"];
  for (const n of numbers.sort((a, b) => a - b)) {
    const data = await $`gh issue view ${n} --repo ${REPO} --json number,title,state,author,createdAt,updatedAt,closedAt,labels,assignees,milestone,url,body,comments`.json();
    const md = [
      `# #${data.number} — ${data.title}`,
      "",
      `- **State:** ${data.state}`,
      `- **Author:** @${data.author?.login ?? "ghost"}`,
      `- **Created:** ${fmtDate(data.createdAt)}`,
      `- **Updated:** ${fmtDate(data.updatedAt)}`,
      data.closedAt ? `- **Closed:** ${fmtDate(data.closedAt)}` : null,
      `- **Labels:** ${labelList(data.labels)}`,
      `- **Assignees:** ${data.assignees?.length ? data.assignees.map((a: any) => "@" + a.login).join(", ") : "—"}`,
      data.milestone?.title ? `- **Milestone:** ${data.milestone.title}` : null,
      `- **URL:** ${data.url}`,
      "",
      "---",
      "",
      "## Description",
      "",
      data.body?.trim() || "_No description._",
      "",
      "---",
      "",
      `## Comments (${data.comments?.length ?? 0})`,
      "",
      renderComments(data.comments),
    ]
      .filter((l) => l !== null)
      .join("\n");
    const fname = `${String(data.number).padStart(4, "0")}.md`;
    await Bun.write(`${OUT}issues/${fname}`, md);
    index.push(`- [#${data.number} ${data.title}](./${fname}) — ${data.state}`);
    console.log(`  issue #${n} ✓`);
  }
  await Bun.write(`${OUT}issues/README.md`, index.join("\n") + "\n");
}

async function exportPRs() {
  await mkdir(`${OUT}pulls`, { recursive: true });
  const numbers: number[] = await $`gh pr list --repo ${REPO} --state all --limit 2000 --json number --jq '[.[].number]'`.json();
  console.log(`PRs: ${numbers.length}`);
  const index: string[] = ["# Pull Requests\n"];
  for (const n of numbers.sort((a, b) => a - b)) {
    const data = await $`gh pr view ${n} --repo ${REPO} --json number,title,state,isDraft,author,createdAt,updatedAt,closedAt,mergedAt,mergedBy,labels,assignees,milestone,baseRefName,headRefName,additions,deletions,changedFiles,url,body,comments,reviews`.json();
    const reviews = (data.reviews ?? [])
      .filter((r: any) => r.body?.trim() || r.state)
      .map((r: any, i: number) => `### Review ${i + 1} — @${r.author?.login ?? "ghost"} · ${r.state} · ${fmtDate(r.submittedAt)}\n\n${r.body?.trim() || "_(no body)_"}\n`)
      .join("\n---\n\n") || "_No reviews._\n";
    const md = [
      `# PR #${data.number} — ${data.title}`,
      "",
      `- **State:** ${data.state}${data.isDraft ? " (draft)" : ""}`,
      `- **Author:** @${data.author?.login ?? "ghost"}`,
      `- **Branch:** \`${data.headRefName}\` → \`${data.baseRefName}\``,
      `- **Created:** ${fmtDate(data.createdAt)}`,
      `- **Updated:** ${fmtDate(data.updatedAt)}`,
      data.mergedAt ? `- **Merged:** ${fmtDate(data.mergedAt)}${data.mergedBy?.login ? " by @" + data.mergedBy.login : ""}` : null,
      data.closedAt && !data.mergedAt ? `- **Closed:** ${fmtDate(data.closedAt)}` : null,
      `- **Changes:** +${data.additions} −${data.deletions} across ${data.changedFiles} file(s)`,
      `- **Labels:** ${labelList(data.labels)}`,
      `- **URL:** ${data.url}`,
      "",
      "---",
      "",
      "## Description",
      "",
      data.body?.trim() || "_No description._",
      "",
      "---",
      "",
      `## Reviews (${data.reviews?.length ?? 0})`,
      "",
      reviews,
      "---",
      "",
      `## Comments (${data.comments?.length ?? 0})`,
      "",
      renderComments(data.comments),
    ]
      .filter((l) => l !== null)
      .join("\n");
    const fname = `${String(data.number).padStart(4, "0")}.md`;
    await Bun.write(`${OUT}pulls/${fname}`, md);
    index.push(`- [PR #${data.number} ${data.title}](./${fname}) — ${data.state}`);
    console.log(`  pr #${n} ✓`);
  }
  await Bun.write(`${OUT}pulls/README.md`, index.join("\n") + "\n");
}

await exportIssues();
await exportPRs();
console.log("Done.");
