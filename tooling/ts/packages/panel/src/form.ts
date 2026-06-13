/** Create/Edit form — renders the labelled field widgets, then a client script that (on edit) loads the record +
 *  populates relationship <select>s from their entity, and (on submit) coerces each field by type and POSTs/PATCHes
 *  to the entity's REST endpoint. Pure projection — the panel never touches the DB; it drives the contract's CRUD. */
import type { EntityModel } from "./model";
import { renderFieldRow } from "./widgets";
import { richtextScript } from "./richtext";

export interface FormOptions { basePath: string; relPaths: Record<string, string>; canDelete: boolean }

export function renderForm(model: EntityModel, opts: FormOptions): string {
  const rows = model.fields.map((f) => renderFieldRow(f)).join("\n");
  const meta = model.fields.map((f) => ({ name: f.name, type: f.type, ro: f.readOnly, rel: f.relationTo, relLabel: f.relationLabelField, nullable: f.nullable, opt: f.optionType }));
  return `<form id="pf-form" class="pf-form">
  <div class="pf-grid">${rows}</div>
  <div class="pf-actions">
    <button type="submit" class="pf-btn pf-primary">Save</button>
    <a class="pf-btn" href="${opts.basePath}/${model.name}">Cancel</a>
    ${opts.canDelete ? `<button type="button" id="pf-delete" class="pf-btn pf-danger" style="margin-inline-start:auto">Delete</button>` : ""}
  </div>
  <p id="pf-msg" class="pf-msg" role="status"></p>
</form>
<script type="application/json" id="pf-meta">${JSON.stringify(meta).replace(/</g, "\\u003c")}</script>
<script>${formScript(model, opts)}</script>
${model.fields.some((f) => f.type === "richtext") ? `<script>${richtextScript()}</script>` : ""}`;
}

function formScript(model: EntityModel, opts: FormOptions): string {
  return `(function(){
  var path=${JSON.stringify(model.path)}, base=${JSON.stringify(opts.basePath)}, ent=${JSON.stringify(model.name)}, relPaths=${JSON.stringify(opts.relPaths)};
  var meta=JSON.parse(document.getElementById("pf-meta").textContent);
  var form=document.getElementById("pf-form"), msg=document.getElementById("pf-msg");
  var id=new URLSearchParams(location.search).get("id");
  function el(n){return form.elements[n];}
  function asDate(v,len){var d=(typeof v==="number"||/^\\d+$/.test(String(v)))?new Date(Number(v)):new Date(v);return isNaN(d)?"":d.toISOString().slice(0,len);}
  meta.filter(function(m){return m.rel;}).forEach(function(m){
    var sel=el(m.name), rp=relPaths[m.rel]; if(!sel||!rp) return;
    fetch(rp,{credentials:"same-origin"}).then(function(r){return r.json();}).then(function(rows){
      (Array.isArray(rows)?rows:[]).forEach(function(row){var o=document.createElement("option");o.value=row.id;o.textContent=(row[m.relLabel]||row.name||row.title||("#"+row.id));sel.appendChild(o);});
      if(sel.dataset.val!=null) sel.value=sel.dataset.val;
    }).catch(function(){ if(sel.options[0]) sel.options[0].textContent="— could not load "+m.rel+" —"; });
  });
  if(id){
    fetch(path+"/"+encodeURIComponent(id),{credentials:"same-origin"}).then(function(r){return r.json();}).then(function(rec){
      meta.forEach(function(m){var e=el(m.name); if(!e||rec[m.name]==null) return;
        if(m.type==="boolean"){e.checked=!!rec[m.name];}
        else if(m.type==="json"){e.value=typeof rec[m.name]==="object"?JSON.stringify(rec[m.name],null,2):rec[m.name];}
        else if(m.type==="date"){e.value=asDate(rec[m.name],10);}
        else if(m.type==="datetime"){e.value=asDate(rec[m.name],16);}
        else if(m.rel){e.dataset.val=rec[m.name]; e.value=rec[m.name];}
        else{e.value=rec[m.name];}
      });
    }).catch(function(){msg.textContent="Could not load record.";});
  }
  form.addEventListener("submit",function(ev){ev.preventDefault();
    var payload={}, bad=false;
    meta.forEach(function(m){ if(m.ro) return; var e=el(m.name); if(!e) return; var v;
      if(m.type==="boolean"){v=e.checked;}
      else if(m.type==="number"||m.rel){v=e.value===""?null:Number(e.value);}
      else if(m.type==="select"){v=e.value===""?(m.nullable?null:""):(m.opt==="number"?Number(e.value):m.opt==="boolean"?e.value==="true":e.value);}
      else if(m.type==="json"){ if(!e.value){v=null;} else { try{v=JSON.parse(e.value);}catch(x){msg.textContent="Invalid JSON in "+m.name;bad=true;return;} } }
      else{v=e.value===""?(m.nullable?null:""):e.value;}
      if(v!==null||m.nullable) payload[m.name]=v;
    });
    if(bad) return; msg.textContent="Saving…";
    fetch(id?path+"/"+encodeURIComponent(id):path,{method:id?"PATCH":"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify(payload)})
      .then(function(r){if(!r.ok)return r.json().catch(function(){return{};}).then(function(d){throw new Error((d&&(d.error||d.title))||("HTTP "+r.status));}); location.href=base+"/"+ent;})
      .catch(function(e){msg.textContent="Could not save: "+e.message;});
  });
  var del=document.getElementById("pf-delete");
  if(del&&id) del.addEventListener("click",function(){ if(!confirm("Delete this "+ent+"? This can't be undone.")) return;
    fetch(path+"/"+encodeURIComponent(id),{method:"DELETE",credentials:"same-origin"}).then(function(r){if(r.ok)location.href=base+"/"+ent;else msg.textContent="Could not delete.";}).catch(function(){});
  });
})();`;
}
