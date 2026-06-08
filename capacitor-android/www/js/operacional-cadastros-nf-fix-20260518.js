/*
 * thIAguinho SaaS - hardening operacional 2026-05-18
 * Cadastro Brasil, fornecedor completo, edicao auditada de itens da NF
 * e bloqueio forte da Tabela Temparia quando o modulo estiver desligado.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const $ = id => D.getElementById(id);
  const val = id => ($(id)?.value || '').trim();
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const digits = v => typeof W.thiaOnlyDigits === 'function' ? W.thiaOnlyDigits(v) : String(v || '').replace(/\D/g, '');
  const num = v => {
    let s = String(v ?? '').trim().replace(/R\$|\s/g, '');
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };
  const moeda = v => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const clone = obj => JSON.parse(JSON.stringify(obj || null));
  const J = () => W.J || {};
  const db = () => W.db || J().db || null;

  function toast(msg, type) {
    if (typeof W.toast === 'function') W.toast(msg, type || 'ok');
    else alert(String(msg).replace(/<[^>]+>/g, ''));
  }

  function setValue(id, value) {
    const el = $(id);
    if (el) el.value = value ?? '';
  }

  function fornecedorDocumento(f) {
    return f?.doc || f?.documento || f?.cpfCnpj || f?.cnpj || f?.cpf || '';
  }

  function fornecedorEndereco(f) {
    const e = f?.endereco && typeof f.endereco === 'object' ? f.endereco : {};
    return {
      cep: f?.cep || e.cep || '',
      rua: f?.rua || f?.logradouro || e.rua || e.logradouro || '',
      numero: f?.numero || f?.num || e.numero || e.nro || '',
      complemento: f?.complemento || e.complemento || '',
      bairro: f?.bairro || e.bairro || '',
      cidade: f?.cidade || f?.municipio || e.cidade || e.municipio || '',
      uf: f?.uf || e.uf || ''
    };
  }

  function ensureFornecedorModal() {
    const modal = $('modalFornec');
    const body = modal?.querySelector('.modal-body');
    const box = modal?.querySelector('.modal');
    if (!modal || !body || body.dataset.thiaCompleto === '1') return;
    if (box) box.style.maxWidth = '860px';
    body.dataset.thiaCompleto = '1';
    body.innerHTML = `
      <input type="hidden" id="fornecId">
      <div class="form-row cols-2">
        <div class="form-group"><label class="j-label">Razão Social / Nome</label><input class="j-input" id="fornecNome" placeholder="Distribuidora ABC Ltda."></div>
        <div class="form-group"><label class="j-label">Nome Fantasia</label><input class="j-input" id="fornecFantasia" placeholder="Nome comercial"></div>
      </div>
      <div class="form-row cols-4">
        <div class="form-group"><label class="j-label">CPF/CNPJ</label><input class="j-input" id="fornecDoc" inputmode="numeric" placeholder="00.000.000/0000-00"></div>
        <div class="form-group"><label class="j-label">Inscrição Estadual</label><input class="j-input" id="fornecIE" placeholder="Isento ou número"></div>
        <div class="form-group"><label class="j-label">Segmento</label><input class="j-input" id="fornecSeg" placeholder="Peças, óleo, elétrica..."></div>
        <div class="form-group"><label class="j-label">Contato</label><input class="j-input" id="fornecContato" placeholder="Nome do vendedor"></div>
      </div>
      <div id="fornecDocStatus" style="display:none;font-family:var(--fm);font-size:.68rem;margin:-4px 0 8px;"></div>
      <div class="form-row cols-3">
        <div class="form-group"><label class="j-label">Telefone</label><input class="j-input" id="fornecTelefone" inputmode="numeric" placeholder="(17) 3000-0000"></div>
        <div class="form-group"><label class="j-label">WhatsApp</label><input class="j-input" id="fornecWpp" inputmode="numeric" placeholder="(17) 99999-9999"></div>
        <div class="form-group"><label class="j-label">E-mail</label><input class="j-input" id="fornecEmail" type="email" placeholder="financeiro@fornecedor.com.br"></div>
      </div>
      <div class="form-row cols-4">
        <div class="form-group"><label class="j-label">CEP</label><input class="j-input" id="fornecCep" inputmode="numeric" placeholder="00000-000"></div>
        <div class="form-group" style="grid-column:span 2;"><label class="j-label">Endereço</label><input class="j-input" id="fornecRua" placeholder="Rua / avenida"></div>
        <div class="form-group"><label class="j-label">Número</label><input class="j-input" id="fornecNumero" inputmode="numeric" placeholder="Nº"></div>
      </div>
      <div class="form-row cols-4">
        <div class="form-group"><label class="j-label">Complemento</label><input class="j-input" id="fornecComplemento" placeholder="Sala, bloco..."></div>
        <div class="form-group"><label class="j-label">Bairro</label><input class="j-input" id="fornecBairro"></div>
        <div class="form-group"><label class="j-label">Cidade</label><input class="j-input" id="fornecCidade"></div>
        <div class="form-group"><label class="j-label">UF</label><input class="j-input" id="fornecUf" maxlength="2" placeholder="SP"></div>
      </div>
      <div class="form-group"><label class="j-label">Observações / condições comerciais</label><textarea class="j-textarea" id="fornecObs" rows="2" placeholder="Prazo, tabela, contato financeiro, restrições..."></textarea></div>`;
    W.thiaInstalarMascarasBrasil?.();
  }

  function ensureFornecedorTableHeader() {
    const tb = $('tbFornec');
    const table = tb?.closest('table');
    const head = table?.querySelector('thead tr');
    if (head && head.dataset.thiaCompleto !== '1') {
      head.dataset.thiaCompleto = '1';
      head.innerHTML = '<th>Razão Social</th><th>Documento / Contato</th><th>Endereço</th><th>Ações</th>';
    }
  }

  function prepFornecCompleto(mode, id) {
    ensureFornecedorModal();
    if (arguments.length === 1 && mode && mode !== 'add' && mode !== 'edit') { id = mode; mode = 'edit'; }
    const campos = ['fornecId','fornecNome','fornecFantasia','fornecDoc','fornecIE','fornecSeg','fornecContato','fornecTelefone','fornecWpp','fornecEmail','fornecCep','fornecRua','fornecNumero','fornecComplemento','fornecBairro','fornecCidade','fornecUf','fornecObs'];
    campos.forEach(k => setValue(k, ''));
    const status = $('fornecDocStatus');
    if (status) { status.style.display = 'none'; status.textContent = ''; }
    if ((mode === 'edit' || id) && id) {
      const f = (J().fornecedores || []).find(x => String(x.id) === String(id));
      if (!f) return;
      const e = fornecedorEndereco(f);
      setValue('fornecId', f.id);
      setValue('fornecNome', f.razaoSocial || f.razao || f.nome || '');
      setValue('fornecFantasia', f.fantasia || f.nomeFantasia || '');
      setValue('fornecDoc', fornecedorDocumento(f));
      setValue('fornecIE', f.ie || f.inscricaoEstadual || '');
      setValue('fornecSeg', f.segmento || '');
      setValue('fornecContato', f.contato || f.responsavel || '');
      setValue('fornecTelefone', f.telefone || '');
      setValue('fornecWpp', f.wpp || f.whatsapp || '');
      setValue('fornecEmail', f.email || '');
      setValue('fornecCep', e.cep);
      setValue('fornecRua', e.rua);
      setValue('fornecNumero', e.numero);
      setValue('fornecComplemento', e.complemento);
      setValue('fornecBairro', e.bairro);
      setValue('fornecCidade', e.cidade);
      setValue('fornecUf', e.uf);
      setValue('fornecObs', f.obs || f.observacoes || '');
    }
    W.thiaInstalarMascarasBrasil?.();
  }

  async function salvarFornecCompleto() {
    ensureFornecedorModal();
    const nome = val('fornecNome');
    if (!nome) { toast('Informe a razão social/nome do fornecedor.', 'warn'); return; }
    const id = val('fornecId');
    const doc = val('fornecDoc');
    const docLimpo = digits(doc);
    if (docLimpo && !(W.thiaValidarCpfCnpj ? W.thiaValidarCpfCnpj(doc) : true)) {
      toast('CPF/CNPJ do fornecedor inválido. Corrija antes de salvar.', 'warn');
      $('fornecDoc')?.focus();
      return;
    }
    if (docLimpo && W.thiaDocumentoExiste?.(J().fornecedores || [], doc, id)) {
      toast('Já existe fornecedor cadastrado com este CPF/CNPJ.', 'warn');
      $('fornecDoc')?.focus();
      return;
    }
    const tipoDoc = docLimpo.length === 14 ? 'cnpj' : (docLimpo.length === 11 ? 'cpf' : '');
    const endereco = {
      cep: val('fornecCep'),
      rua: val('fornecRua'),
      logradouro: val('fornecRua'),
      numero: val('fornecNumero'),
      complemento: val('fornecComplemento'),
      bairro: val('fornecBairro'),
      cidade: val('fornecCidade'),
      municipio: val('fornecCidade'),
      uf: val('fornecUf').toUpperCase()
    };
    const payload = {
      tenantId: J().tid,
      nome,
      razao: nome,
      razaoSocial: nome,
      fantasia: val('fornecFantasia'),
      nomeFantasia: val('fornecFantasia'),
      segmento: val('fornecSeg'),
      contato: val('fornecContato'),
      telefone: val('fornecTelefone') || val('fornecWpp'),
      wpp: val('fornecWpp') || val('fornecTelefone'),
      whatsapp: val('fornecWpp') || val('fornecTelefone'),
      email: val('fornecEmail'),
      doc,
      documento: doc,
      cpfCnpj: doc,
      docLimpo,
      cpfCnpjLimpo: docLimpo,
      tipoDoc,
      cnpj: tipoDoc === 'cnpj' ? doc : '',
      cpf: tipoDoc === 'cpf' ? doc : '',
      ie: val('fornecIE'),
      inscricaoEstadual: val('fornecIE'),
      ...endereco,
      endereco,
      obs: val('fornecObs'),
      observacoes: val('fornecObs'),
      updatedAt: new Date().toISOString()
    };
    if (!db()) { toast('Banco de dados ainda não carregado.', 'warn'); return; }
    try {
      if (id) await db().collection('fornecedores').doc(id).update(payload);
      else await db().collection('fornecedores').add(Object.assign(payload, { createdAt: new Date().toISOString() }));
      W.audit?.('FORNECEDORES', `${id ? 'Editou' : 'Cadastrou'} fornecedor ${nome}`, { fornecedorId: id || '', documento: docLimpo });
      toast('Fornecedor salvo com cadastro completo.', 'ok');
      W.fecharModal?.('modalFornec');
    } catch (e) {
      toast('Erro ao salvar fornecedor: ' + (e.message || e), 'err');
    }
  }

  function renderFornecedoresCompleto() {
    ensureFornecedorTableHeader();
    const tb = $('tbFornec');
    if (!tb) return;
    tb.innerHTML = (J().fornecedores || []).map(f => {
      const e = fornecedorEndereco(f);
      const doc = fornecedorDocumento(f);
      const contato = [f.contato, f.wpp || f.whatsapp || f.telefone, f.email].filter(Boolean).join(' | ');
      const end = [e.rua, e.numero, e.bairro, e.cidade, e.uf].filter(Boolean).join(', ');
      return `<tr>
        <td><strong>${esc(f.razaoSocial || f.razao || f.nome || '-')}</strong><br><small>${esc(f.fantasia || f.nomeFantasia || f.segmento || '')}</small></td>
        <td>${esc(doc || '-')}<br><small>${esc(contato || '-')}</small></td>
        <td>${esc(end || '-')}<br><small>${esc(e.cep || '')}</small></td>
        <td><button class="btn-ghost" onclick="window.prepFornec('edit','${esc(f.id)}');abrirModal('modalFornec')">EDITAR</button><button class="btn-danger" onclick="window.excluirFornecedorDef && window.excluirFornecedorDef('${esc(f.id)}')" style="margin-left:4px;">EXCLUIR</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:18px;">Nenhum fornecedor cadastrado</td></tr>';
  }

  function validarDocumentoClienteAntesSalvar() {
    const doc = val('cliDoc');
    const id = val('cliId');
    if (!doc) return true;
    if (W.thiaValidarCpfCnpj && !W.thiaValidarCpfCnpj(doc)) {
      toast('CPF/CNPJ do cliente inválido. Corrija antes de salvar.', 'warn');
      $('cliDoc')?.focus();
      return false;
    }
    if (W.thiaDocumentoExiste?.(J().clientes || [], doc, id)) {
      toast('Já existe cliente cadastrado com este CPF/CNPJ.', 'warn');
      $('cliDoc')?.focus();
      return false;
    }
    return true;
  }

  function wrapClienteSave() {
    if (typeof W.salvarCliente !== 'function' || W.salvarCliente.__thiaDocWrap) return;
    const old = W.salvarCliente;
    W.salvarCliente = async function () {
      if (!validarDocumentoClienteAntesSalvar()) return;
      return old.apply(this, arguments);
    };
    W.salvarCliente.__thiaDocWrap = true;
  }

  function ensureNFEditBox() {
    const modal = $('modalNF');
    if (!modal || $('nfEditId')) return;
    const container = modal.querySelector('.modal-body');
    const anchor = $('containerItensNF')?.parentElement;
    if (!container || !anchor) return;
    anchor.insertAdjacentHTML('beforebegin', `
      <input type="hidden" id="nfEditId">
      <input type="hidden" id="nfEditCollection" value="notas_fiscais_entrada">
      <div id="nfEditBox" style="display:none;border:1px solid rgba(255,184,0,.35);background:rgba(255,184,0,.08);border-radius:4px;padding:12px;margin-bottom:12px;">
        <div style="font-family:var(--fd);font-weight:800;color:var(--warn);margin-bottom:8px;">EDIÇÃO AUDITADA DE NOTA FISCAL</div>
        <div id="nfEditResumo" style="font-family:var(--fm);font-size:.70rem;color:var(--muted2);margin-bottom:8px;"></div>
        <div class="form-group"><label class="j-label">Justificativa obrigatória</label><textarea class="j-textarea" id="nfEditJust" rows="2" placeholder="Ex: item lançado em duplicidade, código corrigido após conferência, devolução parcial..."></textarea></div>
      </div>`);
  }

  function setNFSavingMode(editing) {
    const modal = $('modalNF');
    const btn = modal?.querySelector('.modal-foot .btn-primary:last-child');
    if (btn) btn.textContent = editing ? 'SALVAR EDIÇÃO AUDITADA' : 'FINALIZAR ENTRADA';
  }

  function collectItensNFEdit() {
    if (typeof W.thiaNFCollectItens === 'function') {
      try { return W.thiaNFCollectItens(); } catch (e) { toast(e.message || String(e), 'warn'); return []; }
    }
    return Array.from(D.querySelectorAll('#containerItensNF .nf-real-row')).map(row => {
      let base = {};
      try { base = JSON.parse(row.querySelector('.nf-json')?.value || '{}'); } catch (_) { base = {}; }
      const osSel = row.querySelector('.nf-os-select');
      const osId = osSel?.value || '';
      const osOpt = osSel?.selectedOptions?.[0];
      const qtd = num(row.querySelector('.nf-qtd')?.value);
      const custo = num(row.querySelector('.nf-custo')?.value);
      const descValor = num(row.querySelector('.nf-descvalor')?.value);
      return Object.assign({}, base, {
        codigoFornecedor: row.querySelector('.nf-codforn')?.value || base.codigoFornecedor || base.codigo || '',
        codigoComercial: row.querySelector('.nf-codigo')?.value || base.codigoComercial || base.oem || '',
        codigo: row.querySelector('.nf-codforn')?.value || base.codigo || '',
        oem: row.querySelector('.nf-codigo')?.value || base.oem || '',
        descricao: row.querySelector('.nf-desc')?.value || base.descricao || base.desc || '',
        desc: row.querySelector('.nf-desc')?.value || base.descricao || base.desc || '',
        marca: row.querySelector('.nf-marca')?.value || base.marca || '',
        quantidade: qtd,
        qtd,
        valorUnitario: custo,
        custo,
        desconto: descValor,
        venda: num(row.querySelector('.nf-venda')?.value),
        ean: row.querySelector('.nf-ean')?.value || base.ean || '',
        ncm: row.querySelector('.nf-ncm-input')?.value || base.ncm || '',
        cfop: row.querySelector('.nf-cfop-input')?.value || base.cfop || '',
        cest: row.querySelector('.nf-cest-input')?.value || base.cest || '',
        destino: row.querySelector('.nf-finalidade')?.value || base.destino || 'estoque',
        finalidade: row.querySelector('.nf-finalidade')?.value || base.finalidade || 'estoque',
        osId,
        placa: osOpt?.dataset?.placa || base.placa || '',
        vinculo: row.querySelector('.nf-vinculo')?.value || osId || base.vinculo || '',
        valorLiquido: Math.max(qtd * custo - descValor, 0)
      });
    }).filter(x => x.descricao);
  }

  function itemKeyNF(item, idx) {
    return String(item?.origemNFItemKey || item?.nItem || item?.numeroItem || item?.codigoFornecedor || item?.codigo || item?.descricao || idx);
  }

  function resumoDiffItensNF(antes, depois) {
    const a = Array.isArray(antes) ? antes : [];
    const d = Array.isArray(depois) ? depois : [];
    const campos = ['codigoFornecedor','codigoComercial','codigo','oem','descricao','marca','quantidade','quantidadeFiscal','quantidadeOperacional','fatorOperacional','valorUnitario','desconto','venda','ean','ncm','cfop','cest','destino','finalidade','osId','placa','vinculo','destinosOperacionais','destinos'];
    const mapA = new Map(a.map((it, idx) => [itemKeyNF(it, idx), it]));
    const mapD = new Map(d.map((it, idx) => [itemKeyNF(it, idx), it]));
    const excluidos = [];
    const incluidos = [];
    const alterados = [];
    mapA.forEach((it, key) => { if (!mapD.has(key)) excluidos.push(it); });
    mapD.forEach((it, key) => {
      if (!mapA.has(key)) { incluidos.push(it); return; }
      const old = mapA.get(key);
      const mudou = campos.some(c => {
        const a = old?.[c];
        const b = it?.[c];
        const sa = (a && typeof a === 'object') ? JSON.stringify(a) : String(a ?? '');
        const sb = (b && typeof b === 'object') ? JSON.stringify(b) : String(b ?? '');
        return sa !== sb;
      });
      if (mudou) alterados.push({ antes: old, depois: it });
    });
    return { excluidos, incluidos, alterados };
  }

  const normNF = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  function cargoPodeExcluirNF() {
    const cargo = normNF(J().cargo || sessionStorage.getItem('j_cargo') || J().role || sessionStorage.getItem('j_role') || '');
    return /superadmin|admin|dono|proprietario|owner|gerente|gestor/.test(cargo);
  }

  function itemTextoChave(it) {
    return [it?.codigoFornecedor, it?.codigoComercial, it?.codigo, it?.oem, it?.ean, it?.descricao, it?.desc].map(normNF).filter(Boolean).join('|');
  }

  function itemCombina(a, b) {
    const codA = normNF(a?.codigoFornecedor || a?.codigo || a?.codigoComercial || a?.oem || a?.ean || '');
    const codB = normNF(b?.codigoFornecedor || b?.codigo || b?.codigoComercial || b?.oem || b?.ean || '');
    const descA = normNF(a?.descricao || a?.desc || '');
    const descB = normNF(b?.descricao || b?.desc || '');
    if (codA && codB && codA === codB) return true;
    if (descA && descB && descA === descB) return true;
    return itemTextoChave(a) && itemTextoChave(a) === itemTextoChave(b);
  }

  async function carregarVinculosNF(nfId, nf) {
    const porId = new Map();
    (J().nfItensVinculos || [])
      .filter(v => String(v.nfId || '') === String(nfId) || (nf?.chave && v.chave === nf.chave) || (nf?.numero && String(v.nfNumero || '') === String(nf.numero)))
      .forEach(v => porId.set(v.id || itemTextoChave(v), v));
    try {
      const snap = await db().collection('nf_itens_vinculos').where('tenantId', '==', J().tid).where('nfId', '==', nfId).get();
      snap.forEach(doc => porId.set(doc.id, { id: doc.id, ...doc.data() }));
    } catch (_) {}
    return Array.from(porId.values());
  }

  async function carregarFinanceiroNF(nfId, nf) {
    const porId = new Map();
    (J().financeiro || [])
      .filter(f => String(f.notaFiscalId || f.nfId || '') === String(nfId) || (nf?.chave && f.chaveNFe === nf.chave) || (nf?.numero && String(f.desc || '').includes('NF ' + nf.numero)))
      .forEach(f => porId.set(f.id || f.desc || Math.random(), f));
    try {
      const snap = await db().collection('financeiro').where('tenantId', '==', J().tid).where('notaFiscalId', '==', nfId).get();
      snap.forEach(doc => porId.set(doc.id, { id: doc.id, ...doc.data() }));
    } catch (_) {}
    return Array.from(porId.values());
  }

  function estoqueAtualPorVinculo(v) {
    return (J().estoque || []).find(p => String(p.id || '') === String(v.estoqueId || ''))
      || (J().estoque || []).find(p => normNF(p.codigo || p.codigoFornecedor || p.oem || '') && normNF(p.codigo || p.codigoFornecedor || p.oem || '') === normNF(v.codigo || v.codigoFornecedor || v.codigoComercial || ''));
  }

  function atualizarPecasReaisOSBatch(batch, nfId, itensAlvo, motivo, tipo) {
    const alvo = Array.isArray(itensAlvo) ? itensAlvo : [];
    if (!alvo.length) return { os: 0, pecas: 0 };
    let osAfetadas = 0;
    let pecasAfetadas = 0;
    (J().os || []).forEach(os => {
      const pecas = Array.isArray(os.pecasReais) ? os.pecasReais.slice() : [];
      if (!pecas.length) return;
      let mudou = false;
      let novas = pecas;
      if (tipo === 'remover') {
        novas = pecas.filter(p => {
          const retirar = String(p.nfId || '') === String(nfId) && alvo.some(it => itemCombina(p, it));
          if (retirar) { mudou = true; pecasAfetadas += 1; }
          return !retirar;
        });
      } else if (tipo === 'atualizar') {
        novas = pecas.map(p => {
          if (String(p.nfId || '') !== String(nfId)) return p;
          const alt = alvo.find(a => itemCombina(p, a.antes || a.depois || a));
          if (!alt) return p;
          mudou = true;
          pecasAfetadas += 1;
          const depois = alt.depois || alt;
          return Object.assign({}, p, {
            desc: depois.descricao || depois.desc || p.desc,
            descricao: depois.descricao || depois.desc || p.descricao,
            codigo: depois.codigo || depois.codigoFornecedor || p.codigo,
            codigoFornecedor: depois.codigoFornecedor || depois.codigo || p.codigoFornecedor,
            qtd: Number(depois.quantidade || depois.qtd || p.qtd || 1) || 1,
            custo: Number(depois.valorUnitario || depois.custo || p.custo || 0) || 0,
            total: Number(depois.valorLiquido || depois.total || p.total || 0) || 0,
            ajusteEdicaoNF: true,
            ajusteEdicaoNFEm: new Date().toISOString()
          });
        });
      }
      if (!mudou) return;
      osAfetadas += 1;
      const timeline = Array.isArray(os.timeline) ? os.timeline.slice() : [];
      timeline.push({
        ts: Date.now(),
        por: J().nome || 'Sistema',
        msg: tipo === 'remover' ? `Peca(s) removida(s) por edicao auditada da NF. Motivo: ${motivo}` : `Peca(s) atualizada(s) por edicao auditada da NF. Motivo: ${motivo}`,
        tipo: 'edicao_nf_peca_real',
        nfId
      });
      batch.update(db().collection('ordens_servico').doc(os.id), { pecasReais: novas, timeline, updatedAt: new Date().toISOString() });
      os.pecasReais = novas;
      os.timeline = timeline;
    });
    return { os: osAfetadas, pecas: pecasAfetadas };
  }

  async function aplicarEstornosEdicaoNF(batch, nfId, antes, diff, motivo) {
    const vinculos = await carregarVinculosNF(nfId, antes);
    const excluidos = diff.excluidos || [];
    const alterados = diff.alterados || [];
    const agora = new Date().toISOString();
    const resumo = { vinculosCancelados: 0, vinculosAtualizados: 0, movimentos: 0, os: 0, pecasOS: 0 };

    excluidos.forEach(item => {
      const matchs = vinculos.filter(v => !/cancelado|excluido|estornado/i.test(String(v.status || '')) && itemCombina(v, item));
      matchs.forEach(v => {
        if (v.id) {
          batch.update(db().collection('nf_itens_vinculos').doc(v.id), {
            status: 'Cancelado por edicao de NF',
            canceladoEm: agora,
            canceladoPor: J().nome || 'Sistema',
            motivoCancelamento: motivo,
            updatedAt: agora
          });
          resumo.vinculosCancelados += 1;
        }
        const qtd = Number(v.qtd || item.quantidade || 0) || 0;
        const est = estoqueAtualPorVinculo(v);
        if (v.estoqueId && !v.estoqueBaixadoAutomatico && est) {
          batch.update(db().collection('estoqueItems').doc(v.estoqueId), { qtd: Math.max(0, (Number(est.qtd) || 0) - qtd), updatedAt: agora });
        }
        batch.set(db().collection('estoque_movimentos').doc(), {
          tenantId: J().tid,
          estoqueId: v.estoqueId || '',
          tipo: 'estorno_entrada_nf_editada',
          nfId,
          nfNumero: antes.numero || v.nfNumero || '',
          codigo: v.codigoFornecedor || v.codigo || '',
          desc: v.desc || item.descricao || '',
          qtd: -Math.abs(qtd),
          custo: Number(v.custo || item.valorUnitario || 0) || 0,
          total: Number(v.total || item.valorLiquido || 0) || 0,
          osId: v.osId || item.osId || '',
          placa: v.placa || item.placa || '',
          motivo,
          createdAt: agora,
          usuario: J().nome || 'Sistema'
        });
        resumo.movimentos += 1;
        if (v.estoqueBaixadoAutomatico) {
          batch.set(db().collection('estoque_movimentos').doc(), {
            tenantId: J().tid,
            estoqueId: v.estoqueId || '',
            tipo: 'estorno_baixa_auto_nf_editada',
            nfId,
            nfNumero: antes.numero || v.nfNumero || '',
            codigo: v.codigoFornecedor || v.codigo || '',
            desc: v.desc || item.descricao || '',
            qtd: Math.abs(qtd),
            custo: Number(v.custo || item.valorUnitario || 0) || 0,
            total: Number(v.total || item.valorLiquido || 0) || 0,
            osId: v.osId || item.osId || '',
            placa: v.placa || item.placa || '',
            motivo,
            createdAt: agora,
            usuario: J().nome || 'Sistema'
          });
          resumo.movimentos += 1;
        }
      });
    });

    alterados.forEach(par => {
      const depois = par.depois || {};
      const antesItem = par.antes || {};
      const matchs = vinculos.filter(v => !/cancelado|excluido|estornado/i.test(String(v.status || '')) && itemCombina(v, antesItem));
      matchs.forEach(v => {
        const qtdNova = Number(depois.quantidade || depois.qtd || 0) || 0;
        const qtdAnt = Number(v.qtd || antesItem.quantidade || antesItem.qtd || 0) || 0;
        const delta = qtdNova - qtdAnt;
        if (v.id) {
          batch.update(db().collection('nf_itens_vinculos').doc(v.id), {
            codigo: depois.codigo || depois.codigoFornecedor || v.codigo || '',
            codigoFornecedor: depois.codigoFornecedor || depois.codigo || v.codigoFornecedor || '',
            codigoComercial: depois.codigoComercial || depois.oem || v.codigoComercial || '',
            desc: depois.descricao || depois.desc || v.desc || '',
            qtd: qtdNova,
            custo: Number(depois.valorUnitario || depois.custo || 0) || 0,
            total: Number(depois.valorLiquido || depois.total || 0) || 0,
            desconto: Number(depois.desconto || 0) || 0,
            editadoEmNF: true,
            editadoEm: agora,
            motivoEdicao: motivo,
            updatedAt: agora
          });
          resumo.vinculosAtualizados += 1;
        }
        const est = estoqueAtualPorVinculo(v);
        if (delta && v.estoqueId && !v.estoqueBaixadoAutomatico && est) {
          batch.update(db().collection('estoqueItems').doc(v.estoqueId), { qtd: Math.max(0, (Number(est.qtd) || 0) + delta), updatedAt: agora });
          batch.set(db().collection('estoque_movimentos').doc(), {
            tenantId: J().tid,
            estoqueId: v.estoqueId || '',
            tipo: 'ajuste_qtd_nf_editada',
            nfId,
            nfNumero: antes.numero || v.nfNumero || '',
            codigo: depois.codigoFornecedor || depois.codigo || v.codigoFornecedor || v.codigo || '',
            desc: depois.descricao || depois.desc || v.desc || '',
            qtd: delta,
            custo: Number(depois.valorUnitario || depois.custo || 0) || 0,
            total: Number(depois.valorLiquido || depois.total || 0) || 0,
            motivo,
            createdAt: agora,
            usuario: J().nome || 'Sistema'
          });
          resumo.movimentos += 1;
        }
      });
    });

    const rem = atualizarPecasReaisOSBatch(batch, nfId, excluidos, motivo, 'remover');
    const upd = atualizarPecasReaisOSBatch(batch, nfId, alterados, motivo, 'atualizar');
    resumo.os = rem.os + upd.os;
    resumo.pecasOS = rem.pecas + upd.pecas;
    return resumo;
  }

  async function ajustarFinanceiroEdicaoNF(batch, nfId, antes, novoTotal, motivo) {
    const titulos = await carregarFinanceiroNF(nfId, antes);
    if (!titulos.length) return { titulos: 0, ajuste: 0 };
    const totalAnterior = titulos.reduce((s, f) => s + (Number(f.valor) || 0), 0);
    const diff = Math.round((Number(novoTotal || 0) - totalAnterior) * 100) / 100;
    const bloqueado = titulos.some(f => /pago|liquidado|baixado|agrupado|cancelado/.test(normNF(f.status)) || f.pacoteBoletoId || f.bloqueadoPagamentoIndividual);
    const agora = new Date().toISOString();
    if (bloqueado) {
      if (Math.abs(diff) >= 0.01) {
        batch.set(db().collection('financeiro').doc(), {
          tenantId: J().tid,
          tipo: diff > 0 ? 'Saida' : 'Entrada',
          status: 'Pendente',
          desc: `Ajuste auditado NF ${antes.numero || nfId} por edicao`,
          valor: Math.abs(diff),
          pgto: 'Ajuste auditado',
          venc: hojeISOEdicao(),
          notaFiscalId: nfId,
          nfAjusteOrigem: 'edicao_nf',
          motivo,
          createdAt: agora
        });
      }
      return { titulos: titulos.length, ajuste: diff };
    }
    if (titulos.length === 1 && titulos[0].id) {
      batch.update(db().collection('financeiro').doc(titulos[0].id), { valor: Number(novoTotal || 0), status: titulos[0].status || 'Pendente', atualizadoPorEdicaoNF: true, motivoEdicaoNF: motivo, updatedAt: agora });
    } else {
      const base = totalAnterior || 1;
      titulos.forEach((f, idx) => {
        if (!f.id) return;
        const valor = idx === titulos.length - 1
          ? Math.round((Number(novoTotal || 0) - titulos.slice(0, idx).reduce((s, x) => s + ((Number(x.valor) || 0) / base) * Number(novoTotal || 0), 0)) * 100) / 100
          : Math.round((((Number(f.valor) || 0) / base) * Number(novoTotal || 0)) * 100) / 100;
        batch.update(db().collection('financeiro').doc(f.id), { valor, atualizadoPorEdicaoNF: true, motivoEdicaoNF: motivo, updatedAt: agora });
      });
    }
    return { titulos: titulos.length, ajuste: diff };
  }

  function hojeISOEdicao() {
    return new Date().toISOString().slice(0, 10);
  }

  async function abrirEdicaoNF(colOrId, maybeId) {
    ensureNFEditBox();
    const col = maybeId ? colOrId : 'notas_fiscais_entrada';
    const id = maybeId || colOrId;
    if (!id) return;
    let n = (J().notasFiscaisEntrada || []).find(x => String(x.id) === String(id));
    if (!n && db()) {
      const snap = await db().collection(col).doc(id).get();
      if (snap.exists) n = { id: snap.id, ...snap.data() };
    }
    if (!n) { toast('Nota fiscal não encontrada nos dados carregados.', 'warn'); return; }
    W.prepNF?.();
    W._thiaModoNF = 'edicao_nf';
    W._thiaNfEditBefore = clone(n);
    setValue('nfEditId', id);
    setValue('nfEditCollection', col);
    setValue('nfEditJust', '');
    const box = $('nfEditBox');
    if (box) box.style.display = 'block';
    const resumo = $('nfEditResumo');
    if (resumo) resumo.innerHTML = `NF <b>${esc(n.numero || 's/n')}</b> - ${esc(n.fornecedorSnapshot?.nome || n.fornecedorNome || '')} - ${moeda(n.totalNF || n.totalItens || 0)} - ${(n.itens || []).length} item(ns).`;
    setValue('nfNumero', n.numero || '');
    setValue('nfData', String(n.dataNF || n.data || '').slice(0, 10));
    if ($('nfFornec')) {
      W.popularSelects?.();
      $('nfFornec').value = n.fornecedorId || '';
    }
    if ($('containerItensNF')) $('containerItensNF').innerHTML = '';
    const itens = Array.isArray(n.itens) ? n.itens : [];
    if (itens.length && typeof W.adicionarItemNF === 'function') itens.forEach(it => W.adicionarItemNF(it));
    else W.adicionarItemNF?.();
    if (typeof W.thiaNFSetTotaisFiscais === 'function') {
      W.thiaNFSetTotaisFiscais(Object.assign({}, n.totaisFiscais || {}, n.despesasAcessorias || {}, {
        vNF: n.totalNF || n.totaisFiscais?.vNF || n.totalItens || 0
      }), { manualTotal:true, forceTotal:true });
    }
    W.calcNFTotal?.();
    setNFSavingMode(true);
    W.abrirModal?.('modalNF');
  }

  async function salvarEdicaoNF() {
    const id = val('nfEditId');
    const col = val('nfEditCollection') || 'notas_fiscais_entrada';
    if (!id || !db()) return false;
    const motivo = val('nfEditJust');
    if (motivo.length < 8) {
      toast('Informe uma justificativa objetiva para editar/excluir itens da NF.', 'warn');
      $('nfEditJust')?.focus();
      return true;
    }
    const antes = W._thiaNfEditBefore || {};
    const itens = collectItensNFEdit();
    if (!itens.length) { toast('A NF precisa manter ao menos um item. Para cancelar a nota, use exclusão auditada.', 'warn'); return true; }
    const totaisTela = typeof W.thiaNFCalcTotaisFiscais === 'function'
      ? W.thiaNFCalcTotaisFiscais()
      : {
          totalItens: Math.round(itens.reduce((s, i) => s + (Number(i.valorLiquido) || 0), 0) * 100) / 100,
          totalFiscal: Math.round(itens.reduce((s, i) => s + (Number(i.valorLiquido) || 0), 0) * 100) / 100,
          frete: 0,
          seguro: 0,
          outrasDespesas: 0,
          descontoFiscalExtra: 0,
          totalCalculado: 0
        };
    const totalItens = totaisTela.totalItens;
    const totalNF = totaisTela.totalFiscal || totalItens;
    const diff = resumoDiffItensNF(antes.itens || [], itens);
    const totalOriginal = Number(antes.totalFiscalOriginal || antes.totalNF || antes.totalItens || 0) || totalItens;
    const registro = {
      em: new Date().toISOString(),
      por: J().nome || 'Sistema',
      perfil: J().role || '',
      motivo,
      resumo: {
        itensAntes: (antes.itens || []).length,
        itensDepois: itens.length,
        alterados: diff.alterados.length,
        incluidos: diff.incluidos.length,
        excluidos: diff.excluidos.length,
        totalAntes: Number(antes.totalItens || antes.totalNF || 0) || 0,
        totalDepois: totalNF
      }
    };
    const payload = {
      fornecedorId: val('nfFornec') || antes.fornecedorId || '',
      numero: val('nfNumero') || antes.numero || '',
      dataNF: val('nfData') || antes.dataNF || '',
      itens,
      totalItens,
      totalNF,
      despesasAcessorias: {
        frete: totaisTela.frete || 0,
        seguro: totaisTela.seguro || 0,
        outrasDespesas: totaisTela.outrasDespesas || 0,
        descontoFiscalExtra: totaisTela.descontoFiscalExtra || 0
      },
      totaisFiscais: Object.assign({}, antes.totaisFiscais || {}, {
        totalItens,
        vFrete: totaisTela.frete || 0,
        vSeg: totaisTela.seguro || 0,
        vOutro: totaisTela.outrasDespesas || 0,
        descontoFiscalExtra: totaisTela.descontoFiscalExtra || 0,
        vNF: totalNF,
        totalCalculado: totaisTela.totalCalculado || totalNF
      }),
      totalFiscalOriginal: totalOriginal,
      itensEditados: true,
      statusConferencia: 'Editada com justificativa',
      obsConferencia: motivo,
      ultimaEdicaoItensNF: registro,
      reconciliacaoEstoqueFinanceiroPendente: true,
      updatedAt: new Date().toISOString()
    };
    let fv = null;
    try { fv = W.firebase?.firestore?.FieldValue || (typeof firebase !== 'undefined' ? firebase.firestore?.FieldValue : null); } catch (_) {}
    if (fv?.arrayUnion) payload.auditoriaEdicoes = fv.arrayUnion(registro);
    try {
      const batch = db().batch();
      const efeitos = await aplicarEstornosEdicaoNF(batch, id, antes, diff, motivo);
      const financeiro = await ajustarFinanceiroEdicaoNF(batch, id, antes, totalNF, motivo);
      payload.reconciliacaoEstoqueFinanceiroPendente = diff.incluidos.length > 0;
      payload.resumoReconciliacaoEdicaoNF = { efeitos, financeiro };
      batch.update(db().collection(col).doc(id), payload);
      batch.set(db().collection('lixeira_auditoria').doc(), {
        tenantId: J().tid,
        modulo: 'ESTOQUE/NF',
        acao: `Editou itens da NF ${payload.numero || id}`,
        usuario: J().nome || 'Sistema',
        perfil: J().role || '',
        entidade: col,
        entidadeId: id,
        motivo,
        antes: { numero: antes.numero || '', totalNF: antes.totalNF || antes.totalItens || 0, itens: antes.itens || [] },
        depois: { numero: payload.numero, totalNF: payload.totalNF, itens },
        diff,
        efeitos,
        financeiro,
        aviso: diff.incluidos.length ? 'Itens novos adicionados em modo edicao ficam pendentes de reconciliacao manual; nada foi relancado como entrada nova.' : 'Edicao aplicada sem relancar NF como nova entrada.',
        ts: new Date().toISOString()
      });
      await batch.commit();
      toast(`NF ${payload.numero || id} atualizada com auditoria. Nenhuma entrada nova foi criada.`, 'ok');
      W._thiaModoNF = '';
      setNFSavingMode(false);
      W.fecharModal?.('modalNF');
    } catch (e) {
      toast('Erro ao salvar edição da NF: ' + (e.message || e), 'err');
    }
    return true;
  }

  async function excluirNFAuditada(idEntrada) {
    const id = idEntrada || val('nfEditId');
    if (!id || !db()) return false;
    if (!cargoPodeExcluirNF()) {
      toast('Exclusao de NF ja lancada e permitida somente para admin/dono/gerente autorizado.', 'warn');
      return true;
    }
    let nf = (J().notasFiscaisEntrada || []).find(x => String(x.id) === String(id));
    if (!nf) {
      const snap = await db().collection('notas_fiscais_entrada').doc(id).get();
      if (snap.exists) nf = { id: snap.id, ...snap.data() };
    }
    if (!nf) { toast('NF nao encontrada para exclusao auditada.', 'warn'); return true; }
    const motivo = prompt(`Justificativa obrigatoria para excluir/cancelar a NF ${nf.numero || id}:`, '') || '';
    if (motivo.trim().length < 8) {
      toast('Informe uma justificativa objetiva para excluir/cancelar a NF.', 'warn');
      return true;
    }
    const diff = { excluidos: Array.isArray(nf.itens) ? nf.itens : [], incluidos: [], alterados: [] };
    const agora = new Date().toISOString();
    try {
      const batch = db().batch();
      const efeitos = await aplicarEstornosEdicaoNF(batch, id, nf, diff, motivo.trim());
      const financeiro = await ajustarFinanceiroEdicaoNF(batch, id, nf, 0, motivo.trim());
      batch.update(db().collection('notas_fiscais_entrada').doc(id), {
        excluidaAuditada: true,
        statusFiscal: 'Excluida auditada',
        statusConferencia: 'Excluida auditada',
        excluidaEm: agora,
        excluidaPor: J().nome || 'Sistema',
        motivoExclusao: motivo.trim(),
        resumoExclusaoAuditada: { efeitos, financeiro },
        updatedAt: agora
      });
      batch.set(db().collection('lixeira_auditoria').doc(), {
        tenantId: J().tid,
        modulo: 'ESTOQUE/NF',
        acao: `Exclusao auditada da NF ${nf.numero || id}`,
        usuario: J().nome || 'Sistema',
        perfil: J().role || '',
        entidade: 'notas_fiscais_entrada',
        entidadeId: id,
        motivo: motivo.trim(),
        antes: nf,
        efeitos,
        financeiro,
        ts: agora
      });
      await batch.commit();
      toast(`NF ${nf.numero || id} excluida/cancelada com estorno auditado.`, 'ok');
      W.fecharModal?.('modalNF');
      W.fecharModal?.('modalFiscalDocHardening');
    } catch (e) {
      toast('Erro na exclusao auditada da NF: ' + (e.message || e), 'err');
    }
    return true;
  }

  function wrapNF() {
    if (typeof W.prepNF === 'function' && !W.prepNF.__thiaEditWrap) {
      const oldPrep = W.prepNF;
      W.prepNF = function () {
        const out = oldPrep.apply(this, arguments);
        if ($('nfEditId')) {
          setValue('nfEditId', '');
          setValue('nfEditCollection', 'notas_fiscais_entrada');
          setValue('nfEditJust', '');
          if ($('nfEditBox')) $('nfEditBox').style.display = 'none';
        }
        W._thiaModoNF = '';
        W._thiaNfEditBefore = null;
        setNFSavingMode(false);
        return out;
      };
      W.prepNF.__thiaEditWrap = true;
    }
    if (typeof W.salvarNF === 'function' && !W.salvarNF.__thiaEditWrap) {
      const oldSalvar = W.salvarNF;
      W.salvarNF = async function () {
        if (val('nfEditId') || W._thiaModoNF === 'edicao_nf') {
          const handled = await salvarEdicaoNF();
          if (handled) return;
        }
        return oldSalvar.apply(this, arguments);
      };
      W.salvarNF.__thiaEditWrap = true;
    }
    W.salvarEdicaoNF = salvarEdicaoNF;
    W.excluirNFAuditada = excluirNFAuditada;
    W.excluirNFDef = excluirNFAuditada;
    W.editarDocFiscal = abrirEdicaoNF;
  }

  function tempaAtiva() {
    if (typeof W.thiaModEnabled === 'function') return W.thiaModEnabled('tabelaTempa');
    const mods = J().oficina?.modulos || J().modulos || {};
    return mods.tabelaTempa !== false;
  }

  function bloquearTempa(silencioso) {
    D.querySelectorAll('#navTabelaTempa,#s-tabelatempa,[onclick*="tempa"],[onclick*="Tempa"],.tempa-inline-box,.serv-tempa-busca,.serv-tempa-aplicar,.serv-tempa-resultados-list,.serv-tempa-meta').forEach(el => {
      if (el) el.style.display = 'none';
    });
    if (!silencioso) toast('Tabela Tempária não está liberada para este tenant.', 'warn');
  }

  function wrapTempa() {
    const names = ['tempaCarregar','tempaInicializarTela','tempaPesquisar','tempaSugerirInlineOS','tempaSugerirParaOS','tempaConsultarParaIA'];
    names.forEach(name => {
      const old = W[name];
      if (typeof old !== 'function' || old.__thiaModWrap) return;
      W[name] = function () {
        if (!tempaAtiva()) {
          bloquearTempa(name === 'tempaSugerirInlineOS' || name === 'tempaConsultarParaIA');
          return name === 'tempaBuscarPorTexto' ? [] : null;
        }
        return old.apply(this, arguments);
      };
      W[name].__thiaModWrap = true;
    });
    if (typeof W.tempaBuscarPorTexto === 'function' && !W.tempaBuscarPorTexto.__thiaModWrap) {
      const oldBusca = W.tempaBuscarPorTexto;
      W.tempaBuscarPorTexto = function () {
        if (!tempaAtiva()) { bloquearTempa(true); return []; }
        return oldBusca.apply(this, arguments);
      };
      W.tempaBuscarPorTexto.__thiaModWrap = true;
    }
    if (typeof W.ir === 'function' && !W.ir.__thiaTempaWrap) {
      const oldIr = W.ir;
      W.ir = function (secao, el) {
        if (String(secao || '').replace(/^s-/, '').toLowerCase() === 'tabelatempa' && !tempaAtiva()) {
          bloquearTempa(false);
          return oldIr.call(this, 'dashboard', D.querySelector('.nav-item[onclick*="dashboard"]'));
        }
        return oldIr.apply(this, arguments);
      };
      W.ir.__thiaTempaWrap = true;
    }
    if (!tempaAtiva()) bloquearTempa(true);
  }

  function installClicks() {
    if (D.__thiaFornecedorClick) return;
    D.__thiaFornecedorClick = true;
    D.addEventListener('click', ev => {
      const btn = ev.target?.closest?.('[onclick*="modalFornec"]');
      if (btn && !/prepFornec\(/.test(btn.getAttribute('onclick') || '')) prepFornecCompleto('add');
    }, true);
  }

  function installAll() {
    ensureFornecedorModal();
    ensureFornecedorTableHeader();
    ensureNFEditBox();
    W.prepFornec = prepFornecCompleto;
    W.salvarFornec = salvarFornecCompleto;
    W.renderFornecedores = renderFornecedoresCompleto;
    wrapClienteSave();
    wrapNF();
    wrapTempa();
    installClicks();
    W.thiaInstalarMascarasBrasil?.();
    renderFornecedoresCompleto();
  }

  D.addEventListener('DOMContentLoaded', installAll);
  setTimeout(installAll, 500);
  setTimeout(installAll, 1400);
})();
