/** The self-contained CSS + client JS for the reference page. No build step, no CDN — inlined into the HTML so
 *  it runs in a Cloudflare Worker. Light + dark themes via [data-theme]; all interactivity is dependency-free. */

export const STYLE = `
:root{
  --bg:#f8fafc;--panel:#fff;--panel2:#f8fafc;--fg:#0f172a;--muted:#64748b;--line:#e2e8f0;--accent:#6366f1;
  --accentbg:#eef2ff;--accentline:#e0e7ff;--code:#f1f5f9;--codefg:#334155;--shadow:0 1px 2px rgba(0,0,0,.04);
}
[data-theme="dark"]{
  --bg:#0b1120;--panel:#0f172a;--panel2:#131c30;--fg:#e2e8f0;--muted:#94a3b8;--line:#1e293b;--accent:#818cf8;
  --accentbg:#1e1b4b;--accentline:#312e81;--code:#1e293b;--codefg:#cbd5e1;--shadow:0 1px 2px rgba(0,0,0,.3);
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font:15px/1.55 Inter,system-ui,-apple-system,sans-serif;color:var(--fg);background:var(--bg);display:flex}
code,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
a{color:var(--accent)}
/* sidebar */
.side{width:300px;min-width:300px;height:100vh;position:sticky;top:0;overflow:auto;border-right:1px solid var(--line);background:var(--panel);padding:16px;display:flex;flex-direction:column;gap:12px}
.side-head{display:flex;align-items:center;justify-content:space-between}
.logo{font-weight:800;font-size:18px;color:var(--accent)}
.side-actions{display:flex;gap:6px;align-items:center}
.iconbtn{cursor:pointer;border:1px solid var(--line);background:var(--panel2);color:var(--muted);border-radius:8px;width:30px;height:30px;display:grid;place-items:center;font-size:14px}
.iconbtn:hover{color:var(--fg);border-color:var(--accent)}
#filter{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;background:var(--bg);color:var(--fg)}
.kbd{font-size:10px;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:0 4px;margin-left:6px}
.lens{border:1px solid var(--accentline);background:var(--accentbg);border-radius:10px;padding:8px}
.lens-label{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--accent);font-weight:800;margin-bottom:6px}
.lens-btns{display:flex;flex-direction:column;gap:3px}
.lens-btn{cursor:pointer;text-align:left;border:1px solid transparent;background:transparent;color:var(--fg);border-radius:6px;padding:4px 8px;font-size:13px;display:flex;justify-content:space-between;align-items:center}
.lens-btn:hover{background:var(--panel)}
.lens-btn.on{background:var(--accent);color:#fff;font-weight:600}
.lens-btn .cnt{font-size:11px;opacity:.7}
nav{overflow:auto;flex:1;margin:0 -6px}
.nav-group{margin-bottom:10px}
.nav-tag{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;padding:4px 8px}
.nav-op{display:flex;gap:8px;align-items:center;padding:4px 8px;border-radius:6px;color:var(--fg);text-decoration:none;font-size:13px;border-left:2px solid transparent}
.nav-op:hover{background:var(--accentbg)}
.nav-op.active{background:var(--accentbg);border-left-color:var(--accent);font-weight:600}
.nav-op .nm{font-size:9px;font-weight:800;min-width:38px}
.side-foot{font-size:11px;color:var(--muted);border-top:1px solid var(--line);padding-top:10px;display:flex;flex-direction:column;gap:4px}
/* main */
main{flex:1;max-width:960px;margin:0 auto;padding:28px 36px 90px;min-width:0}
.hero{border-bottom:1px solid var(--line);padding-bottom:20px;margin-bottom:18px}
.badges{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap}
.badge{font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;background:var(--code);color:var(--muted)}
.badge.v4{background:var(--accent);color:#fff}
.badge.cost{background:var(--accentbg);color:var(--accent);border:1px solid var(--accentline)}
h1{font-size:30px;margin:.1em 0}
.tagline{font-size:16px;margin:.2em 0}
.native-note{font-size:13px;color:var(--muted);background:var(--accentbg);border:1px solid var(--accentline);border-radius:10px;padding:10px 12px;margin-top:12px}
.muted{color:var(--muted)}
.toolbar{display:flex;gap:8px;align-items:center;margin:14px 0 6px;flex-wrap:wrap}
.tbtn{cursor:pointer;font-size:12px;border:1px solid var(--line);background:var(--panel);color:var(--muted);border-radius:7px;padding:4px 10px}
.tbtn:hover{color:var(--fg);border-color:var(--accent)}
.group{margin:26px 0}
.group>h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--accent);border-bottom:1px solid var(--line);padding-bottom:8px;scroll-margin-top:14px}
/* operation card */
.op{background:var(--panel);border:1px solid var(--line);border-radius:12px;margin:14px 0;scroll-margin-top:14px;box-shadow:var(--shadow);overflow:hidden}
.op-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:14px 16px;cursor:pointer}
.method{color:#fff;font-size:11px;font-weight:800;padding:3px 9px;border-radius:6px;letter-spacing:.03em}
.op-path{font-size:14px;background:var(--code);color:var(--codefg);padding:2px 8px;border-radius:6px}
.op-name{font-weight:700}
.dep{font-size:11px;color:#b91c1c;background:#fee2e2;padding:2px 7px;border-radius:5px}
.spacer{margin-left:auto}
.acc{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;white-space:nowrap}
.acc-any{background:#ecfdf5;color:#047857}.acc-auth{background:#eff6ff;color:#1d4ed8}.acc-admin{background:#fef2f2;color:#b91c1c}
[data-theme="dark"] .acc-any{background:#064e3b;color:#6ee7b7}[data-theme="dark"] .acc-auth{background:#1e3a8a;color:#bfdbfe}[data-theme="dark"] .acc-admin{background:#7f1d1d;color:#fecaca}
.cost{font-size:12px;font-weight:700;color:var(--accent);background:var(--accentbg);border:1px solid var(--accentline);padding:3px 9px;border-radius:999px;white-space:nowrap;cursor:help}
.cost.uncosted{color:#92400e;background:#fffbeb;border-color:#fde68a}
[data-theme="dark"] .cost.uncosted{color:#fcd34d;background:#451a03;border-color:#78350f}
.cost-raw{color:var(--muted);font-weight:500}
.drift{font-size:11px;font-weight:700;padding:2px 7px;border-radius:999px;margin-left:4px}
.drift.up{color:#b91c1c;background:#fef2f2}.drift.down{color:#047857;background:#ecfdf5}.drift.ok{color:var(--muted);background:var(--code)}
.caret{color:var(--muted);transition:transform .15s}
.op.collapsed .caret{transform:rotate(-90deg)}
.op-body{padding:0 16px 16px}
.op.collapsed .op-body{display:none}
.multi{font-size:12px;background:var(--accentbg);border:1px solid var(--accentline);border-radius:8px;padding:7px 10px;margin:10px 0;color:var(--fg)}
.collide{font-size:12px;border-radius:8px;padding:8px 11px;margin:10px 0;border:1px solid}
.collide.provable-collision{background:#fef2f2;border-color:#fecaca;color:#991b1b}
.collide.not-statically-determinable{background:#fffbeb;border-color:#fde68a;color:#92400e}
[data-theme="dark"] .collide.provable-collision{background:#450a0a;border-color:#7f1d1d;color:#fca5a5}
[data-theme="dark"] .collide.not-statically-determinable{background:#451a03;border-color:#78350f;color:#fcd34d}
.op-summary{margin:.6em 0 .2em;font-weight:500}
.sec{font-size:12px;margin:8px 0}
.slots{display:flex;flex-direction:column;gap:12px;margin-top:12px}
.slot-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;margin-bottom:5px;display:flex;gap:8px;align-items:center}
.copy{cursor:pointer;font-size:10px;border:1px solid var(--line);background:var(--panel2);color:var(--muted);border-radius:5px;padding:1px 6px;font-weight:600}
.copy:hover{color:var(--fg);border-color:var(--accent)}
.chip{display:inline-block;font-size:12px;font-family:ui-monospace,monospace;background:var(--code);color:var(--codefg);padding:1px 7px;border-radius:5px}
.ref-link{text-decoration:none}
.props{width:100%;border-collapse:collapse;font-size:13px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;overflow:hidden}
.props th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);padding:6px 10px;background:var(--code);font-weight:700}
.props td{padding:6px 10px;border-bottom:1px solid var(--line);vertical-align:top}.props tr:last-child td{border-bottom:0}
.pname{font-family:ui-monospace,monospace;font-weight:600;white-space:nowrap}.req{color:var(--accent);font-weight:800;margin-left:2px}
.ptype{color:#0e7490;font-family:ui-monospace,monospace;white-space:nowrap}[data-theme="dark"] .ptype{color:#67e8f9}
.pdesc{color:var(--muted)}.pdefault{color:#047857;font-family:ui-monospace,monospace;font-size:12px}.penum code,.enum-vals code{font-size:11px;background:var(--code);padding:0 4px;border-radius:4px}
.pnest{margin-top:6px;padding-left:8px;border-left:2px solid var(--accentline)}
.ref{border-left:2px solid var(--accentline);padding-left:8px}.ref-name{font-size:12px;font-family:ui-monospace,monospace;color:var(--accent);font-weight:600;text-decoration:none}
.compose{border-left:2px solid var(--accentline);padding-left:8px}.compose-kind{font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase}.variant{margin:4px 0}
.arr{display:flex;gap:6px;align-items:baseline;flex-wrap:wrap}
.responses{margin-top:14px;border-top:1px dashed var(--line);padding-top:12px}
.resp{margin:8px 0}.status{font-weight:800;font-family:ui-monospace,monospace}.status.s2{color:#15803d}.status.s4{color:#b45309}.status.s5{color:#b91c1c}.status.sd{color:var(--muted)}
.rname{font-family:ui-monospace,monospace;color:var(--muted);font-size:13px}
.example{margin-top:6px}
pre.json{background:var(--code);color:var(--codefg);border-radius:8px;padding:10px 12px;font-size:12.5px;overflow:auto;margin:6px 0;border:1px solid var(--line)}
.jk{color:var(--accent)}.js{color:#15803d}.jn{color:#b45309}.jb{color:#7c3aed}
[data-theme="dark"] .js{color:#86efac}[data-theme="dark"] .jn{color:#fcd34d}[data-theme="dark"] .jb{color:#c4b5fd}
/* matrix + models + security */
.section{margin:40px 0}.section>h2{font-size:18px;border-bottom:1px solid var(--line);padding-bottom:8px;scroll-margin-top:14px}
.matrix{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}
.matrix th,.matrix td{padding:6px 10px;border-bottom:1px solid var(--line);text-align:left}
.matrix th{font-size:11px;text-transform:uppercase;color:var(--muted)}
.matrix td.cell{text-align:center;font-weight:800}.yes{color:#15803d}.no{color:var(--line)}
.matrix .opn{font-family:ui-monospace,monospace}
.model{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:12px 0;scroll-margin-top:14px}
.model>h3{margin:0 0 8px;font-family:ui-monospace,monospace;font-size:15px}
.scheme{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:10px 0}
.foot{margin-top:50px;padding-top:18px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}
.hidden-by-view,.hidden-by-filter{display:none !important}
.menu-toggle{display:none}
@media(max-width:820px){
  .side{position:fixed;left:0;top:0;z-index:50;transform:translateX(-100%);transition:transform .2s;box-shadow:0 0 40px rgba(0,0,0,.2)}
  body.nav-open .side{transform:translateX(0)}
  .menu-toggle{display:grid;position:fixed;top:12px;left:12px;z-index:60}
  main{padding:60px 18px 80px}
}
`;

// The client JS. Kept free of template literals (this whole string is one) — single quotes + concatenation only.
export const SCRIPT = `
(function(){
  var root=document.documentElement, body=document.body;
  // theme
  try{var t=localStorage.getItem('suluk-theme'); if(t) root.setAttribute('data-theme',t);}catch(e){}
  function toggleTheme(){var d=root.getAttribute('data-theme')==='dark'?'':'dark'; if(d) root.setAttribute('data-theme',d); else root.removeAttribute('data-theme'); try{localStorage.setItem('suluk-theme',d);}catch(e){}}
  document.querySelectorAll('[data-act=theme]').forEach(function(b){b.addEventListener('click',toggleTheme);});
  // mobile menu
  document.querySelectorAll('[data-act=menu]').forEach(function(b){b.addEventListener('click',function(){body.classList.toggle('nav-open');});});
  // filter
  var filter=document.getElementById('filter');
  function applyFilter(){
    var q=(filter.value||'').trim().toLowerCase();
    document.querySelectorAll('.op').forEach(function(s){var hit=!q||(s.dataset.name||'').indexOf(q)>=0; s.classList.toggle('hidden-by-filter',!hit);});
    document.querySelectorAll('.nav-op').forEach(function(a){var hit=!q||(a.dataset.name||'').indexOf(q)>=0; a.style.display=hit?'':'none';});
  }
  filter&&filter.addEventListener('input',applyFilter);
  document.addEventListener('keydown',function(e){
    if((e.key==='/'||((e.metaKey||e.ctrlKey)&&e.key==='k'))&&document.activeElement!==filter){e.preventDefault();filter&&filter.focus();}
    if(e.key==='Escape'&&document.activeElement===filter){filter.value='';applyFilter();filter.blur();}
  });
  // collapse / expand
  document.querySelectorAll('.op-head').forEach(function(h){h.addEventListener('click',function(e){if(e.target.closest('a,.copy'))return; h.parentElement.classList.toggle('collapsed');});});
  document.querySelectorAll('[data-act=expand]').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('.op').forEach(function(o){o.classList.remove('collapsed');});});});
  document.querySelectorAll('[data-act=collapse]').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('.op').forEach(function(o){o.classList.add('collapsed');});});});
  // copy
  document.addEventListener('click',function(e){var c=e.target.closest('.copy'); if(!c)return; e.stopPropagation(); var v=c.getAttribute('data-copy')||''; navigator.clipboard&&navigator.clipboard.writeText(v); var o=c.textContent; c.textContent='copied'; setTimeout(function(){c.textContent=o;},900);});
  // scroll-spy + deep-link
  var navmap={}; document.querySelectorAll('.nav-op').forEach(function(a){var id=a.getAttribute('href').slice(1); navmap[id]=a;});
  var spy=new IntersectionObserver(function(ents){ents.forEach(function(en){if(en.isIntersecting){var a=navmap[en.target.id]; if(a){document.querySelectorAll('.nav-op.active').forEach(function(x){x.classList.remove('active');}); a.classList.add('active'); }}});},{rootMargin:'-10% 0px -80% 0px'});
  document.querySelectorAll('.op').forEach(function(o){spy.observe(o);});
  document.querySelectorAll('.nav-op').forEach(function(a){a.addEventListener('click',function(){body.classList.remove('nav-open');});});
  if(location.hash){var el=document.getElementById(location.hash.slice(1)); el&&setTimeout(function(){el.scrollIntoView();},60);}
  // VIEW-AS lens: recompute the visible operation SET per viewer (hide, not grey)
  var views=document.querySelectorAll('.lens-btn');
  function setView(id){
    views.forEach(function(b){b.classList.toggle('on',b.dataset.view===id);});
    var shown=0;
    document.querySelectorAll('.op').forEach(function(o){
      var reach=(o.dataset.reach||'').split(' '); var on=id==='all'||reach.indexOf(id)>=0;
      o.classList.toggle('hidden-by-view',!on); if(on)shown++;
      var a=navmap[o.id]; if(a)a.classList.toggle('hidden-by-view',!on);
    });
    var c=document.getElementById('view-count'); if(c)c.textContent=shown;
    try{localStorage.setItem('suluk-view',id);}catch(e){}
  }
  views.forEach(function(b){b.addEventListener('click',function(){setView(b.dataset.view);});});
  var saved='all'; try{saved=localStorage.getItem('suluk-view')||'all';}catch(e){} setView(saved);
  // DECLARED-vs-ACTUAL cost drift — fetch the live ledger if one is wired
  var costUrl=window.__SULUK_COST_URL;
  if(costUrl){fetch(costUrl,{headers:{accept:'application/json'}}).then(function(r){return r.ok?r.json():null;}).then(function(d){
    if(!d||!d.opStats)return; // {opStats:{op:{count,totalMicroUsd}}} — average actual per call
    document.querySelectorAll('.op[data-op]').forEach(function(o){
      var rec=d.opStats[o.dataset.op]; var declared=Number(o.dataset.cost||0); var badge=o.querySelector('[data-drift]');
      if(!rec||!rec.count||!badge||!declared)return;
      var actual=rec.totalMicroUsd/rec.count; var pct=Math.round((actual-declared)/declared*100);
      badge.textContent=(pct>0?'▲':pct<0?'▼':'=')+Math.abs(pct)+'%'; badge.className='drift '+(pct>5?'up':pct<-5?'down':'ok');
      badge.title='declared '+declared+'µ$ · actual '+Math.round(actual)+'µ$ (avg of '+rec.count+' calls)';
    });
  }).catch(function(){});}
})();
`;
