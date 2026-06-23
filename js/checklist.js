(function(){
'use strict';
const $=id=>document.getElementById(id);
const $$=(sel,root=document)=>Array.from(root.querySelectorAll(sel));
const state={db:null,model:null,placa:'',os:[],histItens:[],selected:new Map(),sintomas:new Set(),photos:[],audioBlob:null,audioUrl:'',theme:localStorage.getItem('chk_theme')||'light'};
const NORM=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const toast=msg=>{const t=$('toast'); if(!t)return; t.textContent=msg; t.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'),2800)};
function fmtMoney(v){v=Number(v||0);return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});} 
function fmtDate(t){if(!t)return'-';try{return new Date(t).toLocaleDateString('pt-BR')}catch(e){return'-'}}
function ts(v){ if(!v)return 0; if(v.toDate)return v.toDate().getTime(); if(typeof v==='number')return v; const t=Date.parse(v); return isNaN(t)?0:t; }
function placaNorm(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7)}
function statusLabel(s){return ({ok:'OK',atencao:'ATENÇÃO',trocar:'TROCAR',na:'N/A'})[s]||'PENDENTE'}
function statusClass(s){return ({ok:'ok',atencao:'warn',trocar:'bad',na:'na'})[s]||''}
function applyTheme(){document.documentElement.dataset.theme=state.theme; localStorage.setItem('chk_theme',state.theme)}
function go(screen){['screenStart','screenCheck','screenMidia','screenResumo'].forEach(x=>$(x)?.classList.add('hidden')); $(screen)?.classList.remove('hidden'); $$('.step').forEach((s,i)=>s.classList.toggle('on', ['screenStart','screenCheck','screenMidia','screenResumo'].indexOf(screen)>=i)); window.scrollTo({top:0,behavior:'smooth'});}
async function boot(){applyTheme(); bind(); await loadModel(); renderSymptoms(); renderGroups(); restoreDraft();}
function bind(){
 $('btnTheme')?.addEventListener('click',()=>{state.theme=state.theme==='dark'?'light':'dark';applyTheme()});
 $('placa')?.addEventListener('input',e=>{e.target.value=placaNorm(e.target.value)});
 $('btnBuscarPlaca')?.addEventListener('click',buscarHistorico);
 $('btnComecar')?.addEventListener('click',()=>go('screenCheck'));
 $('btnNextMidia')?.addEventListener('click',()=>{renderMidia();go('screenMidia')});
 $('btnResumo')?.addEventListener('click',()=>{renderResumo();go('screenResumo')});
 $('btnVoltarCheck')?.addEventListener('click',()=>go('screenCheck'));
 $('btnVoltarMidia')?.addEventListener('click',()=>go('screenMidia'));
 $('buscaItem')?.addEventListener('input',renderGroups);
 $('btnAudio')?.addEventListener('click',toggleAudio);
 $('btnDitar')?.addEventListener('click',ditarTexto);
 $('fotoGeral')?.addEventListener('change',e=>addPhotos(e.target.files,'geral','Fotos gerais'));
 $('btnSalvar')?.addEventListener('click',salvarChecklist);
 $('btnPDF')?.addEventListener('click',gerarPDF);
 $('btnXLSX')?.addEventListener('click',gerarXLSX);
 $('btnJSON')?.addEventListener('click',baixarJSON);
 $('btnImportOS')?.addEventListener('click',enviarParaOS);
 window.addEventListener('beforeunload',saveDraft);
}
async function loadModel(){
 try{ const r=await fetch('./data/checklist-model.json?ts=20260623v2',{cache:'no-store'}); state.model=await r.json(); }
 catch(e){ console.error(e); state.model={sintomas:[],secoes:[]}; toast('Modelo não carregado.'); }
}
function initFirebase(){
 if(state.db) return state.db;
 try{
   const cfg=window.APP_CONFIG?.firebaseConfig||window.firebaseConfig||window.cfg?.firebaseConfig||window.__firebaseConfig;
   if(window.firebase && cfg){ if(!firebase.apps.length) firebase.initializeApp(cfg); state.db=firebase.firestore(); }
 }catch(e){console.warn('Firebase indisponível',e)}
 return state.db;
}
async function buscarHistorico(){
 state.placa=placaNorm($('placa').value); if(!state.placa){toast('Digite a placa.');return;}
 $('historicoResumo').innerHTML='<div class="notice">🔎 Buscando histórico real da placa...</div>';
 state.os=[]; state.histItens=[];
 const db=initFirebase();
 if(!db){ $('historicoResumo').innerHTML='<div class="notice warn">Firebase não carregado. Pode continuar e gerar PDF/XLSX.</div>'; go('screenCheck'); return; }
 const cols=['ordensServico','ordens_servico','os','ordens'];
 for(const col of cols){
   try{
     const snap=await db.collection(col).limit(500).get();
     const docs=snap.docs.map(d=>({id:d.id,_col:col,...d.data()})).filter(o=>placaNorm(o.placa||o.veiculoPlaca||o.placaVeiculo||o.dadosVeiculo?.placa)===state.placa);
     state.os.push(...docs);
   }catch(e){ console.warn('coleção indisponível',col,e.message); }
 }
 const seen=new Set(); state.os=state.os.filter(o=>{const k=(o._col||'')+'-'+o.id;if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>ts(b.dataEntrada||b.entrada||b.criadoEm)-ts(a.dataEntrada||a.entrada||a.criadoEm));
 state.histItens=extrairHistorico(state.os);
 renderHistoricoResumo(); renderGroups(); go('screenCheck');
}
function extrairHistorico(lista){
 const out=[];
 lista.forEach(o=>{
   const base={osId:o.numero||o.codigo||o.id,docId:o.id,col:o._col,status:o.status||'',data:ts(o.dataEntrada||o.entrada||o.criadoEm||o.data),cliente:o.clienteNome||o.cliente||o.nomeCliente||'',veiculo:o.veiculo||o.modelo||o.veiculoModelo||'',km:o.km||o.kmEntrada||'',total:o.total||o.valorTotal||0};
   const fontes=[['pecas',o.pecas],['pecasOS',o.pecasOS],['pecasReais',o.pecasReais],['pecasTrocadas',o.pecasTrocadas],['servicos',o.servicos],['itens',o.itens],['itensAprovados',o.itensAprovados]];
   fontes.forEach(([fonte,arr])=>{ if(!Array.isArray(arr)) return; arr.forEach(x=>{ const desc=x.descricao||x.desc||x.nome||x.servico||x.peca||x.item||x.titulo||''; if(!desc)return; out.push({...base,fonte,tipo:fonte.toLowerCase().includes('pec')?'peça':'serviço',descricao:desc,norm:NORM(desc),codigo:x.codigo||x.cod||x.codigoOriginal||'',qtd:x.qtd||x.quantidade||1,valor:x.valor||x.total||x.valorVenda||0}); }); });
   ['diagnostico','diagnosticoTecnico','relato','observacoes','obs'].forEach(k=>{ if(o[k]) out.push({...base,fonte:k,tipo:'texto',descricao:o[k],norm:NORM(o[k])}); });
 });
 return out;
}
function renderHistoricoResumo(){
 const box=$('historicoResumo');
 if(!state.os.length){box.innerHTML='<div class="notice warn">Nenhuma O.S. encontrada para essa placa. O checklist continua funcionando.</div>';return;}
 const ult=state.os[0];
 box.innerHTML=`<div class="hist-card"><b>✅ Histórico carregado</b><br>${state.os.length} O.S. • ${state.histItens.length} itens técnicos encontrados<br><span>Última O.S.: ${esc(ult.numero||ult.codigo||ult.id)} • ${fmtDate(ts(ult.dataEntrada||ult.entrada||ult.criadoEm))} • ${esc(ult.status||'')}</span></div>`;
}
function renderSymptoms(){
 const box=$('symptoms'); if(!box)return; box.innerHTML='';
 (state.model.sintomas||[]).forEach(s=>{ const b=document.createElement('button'); b.type='button'; b.className='symptom'; b.innerHTML=`<span class="draw">${s.emoji}</span><span>${esc(s.label)}</span>`; b.onclick=()=>{ if(state.sintomas.has(s.id))state.sintomas.delete(s.id); else state.sintomas.add(s.id); b.classList.toggle('active'); renderGroups(); }; box.appendChild(b); });
}
function itemId(sec,item){return `${sec.id}__${NORM(item).replace(/\s+/g,'_')}`;}
function matchHist(item){
 const target=NORM(item); const words=target.split(' ').filter(w=>w.length>2); let best=null,score=0;
 state.histItens.forEach(h=>{ let s=0; words.forEach(w=>{if(h.norm.includes(w))s++}); if(target.includes(h.norm)||h.norm.includes(target))s+=4; if(s>score){score=s;best=h;} });
 return score>=2?best:null;
}
function shouldOpen(sec){
 if(!state.sintomas.size) return true;
 const sintomas=(state.model.sintomas||[]).filter(s=>state.sintomas.has(s.id));
 const open=new Set(sintomas.flatMap(s=>s.abrir||[]));
 return open.has(sec.id);
}
function renderGroups(){
 const box=$('groups'); if(!box||!state.model)return; const q=NORM($('buscaItem')?.value||''); box.innerHTML='';
 (state.model.secoes||[]).forEach(sec=>{
   let items=(sec.itens||[]).filter(it=>!q || NORM(it+' '+sec.titulo).includes(q));
   if(!items.length) return;
   const det=document.createElement('details'); det.open=shouldOpen(sec)||!!q; det.className='sec';
   det.innerHTML=`<summary><span><span class="draw">${sec.emoji}</span> ${esc(sec.titulo)}</span><small>${items.length} itens</small></summary><div class="hint">${esc(sec.hint||'')}</div><div class="items"></div>`;
   const cont=det.querySelector('.items');
   items.forEach(it=>cont.appendChild(renderItem(sec,it)));
   box.appendChild(det);
 });
 updateBottomCount();
}
function renderItem(sec,it){
 const id=itemId(sec,it); const cur=state.selected.get(id)||{id,secao:sec.titulo,tipo:guessTipo(sec,it),descricao:it,status:'',obs:'',photos:[]}; const hist=matchHist(it);
 const el=document.createElement('div'); el.className='item'; el.dataset.id=id;
 const photoCount=(cur.photos||[]).length;
 el.innerHTML=`
   <div class="item-head">
     <div class="item-icon">${sec.emoji}</div>
     <div><b>${esc(it)}</b><div class="mini">${esc(sec.titulo)} • ${cur.tipo}</div></div>
   </div>
   <div class="hist ${hist?'':'empty'}">${hist?`🕘 Última vez: <b>${fmtDate(hist.data)}</b> • O.S. ${esc(hist.osId)} • ${esc(hist.descricao).slice(0,120)} ${hist.km?`• KM ${esc(hist.km)}`:''}`:'Sem histórico encontrado para este item nessa placa.'}</div>
   <div class="status-grid">
     <button type="button" data-st="ok" class="${cur.status==='ok'?'on ok':''}">✅ OK</button>
     <button type="button" data-st="atencao" class="${cur.status==='atencao'?'on warn':''}">⚠️ Atenção</button>
     <button type="button" data-st="trocar" class="${cur.status==='trocar'?'on bad':''}">🔧 Trocar</button>
     <button type="button" data-st="na" class="${cur.status==='na'?'on na':''}">➖ N/A</button>
   </div>
   <textarea class="obs" placeholder="Comentário rápido desse item (opcional)">${esc(cur.obs||'')}</textarea>
   <div class="item-actions">
     <label class="filebtn">📷 Foto <input type="file" accept="image/*" capture="environment" multiple hidden></label>
     <span class="photo-count">${photoCount?photoCount+' foto(s)':'sem foto'}</span>
   </div>
   <div class="sugs"></div>`;
 el.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{cur.status=b.dataset.st; state.selected.set(id,cur); renderGroups(); saveDraft();});
 el.querySelector('.obs').oninput=e=>{cur.obs=e.target.value; if(cur.status||cur.obs||cur.photos?.length)state.selected.set(id,cur); saveDraft();};
 el.querySelector('input[type=file]').onchange=e=>addPhotos(e.target.files,id,it,cur);
 renderSugestoes(el.querySelector('.sugs'), it);
 return el;
}
function renderSugestoes(box,it){
 const sugs=state.model.sugestoes?.[it]||[]; if(!sugs.length)return; box.innerHTML='<div class="sug-title">Sugestão do conjunto:</div>';
 sugs.slice(0,5).forEach(s=>{ const b=document.createElement('button'); b.type='button'; b.className='sug'; b.textContent='＋ '+s; b.onclick=()=>{ const sec=(state.model.secoes||[]).find(x=>(x.itens||[]).includes(s)); if(sec){ const id=itemId(sec,s); const cur=state.selected.get(id)||{id,secao:sec.titulo,tipo:guessTipo(sec,s),descricao:s,status:'atencao',obs:'Sugerido pelo conjunto: '+it,photos:[]}; state.selected.set(id,cur); toast('Item sugerido marcado: '+s); renderGroups(); }}; box.appendChild(b); });
}
function guessTipo(sec,it){ const n=NORM(sec.titulo+' '+it); return /SERVICO|ALINHAMENTO|BALANCEAMENTO|SANGRIA|LIMPEZA|HIGIENIZACAO|LEITURA|TESTE|REGULAGEM|CALIBRAGEM|RODIZIO|DESMONTAGEM/.test(n)?'serviço':'peça/serviço'; }
function updateBottomCount(){ const arr=Array.from(state.selected.values()).filter(x=>x.status&&x.status!=='ok'&&x.status!=='na'); $('selCount') && ($('selCount').textContent=arr.length); }
async function compressImage(file){
 const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});
 const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=data});
 const max=1200; let w=img.width,h=img.height; if(Math.max(w,h)>max){ if(w>h){h=Math.round(h*max/w);w=max}else{w=Math.round(w*max/h);h=max} }
 const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h; const ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0,w,h);
 return canvas.toDataURL('image/jpeg',0.72);
}
async function addPhotos(files,itemId,label,cur){
 const arr=Array.from(files||[]).slice(0,6); if(!arr.length)return; toast('Processando fotos...');
 for(const f of arr){ const dataUrl=await compressImage(f); const photo={id:'ph_'+Date.now()+'_'+Math.random().toString(36).slice(2),itemId,label,dataUrl,createdAt:new Date().toISOString()}; state.photos.push(photo); if(cur){cur.photos=cur.photos||[]; cur.photos.push(photo.id); state.selected.set(itemId,cur);} }
 saveDraft(); renderGroups(); renderMidia(); toast('Foto anexada.');
}
function renderMidia(){
 const box=$('photoGrid'); if(!box)return; box.innerHTML='';
 if(!state.photos.length){box.innerHTML='<div class="notice">Nenhuma foto anexada ainda.</div>'; return;}
 state.photos.forEach(p=>{ const d=document.createElement('div'); d.className='photo'; d.innerHTML=`<img src="${p.dataUrl}" alt="foto"><div><b>${esc(p.label)}</b><button type="button">Remover</button></div>`; d.querySelector('button').onclick=()=>{state.photos=state.photos.filter(x=>x.id!==p.id); state.selected.forEach(v=>{v.photos=(v.photos||[]).filter(id=>id!==p.id)}); saveDraft(); renderMidia(); renderGroups();}; box.appendChild(d); });
}
async function toggleAudio(){
 if(state.rec && state.rec.state==='recording'){state.rec.stop(); return;}
 try{ const stream=await navigator.mediaDevices.getUserMedia({audio:true}); const chunks=[]; state.rec=new MediaRecorder(stream); state.rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}; state.rec.onstop=()=>{state.audioBlob=new Blob(chunks,{type:'audio/webm'}); state.audioUrl=URL.createObjectURL(state.audioBlob); $('audioBox').innerHTML=`<audio controls src="${state.audioUrl}"></audio>`; $('btnAudio').textContent='🎤 Gravar áudio'; stream.getTracks().forEach(t=>t.stop()); saveDraft();}; state.rec.start(); $('btnAudio').textContent='⏹️ Parar gravação'; toast('Gravando áudio...'); }catch(e){toast('Microfone não liberado.');}
}
function ditarTexto(){ const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR){toast('Ditado não suportado.');return;} const rec=new SR(); rec.lang='pt-BR'; rec.onresult=e=>{$('diagnostico').value=($('diagnostico').value+'\n'+e.results[0][0].transcript).trim(); saveDraft();}; rec.start(); toast('Pode falar.');}
function payload(includePhotos=true){
 const itens=Array.from(state.selected.values()).filter(x=>x.status||x.obs||x.photos?.length);
 return {versao:'checklist-concessionaria-v2',criadoEm:new Date().toISOString(),placa:placaNorm($('placa').value),osRef:$('osRef').value.trim(),mecanico:$('mecanico').value.trim(),km:$('km').value.trim(),relato:$('relato').value.trim(),diagnostico:$('diagnostico').value.trim(),sintomas:Array.from(state.sintomas),itens,historico:{os:state.os.length,itens:state.histItens.length},fotos:includePhotos?state.photos:state.photos.map(p=>({id:p.id,itemId:p.itemId,label:p.label,createdAt:p.createdAt})),audioLocal:!!state.audioBlob,origem:'checklist.html'};
}
function renderResumo(){
 const p=payload(false); const trocar=p.itens.filter(x=>x.status==='trocar').length, at=p.itens.filter(x=>x.status==='atencao').length, ok=p.itens.filter(x=>x.status==='ok').length;
 $('kTrocar').textContent=trocar; $('kAtencao').textContent=at; $('kOk').textContent=ok; $('kFotos').textContent=state.photos.length;
 const box=$('resumoLista'); box.innerHTML=''; const list=p.itens.filter(x=>x.status==='trocar'||x.status==='atencao');
 if(!list.length){box.innerHTML='<div class="notice">Nenhum item crítico marcado.</div>';return;}
 list.forEach(x=>{ const d=document.createElement('div'); d.className='resume-line'; d.innerHTML=`<div><b>${esc(x.descricao)}</b><span>${esc(x.secao)} • ${esc(x.obs||'sem comentário')}</span></div><strong class="${statusClass(x.status)}">${statusLabel(x.status)}</strong>`; box.appendChild(d);});
}
async function salvarChecklist(){
 const p=payload(true); if(!p.placa){toast('Digite a placa.');return;}
 localStorage.setItem('CHECKLIST_ULTIMO_'+p.placa, JSON.stringify(p));
 const db=initFirebase(); if(db){ try{ const pSmall=payload(false); const ref=await db.collection('checklists').add(pSmall); p.firestoreId=ref.id; toast('Checklist salvo no sistema e no celular.'); }catch(e){console.warn(e); toast('Salvo no celular. Banco recusou/anexos grandes.');} }
 else toast('Salvo no celular.');
}
function baixarJSON(){ const p=payload(true); downloadBlob(JSON.stringify(p,null,2),'application/json',`CHECKLIST_${p.placa||'SEM_PLACA'}_${Date.now()}.json`); }
function gerarXLSX(){ if(!window.XLSX){toast('XLSX não carregado.');return;} const p=payload(false); const rows=[['CHECKLIST PADRÃO CONCESSIONÁRIA - OFICIN-IA'],['Placa',p.placa,'O.S./Ref',p.osRef,'Mecânico',p.mecanico,'KM',p.km],['Relato',p.relato],['Diagnóstico',p.diagnostico],[],['Status','Tipo','Seção','Item','Comentário','Fotos']]; p.itens.forEach(x=>rows.push([statusLabel(x.status),x.tipo,x.secao,x.descricao,x.obs||'',(x.photos||[]).length])); const wb=XLSX.utils.book_new(), ws=XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:14},{wch:15},{wch:24},{wch:45},{wch:45},{wch:8}]; XLSX.utils.book_append_sheet(wb,ws,'Checklist'); XLSX.writeFile(wb,`CHECKLIST_${p.placa||'SEM_PLACA'}_${Date.now()}.xlsx`); }
async function gerarPDF(){
 if(!window.jspdf){toast('jsPDF não carregado.');return;} const {jsPDF}=window.jspdf; const p=payload(true); const doc=new jsPDF('p','mm','a4'); let y=12;
 const addText=(txt,x=12,size=9,bold=false,max=186)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size); const lines=doc.splitTextToSize(String(txt||''),max); if(y+lines.length*5>285){doc.addPage();y=12;} doc.text(lines,x,y); y+=lines.length*5;};
 doc.setFillColor(15,23,42); doc.rect(0,0,210,24,'F'); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text('Checklist Padrão Concessionária',12,14); doc.setFontSize(9); doc.text('OFICIN-IA • Avaliação técnica com fotos e histórico',12,20); y=32; doc.setTextColor(0,0,0);
 addText(`Placa: ${p.placa||'-'}   O.S./Ref: ${p.osRef||'-'}   Mecânico: ${p.mecanico||'-'}   KM: ${p.km||'-'}`,12,9,true);
 if(p.relato)addText('Relato do cliente: '+p.relato,12,9,false);
 if(p.diagnostico)addText('Diagnóstico técnico: '+p.diagnostico,12,9,false);
 addText('Itens avaliados',12,11,true); y+=2;
 p.itens.forEach((it,i)=>{ addText(`${i+1}. [${statusLabel(it.status)}] ${it.tipo.toUpperCase()} • ${it.secao} • ${it.descricao}${it.obs?' — '+it.obs:''}`,12,8,false); });
 if(state.photos.length){ doc.addPage(); y=12; addText('Fotos anexadas',12,12,true); for(const ph of state.photos){ if(y>230){doc.addPage();y=12;} addText(ph.label,12,9,true); try{ doc.addImage(ph.dataUrl,'JPEG',12,y,84,63); y+=68; }catch(e){ addText('Foto não pôde ser inserida no PDF.',12,8,false); } } }
 const pages=doc.internal.getNumberOfPages(); for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(120);doc.text(`Página ${i}/${pages} • Powered by thIAguinho Soluções Digitais`,12,292);}
 doc.save(`CHECKLIST_${p.placa||'SEM_PLACA'}_${Date.now()}.pdf`);
}
async function enviarParaOS(){ await salvarChecklist(); baixarJSON(); toast('Arquivo JSON gerado. Importe/anexe na O.S. do Jarvis junto com o PDF.'); }
function downloadBlob(content,type,name){ const blob=new Blob([content],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function saveDraft(){ try{localStorage.setItem('CHECKLIST_RASCUNHO',JSON.stringify(payload(true)));}catch(e){console.warn('rascunho grande demais',e)} }
function restoreDraft(){ try{ const raw=localStorage.getItem('CHECKLIST_RASCUNHO'); if(!raw)return; const p=JSON.parse(raw); if(!p)return; if(p.placa&&!$('placa').value)$('placa').value=p.placa; if(p.osRef)$('osRef').value=p.osRef; if(p.mecanico)$('mecanico').value=p.mecanico; if(p.km)$('km').value=p.km; if(p.relato)$('relato').value=p.relato; if(p.diagnostico)$('diagnostico').value=p.diagnostico; (p.itens||[]).forEach(x=>state.selected.set(x.id,x)); state.photos=p.fotos||[]; }catch(e){} }
window.CHECKLIST_OFICINIA={state,buscarHistorico,gerarPDF,gerarXLSX,baixarJSON,salvarChecklist};
boot();
})();
