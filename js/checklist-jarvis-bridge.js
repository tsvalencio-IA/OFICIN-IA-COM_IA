(function(){
  'use strict';
  const W=window;
  const DOC=document;
  const CSS_ID='checklistInteligenteOSStyle';
  function $(id){return DOC.getElementById(id);} 
  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
  function placaNorm(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);} 
  function fmtDate(v){try{ if(!v) return '-'; if(v.toDate) v=v.toDate(); const d=v instanceof Date?v:new Date(v); if(isNaN(d.getTime())) return '-'; return d.toLocaleString('pt-BR'); }catch(_){return '-';}}
  function toast(msg,type){ if(typeof W.toast==='function') W.toast(msg,type||'info'); else console.log('[Checklist Jarvis]',msg); }
  function currentOS(){ const id=$('osId')?.value||''; return (W.J?.os||[]).find(o=>o.id===id) || null; }
  function checklistUrl(){
    const saved=(localStorage.getItem('OFICINIA_CHECKLIST_APP_URL')||'').trim();
    if(saved) return saved.replace(/\/+$/,'/');
    const host=(location.hostname||'').toLowerCase();
    if(host.endsWith('.github.io')) return `${location.protocol}//${location.host}/CHECKLIST/`;
    return 'https://tsvalencio-ia.github.io/CHECKLIST/';
  }
  function ensureStyle(){
    if($(CSS_ID)) return;
    const st=DOC.createElement('style'); st.id=CSS_ID;
    st.textContent=`
      #checklistInteligenteOSBox{background:rgba(34,197,94,.055);border:1px solid rgba(34,197,94,.28);border-radius:3px;padding:16px;margin-bottom:16px;color:var(--text,#e5e7eb)}
      #checklistInteligenteOSBox .ci-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px}
      #checklistInteligenteOSBox .ci-title{font-family:var(--fd,monospace);font-weight:800;color:#86efac;letter-spacing:.8px;text-transform:uppercase}
      #checklistInteligenteOSBox .ci-sub{font-family:var(--fm,monospace);font-size:.66rem;color:var(--muted,#94a3b8);margin-top:4px;letter-spacing:.8px}
      #checklistInteligenteOSBox .ci-actions{display:flex;gap:8px;flex-wrap:wrap}
      #checklistInteligenteOSBox .ci-btn{border:1px solid rgba(148,163,184,.35);background:rgba(15,23,42,.45);color:var(--text,#e5e7eb);border-radius:3px;padding:7px 10px;font-family:var(--fm,monospace);font-size:.68rem;font-weight:800;cursor:pointer;text-transform:uppercase;letter-spacing:.7px}
      #checklistInteligenteOSBox .ci-btn.ok{background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.45);color:#bbf7d0}
      #checklistInteligenteOSBox .ci-btn.warn{background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.45);color:#fde68a}
      #checklistInteligenteOSBox .ci-btn.bad{background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.45);color:#fecaca}
      #checklistInteligenteOSBox .ci-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px;margin:10px 0}
      #checklistInteligenteOSBox .ci-kpi{background:rgba(15,23,42,.35);border:1px solid rgba(148,163,184,.18);border-radius:3px;padding:9px}
      #checklistInteligenteOSBox .ci-kpi small{display:block;color:var(--muted,#94a3b8);font-family:var(--fm,monospace);font-size:.58rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px}
      #checklistInteligenteOSBox .ci-kpi b{font-size:1.05rem;color:#fff}
      #checklistInteligenteOSBox .ci-list{display:grid;gap:6px;margin-top:10px;max-height:245px;overflow:auto;padding-right:4px}
      #checklistInteligenteOSBox .ci-item{border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.30);border-radius:3px;padding:8px}
      #checklistInteligenteOSBox .ci-item b{display:block;color:#e5e7eb;margin-bottom:3px}
      #checklistInteligenteOSBox .ci-item small{display:block;color:var(--muted,#94a3b8)}
      #checklistInteligenteOSBox .ci-empty{border:1px dashed rgba(148,163,184,.35);border-radius:3px;padding:12px;color:var(--muted,#94a3b8);font-family:var(--fm,monospace);font-size:.7rem}
    `;
    DOC.head.appendChild(st);
  }
  function ensureBox(){
    ensureStyle();
    const tab=$('tabOS2'); if(!tab) return null;
    let box=$('checklistInteligenteOSBox');
    if(box) return box;
    box=DOC.createElement('div'); box.id='checklistInteligenteOSBox';
    const children=Array.from(tab.children||[]);
    if(children.length>1) tab.insertBefore(box, children[1]); else tab.appendChild(box);
    return box;
  }
  function getResumo(os){
    if(!os) return null;
    if(os.checklistResumo) return os.checklistResumo;
    if(os.checklistUltimo) return os.checklistUltimo;
    if(Array.isArray(os.checklistsTecnicos) && os.checklistsTecnicos.length) return os.checklistsTecnicos[os.checklistsTecnicos.length-1];
    return null;
  }
  function statsFrom(c){ return c?.stats || {ok:0,atencao:0,trocar:0,tecnicas:0,pending:0}; }
  function criticosFrom(c){
    const acFinal=new Set(['atencao','trocar','retificar','regular','ajustar','lubrificar','limpar','revisar']);
    if(Array.isArray(c?.criticos)) return c.criticos;
    if(Array.isArray(c?.itens)) return c.itens.filter(i=>acFinal.has(i.acao)).map(i=>({secao:i.secao,item:i.item,acao:i.acao,acaoLabel:i.acaoLabel||i.acao,obs:i.obs||''}));
    return [];
  }
  async function fetchFreshOS(){
    const id=$('osId')?.value||''; if(!id || !W.db) return currentOS();
    try{
      const snap=await W.db.collection('ordens_servico').doc(id).get();
      if(snap.exists){
        const data={id:snap.id,...snap.data()};
        const arr=W.J?.os||[]; const idx=arr.findIndex(o=>o.id===id); if(idx>=0) arr[idx]=Object.assign(arr[idx]||{},data);
        return data;
      }
    }catch(e){ console.warn('[checklist bridge] refresh OS',e); }
    return currentOS();
  }
  function render(os){
    const box=ensureBox(); if(!box) return;
    os=os||currentOS(); const c=getResumo(os); const id=$('osId')?.value||'';
    const placa=placaNorm($('osPlaca')?.value||os?.placa||'');
    const osRef=id || os?.numero || os?.codigo || os?.osRef || '';
    if(!id && !os){
      box.innerHTML=`<div class="ci-head"><div><div class="ci-title">✅ Checklist Técnico Inteligente</div><div class="ci-sub">Salve a O.S. primeiro para vincular checklist técnico, histórico e entrega.</div></div><div class="ci-actions"><button class="ci-btn ok" type="button" data-ci-open>ABRIR APP CHECKLIST</button></div></div><div class="ci-empty">Nova O.S. ainda sem ID. Após salvar, o checklist pode ser anexado pelo app separado.</div>`;
    } else if(!c){
      box.innerHTML=`<div class="ci-head"><div><div class="ci-title">✅ Checklist Técnico Inteligente</div><div class="ci-sub">O.S. ${esc(osRef||'-')} • Placa ${esc(placa||'-')} • mesmo Firebase do SaaS</div></div><div class="ci-actions"><button class="ci-btn ok" type="button" data-ci-open>ABRIR APP CHECKLIST</button><button class="ci-btn" type="button" data-ci-refresh>ATUALIZAR</button></div></div><div class="ci-empty">Nenhum checklist técnico inteligente anexado nesta O.S. ainda. Abra o app Checklist, preencha a placa/O.S. e salve/anexe. Depois clique em Atualizar.</div>`;
    } else {
      const st=statsFrom(c); const crit=criticosFrom(c);
      box.innerHTML=`<div class="ci-head"><div><div class="ci-title">✅ Checklist Técnico Inteligente</div><div class="ci-sub">${esc(c.placa||placa||'-')} • O.S. ${esc(c.osRef||osRef||'-')} • ${esc(c.responsavel||'-')} • ${fmtDate(c.atualizadoEm||c.criadoEm||os?.checklistAtualizadoEm)}</div></div><div class="ci-actions"><button class="ci-btn ok" type="button" data-ci-open>ABRIR APP</button><button class="ci-btn" type="button" data-ci-view>VER NA O.S.</button><button class="ci-btn" type="button" data-ci-pdf>PDF</button><button class="ci-btn" type="button" data-ci-xlsx>XLSX</button><button class="ci-btn" type="button" data-ci-print>IMPRIMIR</button><button class="ci-btn" type="button" data-ci-refresh>ATUALIZAR</button></div></div><div class="ci-grid"><div class="ci-kpi"><small>OK</small><b>${Number(st.ok||0)}</b></div><div class="ci-kpi"><small>Atenção</small><b>${Number(st.atencao||0)}</b></div><div class="ci-kpi"><small>Trocar</small><b>${Number(st.trocar||0)}</b></div><div class="ci-kpi"><small>Ações técnicas</small><b>${Number(st.tecnicas||0)}</b></div><div class="ci-kpi"><small>Pendentes</small><b>${Number(st.pending||0)}</b></div></div><div class="ci-list">${crit.length?crit.slice(0,60).map(i=>`<div class="ci-item"><b>${esc(i.secao||'Seção')} • ${esc(i.item||'Item')}</b><small>Ação: ${esc(i.acaoLabel||i.acao||'-')}${i.obs?' • Obs.: '+esc(i.obs):''}</small></div>`).join(''):'<div class="ci-empty">Checklist sem itens críticos. Tudo marcado como OK/N/A ou sem ação de serviço.</div>'}</div>`;
    }
    box.querySelector('[data-ci-open]')?.addEventListener('click',abrirApp);
    box.querySelector('[data-ci-refresh]')?.addEventListener('click',async()=>{ box.innerHTML='<div class="ci-empty">Atualizando checklist da O.S...</div>'; render(await fetchFreshOS()); });
    box.querySelector('[data-ci-view]')?.addEventListener('click',()=>modalRelatorio(getResumo(currentOS())||c));
    box.querySelector('[data-ci-pdf]')?.addEventListener('click',()=>gerarPdf(getResumo(currentOS())||c));
    box.querySelector('[data-ci-xlsx]')?.addEventListener('click',()=>gerarXlsx(getResumo(currentOS())||c));
    box.querySelector('[data-ci-print]')?.addEventListener('click',()=>imprimir(getResumo(currentOS())||c));
  }
  function abrirApp(){
    const os=currentOS()||{}; const id=$('osId')?.value||os.id||''; const placa=placaNorm($('osPlaca')?.value||os.placa||''); const km=$('osKm')?.value||os.km||''; const relato=$('osDescricao')?.value||os.desc||os.relato||'';
    const u=new URL(checklistUrl());
    if(placa) u.searchParams.set('placa',placa);
    if(id) u.searchParams.set('os',id);
    if(km) u.searchParams.set('km',km);
    if(relato) u.searchParams.set('relato',relato.slice(0,240));
    W.open(u.toString(),'_blank','noopener');
  }
  function modalRelatorio(c){
    if(!c) return toast('Nenhum checklist anexado nesta O.S.');
    const crit=criticosFrom(c); let ov=$('ciModalOverlay'); if(ov) ov.remove();
    ov=DOC.createElement('div'); ov.id='ciModalOverlay'; ov.style.cssText='position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px';
    ov.innerHTML=`<div style="max-width:860px;width:100%;max-height:88vh;overflow:auto;background:#0f172a;color:#e5e7eb;border:1px solid rgba(148,163,184,.35);border-radius:12px;padding:16px;font-family:system-ui"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><h2 style="margin:0;font-size:18px">Checklist Técnico Inteligente</h2><button style="background:#ef4444;color:white;border:0;border-radius:8px;padding:8px 12px;font-weight:700" data-close>Fechar</button></div><p style="color:#94a3b8">Placa ${esc(c.placa||'-')} • O.S. ${esc(c.osRef||'-')} • Responsável ${esc(c.responsavel||'-')} • ${fmtDate(c.criadoEm)}</p><div>${crit.length?crit.map(i=>`<div style="border:1px solid rgba(148,163,184,.22);border-radius:8px;padding:10px;margin:8px 0"><b>${esc(i.secao||'')} • ${esc(i.item||'')}</b><br><span style="color:#fde68a">${esc(i.acaoLabel||i.acao||'')}</span>${i.obs?`<br><small>${esc(i.obs)}</small>`:''}</div>`).join(''):'<div>Tudo OK/N/A ou sem itens críticos.</div>'}</div></div>`;
    DOC.body.appendChild(ov); ov.querySelector('[data-close]').onclick=()=>ov.remove();
  }
  function gerarPdf(c){
    if(!c) return toast('Nenhum checklist anexado nesta O.S.');
    if(!W.jspdf?.jsPDF) return imprimir(c);
    const doc=new W.jspdf.jsPDF('p','mm','a4'); const crit=criticosFrom(c); let y=12;
    doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text('CHECKLIST TÉCNICO INTELIGENTE',12,y); y+=7;
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.text(`Placa: ${c.placa||'-'}   O.S.: ${c.osRef||'-'}   Responsável: ${c.responsavel||'-'}`,12,y); y+=6; doc.text(`Data: ${fmtDate(c.criadoEm)}   Oficina: ${c.oficinaNome||''}`,12,y); y+=8;
    doc.setFont('helvetica','bold'); doc.text('Itens críticos / ações técnicas',12,y); y+=6; doc.setFont('helvetica','normal');
    (crit.length?crit:[{secao:'Resumo',item:'Sem itens críticos',acaoLabel:'OK / N/A'}]).forEach(i=>{ if(y>280){doc.addPage(); y=12;} doc.text(`${i.secao||''} • ${i.item||''} — ${i.acaoLabel||i.acao||''}`,12,y); y+=5; if(i.obs){ const lines=doc.splitTextToSize('Obs.: '+i.obs,180); doc.text(lines,14,y); y+=lines.length*4; }});
    doc.save(`CHECKLIST_OS_${c.osRef||c.placa||'OS'}.pdf`);
  }
  function gerarXlsx(c){
    if(!c) return toast('Nenhum checklist anexado nesta O.S.');
    if(!W.XLSX) return toast('Biblioteca XLSX não carregou.');
    const wb=W.XLSX.utils.book_new(); const crit=criticosFrom(c);
    W.XLSX.utils.book_append_sheet(wb,W.XLSX.utils.json_to_sheet([{Placa:c.placa,OS:c.osRef,Responsavel:c.responsavel,Data:fmtDate(c.criadoEm),OK:c.stats?.ok||0,Atencao:c.stats?.atencao||0,Trocar:c.stats?.trocar||0,AcoesTecnicas:c.stats?.tecnicas||0,Pendentes:c.stats?.pending||0}]),'Resumo');
    W.XLSX.utils.book_append_sheet(wb,W.XLSX.utils.json_to_sheet((Array.isArray(c.itens)?c.itens:crit).map(i=>({Secao:i.secao,Item:i.item,Acao:i.acaoLabel||i.acao,Observacao:i.obs||''}))),'Itens');
    W.XLSX.writeFile(wb,`CHECKLIST_OS_${c.osRef||c.placa||'OS'}.xlsx`);
  }
  function imprimir(c){
    if(!c) return toast('Nenhum checklist anexado nesta O.S.');
    const crit=criticosFrom(c); const w=W.open('','_blank'); if(!w) return;
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Checklist OS</title><style>@page{size:A4;margin:10mm}body{font-family:Arial,sans-serif;font-size:11px;color:#111}h1{font-size:18px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #444;padding:5px;text-align:left}th{background:#eee}.sign{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14mm;margin-top:18mm}.line{border-top:1px solid #111;text-align:center;padding-top:2mm}</style><h1>Checklist Técnico Inteligente</h1><p><b>Placa:</b> ${esc(c.placa||'-')} &nbsp; <b>O.S.:</b> ${esc(c.osRef||'-')} &nbsp; <b>Responsável:</b> ${esc(c.responsavel||'-')} &nbsp; <b>Data:</b> ${fmtDate(c.criadoEm)}</p><table><thead><tr><th>Seção</th><th>Item</th><th>Ação</th><th>Observação</th></tr></thead><tbody>${(crit.length?crit:[{secao:'Resumo',item:'Sem itens críticos',acaoLabel:'OK / N/A',obs:''}]).map(i=>`<tr><td>${esc(i.secao||'')}</td><td>${esc(i.item||'')}</td><td>${esc(i.acaoLabel||i.acao||'')}</td><td>${esc(i.obs||'')}</td></tr>`).join('')}</tbody></table><div class="sign"><div class="line">Responsável técnico</div><div class="line">Gestor / Conferente</div><div class="line">Cliente</div></div><script>window.onload=()=>setTimeout(()=>print(),250)<\/script>`);
    w.document.close();
  }
  function install(){
    render();
    const oldPrep=W.prepOS;
    if(typeof oldPrep==='function' && !oldPrep.__ciWrapped){
      W.prepOS=function(){ const r=oldPrep.apply(this,arguments); setTimeout(()=>render(),180); return r; };
      W.prepOS.__ciWrapped=true;
    }
    const oldSwitch=W.switchTab;
    if(typeof oldSwitch==='function' && !oldSwitch.__ciWrapped){
      W.switchTab=function(){ const r=oldSwitch.apply(this,arguments); if([].slice.call(arguments).includes('tabOS2')) setTimeout(()=>render(),120); return r; };
      W.switchTab.__ciWrapped=true;
    }
  }
  W.renderChecklistInteligenteOS=function(){ render(); };
  W.abrirChecklistInteligenteAppOS=abrirApp;
  if(DOC.readyState==='loading') DOC.addEventListener('DOMContentLoaded',()=>setTimeout(install,600)); else setTimeout(install,600);
})();
