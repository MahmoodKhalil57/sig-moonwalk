/** Rich-text field — a dependency-free, GitHub-style markdown editor: a formatting toolbar over a textarea (the
 *  textarea IS the form input, so the field stays plain markdown), plus a Write/Preview toggle that renders the
 *  markdown with a tiny XSS-safe client renderer. No editor library, no AST — Cloudflare-safe, and it matches how
 *  content fields (e.g. a blog `body`) are actually stored. (A Lexical-AST mode can layer on later.) */

const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

const TOOLS: { md: string; label: string; title: string }[] = [
  { md: "bold", label: "<b>B</b>", title: "Bold (**)" },
  { md: "italic", label: "<i>I</i>", title: "Italic (*)" },
  { md: "h2", label: "H", title: "Heading (##)" },
  { md: "ul", label: "&bull;", title: "Bulleted list" },
  { md: "ol", label: "1.", title: "Numbered list" },
  { md: "quote", label: "&rdquo;", title: "Quote (>)" },
  { md: "code", label: "&lt;/&gt;", title: "Code (`)" },
  { md: "link", label: "&#128279;", title: "Link" },
];

/** The editor markup for one rich-text field. `name` is the form field; `value` is the initial markdown. */
export function richtextEditor(name: string, value: unknown = "", attrs = ""): string {
  const bar = TOOLS.map((t) => `<button type="button" class="pf-rt-btn" data-md="${t.md}" title="${esc(t.title)}" tabindex="-1">${t.label}</button>`).join("");
  return `<div class="pf-rt" data-rt>
    <div class="pf-rt-bar" role="toolbar" aria-label="Formatting (⌘/Ctrl+B bold · ⌘/Ctrl+I italic)">${bar}<span style="flex:1"></span><button type="button" class="pf-rt-tab on" data-rt-tab="write">Write</button><button type="button" class="pf-rt-tab" data-rt-tab="preview">Preview</button></div>
    <textarea class="pf-input pf-mono pf-rt-ta" rows="10" id="pf-${esc(name)}" name="${esc(name)}"${attrs}>${esc(value)}</textarea>
    <div class="pf-rt-prev pf-rich" hidden></div>
  </div>`;
}

export const RICHTEXT_CSS = `
  .pf-rt{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--bg-soft)}
  .pf-rt-bar{display:flex;align-items:center;gap:2px;padding:6px 8px;border-bottom:1px solid var(--line);background:var(--panel)}
  .pf-rt-btn,.pf-rt-tab{font:inherit;font-size:13px;background:none;border:0;border-radius:7px;padding:5px 9px;cursor:pointer;color:var(--fg);min-width:30px}
  .pf-rt-btn:hover,.pf-rt-tab:hover{background:var(--bg-soft)}.pf-rt-tab.on{background:color-mix(in oklab,var(--accent) 16%,transparent);color:var(--accent);font-weight:600}
  .pf-rt-ta{border:0;border-radius:0;background:var(--bg-soft);resize:vertical}.pf-rt-ta:focus{outline:0}
  .pf-rt-prev{padding:14px 16px;min-height:120px}
  .pf-rich h2{font-size:20px;margin:16px 0 8px}.pf-rich h3{font-size:17px;margin:14px 0 6px}.pf-rich p{margin:0 0 12px}
  .pf-rich ul,.pf-rich ol{margin:0 0 12px;padding-inline-start:22px}.pf-rich blockquote{margin:0 0 12px;padding:2px 14px;border-inline-start:3px solid var(--accent);color:var(--muted)}
  .pf-rich code{font-family:ui-monospace,monospace;font-size:.88em;background:var(--bg-soft);border:1px solid var(--line);border-radius:5px;padding:1px 5px}
  .pf-rich pre{background:var(--bg-soft);border:1px solid var(--line);border-radius:9px;padding:12px 14px;overflow-x:auto}.pf-rich pre code{background:none;border:0;padding:0}
  .pf-rich a{color:var(--accent)}
`;

/** Client init for every `[data-rt]` on the page — toolbar inserts markdown around the selection; the Preview tab
 *  renders the markdown with an inline, escape-first (XSS-safe) renderer. Include once per page that has editors. */
export function richtextScript(): string {
  return `(function(){
  function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"})[c];});}
  function inline(t){return esc(t).replace(/\`([^\`]+)\`/g,"<code>$1</code>").replace(/\\*\\*([^*]+)\\*\\*/g,"<strong>$1</strong>").replace(/(^|[^*])\\*([^*]+)\\*/g,"$1<em>$2</em>").replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+|\\/[^\\s)]*)\\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');}
  function md(src){var L=String(src||"").replace(/\\r\\n/g,"\\n").split("\\n"),o=[],i=0;
    while(i<L.length){var ln=L[i];
      if(/^\`\`\`/.test(ln)){var b=[];i++;while(i<L.length&&!/^\`\`\`/.test(L[i]))b.push(L[i++]);i++;o.push("<pre><code>"+esc(b.join("\\n"))+"</code></pre>");continue;}
      var h=ln.match(/^(#{1,3})\\s+(.*)/);if(h){var n=Math.max(2,h[1].length);o.push("<h"+n+">"+inline(h[2])+"</h"+n+">");i++;continue;}
      if(/^[-*]\\s+/.test(ln)){var it=[];while(i<L.length&&/^[-*]\\s+/.test(L[i]))it.push("<li>"+inline(L[i++].replace(/^[-*]\\s+/,""))+"</li>");o.push("<ul>"+it.join("")+"</ul>");continue;}
      if(/^\\d+\\.\\s+/.test(ln)){var ot=[];while(i<L.length&&/^\\d+\\.\\s+/.test(L[i]))ot.push("<li>"+inline(L[i++].replace(/^\\d+\\.\\s+/,""))+"</li>");o.push("<ol>"+ot.join("")+"</ol>");continue;}
      if(/^>\\s?/.test(ln)){var q=[];while(i<L.length&&/^>\\s?/.test(L[i]))q.push(L[i++].replace(/^>\\s?/,""));o.push("<blockquote>"+inline(q.join(" "))+"</blockquote>");continue;}
      if(ln.trim()===""){i++;continue;}
      var p=[];while(i<L.length&&L[i].trim()!==""&&!/^(#{1,3}\\s|[-*]\\s|\\d+\\.\\s|\`\`\`|>\\s?)/.test(L[i]))p.push(L[i++]);o.push("<p>"+inline(p.join(" "))+"</p>");}
    return o.join("\\n");}
  function wrap(ta,pre,post,line){var s=ta.selectionStart,e=ta.selectionEnd,v=ta.value,sel=v.slice(s,e);
    if(line){var ls=v.lastIndexOf("\\n",s-1)+1;var seg=v.slice(ls,e)||sel;var done=seg.split("\\n").map(function(x){return pre+x;}).join("\\n");ta.value=v.slice(0,ls)+done+v.slice(e);ta.selectionStart=ls;ta.selectionEnd=ls+done.length;}
    else{ta.value=v.slice(0,s)+pre+(sel||"text")+post+v.slice(e);ta.selectionStart=s+pre.length;ta.selectionEnd=s+pre.length+(sel||"text").length;}
    ta.dispatchEvent(new Event("input",{bubbles:true}));ta.focus();}
  document.querySelectorAll("[data-rt]").forEach(function(rt){
    var ta=rt.querySelector(".pf-rt-ta"),prev=rt.querySelector(".pf-rt-prev");if(!ta)return;
    ta.addEventListener("keydown",function(e){if((e.ctrlKey||e.metaKey)&&!e.altKey){var k=e.key.toLowerCase();if(k==="b"){e.preventDefault();wrap(ta,"**","**");}else if(k==="i"){e.preventDefault();wrap(ta,"*","*");}}});
    rt.querySelectorAll("[data-md]").forEach(function(b){b.addEventListener("click",function(){var k=b.dataset.md;
      if(k==="bold")wrap(ta,"**","**");else if(k==="italic")wrap(ta,"*","*");else if(k==="code")wrap(ta,"\`","\`");
      else if(k==="h2")wrap(ta,"## ","",true);else if(k==="ul")wrap(ta,"- ","",true);else if(k==="ol")wrap(ta,"1. ","",true);
      else if(k==="quote")wrap(ta,"> ","",true);else if(k==="link"){var u=prompt("Link URL:","https://");if(u)wrap(ta,"[","]("+u+")");}});});
    rt.querySelectorAll("[data-rt-tab]").forEach(function(t){t.addEventListener("click",function(){var w=t.dataset.rtTab==="write";
      rt.querySelectorAll("[data-rt-tab]").forEach(function(x){x.classList.toggle("on",x===t);});
      ta.hidden=!w;prev.hidden=w;if(!w)prev.innerHTML=md(ta.value)||'<p class="pf-muted">Nothing to preview.</p>';});});
  });
})();`;
}
