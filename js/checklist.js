(function(){
'use strict';
const $=id=>document.getElementById(id);
const $$=(sel,root=document)=>Array.from(root.querySelectorAll(sel));
const state={db:null,model:null,placa:'',os:[],histItens:[],selected:new Map(),sintomas:new Set(),activeSecId:'',completedSecoes:new Set(),photos:[],audioBlob:null,audioUrl:'',theme:localStorage.getItem('chk_theme')||'light',user:null,screen:'screenStart',historicoVisivel:false,allowedRoles:['mecanico','mecânico','tecnico','técnico','gerente','gestor','admin','adminmaster','admin master','master','superadmin','admin oficina','adminoficina','admin_master','admin-master']};
const NORM=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const toast=msg=>{const t=$('toast'); if(!t)return; t.textContent=msg; t.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'),3000)};
const nowISO=()=>new Date().toISOString();
function fmtMoney(v){v=Number(v||0);return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});} 
function fmtDate(t){if(!t)return'-';try{return new Date(t).toLocaleDateString('pt-BR')}catch(e){return'-'}}
function ts(v){ if(!v)return 0; if(v.toDate)return v.toDate().getTime(); if(typeof v==='number')return v; const t=Date.parse(v); return isNaN(t)?0:t; }
function placaNorm(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7)}
function statusLabel(s){return ({ok:'OK',atencao:'ATENÇÃO',trocar:'TROCAR',na:'N/A'})[s]||'PENDENTE'}
function statusClass(s){return ({ok:'ok',atencao:'warn',trocar:'bad',na:'na'})[s]||''}
function applyTheme(){document.documentElement.dataset.theme=state.theme; localStorage.setItem('chk_theme',state.theme)}
function getStore(k){return sessionStorage.getItem(k)||localStorage.getItem(k)||'';}
function readSession(){
  const u={tid:getStore('j_tid'),role:getStore('j_role'),nome:getStore('j_nome'),tnome:getStore('j_tnome'),fid:getStore('j_fid'),cloudName:getStore('j_cloud_name')||'dmuvm1o6m',cloudPreset:getStore('j_cloud_preset')||'evolution'};
  try{u.oficina=JSON.parse(sessionStorage.getItem('j_oficina')||localStorage.getItem('j_oficina')||'null')||null}catch(e){u.oficina=null}
  state.user=u; return u;
}
function roleNorm(v){return NORM(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function isRoleAutorizado(role){ const r=roleNorm(role); if(!r)return false; if(r.includes('cliente'))return false; return state.allowedRoles.some(a=>r===a||r.includes(a)); }
function isSessionOk(){ const u=state.user||readSession(); return !!(u.tid && u.nome && isRoleAutorizado(u.role)); }
function applySessionUI(){
  const u=state.user||readSession();
  if($('sessOficina')) $('sessOficina').textContent='🏢 '+(u.tnome||u.oficina?.nome||'Oficina');
  if($('sessMecanico')) $('sessMecanico').textContent='👤 '+(u.nome||'Responsável')+' • '+(u.role||'perfil');
  if($('sessStatus')) $('sessStatus').textContent=isSessionOk()?'✅ Autorizado':'⚠️ Sem sessão autorizada';
  if($('mecanico')) $('mecanico').value=u.nome||'';
  if($('consultaMecanico')) $('consultaMecanico').value=u.nome||'';
}
function go(screen){state.screen=screen;['screenAccess','screenStart','screenConsulta','screenCheck','screenMidia','screenResumo'].forEach(x=>$(x)?.classList.add('hidden')); $(screen)?.classList.remove('hidden'); const idx=['screenStart','screenCheck','screenMidia','screenResumo'].indexOf(screen); $$('.step').forEach((s,i)=>s.classList.toggle('on', idx>=i || (screen==='screenConsulta'&&i===0))); updateNav(); window.scrollTo({top:0,behavior:'smooth'});}
function updateNav(){
 const order=['screenStart','screenCheck','screenMidia','screenResumo']; const i=order.indexOf(state.screen);
 if($('btnVoltar')) $('btnVoltar').classList.toggle('hidden',state.screen==='screenAccess');
 if($('btnAvancar')) $('btnAvancar').textContent=state.screen==='screenResumo'?'Finalizado ✅':'Avançar ➜';
}
function nextScreen(){ if(state.screen==='screenStart') go('screenCheck'); else if(state.screen==='screenCheck'){renderMidia();go('screenMidia')} else if(state.screen==='screenMidia'){renderResumo();go('screenResumo')} else if(state.screen==='screenResumo') toast('Checklist finalizado. Baixe PDF/XLSX ou envie para a O.S.'); else go('screenStart'); }
function prevScreen(){ if(state.screen==='screenResumo') go('screenMidia'); else if(state.screen==='screenMidia') go('screenCheck'); else if(state.screen==='screenCheck'||state.screen==='screenConsulta') go('screenStart'); else go('screenStart'); }
async function boot(){applyTheme(); readSession(); applySessionUI(); bind(); await loadModel(); restoreDraft(); renderSymptoms(); renderGroups(); if(!isSessionOk()) go('screenAccess'); else go('screenStart');}
function bind(){
 $('btnTheme')?.addEventListener('click',()=>{state.theme=state.theme==='dark'?'light':'dark';applyTheme()});
 $('placa')?.addEventListener('input',e=>{e.target.value=placaNorm(e.target.value)});
 $('consultaPlaca')?.addEventListener('input',e=>{e.target.value=placaNorm(e.target.value)});
 $('btnBuscarPlaca')?.addEventListener('click',buscarHistorico);
 $('btnNovo')?.addEventListener('click',novoChecklist);
 $('btnAbrirConsulta')?.addEventListener('click',()=>{go('screenConsulta'); consultarChecklists();});
 $('btnFecharConsulta')?.addEventListener('click',()=>go('screenStart'));
 $('btnConsultar')?.addEventListener('click',consultarChecklists);
 $('buscaItem')?.addEventListener('input',()=>{ const q=NORM($('buscaItem')?.value||''); if(q) state.activeSecId=''; renderGroups(); });
 $('btnAudio')?.addEventListener('click',toggleAudio);
 $('btnDitar')?.addEventListener('click',ditarTexto);
 $('fotoGeral')?.addEventListener('change',e=>addPhotos(e.target.files,'geral','Fotos gerais'));
 $('btnSalvar')?.addEventListener('click',salvarChecklist);
 $('btnPDF')?.addEventListener('click',gerarPDF);
 $('btnXLSX')?.addEventListener('click',gerarXLSX);
 $('btnJSON')?.addEventListener('click',baixarJSON);
 $('btnPrintManual')?.addEventListener('click',imprimirManualUmaPagina);
 $('btnImportOS')?.addEventListener('click',enviarParaOS);
 $('btnVoltar')?.addEventListener('click',prevScreen);
 $('btnAvancar')?.addEventListener('click',nextScreen);
 window.addEventListener('beforeunload',saveDraft);
}
async function loadModel(){
 try{ const r=await fetch('./data/checklist-model.json?ts=20260623v4',{cache:'no-store'}); state.model=await r.json(); }
 catch(e){ console.error(e); state.model={sintomas:[],secoes:[],sugestoes:{}}; toast('Modelo não carregado.'); }
}
function firebaseConfig(){
 try{ const cfg=JSON.parse(sessionStorage.getItem('j_firebase_config')||'null'); if(cfg&&cfg.apiKey&&cfg.projectId) return cfg; }catch(e){}
 return window.JARVIS_FB_CONFIG || window.APP_CONFIG?.firebaseConfig || window.firebaseConfig || window.cfg?.firebaseConfig || window.__firebaseConfig || null;
}
function initFirebase(){
 if(state.db) return state.db;
 try{
   const cfg=firebaseConfig(); if(!window.firebase||!cfg) return null;
   const appName=(cfg.projectId&&cfg.projectId!=='hub-thiaguinho')?('tenant-'+String(cfg.projectId).replace(/[^a-z0-9-]/gi,'-')):undefined;
   let app;
   if(appName) app=firebase.apps.find(a=>a.name===appName)||firebase.initializeApp(cfg,appName); else app=firebase.apps[0]||firebase.initializeApp(cfg);
   state.db=app.firestore(); return state.db;
 }catch(e){console.warn('Firebase indisponível',e); return null;}
}
function tenantFields(){ const u=state.user||readSession(); return {tenantId:u.tid, oficinaId:u.tid, tid:u.tid}; }
function tenantOk(o){ const u=state.user||readSession(); return !u.tid || !o || !('tenantId' in o || 'oficinaId' in o || 'tid' in o) || o.tenantId===u.tid || o.oficinaId===u.tid || o.tid===u.tid; }
function placaFromOS(o){ return placaNorm(o?.placa||o?.placaNorm||o?.placaBusca||o?.veiculoPlaca||o?.placaVeiculo||o?.dadosVeiculo?.placa||o?.veiculo?.placa||o?.carro?.placa||o?.auto?.placa||''); }
async function getDocsFromCol(db,col,limit=1200){
 const u=state.user||readSession(); let docs=[];
 const mapSnap=(snap)=>snap.docs.map(d=>({id:d.id,_col:col,...d.data()}));
 const filtrosTenant=[['tenantId',u.tid],['oficinaId',u.tid],['tid',u.tid]].filter(x=>x[1]);
 for(const [campo,valor] of filtrosTenant){
   try{ const snap=await db.collection(col).where(campo,'==',valor).limit(limit).get(); docs=docs.concat(mapSnap(snap)); if(docs.length) break; }catch(e){}
 }
 if(!docs.length){
   try{ const snap=await db.collection(col).limit(limit).get(); docs=mapSnap(snap).filter(tenantOk); }catch(e2){ console.warn('coleção indisponível',col,e2.message); }
 }
 return docs;
}
async function buscarOSPorPlacaDireto(db,col,placa){
 const variantes=Array.from(new Set([placa, placa.replace(/([A-Z]{3})([0-9A-Z]{4})/,'$1-$2'), placa.toLowerCase()]));
 const campos=['placa','placaNorm','placaBusca','placaVeiculo','veiculoPlaca','dadosVeiculo.placa','veiculo.placa','carro.placa','auto.placa'];
 const out=[];
 for(const campo of campos){
   for(const valor of variantes){
     try{ const snap=await db.collection(col).where(campo,'==',valor).limit(80).get(); snap.docs.forEach(d=>out.push({id:d.id,_col:col,...d.data()})); }catch(e){}
   }
 }
 return out.filter(tenantOk);
}
async function buscarHistorico(){
 state.placa=placaNorm($('placa').value); if(!state.placa){toast('Digite a placa.');return;}
 $('historicoResumo').innerHTML='<div class="notice">🔎 Buscando histórico real da placa no SaaS...</div>';
 state.os=[]; state.histItens=[];
 const db=initFirebase();
 if(!db){ $('historicoResumo').innerHTML='<div class="notice warn">Firebase não carregado. Entre pelo equipe.html antes de abrir o checklist.</div>'; go('screenCheck'); return; }
 const cols=['ordens_servico','ordensServico','os','ordens','ordensServicoFinalizadas','historico_os'];
 for(const col of cols){
   const diretos=await buscarOSPorPlacaDireto(db,col,state.placa);
   state.os.push(...diretos.filter(o=>placaFromOS(o)===state.placa));
 }
 if(!state.os.length){
   for(const col of cols){ const docs=await getDocsFromCol(db,col,1500); state.os.push(...docs.filter(o=>placaFromOS(o)===state.placa)); }
 }
 const seen=new Set(); state.os=state.os.filter(o=>{const k=(o._col||'')+'-'+o.id;if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>ts(b.dataEntrada||b.entrada||b.criadoEm||b.createdAt||b.data)-ts(a.dataEntrada||a.entrada||a.criadoEm||a.createdAt||a.data));
 state.histItens=extrairHistorico(state.os);
 renderHistoricoResumo(); renderGroups(); go('screenCheck'); saveDraft();
}
function extrairHistorico(lista){
 const out=[];
 lista.forEach(o=>{
   const base={osId:o.numero||o.codigo||o.id,docId:o.id,col:o._col,status:o.status||'',data:ts(o.dataEntrada||o.entrada||o.criadoEm||o.createdAt||o.data),cliente:o.clienteNome||o.cliente||o.nomeCliente||o.cliente?.nome||'',veiculo:o.veiculo||o.modelo||o.veiculoModelo||o.veiculo?.modelo||'',km:o.km||o.kmEntrada||o.kmAtual||'',total:o.total||o.valorTotal||0};
   const fontes=[['Peças da O.S.',o.pecas],['Peças orçamento',o.pecasOS],['Peças reais',o.pecasReais],['Peças trocadas',o.pecasTrocadas],['Peças aplicadas',o.pecasAplicadas],['Serviços',o.servicos],['Serviços executados',o.servicosExecutados],['Mão de obra',o.maoDeObra||o.maosObra],['Itens',o.itens],['Itens aprovados',o.itensAprovados],['Checklist anterior',o.checklistItens]];
   fontes.forEach(([fonte,arr])=>{ if(!Array.isArray(arr)) return; arr.forEach(x=>{ const desc=x.descricao||x.desc||x.nome||x.servico||x.peca||x.item||x.titulo||''; if(!desc)return; out.push({...base,fonte,tipo:fonte.toLowerCase().includes('peç')?'peça':'serviço',descricao:desc,norm:NORM(desc),codigo:x.codigo||x.cod||x.codigoOriginal||'',qtd:x.qtd||x.quantidade||1,valor:x.valor||x.total||x.valorVenda||x.venda||0}); }); });
   ['diagnostico','diagnosticoTecnico','diagnosticoInterno','relato','observacoes','obs','defeito','queixa'].forEach(k=>{ if(o[k]) out.push({...base,fonte:k,tipo:'texto',descricao:o[k],norm:NORM(o[k])}); });
 });
 return out;
}
function renderHistoricoResumo(){
 const box=$('historicoResumo');
 if(!state.os.length){box.innerHTML='<div class="notice warn">Nenhuma O.S. encontrada para essa placa. O checklist continua funcionando e será salvo com a placa informada.</div>'; renderHistoricoDetalhado(); return;}
 const ult=state.os[0];
 box.innerHTML=`<div class="hist-card"><b>✅ Histórico carregado da placa ${esc(state.placa)}</b><br>${state.os.length} O.S. • ${state.histItens.length} itens técnicos encontrados<br><span>Última O.S.: ${esc(ult.numero||ult.codigo||ult.id)} • ${fmtDate(ts(ult.dataEntrada||ult.entrada||ult.criadoEm||ult.createdAt))} • ${esc(ult.status||'')}</span><div style="margin-top:8px"><button class="btn small secondary" id="btnVerHistoricoPlaca" type="button">📜 Ver histórico completo da placa</button></div></div>`;
 setTimeout(()=>{$('btnVerHistoricoPlaca')?.addEventListener('click',()=>{state.historicoVisivel=!state.historicoVisivel; renderHistoricoDetalhado();});},0); renderHistoricoDetalhado();
}
function renderHistoricoDetalhado(){
 const box=$('historicoDetalhado'); if(!box)return;
 if(!state.historicoVisivel){ box.innerHTML=''; return; }
 if(!state.os.length){ box.innerHTML='<div class="notice warn">Sem histórico encontrado para esta placa.</div>'; return; }
 const osHtml=state.os.slice(0,12).map(o=>`<div class="consulta-card"><b>O.S. ${esc(o.numero||o.codigo||o.id)} • ${esc(o.status||'-')}</b><small>${fmtDate(ts(o.dataEntrada||o.entrada||o.criadoEm||o.createdAt||o.data))} • ${esc(o.clienteNome||o.cliente||o.nomeCliente||o.cliente?.nome||'-')} • ${esc(o.veiculo||o.modelo||o.veiculoModelo||o.veiculo?.modelo||'-')}</small></div>`).join('');
 const itensHtml=state.histItens.slice(0,80).map(h=>`<div class="hist-line"><b>${esc(h.descricao)}</b><span>${fmtDate(h.data)} • O.S. ${esc(h.osId)} • ${esc(h.fonte)} ${h.km?'• KM '+esc(h.km):''}</span></div>`).join('');
 box.innerHTML=`<div class="card hist-full"><div class="title"><h2>📜 Histórico da placa ${esc(state.placa)}</h2><button class="btn small secondary" id="btnOcultarHistorico" type="button">Ocultar</button></div><div class="notice">Histórico puxado do SaaS para ajudar o mecânico a decidir sem procurar O.S. manualmente.</div><h3>Últimas O.S.</h3>${osHtml||'<div class="notice warn">Sem O.S.</div>'}<h3>Peças, serviços e textos encontrados</h3>${itensHtml||'<div class="notice warn">Sem itens técnicos extraídos.</div>'}</div>`;
 setTimeout(()=>{$('btnOcultarHistorico')?.addEventListener('click',()=>{state.historicoVisivel=false; renderHistoricoDetalhado();});},0);
}
function renderSymptoms(){
 const box=$('symptoms'); if(!box||!state.model)return; box.innerHTML='';
 (state.model.sintomas||[]).forEach(s=>{
   const secId=(s.abrir&&s.abrir[0])||s.id; const prog=secProgress(secId);
   const b=document.createElement('button'); b.type='button'; b.className='symptom'+(state.activeSecId===secId?' active':'')+(state.completedSecoes.has(secId)?' done':'');
   b.innerHTML=`<span class="draw">${s.emoji}</span><span>${esc(s.label)}<span class="prog">${prog.txt}</span></span>`;
   b.onclick=()=>abrirSecao(secId,true); box.appendChild(b);
 });
}
function abrirSecao(secId,scroll){ state.activeSecId=secId; state.sintomas.clear(); const sint=(state.model.sintomas||[]).find(s=>(s.abrir||[]).includes(secId)); if(sint) state.sintomas.add(sint.id); renderSymptoms(); renderGroups(); if(scroll)setTimeout(()=>{ const alvo=document.getElementById('sec-'+secId)||document.getElementById('groups'); alvo?.scrollIntoView({behavior:'smooth',block:'start'}); },80); saveDraft(); }
function concluirSecao(secId){ state.completedSecoes.add(secId); state.activeSecId=''; saveDraft(); renderSymptoms(); renderGroups(); toast('Seção concluída e minimizada.'); setTimeout(()=>document.getElementById('symptoms')?.scrollIntoView({behavior:'smooth',block:'start'}),60); }
function secProgress(secId){ const sec=(state.model.secoes||[]).find(x=>x.id===secId); if(!sec)return {done:0,total:0,crit:0,txt:'toque para abrir'}; let done=0,crit=0,total=(sec.itens||[]).length; (sec.itens||[]).forEach(it=>{const cur=state.selected.get(itemId(sec,it)); if(cur&&cur.status){done++; if(cur.status==='trocar'||cur.status==='atencao')crit++;}}); return {done,total,crit,txt: done?`${done}/${total} avaliados${crit?' • '+crit+' críticos':''}`:'toque para abrir'}; }
function itemId(sec,item){return `${sec.id}__${NORM(item).replace(/\s+/g,'_')}`;}
function termosItem(item){ const mapa={PASTILHA:['PASTILHA','PASTILHAS'],FREIO:['FREIO','FREIOS'],DIANTEIRA:['DIANTEIRA','DIANTEIRO','FRENTE'],TRASEIRA:['TRASEIRA','TRASEIRO'],AMORTECEDOR:['AMORTECEDOR','AMORT'],BORRACHA:['BORRACHA','BORRACHAS'],LAMPADA:['LAMPADA','LAMPADAS','LUZ'],PALHETA:['PALHETA','PALHETAS'],FECHADURA:['FECHADURA','FECHADURAS'],BATENTE:['BATENTE','BATENTES'],COIFA:['COIFA','COIFAS'],BIELETA:['BIELETA','BIELETAS']}; const base=NORM(item).split(' ').filter(w=>w.length>2); const out=new Set(base); base.forEach(w=>Object.keys(mapa).forEach(k=>{ if(w.includes(k)||k.includes(w)) mapa[k].forEach(x=>out.add(x)); })); return Array.from(out); }
function matchHist(item){ const target=NORM(item); const words=termosItem(item); let best=null,score=0; state.histItens.forEach(h=>{ let s=0; words.forEach(w=>{if(h.norm.includes(w))s++}); if(target.includes(h.norm)||h.norm.includes(target))s+=5; if(/DIANTEIR/.test(target)&&/TRASEIR/.test(h.norm))s-=2; if(/TRASEIR/.test(target)&&/DIANTEIR/.test(h.norm))s-=2; if(s>score){score=s;best=h;} }); return score>=2?best:null; }
function shouldOpen(sec){ return state.activeSecId===sec.id; }
function renderGroups(){
 const box=$('groups'); if(!box||!state.model)return; const q=NORM($('buscaItem')?.value||''); box.innerHTML=''; const secoes=state.model.secoes||[];
 if(!state.activeSecId && !q){ const closed=document.createElement('div'); closed.innerHTML='<div class="empty-pick">Escolha uma seção acima. O checklist abre somente aquele conjunto para não cansar o mecânico.</div>'; secoes.forEach(sec=>{ const p=secProgress(sec.id); if(!p.done&&!state.completedSecoes.has(sec.id))return; closed.appendChild(closedSection(sec,p)); }); box.appendChild(closed); updateBottomCount(); return; }
 secoes.forEach(sec=>{
   let items=(sec.itens||[]).filter(it=>!q || NORM(it+' '+sec.titulo).includes(q)); if(!items.length)return;
   const aberto=q?true:shouldOpen(sec); const p=secProgress(sec.id);
   if(!aberto){ box.appendChild(closedSection(sec,p)); return; }
   const det=document.createElement('details'); det.open=true; det.className='sec open-focus'; det.id='sec-'+sec.id;
   det.innerHTML=`<summary><span><span class="draw">${sec.emoji}</span> ${esc(sec.titulo)}</span><small>${p.done}/${p.total}</small></summary><div class="quick-help">Avalie esta seção. Ao terminar, toque em <b>Concluir e minimizar</b>.</div><div class="hint">${esc(sec.hint||'')}</div><div class="items"></div><div class="sec-actions"><button type="button" class="btn secondary" data-close-sec="${sec.id}">Minimizar</button><button type="button" class="btn ok" data-done-sec="${sec.id}">Concluir seção ✅</button></div>`;
   const cont=det.querySelector('.items'); items.forEach(it=>cont.appendChild(renderItem(sec,it)));
   det.querySelector('[data-close-sec]')?.addEventListener('click',()=>{state.activeSecId=''; renderSymptoms(); renderGroups(); saveDraft();});
   det.querySelector('[data-done-sec]')?.addEventListener('click',()=>concluirSecao(sec.id)); box.appendChild(det);
 }); updateBottomCount();
}
function closedSection(sec,p){ const d=document.createElement('button'); d.type='button'; d.className='section-closed'+(state.completedSecoes.has(sec.id)?' done':''); d.innerHTML=`<span><b><span class="draw">${sec.emoji}</span> ${esc(sec.titulo)}</b><small>${p.done}/${p.total} avaliados${p.crit?' • '+p.crit+' críticos':''}</small></span><span>abrir</span>`; d.onclick=()=>abrirSecao(sec.id,true); return d; }
function renderItem(sec,it){
 const id=itemId(sec,it); const cur=state.selected.get(id)||{id,secao:sec.titulo,tipo:guessTipo(sec,it),descricao:it,status:'',obs:'',photos:[]}; const hist=matchHist(it); const el=document.createElement('div'); el.className='item'; el.dataset.id=id; const photoCount=(cur.photos||[]).length;
 el.innerHTML=`<div class="item-head"><div class="item-icon">${sec.emoji}</div><div><b>${esc(it)}</b><div class="mini">${esc(sec.titulo)} • ${cur.tipo}</div></div></div><div class="hist ${hist?'':'empty'}">${hist?`🕘 Última vez: <b>${fmtDate(hist.data)}</b> • O.S. ${esc(hist.osId)} • ${esc(hist.descricao).slice(0,130)} ${hist.km?`• KM ${esc(hist.km)}`:''}`:'Sem histórico encontrado para este item nessa placa.'}</div><div class="status-grid"><button type="button" data-st="ok" class="${cur.status==='ok'?'on ok':''}">✅ OK</button><button type="button" data-st="atencao" class="${cur.status==='atencao'?'on warn':''}">⚠️ Atenção</button><button type="button" data-st="trocar" class="${cur.status==='trocar'?'on bad':''}">🔧 Trocar</button><button type="button" data-st="na" class="${cur.status==='na'?'on na':''}">➖ N/A</button></div><textarea class="obs" placeholder="Comentário rápido desse item (opcional)">${esc(cur.obs||'')}</textarea><div class="item-actions"><label class="filebtn">📷 Foto <input type="file" accept="image/*" capture="environment" multiple hidden></label><span class="photo-count">${photoCount?photoCount+' foto(s)':'sem foto'}</span></div><div class="sugs"></div>`;
 el.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{cur.status=b.dataset.st; state.selected.set(id,cur); renderGroups(); saveDraft();});
 el.querySelector('.obs').oninput=e=>{cur.obs=e.target.value; if(cur.status||cur.obs||cur.photos?.length)state.selected.set(id,cur); saveDraft();};
 el.querySelector('input[type=file]').onchange=e=>addPhotos(e.target.files,id,it,cur); renderSugestoes(el.querySelector('.sugs'), it); return el;
}
function renderSugestoes(box,it){ const sugs=state.model.sugestoes?.[it]||[]; if(!sugs.length)return; box.innerHTML='<div class="sug-title">Sugestão inteligente do conjunto:</div>'; sugs.slice(0,5).forEach(s=>{ const b=document.createElement('button'); b.type='button'; b.className='sug'; b.textContent='＋ '+s; b.onclick=()=>{ const sec=(state.model.secoes||[]).find(x=>(x.itens||[]).includes(s)); if(sec){ const id=itemId(sec,s); const cur=state.selected.get(id)||{id,secao:sec.titulo,tipo:guessTipo(sec,s),descricao:s,status:'atencao',obs:'Sugerido pelo conjunto: '+it,photos:[]}; state.selected.set(id,cur); toast('Item sugerido marcado: '+s); renderGroups(); saveDraft(); }}; box.appendChild(b); }); }
function guessTipo(sec,it){ const n=NORM(sec.titulo+' '+it); return /SERVICO|ALINHAMENTO|BALANCEAMENTO|SANGRIA|LIMPEZA|HIGIENIZACAO|LEITURA|TESTE|REGULAGEM|CALIBRAGEM|RODIZIO|DESMONTAGEM/.test(n)?'serviço':'peça/serviço'; }
function updateBottomCount(){ const arr=Array.from(state.selected.values()).filter(x=>x.status&&x.status!=='ok'&&x.status!=='na'); if($('selCount')) $('selCount').textContent=arr.length; }
async function compressImage(file){ const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)}); const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=data}); const max=1200; let w=img.width,h=img.height; if(Math.max(w,h)>max){ if(w>h){h=Math.round(h*max/w);w=max}else{w=Math.round(w*max/h);h=max} } const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h; canvas.getContext('2d').drawImage(img,0,0,w,h); return canvas.toDataURL('image/jpeg',0.72); }
async function addPhotos(files,itemId,label,cur){ const arr=Array.from(files||[]).slice(0,8); if(!arr.length)return; toast('Processando fotos...'); for(const f of arr){ const dataUrl=await compressImage(f); const photo={id:'ph_'+Date.now()+'_'+Math.random().toString(36).slice(2),itemId,label,dataUrl,createdAt:nowISO()}; state.photos.push(photo); if(cur){cur.photos=cur.photos||[]; cur.photos.push(photo.id); state.selected.set(itemId,cur);} } saveDraft(); renderGroups(); renderMidia(); toast('Foto anexada.'); }
function renderMidia(){ const box=$('photoGrid'); if(!box)return; box.innerHTML=''; if(!state.photos.length){box.innerHTML='<div class="notice">Nenhuma foto anexada ainda.</div>'; return;} state.photos.forEach(p=>{ const d=document.createElement('div'); d.className='photo'; d.innerHTML=`<img src="${p.dataUrl}" alt="foto"><div><b>${esc(p.label)}</b><button type="button">Remover</button></div>`; d.querySelector('button').onclick=()=>{state.photos=state.photos.filter(x=>x.id!==p.id); state.selected.forEach(v=>{v.photos=(v.photos||[]).filter(id=>id!==p.id)}); saveDraft(); renderMidia(); renderGroups();}; box.appendChild(d); }); }
async function toggleAudio(){ if(state.rec&&state.rec.state==='recording'){state.rec.stop();return;} try{ const stream=await navigator.mediaDevices.getUserMedia({audio:true}); const chunks=[]; state.rec=new MediaRecorder(stream); state.rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}; state.rec.onstop=()=>{state.audioBlob=new Blob(chunks,{type:'audio/webm'}); state.audioUrl=URL.createObjectURL(state.audioBlob); $('audioBox').innerHTML=`<audio controls src="${state.audioUrl}"></audio>`; $('btnAudio').textContent='🎤 Gravar áudio'; stream.getTracks().forEach(t=>t.stop()); saveDraft();}; state.rec.start(); $('btnAudio').textContent='⏹️ Parar gravação'; toast('Gravando áudio...'); }catch(e){toast('Microfone não liberado.');} }
function ditarTexto(){ const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR){toast('Ditado não suportado.');return;} const rec=new SR(); rec.lang='pt-BR'; rec.onresult=e=>{$('diagnostico').value=($('diagnostico').value+'\n'+e.results[0][0].transcript).trim(); saveDraft();}; rec.start(); toast('Pode falar.'); }
function payload(includePhotos=true){ const u=state.user||readSession(); const itens=Array.from(state.selected.values()).filter(x=>x.status||x.obs||x.photos?.length); return {versao:'checklist-concessionaria-v6-historico-scroll-print',tenantId:u.tid,oficinaNome:u.tnome||u.oficina?.nome||'',criadoEm:nowISO(),atualizadoEm:nowISO(),placa:placaNorm($('placa').value),osRef:$('osRef').value.trim(),mecanico:$('mecanico').value.trim()||u.nome,responsavel:$('mecanico').value.trim()||u.nome,mecanicoId:u.fid||'',responsavelId:u.fid||'',mecanicoRole:u.role||'',responsavelPerfil:u.role||'',km:$('km').value.trim(),relato:$('relato').value.trim(),diagnostico:$('diagnostico').value.trim(),sintomas:Array.from(state.sintomas),secaoAtiva:state.activeSecId,secoesConcluidas:Array.from(state.completedSecoes),itens,historico:{os:state.os.length,itens:state.histItens.length,placa:state.placa},fotos:includePhotos?state.photos:state.photos.map(p=>({id:p.id,itemId:p.itemId,label:p.label,createdAt:p.createdAt})),audioLocal:!!state.audioBlob,origem:'checklist.html'}; }
function renderResumo(){ const p=payload(false); const trocar=p.itens.filter(x=>x.status==='trocar').length, at=p.itens.filter(x=>x.status==='atencao').length, ok=p.itens.filter(x=>x.status==='ok').length; $('kTrocar').textContent=trocar; $('kAtencao').textContent=at; $('kOk').textContent=ok; $('kFotos').textContent=state.photos.length; const box=$('resumoLista'); box.innerHTML=''; const list=p.itens.filter(x=>x.status==='trocar'||x.status==='atencao'); if(!list.length){box.innerHTML='<div class="notice">Nenhum item crítico marcado.</div>';return;} list.forEach(x=>{ const d=document.createElement('div'); d.className='resume-line'; d.innerHTML=`<div><b>${esc(x.descricao)}</b><span>${esc(x.secao)} • ${esc(x.obs||'sem comentário')}</span></div><strong class="${statusClass(x.status)}">${statusLabel(x.status)}</strong>`; box.appendChild(d);}); }
async function salvarChecklist(){ const p=payload(false); if(!p.placa){toast('Digite a placa.');return;} try{localStorage.setItem('CHECKLIST_ULTIMO_'+p.placa,JSON.stringify(payload(true)));}catch(e){} const db=initFirebase(); if(db){ try{ const ref=await db.collection('checklists').add({...p,...tenantFields(),createdAt:nowISO(),updatedAt:nowISO(),status:'salvo'}); toast('Checklist salvo no sistema e no celular.'); return ref.id; }catch(e){console.warn(e); toast('Salvo no celular. Banco recusou ou sem permissão.'); return null;} } toast('Salvo no celular.'); return null; }
function baixarJSON(){ const p=payload(true); downloadBlob(JSON.stringify(p,null,2),'application/json',`CHECKLIST_${p.placa||'SEM_PLACA'}_${Date.now()}.json`); }
function gerarXLSX(){ if(!window.XLSX){toast('XLSX não carregado.');return;} const p=payload(false); const wb=XLSX.utils.book_new(); const resumo=[['OFICIN-IA • CHECKLIST PADRÃO CONCESSIONÁRIA'],['Placa',p.placa,'O.S./Ref',p.osRef,'Responsável',p.responsavel||p.mecanico],['KM',p.km,'Data',new Date(p.criadoEm).toLocaleString('pt-BR'),'Oficina',p.oficinaNome],['Histórico encontrado',`${p.historico.os} O.S. / ${p.historico.itens} itens`],[],['Relato do cliente',p.relato],['Diagnóstico técnico',p.diagnostico],[],['Resumo'],['Trocar',p.itens.filter(x=>x.status==='trocar').length],['Atenção',p.itens.filter(x=>x.status==='atencao').length],['OK',p.itens.filter(x=>x.status==='ok').length],['Fotos',state.photos.length]]; let ws=XLSX.utils.aoa_to_sheet(resumo); ws['!cols']=[{wch:24},{wch:35},{wch:18},{wch:24},{wch:18},{wch:30}]; XLSX.utils.book_append_sheet(wb,ws,'Resumo'); const itens=[['Status','Tipo','Seção','Item','Comentário','Fotos','Histórico']]; p.itens.forEach(x=>{const h=matchHist(x.descricao); itens.push([statusLabel(x.status),x.tipo,x.secao,x.descricao,x.obs||'',(x.photos||[]).length,h?`${fmtDate(h.data)} • OS ${h.osId} • ${h.descricao}`:'Sem histórico']);}); ws=XLSX.utils.aoa_to_sheet(itens); ws['!cols']=[{wch:14},{wch:16},{wch:28},{wch:46},{wch:50},{wch:8},{wch:62}]; XLSX.utils.book_append_sheet(wb,ws,'Itens avaliados'); const hist=[['Data','O.S.','Status','Tipo','Fonte','Descrição','KM','Valor']]; state.histItens.slice(0,400).forEach(h=>hist.push([fmtDate(h.data),h.osId,h.status,h.tipo,h.fonte,h.descricao,h.km||'',Number(h.valor||0)])); ws=XLSX.utils.aoa_to_sheet(hist); ws['!cols']=[{wch:12},{wch:16},{wch:16},{wch:12},{wch:20},{wch:55},{wch:12},{wch:14}]; XLSX.utils.book_append_sheet(wb,ws,'Histórico placa'); const fotos=[['Item','Data','Observação'],...state.photos.map(f=>[f.label,fmtDate(f.createdAt),'Foto salva no PDF/JSON/local'])]; ws=XLSX.utils.aoa_to_sheet(fotos); ws['!cols']=[{wch:42},{wch:18},{wch:40}]; XLSX.utils.book_append_sheet(wb,ws,'Fotos'); XLSX.writeFile(wb,`CHECKLIST_${p.placa||'SEM_PLACA'}_${Date.now()}.xlsx`); }
async function gerarPDF(){
 if(!window.jspdf){toast('jsPDF não carregado.');return;} const {jsPDF}=window.jspdf; const p=payload(true); const doc=new jsPDF('p','mm','a4'); let y=12; const W=210;
 function pageCheck(h=8){if(y+h>284){footer();doc.addPage();y=12;}}
 function footer(){const pages=doc.internal.getNumberOfPages(); doc.setFontSize(8); doc.setTextColor(115); doc.text(`Powered by thIAguinho Soluções Digitais • OFICIN-IA • Página ${doc.internal.getCurrentPageInfo().pageNumber}/${pages}`,12,292);}
 function header(){doc.setFillColor(15,23,42);doc.rect(0,0,W,26,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text('Checklist Técnico Padrão Concessionária',12,13);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(`OFICIN-IA • ${p.oficinaNome||'Oficina'} • ${new Date(p.criadoEm).toLocaleString('pt-BR')}`,12,20);y=34;doc.setTextColor(15,23,42);}
 function text(txt,x=12,size=9,bold=false,max=186){pageCheck(8);doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(15,23,42);const lines=doc.splitTextToSize(String(txt||''),max);doc.text(lines,x,y);y+=lines.length*4.6;}
 function box(title,lines,color){pageCheck(18);doc.setDrawColor(215,226,239);doc.setFillColor(248,250,252);const start=y;doc.roundedRect(10,y-5,190,Math.max(18,8+lines.length*5),3,3,'FD');doc.setTextColor(color[0],color[1],color[2]);doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text(title,14,y+1);doc.setTextColor(15,23,42);doc.setFont('helvetica','normal');doc.setFontSize(8);let yy=y+7;lines.forEach(l=>{doc.text(doc.splitTextToSize(String(l||''),178),14,yy); yy+=5;});y=start+Math.max(20,10+lines.length*5);}
 header();
 box('Identificação',[`Placa: ${p.placa||'-'}   O.S./Ref: ${p.osRef||'-'}   KM: ${p.km||'-'}`,`Responsável: ${p.responsavel||p.mecanico||'-'}   Perfil: ${p.responsavelPerfil||p.mecanicoRole||'-'}   Histórico: ${p.historico.os} O.S. / ${p.historico.itens} itens`],[29,78,216]);
 const trocar=p.itens.filter(x=>x.status==='trocar').length, at=p.itens.filter(x=>x.status==='atencao').length, ok=p.itens.filter(x=>x.status==='ok').length;
 box('Resumo executivo',[`Trocar: ${trocar}   Atenção: ${at}   OK: ${ok}   Fotos: ${state.photos.length}`,`Relatório gerado para análise e importação/anexo na O.S. do Jarvis.`],[21,128,61]);
 if(p.relato) box('Relato do cliente',[p.relato],[180,83,9]);
 if(p.diagnostico) box('Diagnóstico técnico interno',[p.diagnostico],[185,28,28]);
 text('Itens críticos e observações',12,11,true); y+=2;
 const crit=p.itens.filter(x=>x.status==='trocar'||x.status==='atencao');
 if(!crit.length) text('Nenhum item crítico marcado.',12,9,false); else crit.forEach((it,i)=>{ const h=matchHist(it.descricao); box(`${i+1}. ${statusLabel(it.status)} • ${it.secao}`,[`${it.descricao}${it.obs?' — '+it.obs:''}`,h?`Histórico: ${fmtDate(h.data)} • O.S. ${h.osId} • ${h.descricao}`:'Histórico: sem ocorrência anterior encontrada para esta placa.'],it.status==='trocar'?[185,28,28]:[180,83,9]); });
 const demais=p.itens.filter(x=>x.status==='ok'||x.status==='na'); if(demais.length){ text('Itens conferidos',12,11,true); demais.forEach((it,i)=>text(`${i+1}. [${statusLabel(it.status)}] ${it.secao} • ${it.descricao}${it.obs?' — '+it.obs:''}`,12,8,false)); }
 if(state.photos.length){ footer(); doc.addPage(); header(); text('Fotos anexadas',12,12,true); for(const ph of state.photos){ pageCheck(78); text(ph.label,12,9,true); try{doc.addImage(ph.dataUrl,'JPEG',12,y,84,63); y+=68;}catch(e){text('Foto não pôde ser inserida no PDF.',12,8,false);} } }
 const pages=doc.internal.getNumberOfPages(); for(let i=1;i<=pages;i++){doc.setPage(i);footer();}
 doc.save(`CHECKLIST_${p.placa||'SEM_PLACA'}_${Date.now()}.pdf`);
}
function imprimirManualUmaPagina(){
 const secoes=state.model?.secoes||[]; const placa=placaNorm($('placa')?.value||''); const os=$('osRef')?.value||''; const resp=$('mecanico')?.value||state.user?.nome||'';
 const grupos=secoes.map(sec=>`<section><h2>${sec.emoji||''} ${esc(sec.titulo)}</h2><div class="mini-grid">${(sec.itens||[]).slice(0,18).map(it=>`<label><span class="chk"></span>${esc(it)}</label>`).join('')}</div></section>`).join('');
 const html=`<!doctype html><html><head><meta charset="utf-8"><title>Checklist manual OFICIN-IA</title><style>@page{size:A4;margin:7mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0;font-size:9px}header{border-bottom:2px solid #111;padding-bottom:4px;margin-bottom:4px;display:grid;grid-template-columns:1fr auto;gap:8px}h1{font-size:15px;margin:0}p{margin:2px 0}.meta{font-size:9px;text-align:right}.wrap{columns:2;column-gap:5mm}section{break-inside:avoid;border:1px solid #999;border-radius:6px;padding:4px;margin:0 0 4px;background:#fff}h2{font-size:10px;margin:0 0 3px;padding-bottom:2px;border-bottom:1px solid #ccc}.mini-grid{display:grid;grid-template-columns:1fr;gap:1px}label{display:flex;gap:3px;align-items:flex-start;line-height:1.08}.chk{width:8px;height:8px;border:1px solid #111;display:inline-block;flex:0 0 8px;margin-top:1px}.obs{border:1px solid #999;height:32px;border-radius:6px;margin-top:4px;padding:3px}.foot{position:fixed;bottom:0;left:0;right:0;border-top:1px solid #999;padding-top:2px;font-size:8px;text-align:center}@media print{button{display:none}}</style></head><body><header><div><h1>Checklist Técnico Manual • OFICIN-IA</h1><p>Placa: <b>${esc(placa||'________')}</b> &nbsp; O.S.: <b>${esc(os||'________')}</b> &nbsp; KM: __________</p><p>Responsável: <b>${esc(resp||'________________')}</b> &nbsp; Data: ____/____/______</p></div><div class="meta">OK / Atenção / Trocar<br>usar observação quando necessário</div></header><div class="wrap">${grupos}</div><div class="obs"><b>Observações gerais:</b></div><div class="foot">Powered by thIAguinho Soluções Digitais • OFICIN-IA</div><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`;
 const w=window.open('','_blank'); if(!w){toast('Pop-up bloqueado. Libere pop-ups para imprimir.');return;} w.document.open(); w.document.write(html); w.document.close();
}
async function enviarParaOS(){ await salvarChecklist(); baixarJSON(); toast('JSON gerado para importar/anexar na O.S. do Jarvis. Baixe também o PDF.'); }
function downloadBlob(content,type,name){ const blob=new Blob([content],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function saveDraft(){ try{localStorage.setItem('CHECKLIST_RASCUNHO_'+(state.user?.fid||state.user?.nome||'user'),JSON.stringify(payload(true))); if($('draftInfo')) $('draftInfo').textContent='Rascunho salvo';}catch(e){console.warn('rascunho grande demais',e)} }
function restoreDraft(){ try{ const raw=localStorage.getItem('CHECKLIST_RASCUNHO_'+(state.user?.fid||state.user?.nome||'user'))||localStorage.getItem('CHECKLIST_RASCUNHO'); if(!raw)return; const p=JSON.parse(raw); if(!p)return; if(p.placa&&!$('placa').value)$('placa').value=p.placa; if(p.osRef)$('osRef').value=p.osRef; if(p.km)$('km').value=p.km; if(p.relato)$('relato').value=p.relato; if(p.diagnostico)$('diagnostico').value=p.diagnostico; (p.itens||[]).forEach(x=>state.selected.set(x.id,x)); state.photos=p.fotos||[]; state.activeSecId=p.secaoAtiva||''; state.completedSecoes=new Set(p.secoesConcluidas||[]); }catch(e){} }
function novoChecklist(){ if(!confirm('Zerar este checklist e começar um novo? O histórico salvo no sistema não será apagado.'))return; const mec=$('mecanico')?.value||state.user?.nome||''; ['placa','osRef','km','relato','diagnostico'].forEach(id=>{if($(id))$(id).value=''}); if($('mecanico'))$('mecanico').value=mec; state.placa=''; state.os=[]; state.histItens=[]; state.selected.clear(); state.sintomas.clear(); state.activeSecId=''; state.completedSecoes.clear(); state.photos=[]; state.audioBlob=null; state.audioUrl=''; $('historicoResumo').innerHTML=''; $('audioBox').innerHTML=''; localStorage.removeItem('CHECKLIST_RASCUNHO_'+(state.user?.fid||state.user?.nome||'user')); renderSymptoms(); renderGroups(); renderMidia(); go('screenStart'); toast('Novo checklist iniciado.'); }
async function consultarChecklists(){ const box=$('consultaLista'); if(!box)return; box.innerHTML='<div class="notice">Pesquisando checklists salvos...</div>'; const db=initFirebase(); const placa=placaNorm($('consultaPlaca')?.value||$('placa')?.value||''); const mec=NORM($('consultaMecanico')?.value||''); const qtd=Number($('consultaQtd')?.value||20); let list=[]; if(db){ try{ const docs=await getDocsFromCol(db,'checklists',Math.max(qtd,100)); list=docs; }catch(e){console.warn(e)} } const local=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith('CHECKLIST_ULTIMO_')){try{local.push(JSON.parse(localStorage.getItem(k)))}catch(e){}} } list=list.concat(local).filter(Boolean); if(placa) list=list.filter(x=>placaNorm(x.placa)===placa); if(mec) list=list.filter(x=>NORM(x.responsavel||x.mecanico||x.mecanicoNome||'').includes(mec)); list=list.sort((a,b)=>ts(b.criadoEm||b.createdAt)-ts(a.criadoEm||a.createdAt)).slice(0,qtd); if(!list.length){box.innerHTML='<div class="notice warn">Nenhum checklist encontrado para o filtro.</div>';return;} box.innerHTML=''; list.forEach(x=>{ const d=document.createElement('div'); d.className='consulta-card'; const crit=(x.itens||[]).filter(i=>i.status==='trocar'||i.status==='atencao').length; d.innerHTML=`<b>${esc(x.placa||'-')} • ${esc(x.osRef||'sem O.S.')}</b><small>${fmtDate(ts(x.criadoEm||x.createdAt))} • Responsável: ${esc(x.responsavel||x.mecanico||'-')} • ${crit} crítico(s) • ${x.fotos?.length||0} foto(s)</small><div style="margin-top:8px"><button class="btn small secondary" type="button">Carregar neste aparelho</button></div>`; d.querySelector('button').onclick=()=>{loadChecklistPayload(x); go('screenStart'); toast('Checklist carregado.');}; box.appendChild(d); }); }
function loadChecklistPayload(p){ if(!p)return; if($('placa'))$('placa').value=p.placa||''; if($('osRef'))$('osRef').value=p.osRef||''; if($('km'))$('km').value=p.km||''; if($('relato'))$('relato').value=p.relato||''; if($('diagnostico'))$('diagnostico').value=p.diagnostico||''; state.selected.clear(); (p.itens||[]).forEach(x=>state.selected.set(x.id,x)); state.photos=p.fotos||[]; state.completedSecoes=new Set(p.secoesConcluidas||[]); state.activeSecId=p.secaoAtiva||''; renderSymptoms(); renderGroups(); renderMidia(); renderResumo(); }
window.CHECKLIST_OFICINIA={state,buscarHistorico,consultarChecklists,novoChecklist,gerarPDF,gerarXLSX,baixarJSON,salvarChecklist};
boot();
})();
