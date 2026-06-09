#!/usr/bin/env bun
// Download all GitHub Discussions from a repo as local markdown files.
import { $ } from "bun";
import { mkdir } from "node:fs/promises";

const OWNER = "OAI";
const REPO = "sig-moonwalk";
const OUT = new URL("./", import.meta.url).pathname;

function fmtDate(d?: string | null) {
  return d ? new Date(d).toISOString().replace("T", " ").slice(0, 16) + "Z" : "";
}

async function gql(query: string, vars: Record<string, string> = {}) {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [k, v] of Object.entries(vars)) args.push("-F", `${k}=${v}`);
  const out = await $`gh ${args}`.json();
  if (out.errors) throw new Error(JSON.stringify(out.errors));
  return out.data;
}

// 1. Page through the discussion list to collect every number.
const LIST_QUERY = `
query($owner:String!,$repo:String!,$cursor:String){
  repository(owner:$owner,name:$repo){
    discussions(first:50, after:$cursor, orderBy:{field:CREATED_AT, direction:ASC}){
      pageInfo{ hasNextPage endCursor }
      nodes{ number title }
    }
  }
}`;

async function listNumbers(): Promise<number[]> {
  const nums: number[] = [];
  let cursor = "";
  while (true) {
    const data: any = await gql(LIST_QUERY, cursor ? { owner: OWNER, repo: REPO, cursor } : { owner: OWNER, repo: REPO });
    const d = data.repository.discussions;
    for (const n of d.nodes) nums.push(n.number);
    if (!d.pageInfo.hasNextPage) break;
    cursor = d.pageInfo.endCursor;
  }
  return nums;
}

// 2. Per-discussion full fetch: body + comments + threaded replies.
const DISC_QUERY = `
query($owner:String!,$repo:String!,$number:Int!){
  repository(owner:$owner,name:$repo){
    discussion(number:$number){
      number title url createdAt updatedAt
      author{ login }
      category{ name emoji }
      labels(first:20){ nodes{ name } }
      answer{ id author{ login } createdAt body }
      body
      comments(first:100){
        pageInfo{ hasNextPage }
        totalCount
        nodes{
          author{ login } createdAt body isAnswer
          replies(first:100){
            pageInfo{ hasNextPage }
            totalCount
            nodes{ author{ login } createdAt body }
          }
        }
      }
    }
  }
}`;

function renderReplies(replies: any): string {
  if (!replies?.nodes?.length) return "";
  const parts = replies.nodes.map((r: any, i: number) => {
    const body = (r.body?.trim() || "_(empty)_").split("\n").map((l: string) => "  > " + l).join("\n");
    return `  - **↳ Reply ${i + 1} — @${r.author?.login ?? "ghost"} · ${fmtDate(r.createdAt)}**\n${body}`;
  });
  let out = "\n" + parts.join("\n\n");
  if (replies.pageInfo?.hasNextPage) out += "\n\n  > _…more replies truncated (>100)._";
  return out;
}

function renderComments(comments: any): string {
  if (!comments?.nodes?.length) return "_No comments._\n";
  const parts = comments.nodes.map((c: any, i: number) => {
    const flag = c.isAnswer ? " ✅ (answer)" : "";
    return `### Comment ${i + 1} — @${c.author?.login ?? "ghost"} · ${fmtDate(c.createdAt)}${flag}\n\n${c.body?.trim() || "_(empty)_"}\n${renderReplies(c.replies)}`;
  });
  let out = parts.join("\n\n---\n\n");
  if (comments.pageInfo?.hasNextPage) out += "\n\n> _…more comments truncated (>100)._";
  return out;
}

async function main() {
  await mkdir(`${OUT}discussions`, { recursive: true });
  const numbers = await listNumbers();
  console.log(`Discussions: ${numbers.length}`);
  const index: string[] = ["# Discussions\n"];
  for (const n of numbers) {
    const data: any = await gql(DISC_QUERY, { owner: OWNER, repo: REPO, number: String(n) });
    const d = data.repository.discussion;
    if (!d) { console.log(`  discussion #${n} — skipped (null)`); continue; }
    const cat = d.category ? `${d.category.emoji ?? ""} ${d.category.name}`.trim() : "—";
    const labels = d.labels?.nodes?.length ? d.labels.nodes.map((l: any) => l.name).join(", ") : "—";
    const md = [
      `# Discussion #${d.number} — ${d.title}`,
      "",
      `- **Author:** @${d.author?.login ?? "ghost"}`,
      `- **Category:** ${cat}`,
      `- **Created:** ${fmtDate(d.createdAt)}`,
      `- **Updated:** ${fmtDate(d.updatedAt)}`,
      `- **Labels:** ${labels}`,
      d.answer ? `- **Answered by:** @${d.answer.author?.login ?? "ghost"} · ${fmtDate(d.answer.createdAt)}` : null,
      `- **URL:** ${d.url}`,
      "",
      "---",
      "",
      "## Body",
      "",
      d.body?.trim() || "_No body._",
      "",
      "---",
      "",
      `## Comments (${d.comments?.totalCount ?? 0})`,
      "",
      renderComments(d.comments),
    ].filter((l) => l !== null).join("\n");
    const fname = `${String(d.number).padStart(4, "0")}.md`;
    await Bun.write(`${OUT}discussions/${fname}`, md);
    index.push(`- [#${d.number} ${d.title}](./${fname}) — ${cat}`);
    console.log(`  discussion #${n} ✓`);
  }
  await Bun.write(`${OUT}discussions/README.md`, index.join("\n") + "\n");
  console.log("Done.");
}

await main();
