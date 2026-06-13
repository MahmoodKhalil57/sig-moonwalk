/** List view — a data table over the entity's REST list endpoint, with client-side search, sortable columns,
 *  pagination, and per-row edit/delete. Columns are the display-friendly fields (heavy text/json omitted). */
import type { EntityModel } from "./model";
import type { Field } from "./fields";

const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** id + title + up to 4 more display-friendly fields (skip the heavy long-text ones). */
function columns(model: EntityModel): Field[] {
  const heavy = new Set(["textarea", "richtext", "json"]);
  const display = model.fields.filter((f) => !heavy.has(f.type));
  const ordered = [
    display.find((f) => f.name === "id"),
    display.find((f) => f.name === model.title),
    ...display.filter((f) => f.name !== "id" && f.name !== model.title),
  ].filter(Boolean) as Field[];
  return ordered.slice(0, 6);
}

export interface ListOptions { basePath: string }

export function renderList(model: EntityModel, opts: ListOptions): string {
  const cols = columns(model);
  const meta = cols.map((f) => ({ name: f.name, label: f.label, type: f.type }));
  const head = cols.map((f) => `<th data-col="${esc(f.name)}">${esc(f.label)}</th>`).join("") + "<th></th>";
  return `<div class="pf-listbar">
    <input id="pf-search" class="pf-input" type="search" placeholder="Search ${esc(model.name)}…" aria-label="Search" />
    <span id="pf-count" class="pf-muted"></span>
    <span style="flex:1"></span>
    ${model.access.create ? `<a class="pf-btn pf-primary" href="${opts.basePath}/${model.name}/new">+ New ${esc(model.name)}</a>` : ""}
  </div>
  <div class="pf-tablewrap"><table class="pf-table"><thead><tr>${head}</tr></thead><tbody id="pf-rows"><tr><td colspan="${cols.length + 1}" class="pf-muted">Loading…</td></tr></tbody></table></div>
  <div class="pf-pager"><button id="pf-prev" class="pf-btn">‹ Prev</button><span id="pf-page" class="pf-muted"></span><button id="pf-next" class="pf-btn">Next ›</button></div>
  <script type="application/json" id="pf-cols">${JSON.stringify(meta).replace(/</g, "\\u003c")}</script>
  <script>${listScript(model, opts)}</script>`;
}

function listScript(model: EntityModel, opts: ListOptions): string {
  return `(function(){
  var path=${JSON.stringify(model.path)}, base=${JSON.stringify(opts.basePath)}, ent=${JSON.stringify(model.name)}, title=${JSON.stringify(model.title)}, canEdit=${model.access.update ? "true" : "false"}, canDel=${model.access.delete ? "true" : "false"};
  var cols=JSON.parse(document.getElementById("pf-cols").textContent);
  var tbody=document.getElementById("pf-rows"), search=document.getElementById("pf-search"), countEl=document.getElementById("pf-count"), pageEl=document.getElementById("pf-page");
  var all=[], q="", sortCol="id", sortDir=1, page=0, PER=20;
  function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"})[c];});}
  function fmt(v,t){ if(v==null||v==="")return '<span class="pf-muted">—</span>';
    if(t==="boolean")return v?'<span class="pf-yes">✓</span>':'<span class="pf-no">✕</span>';
    if(t==="date"||t==="datetime"){var d=(typeof v==="number"||/^\\d+$/.test(String(v)))?new Date(Number(v)):new Date(v);return isNaN(d)?esc(v):d.toLocaleDateString();}
    if(t==="select")return '<span class="pf-pill">'+esc(v)+'</span>';
    if(t==="url"){var s=String(v);return /\\.(png|jpe?g|svg|webp|gif)/i.test(s)?'<img src="'+esc(s)+'" class="pf-thumb" alt=""/>':'<a href="'+esc(s)+'" target="_blank" rel="noopener">'+esc(s.slice(0,40))+'</a>';}
    var str=String(v); return esc(str.length>60?str.slice(0,60)+"…":str);
  }
  function render(){
    var rows=all.filter(function(r){ if(!q)return true; var hay=String(r[title]==null?"":r[title])+" "+String(r.id); return hay.toLowerCase().indexOf(q)>=0; });
    rows.sort(function(a,b){var x=a[sortCol],y=b[sortCol]; if(x==null)return 1; if(y==null)return -1; return (x>y?1:x<y?-1:0)*sortDir;});
    countEl.textContent=rows.length+" "+(rows.length===1?"row":"rows");
    var pages=Math.max(1,Math.ceil(rows.length/PER)); if(page>=pages)page=pages-1; pageEl.textContent="Page "+(page+1)+" / "+pages;
    var slice=rows.slice(page*PER,page*PER+PER);
    tbody.innerHTML=slice.length?slice.map(function(r){
      var tds=cols.map(function(c){return "<td"+(c.name==="id"?' class="pf-muted"':"")+">"+fmt(r[c.name],c.type)+"</td>";}).join("");
      var act='<td class="pf-rowact">'+(canEdit?'<a href="'+base+"/"+ent+"/edit?id="+encodeURIComponent(r.id)+'">Edit</a>':"")+(canDel?' <button data-del="'+esc(r.id)+'" class="pf-link-danger">Delete</button>':"")+'</td>';
      return "<tr>"+tds+act+"</tr>";
    }).join(""):'<tr><td colspan="'+(cols.length+1)+'" class="pf-muted">No '+ent+' yet.</td></tr>';
    tbody.querySelectorAll("[data-del]").forEach(function(b){b.addEventListener("click",function(){ if(!confirm("Delete this "+ent+"?"))return; fetch(path+"/"+encodeURIComponent(b.dataset.del),{method:"DELETE",credentials:"same-origin"}).then(function(rs){if(rs.ok){all=all.filter(function(x){return String(x.id)!==String(b.dataset.del);});render();}});});});
  }
  document.querySelectorAll("th[data-col]").forEach(function(th){th.style.cursor="pointer";th.addEventListener("click",function(){var c=th.dataset.col;if(sortCol===c)sortDir=-sortDir;else{sortCol=c;sortDir=1;}render();});});
  search.addEventListener("input",function(){q=search.value.toLowerCase();page=0;render();});
  document.getElementById("pf-prev").addEventListener("click",function(){if(page>0){page--;render();}});
  document.getElementById("pf-next").addEventListener("click",function(){page++;render();});
  fetch(path,{credentials:"same-origin"}).then(function(r){return r.json();}).then(function(d){all=Array.isArray(d)?d:[];render();}).catch(function(){tbody.innerHTML='<tr><td colspan="'+(cols.length+1)+'" class="pf-muted">Could not load.</td></tr>';});
})();`;
}
