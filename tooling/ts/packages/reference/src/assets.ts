/** The self-contained CSS + client JS for the reference page. No build step, no CDN — inlined into the HTML so
 *  it runs in a Cloudflare Worker. Light + dark themes via [data-theme]; all interactivity is dependency-free.
 *  try-it does a same-origin fetch; code-sample tabs/copy/lens/drift are all vanilla. */

export const STYLE = `
:root{--bg:#f8fafc;--panel:#fff;--panel2:#f8fafc;--fg:#0f172a;--muted:#64748b;--line:#e2e8f0;--accent:#6366f1;--accentbg:#eef2ff;--accentline:#e0e7ff;--code:#f1f5f9;--codefg:#334155;--shadow:0 1px 2px rgba(0,0,0,.04)}
[data-theme="dark"]{--bg:#0b1120;--panel:#0f172a;--panel2:#131c30;--fg:#e2e8f0;--muted:#94a3b8;--line:#1e293b;--accent:#818cf8;--accentbg:#1e1b4b;--accentline:#312e81;--code:#1e293b;--codefg:#cbd5e1;--shadow:0 1px 2px rgba(0,0,0,.3)}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;font:15px/1.55 Inter,system-ui,-apple-system,sans-serif;color:var(--fg);background:var(--bg);display:flex}
code,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}a{color:var(--accent)}
.skip{position:absolute;left:-999px;top:0;background:var(--accent);color:#fff;padding:8px 14px;z-index:100;border-radius:0 0 8px 0}.skip:focus{left:0}
.side{width:300px;min-width:300px;height:100vh;position:sticky;top:0;overflow:auto;border-right:1px solid var(--line);background:var(--panel);padding:16px;display:flex;flex-direction:column;gap:12px}
.side-head{display:flex;align-items:center;justify-content:space-between}.logo{font-weight:800;font-size:18px;color:var(--accent)}.side-actions{display:flex;gap:6px}
.iconbtn{cursor:pointer;border:1px solid var(--line);background:var(--panel2);color:var(--muted);border-radius:8px;width:30px;height:30px;display:grid;place-items:center;font-size:14px}.iconbtn:hover{color:var(--fg);border-color:var(--accent)}
#filter{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;background:var(--bg);color:var(--fg)}
.kbd{font-size:10px;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:0 4px}
.lens{border:1px solid var(--accentline);background:var(--accentbg);border-radius:10px;padding:8px}.lens-label{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--accent);font-weight:800;margin-bottom:6px}.lens-btns{display:flex;flex-direction:column;gap:3px}
.lens-btn{cursor:pointer;text-align:left;border:1px solid transparent;background:transparent;color:var(--fg);border-radius:6px;padding:4px 8px;font-size:13px;display:flex;justify-content:space-between;align-items:center}.lens-btn:hover{background:var(--panel)}.lens-btn.on{background:var(--accent);color:#fff;font-weight:600}.lens-btn .cnt{font-size:11px;opacity:.7}
nav{overflow:auto;flex:1;margin:0 -6px}.nav-group{margin-bottom:10px}.nav-tag{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;padding:4px 8px}
.nav-op{display:flex;gap:8px;align-items:center;padding:4px 8px;border-radius:6px;color:var(--fg);text-decoration:none;font-size:13px;border-left:2px solid transparent}.nav-op:hover{background:var(--accentbg)}.nav-op.active{background:var(--accentbg);border-left-color:var(--accent);font-weight:600}.nav-op .nm{font-size:9px;font-weight:800;min-width:38px}
.side-foot{font-size:11px;color:var(--muted);border-top:1px solid var(--line);padding-top:10px;display:flex;flex-direction:column;gap:4px}
.sdk-dl{background:var(--accent);color:#fff !important;border-radius:7px;padding:6px 10px;font-weight:700;text-align:center;text-decoration:none;margin-bottom:4px}.sdk-dl:hover{filter:brightness(1.1)}
main{flex:1;max-width:980px;margin:0 auto;padding:28px 36px 90px;min-width:0}
.hero{border-bottom:1px solid var(--line);padding-bottom:20px;margin-bottom:18px}
.badges{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap}.badge{font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;background:var(--code);color:var(--muted)}.badge.v4{background:var(--accent);color:#fff}.badge.cost{background:var(--accentbg);color:var(--accent);border:1px solid var(--accentline)}
h1{font-size:30px;margin:.1em 0}.tagline{font-size:16px;margin:.2em 0}
.native-note{font-size:13px;color:var(--muted);background:var(--accentbg);border:1px solid var(--accentline);border-radius:10px;padding:10px 12px;margin-top:12px}.muted{color:var(--muted)}
.serverbar,.authbar{display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px}.serverbar select,.authbar input{padding:5px 8px;border:1px solid var(--line);border-radius:7px;background:var(--bg);color:var(--fg);font-size:13px}.authbar input{flex:1;max-width:340px}
.diags{margin-top:10px;font-size:12px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:7px 11px}[data-theme="dark"] .diags{color:#fcd34d;background:#451a03;border-color:#78350f}
.toolbar{display:flex;gap:8px;align-items:center;margin:14px 0 6px;flex-wrap:wrap}.tbtn{cursor:pointer;font-size:12px;border:1px solid var(--line);background:var(--panel);color:var(--muted);border-radius:7px;padding:4px 10px}.tbtn:hover{color:var(--fg);border-color:var(--accent)}
.group{margin:26px 0}.group>h2{font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:var(--accent);border-bottom:1px solid var(--line);padding-bottom:8px;scroll-margin-top:14px}
.op{background:var(--panel);border:1px solid var(--line);border-radius:12px;margin:14px 0;scroll-margin-top:14px;box-shadow:var(--shadow);overflow:hidden}
.op-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:14px 16px;cursor:pointer;width:100%;text-align:left;background:none;border:0;font:inherit;color:inherit}
.op-head:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.method{color:#fff;font-size:11px;font-weight:800;padding:3px 9px;border-radius:6px;letter-spacing:.03em}.op-path{font-size:14px;background:var(--code);color:var(--codefg);padding:2px 8px;border-radius:6px}.op-name{font-weight:700}.dep{font-size:11px;color:#b91c1c;background:#fee2e2;padding:2px 7px;border-radius:5px}.spacer{margin-left:auto}
.acc{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;white-space:nowrap}.acc-any{background:#ecfdf5;color:#047857}.acc-auth{background:#eff6ff;color:#1d4ed8}.acc-admin{background:#fef2f2;color:#b91c1c}
[data-theme="dark"] .acc-any{background:#064e3b;color:#6ee7b7}[data-theme="dark"] .acc-auth{background:#1e3a8a;color:#bfdbfe}[data-theme="dark"] .acc-admin{background:#7f1d1d;color:#fecaca}
.cost{font-size:12px;font-weight:700;color:var(--accent);background:var(--accentbg);border:1px solid var(--accentline);padding:3px 9px;border-radius:999px;white-space:nowrap;cursor:help}.cost.uncosted{color:#92400e;background:#fffbeb;border-color:#fde68a}[data-theme="dark"] .cost.uncosted{color:#fcd34d;background:#451a03;border-color:#78350f}.cost-raw{color:var(--muted);font-weight:500}
.drift{font-size:11px;font-weight:700;padding:0 6px;border-radius:999px;margin-left:4px}.drift.up{color:#b91c1c;background:#fef2f2}.drift.down{color:#047857;background:#ecfdf5}.drift.ok{color:var(--muted);background:var(--code)}
.caret{color:var(--muted);transition:transform .15s}.op.collapsed .caret{transform:rotate(-90deg)}.op-body{padding:0 16px 16px}.op.collapsed .op-body{display:none}
.multi{font-size:12px;background:var(--accentbg);border:1px solid var(--accentline);border-radius:8px;padding:7px 10px;margin:10px 0}
.collide{font-size:12px;border-radius:8px;padding:8px 11px;margin:10px 0;border:1px solid}.collide.provable-collision{background:#fef2f2;border-color:#fecaca;color:#991b1b}.collide.not-statically-determinable{background:#fffbeb;border-color:#fde68a;color:#92400e}
[data-theme="dark"] .collide.provable-collision{background:#450a0a;border-color:#7f1d1d;color:#fca5a5}[data-theme="dark"] .collide.not-statically-determinable{background:#451a03;border-color:#78350f;color:#fcd34d}
.op-summary{margin:.6em 0 .2em;font-weight:500}.sec{font-size:12px;margin:8px 0}
.samples{margin:10px 0;border:1px solid var(--line);border-radius:10px;overflow:hidden}.tabs{display:flex;gap:2px;background:var(--panel2);border-bottom:1px solid var(--line);padding:4px 6px;align-items:center}
.tab{cursor:pointer;font-size:12px;border:0;background:none;color:var(--muted);padding:4px 10px;border-radius:6px}.tab.on{background:var(--accent);color:#fff;font-weight:600}.tabs .copy{margin-left:auto}
.sample{display:none;margin:0;border-radius:0;border:0}.sample.on{display:block}
.tryit{margin:10px 0;border:1px dashed var(--accentline);border-radius:10px;padding:10px}.ti-send{font-weight:700;color:#fff;background:var(--accent);border-color:var(--accent)}.ti-body{margin-top:8px}.ti-body-input{width:100%;font-family:ui-monospace,monospace;font-size:12px;border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--bg);color:var(--fg)}
.ti-out{margin-top:8px}.ti-status{font-size:12px;font-weight:700;padding:4px 9px;border-radius:6px;display:inline-block}.ti-status.s2{background:#ecfdf5;color:#047857}.ti-status.s4{background:#fffbeb;color:#92400e}.ti-status.s5{background:#fef2f2;color:#b91c1c}
.ti{width:100%;padding:4px 7px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg);font-size:12px}
.slots{display:flex;flex-direction:column;gap:12px;margin-top:12px}.slot-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;margin-bottom:5px;display:flex;gap:8px;align-items:center}
.copy{cursor:pointer;font-size:10px;border:1px solid var(--line);background:var(--panel2);color:var(--muted);border-radius:5px;padding:1px 6px;font-weight:600}.copy:hover{color:var(--fg);border-color:var(--accent)}
.chip{display:inline-block;font-size:12px;font-family:ui-monospace,monospace;background:var(--code);color:var(--codefg);padding:1px 7px;border-radius:5px}a.chip{text-decoration:none}
.inh{font-size:10px;color:var(--muted);background:var(--code);border-radius:4px;padding:0 5px;font-weight:600;text-transform:uppercase}
.src{font-size:10px;color:var(--muted);margin-left:auto}.src code{font-family:ui-monospace,monospace;font-size:10px;background:var(--code);color:var(--codefg);padding:1px 5px;border-radius:4px}.src[title]{cursor:help}
.constraints{display:inline-flex;gap:4px;flex-wrap:wrap}.cn{font-size:11px;color:#0e7490;background:#ecfeff;border:1px solid #cffafe;border-radius:5px;padding:0 5px}[data-theme="dark"] .cn{color:#67e8f9;background:#083344;border-color:#155e75}.cn code{background:none;padding:0}
.props{width:100%;border-collapse:collapse;font-size:13px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;overflow:hidden}.props th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);padding:6px 10px;background:var(--code);font-weight:700}.props td{padding:6px 10px;border-bottom:1px solid var(--line);vertical-align:top}.props tr:last-child td{border-bottom:0}
.pname{font-family:ui-monospace,monospace;font-weight:600;white-space:nowrap}.req{color:var(--accent);font-weight:800;margin-left:2px}.ptype{color:#0e7490}.pdesc{color:var(--muted)}.pdefault{color:#047857;font-family:ui-monospace,monospace;font-size:12px}.penum code,.enum-vals code{font-size:11px;background:var(--code);padding:0 4px;border-radius:4px}.pnest{margin-top:6px;padding-left:8px;border-left:2px solid var(--accentline)}
.ref{border-left:2px solid var(--accentline);padding-left:8px}.ref-name{font-size:12px;font-family:ui-monospace,monospace;color:var(--accent);font-weight:600;text-decoration:none}.ref-link{text-decoration:none}
.compose{border-left:2px solid var(--accentline);padding-left:8px}.compose-kind{font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase}.variant{margin:4px 0}.arr{display:flex;gap:6px;align-items:baseline;flex-wrap:wrap}
.responses{margin-top:14px;border-top:1px dashed var(--line);padding-top:12px}.resp{margin:8px 0}.status{font-weight:800;font-family:ui-monospace,monospace}.status.s2{color:#15803d}.status.s4{color:#b45309}.status.s5{color:#b91c1c}.status.sd{color:var(--muted)}.rname{font-family:ui-monospace,monospace;color:var(--muted);font-size:13px}.example{margin-top:6px}
pre.json{background:var(--code);color:var(--codefg);border-radius:8px;padding:10px 12px;font-size:12.5px;overflow:auto;margin:6px 0;border:1px solid var(--line);white-space:pre-wrap;word-break:break-word}
.section{margin:40px 0}.section>h2{font-size:18px;border-bottom:1px solid var(--line);padding-bottom:8px;scroll-margin-top:14px}
.matrix{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}.matrix th,.matrix td{padding:6px 10px;border-bottom:1px solid var(--line);text-align:left}.matrix th{font-size:11px;text-transform:uppercase;color:var(--muted)}.matrix td.cell{text-align:center;font-weight:800}.yes{color:#15803d}.scoped{color:#b45309}.no{color:var(--line)}.matrix .opn{font-family:ui-monospace,monospace}
.model{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:12px 0;scroll-margin-top:14px}.model>h3{margin:0 0 8px;font-family:ui-monospace,monospace;font-size:15px}
.scheme{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:10px 0;scroll-margin-top:14px}
.foot{margin-top:50px;padding-top:18px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}
.view-status{font-size:11px;color:var(--muted);margin-top:6px;line-height:1.4}
.cx-calc{display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:var(--accentbg);border:1px solid var(--accentline);border-radius:10px;padding:10px 12px;margin:10px 0;font-size:14px}.cx-calc input{width:80px;padding:3px 6px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)}.cx-table th.sortable{cursor:pointer}
.ada-form{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.ada-form input,.ada-form select{padding:6px 9px;border:1px solid var(--line);border-radius:7px;background:var(--bg);color:var(--fg);font-size:13px}.ada-form input{flex:1;min-width:160px;font-family:ui-monospace,monospace}#ada-out{margin-top:8px}
.proj-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:12px}.proj-card{display:block;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;text-decoration:none;color:var(--fg)}.proj-card:hover{border-color:var(--accent)}.proj-name{font-weight:700;font-size:14px}.proj-detail{font-size:12px;margin-top:2px}
.harden{font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap}.harden-hero{text-decoration:none}
.harden-op{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:10px 0;background:var(--panel)}.harden-op-head{display:flex;gap:8px;align-items:center}.harden-op-head a{text-decoration:none}
.harden-list{margin:8px 0 0;padding-left:18px;font-size:13px}.harden-list li{margin:3px 0}
.sev{font-size:10px;font-weight:800;text-transform:uppercase;padding:0 5px;border-radius:4px}.sev-high{background:#fee2e2;color:#991b1b}.sev-medium{background:#fef9c3;color:#854d0e}.sev-low{background:#f1f5f9;color:#475569}
[data-theme="dark"] .sev-high{background:#7f1d1d;color:#fecaca}[data-theme="dark"] .sev-medium{background:#451a03;color:#fcd34d}
.ok-line{color:#166534;background:#dcfce7;border-radius:8px;padding:8px 12px;display:inline-block}
.hidden-by-view,.hidden-by-filter{display:none !important}.menu-toggle{display:none}
@media(max-width:820px){.side{position:fixed;left:0;top:0;z-index:50;transform:translateX(-100%);transition:transform .2s;box-shadow:0 0 40px rgba(0,0,0,.2)}body.nav-open .side{transform:translateX(0)}.menu-toggle{display:grid;position:fixed;top:12px;left:12px;z-index:60}main{padding:60px 18px 80px}}
`;

// Client JS — no template literals (this whole string is one); single quotes + concatenation only.
export const SCRIPT = `
(function(){
  var root=document.documentElement, body=document.body;
  try{var t=localStorage.getItem('suluk-theme'); if(t) root.setAttribute('data-theme',t);}catch(e){}
  function toggleTheme(){var d=root.getAttribute('data-theme')==='dark'?'':'dark'; if(d)root.setAttribute('data-theme',d);else root.removeAttribute('data-theme'); try{localStorage.setItem('suluk-theme',d);}catch(e){}}
  document.querySelectorAll('[data-act=theme]').forEach(function(b){b.addEventListener('click',toggleTheme);});
  document.querySelectorAll('[data-act=menu]').forEach(function(b){b.addEventListener('click',function(){body.classList.toggle('nav-open');});});
  function esc(s){return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
  // filter (operations + models)
  var filter=document.getElementById('filter');
  function applyFilter(){var q=(filter.value||'').trim().toLowerCase();
    document.querySelectorAll('.op,.model').forEach(function(s){var hit=!q||(s.dataset.name||'').indexOf(q)>=0; s.classList.toggle('hidden-by-filter',!hit);});
    document.querySelectorAll('.nav-op').forEach(function(a){a.style.display=!q||(a.dataset.name||'').indexOf(q)>=0?'':'none';});}
  filter&&filter.addEventListener('input',applyFilter);
  document.addEventListener('keydown',function(e){if((e.key==='/'||((e.metaKey||e.ctrlKey)&&e.key==='k'))&&document.activeElement!==filter&&document.activeElement.tagName!=='INPUT'&&document.activeElement.tagName!=='TEXTAREA'){e.preventDefault();filter&&filter.focus();}if(e.key==='Escape'&&document.activeElement===filter){filter.value='';applyFilter();filter.blur();}});
  // collapse (op-head is a real button → keyboard works; sync aria-expanded)
  document.querySelectorAll('.op-head').forEach(function(h){h.addEventListener('click',function(){var op=h.parentElement; var c=op.classList.toggle('collapsed'); h.setAttribute('aria-expanded',String(!c));});});
  document.querySelectorAll('[data-act=expand]').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('.op').forEach(function(o){o.classList.remove('collapsed');var h=o.querySelector('.op-head');h&&h.setAttribute('aria-expanded','true');});});});
  document.querySelectorAll('[data-act=collapse]').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('.op').forEach(function(o){o.classList.add('collapsed');var h=o.querySelector('.op-head');h&&h.setAttribute('aria-expanded','false');});});});
  // copy + deep-link
  document.addEventListener('click',function(e){var c=e.target.closest('.copy'); if(!c)return; e.preventDefault(); var v=c.getAttribute('data-copy'); if(c.classList.contains('deeplink'))v=location.origin+location.pathname+'#'+c.getAttribute('data-frag'); navigator.clipboard&&navigator.clipboard.writeText(v||''); var o=c.textContent; c.textContent='copied'; setTimeout(function(){c.textContent=o;},900);});
  // code-sample tabs
  document.addEventListener('click',function(e){var t=e.target.closest('.tab[data-tab]'); if(!t)return; var w=t.closest('.samples'); w.querySelectorAll('.tab').forEach(function(x){x.classList.toggle('on',x===t);}); w.querySelectorAll('.sample').forEach(function(s){s.classList.toggle('on',s.id===t.dataset.tab);}); var cp=w.querySelector('.copy'),act=document.getElementById(t.dataset.tab); if(cp&&act)cp.setAttribute('data-copy',act.textContent);});
  // server selector → try-it base
  var ssel=document.getElementById('server-select'); if(ssel){window.__SULUK_SERVER=ssel.value; ssel.addEventListener('change',function(){window.__SULUK_SERVER=ssel.value;});}
  // TRY-IT (same-origin fetch)
  document.addEventListener('click',function(e){var b=e.target.closest('.ti-send'); if(!b)return; var op=b.closest('.op'); var method=(b.dataset.method||'get').toUpperCase();
    var base=(window.__SULUK_SERVER!==undefined?window.__SULUK_SERVER:b.dataset.server)||''; var path=(b.dataset.path||'').replace(/\\{[?&][^}]*\\}/g,''); var query=[];
    op.querySelectorAll('.ti').forEach(function(inp){var n=inp.dataset.paramName,loc=inp.dataset.paramIn,v=inp.value; if(!v)return; if(loc==='path')path=path.replace(new RegExp('[:{]\\\\+?'+n+'\\\\}?'),encodeURIComponent(v)); else if(loc==='query')query.push(encodeURIComponent(n)+'='+encodeURIComponent(v));});
    if(!/^https?:/.test(base)&&path[0]!=='/')path='/'+path; var u=base+path+(query.length?'?'+query.join('&'):'');
    var headers={}; op.querySelectorAll('.ti[data-param-in=header]').forEach(function(inp){if(inp.value)headers[inp.dataset.paramName]=inp.value;});
    var tok=document.getElementById('ti-token'); if(tok&&tok.value)headers['authorization']='Bearer '+tok.value;
    var bodyEl=op.querySelector('.ti-body-input'),bodyVal=null; if(b.dataset.hasBody&&bodyEl){headers['content-type']='application/json';bodyVal=bodyEl.value;}
    var out=op.querySelector('.ti-out'); out.innerHTML='<div class="muted">sending…</div>'; var t0=Date.now();
    fetch(u,{method:method,headers:headers,body:(method==='GET'||method==='HEAD')?undefined:bodyVal}).then(function(r){return r.text().then(function(txt){var ms=Date.now()-t0,pretty=txt; try{pretty=JSON.stringify(JSON.parse(txt),null,2);}catch(e){} out.innerHTML='<div class="ti-status s'+String(r.status).charAt(0)+'">'+r.status+' '+esc(r.statusText)+' · '+ms+'ms · '+esc(u)+'</div><pre class="json">'+esc(pretty)+'</pre>';});}).catch(function(err){out.innerHTML='<div class="ti-status s5">error: '+esc(err.message||err)+'</div>';});});
  // scroll-spy + deep-link load
  var navmap={}; document.querySelectorAll('.nav-op').forEach(function(a){navmap[a.getAttribute('href').slice(1)]=a;});
  var spy=new IntersectionObserver(function(ents){ents.forEach(function(en){if(en.isIntersecting){var a=navmap[en.target.id]; if(a){document.querySelectorAll('.nav-op.active').forEach(function(x){x.classList.remove('active');});a.classList.add('active');}}});},{rootMargin:'-10% 0px -80% 0px'});
  document.querySelectorAll('.op').forEach(function(o){spy.observe(o);});
  document.querySelectorAll('.nav-op').forEach(function(a){a.addEventListener('click',function(){body.classList.remove('nav-open');});});
  if(location.hash){var el=document.getElementById(location.hash.slice(1)); el&&setTimeout(function(){el.scrollIntoView();},60);}
  // VIEW-AS lens
  var views=document.querySelectorAll('.lens-btn');
  function setView(id){views.forEach(function(b){var on=b.dataset.view===id;b.classList.toggle('on',on);b.setAttribute('aria-checked',String(on));}); var shown=0,total=0;
    document.querySelectorAll('.op').forEach(function(o){total++;var on=id==='all'||(o.dataset.reach||'').split(' ').indexOf(id)>=0; o.classList.toggle('hidden-by-view',!on); if(on)shown++; var a=navmap[o.id]; if(a)a.classList.toggle('hidden-by-view',!on);});
    var c=document.getElementById('view-count'); if(c)c.textContent=shown;
    var st=document.getElementById('view-status'); if(st){if(id==='all'){st.textContent='showing all '+total+' — the canonical document';}else{var lbl=id;views.forEach(function(b){if(b.dataset.view===id)lbl=b.textContent.trim();});st.textContent='viewing as '+lbl+' · '+(total-shown)+' hidden by access policy (still reachable on the wire — server-side authz is the boundary)';}}
    try{localStorage.setItem('suluk-view',id);}catch(e){}}
  views.forEach(function(b){b.addEventListener('click',function(){setView(b.dataset.view);});});
  var saved='all'; try{saved=localStorage.getItem('suluk-view')||'all';}catch(e){} setView(saved);
  // L2 LIVE per-user view: detect the session viewer → auto-select the lens; re-check on focus (the canonical full
  // doc is always escapable via "Everything"). The projection is a client-side legible SUBSET; never access control.
  var who=window.__SULUK_WHOAMI;
  function checkWho(){if(!who)return; fetch(who,{headers:{accept:'application/json'}}).then(function(r){return r.ok?r.json():null;}).then(function(d){if(d&&d.viewer){var has=false;views.forEach(function(b){if(b.dataset.view===d.viewer)has=true;}); if(has)setView(d.viewer);}}).catch(function(){});}
  checkWho(); window.addEventListener('focus',checkWho);
  // COST EXPLORER — workflow calculator + sort
  function usd(mu){var d=mu/1e6; return d>=0.01?'$'+d.toFixed(2):d>=0.0001?'$'+d.toFixed(6).replace(/0+$/,''):Math.round(mu)+'µ$';}
  var picks=document.querySelectorAll('.cx-pick'),mult=document.getElementById('cx-mult');
  function cxCalc(){var sum=0,bd={}; document.querySelectorAll('.cx-pick:checked').forEach(function(p){sum+=Number(p.dataset.total||0); try{var s=JSON.parse(p.dataset.sources||'{}'); for(var k in s)bd[k]=(bd[k]||0)+s[k];}catch(e){}});
    var sm=document.getElementById('cx-sum'); if(sm)sm.textContent=usd(sum); var b=document.getElementById('cx-bd'); if(b)b.textContent=Object.keys(bd).length?'('+Object.keys(bd).map(function(k){return k+' '+bd[k]+'µ$';}).join(' · ')+')':'';
    var mo=document.getElementById('cx-month'); var n=Number(mult&&mult.value||0); if(mo)mo.textContent=usd(sum*n);}
  picks.forEach(function(p){p.addEventListener('change',cxCalc);}); mult&&mult.addEventListener('input',cxCalc);
  var clr=document.getElementById('cx-clear'); clr&&clr.addEventListener('click',function(){picks.forEach(function(p){p.checked=false;});cxCalc();});
  var sortTh=document.querySelector('.cx-table th[data-sort=cost]'); if(sortTh){sortTh.style.cursor='pointer'; sortTh.addEventListener('click',function(){var tb=sortTh.closest('table').querySelector('tbody'),rows=[].slice.call(tb.querySelectorAll('tr')); rows.sort(function(a,b){return Number(b.dataset.total)-Number(a.dataset.total);}); rows.forEach(function(r){tb.appendChild(r);});});}
  // ADA RESOLUTION PLAYGROUND
  var adaGo=document.getElementById('ada-go');
  if(adaGo)adaGo.addEventListener('click',function(){var idx=window.__SULUK_SIG_INDEX||[],method=(document.getElementById('ada-method').value||'GET').toUpperCase(),path=(document.getElementById('ada-path').value||'').trim().replace(/^\\//,''),ct=(document.getElementById('ada-ct').value||'').trim().toLowerCase(),segs=path.split('/').filter(Boolean),out=document.getElementById('ada-out');
    var matches=idx.filter(function(o){if(o.method!==method)return false;var os=o.pathShape.split('/').filter(Boolean);if(os.length!==segs.length)return false;for(var i=0;i<os.length;i++){if(os[i]!=='{}'&&os[i]!==segs[i])return false;}if(ct&&o.contentType!=='*'&&o.contentType!==ct)return false;return true;});
    if(!matches.length)out.innerHTML='<div class="ti-status s4">no operation matches '+esc(method+' /'+path)+'</div>';
    else if(matches.length===1)out.innerHTML='<div class="ti-status s2">✓ resolves uniquely to <a href="#'+esc(matches[0].id)+'">'+esc(matches[0].name)+'</a></div>';
    else out.innerHTML='<div class="ti-status s5">⚠ COLLISION — '+matches.length+' operations match: '+matches.map(function(m){return '<a href="#'+esc(m.id)+'">'+esc(m.name)+'</a>';}).join(', ')+' — disambiguated by body/query at runtime</div>';});
  // DECLARED-vs-ACTUAL cost drift
  var costUrl=window.__SULUK_COST_URL;
  if(costUrl){fetch(costUrl,{headers:{accept:'application/json'}}).then(function(r){return r.ok?r.json():null;}).then(function(d){if(!d||!d.opStats)return;
    document.querySelectorAll('.op[data-op]').forEach(function(o){var rec=d.opStats[o.dataset.op]; var badge=o.querySelector('[data-drift]'); if(!rec||!rec.count||!badge||!o.hasAttribute('data-cost')||o.dataset.cost==='')return;
      var declared=Number(o.dataset.cost),actual=rec.totalMicroUsd/rec.count;
      if(declared===0){badge.textContent='was free · now '+Math.round(actual)+'µ$'; badge.className='drift '+(actual>0?'up':'ok'); badge.title='declared 0µ$ · actual '+Math.round(actual)+'µ$ (avg of '+rec.count+')'; return;}
      var pct=Math.round((actual-declared)/declared*100); badge.textContent=(pct>0?'▲':pct<0?'▼':'=')+Math.abs(pct)+'%'; badge.className='drift '+(pct>5?'up':pct<-5?'down':'ok'); badge.title='declared '+declared+'µ$ · actual '+Math.round(actual)+'µ$ (avg of '+rec.count+')';});
  }).catch(function(){});}
})();
`;
