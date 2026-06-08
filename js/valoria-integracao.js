(function () {
  'use strict';

  const W = window;
  const D = document;
  const APP_PREFIX = 'thia-valoria';
  const DEFAULT_VALORIA_BASE_URL = 'https://tsvalencio-ia.github.io/Prec_IA/';
  const SIGNATURE = 'Powered by thIAguinho Soluções Digitais';

  function J() { return W.J || {}; }
  function firestoreDb() { return W.db || J().db || null; }
  function nowISO() { return new Date().toISOString(); }
  function nowMs() { return Date.now(); }
  function num(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    const s = String(v == null ? '' : v).replace(/\s/g, '').replace(/R\$/gi, '');
    if (!s) return 0;
    return parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s) || 0;
  }
  function onlyDigits(v) { return String(v || '').replace(/\D+/g, ''); }
  function phoneBR(v) {
    let d = onlyDigits(v);
    if (!d) return '';
    if (d.length <= 11 && !d.startsWith('55')) d = '55' + d;
    return d;
  }
  function safeKey(v) {
    const raw = String(v == null ? '' : v).trim() || ('k_' + nowMs());
    return raw.replace(/[.#$\[\]\/]/g, '_');
  }
  function safeEmail(v) {
    return String(v || '').trim().toLowerCase().replace(/[.#$\[\]]/g, '_');
  }
  function isEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
  }
  function asArray(v) {
    if (Array.isArray(v)) return v;
    if (!v) return [];
    return String(v).split(/[\n,;]+/).map(x => x.trim()).filter(Boolean);
  }
  function escAttr(v) {
    return String(v == null ? '' : v).replace(/[<>&"']/g, c => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function cotMap(os) {
    const raw = os && os.cotacoesPecas;
    if (Array.isArray(raw)) {
      return raw.reduce((acc, item) => {
        if (item && item.key) acc[item.key] = item;
        return acc;
      }, {});
    }
    return raw && typeof raw === 'object' ? Object.assign({}, raw) : {};
  }
  function veiculoTexto(v) {
    return [v.prefixo ? 'Prefixo ' + v.prefixo : '', v.placa ? 'Placa ' + v.placa : '', v.nome || v.modelo || '', v.ano || '', v.chassi ? 'Chassi ' + v.chassi : ''].filter(Boolean).join(' | ');
  }
  function osLabel(os) {
    return 'O.S. ' + String(os?.numero || os?.id || '').toUpperCase();
  }
  function rawConfig() {
    const oficina = J().oficina || {};
    return Object.assign({},
      W.VALORIA_INTEGRATION || {},
      oficina.valoriaIntegracao || {},
      oficina.valorIAIntegracao || {},
      oficina.valoria || {},
      oficina.valorIA || {}
    );
  }
  function enabled() {
    const c = rawConfig();
    return c.enabled === true || c.ativo === true || c.integrado === true || c.roboAtivo === true || String(c.status || '').toLowerCase() === 'ativo';
  }
  function firebaseConfig(c) {
    const direct = c.firebaseConfig || c.config || c.firebase || c.rtdbConfig;
    if (direct && typeof direct === 'object') return direct;
    if (c.databaseURL) {
      return {
        apiKey: c.apiKey || '',
        authDomain: c.authDomain || '',
        databaseURL: c.databaseURL,
        projectId: c.projectId || '',
        storageBucket: c.storageBucket || '',
        messagingSenderId: c.messagingSenderId || '',
        appId: c.appId || ''
      };
    }
    return null;
  }
  function contextoValorIA() {
    const c = rawConfig();
    const oficina = J().oficina || {};
    const tenantId = String(c.tenantId || c.tenant || c.valoriaTenantId || oficina.slug || oficina.publicSlug || oficina.oficinaSlug || J().tenantSlug || J().slug || J().tid || '').trim();
    return { config: c, firebaseConfig: firebaseConfig(c), tenantId, tenantOnly: true };
  }
  function basePath(ctx) {
    return 'tenants/' + safeKey(ctx.tenantId) + '/';
  }
  function publicQuotePath(ctx, quoteId) {
    return 'publicQuotes/' + safeKey(ctx.tenantId) + '/' + safeKey(quoteId);
  }
  function normalizeFornecedorBaseUrl(url) {
    let base = String(url || DEFAULT_VALORIA_BASE_URL).trim();
    if (!base) return '';
    if (!/fornecedor\.html(?:[?#].*)?$/i.test(base)) {
      base = base.replace(/\/?$/, '/') + 'fornecedor.html';
    }
    return base;
  }
  function fornecedorLink(ctx, quoteId, supplierId) {
    const base = normalizeFornecedorBaseUrl(ctx.config.publicBaseUrl || ctx.config.baseUrl || ctx.config.fornecedorUrl || ctx.config.urlFornecedor || W.THIA_PUBLIC_LINKS?.valorIAFornecedor || W.THIA_PUBLIC_LINKS?.valorIA);
    if (!base) return '';
    const sep = base.includes('?') ? '&' : '?';
    return base + sep + 't=' + encodeURIComponent(ctx.tenantId) + '&q=' + encodeURIComponent(quoteId) + '&s=' + encodeURIComponent(supplierId);
  }
  function valoriaDb(ctx) {
    if (!W.firebase || typeof W.firebase.initializeApp !== 'function') {
      throw new Error('Firebase compat indisponível para conectar no ValorIA.');
    }
    if (typeof W.firebase.database !== 'function') {
      throw new Error('Firebase Realtime Database não carregado. Inclua firebase-database-compat.js no Jarvis.');
    }
    if (!ctx.firebaseConfig || !ctx.firebaseConfig.databaseURL) {
      throw new Error('Configuração do ValorIA sem databaseURL.');
    }
    if (!ctx.tenantId) {
      throw new Error('ValorIA ativo exige tenantId do Prec_IA.');
    }
    const id = safeKey(ctx.firebaseConfig.projectId || ctx.firebaseConfig.databaseURL || 'default').slice(0, 50);
    const appName = APP_PREFIX + '-' + id;
    const app = W.firebase.apps.find(a => a.name === appName) || W.firebase.initializeApp(ctx.firebaseConfig, appName);
    return app.database();
  }
  function itemTitulo(item) {
    return (item?.codigo ? '[' + item.codigo + '] ' : '') + (item?.desc || item?.descricao || 'Peça');
  }
  function supplierName(f) {
    return f.nome || f.razao || f.nomeFantasia || 'Fornecedor';
  }
  function supplierPhone(f) {
    return phoneBR(f.wpp || f.whatsapp || f.telefone || f.celular || f.phone || f.to || '');
  }
  function quoteNumber(os, cotacaoId) {
    return [os?.numero || os?.id || 'OS', String(cotacaoId || '').slice(-6).toUpperCase()].filter(Boolean).join('-');
  }
  function buildQuote(ctx, payload) {
    const os = payload.os || {};
    const v = payload.cotPayload?.veiculo || {};
    const itens = (payload.itensPayload || []).map((it, idx) => {
      const itemKey = it.key || payload.itemKeys?.[idx] || ('item_' + idx);
      const qtd = num(it.qtd || 1) || 1;
      const unit = num(it.valorOrcado || it.valorAprovado || 0);
      return {
        id: safeKey(itemKey),
        sourceItemKey: itemKey,
        osItemKey: itemKey,
        oem: it.codigo || '',
        codigoOriginal: it.codigo || '',
        codigo: it.codigo || '',
        desc: it.desc || it.descricao || '',
        descricaoOriginal: it.desc || it.descricao || '',
        descricao: it.desc || it.descricao || '',
        qty: qtd,
        quantidade: qtd,
        saleUnit: unit,
        saleTotal: +(unit * qtd).toFixed(2),
        type: it.tipo || 'peca',
        tipo: it.tipo || 'peca'
      };
    });
    const fornecedores = {};
    (payload.fornecedores || []).forEach(f => {
      const sid = safeKey(f.id || f.token || supplierName(f));
      fornecedores[sid] = {
        id: sid,
        sourceId: f.id || '',
        name: supplierName(f),
        nome: supplierName(f),
        phone: supplierPhone(f),
        whatsapp: supplierPhone(f),
        email: f.email || ''
      };
    });
    return {
      id: payload.cotacaoId,
      number: quoteNumber(os, payload.cotacaoId),
      numero: quoteNumber(os, payload.cotacaoId),
      status: 'aberta',
      createdAt: nowMs(),
      updatedAt: nowMs(),
      createdAtISO: payload.criadoEm || nowISO(),
      origin: 'thia_saas_os',
      origem: 'thia_saas_os',
      signature: SIGNATURE,
      tenantId: ctx.tenantId,
      thiaTenantId: J().tid || '',
      osId: os.id || payload.cotPayload?.osId || '',
      firestoreCotacaoId: payload.cotacaoId,
      priority: payload.cotPayload?.prioridade || 'normal',
      prioridade: payload.cotPayload?.prioridade || 'normal',
      observation: payload.cotPayload?.observacao || '',
      observacao: payload.cotPayload?.observacao || '',
      expiresAt: payload.expiraEm || '',
      expiraEm: payload.expiraEm || '',
      vehicle: {
        plate: v.placa || '',
        placa: v.placa || '',
        prefixo: v.prefixo || v.frota || '',
        brand: v.marca || '',
        marca: v.marca || '',
        model: v.modelo || v.nome || '',
        modelo: v.modelo || v.nome || '',
        year: v.ano || '',
        ano: v.ano || '',
        chassi: v.chassi || v.chassis || '',
        km: v.km || '',
        tipo: v.tipo || '',
        nome: v.nome || ''
      },
      workOrder: {
        id: os.id || '',
        numero: os.numero || '',
        ref: osLabel(os),
        clienteId: os.clienteId || '',
        veiculoId: os.veiculoId || ''
      },
      items: itens,
      suppliers: fornecedores
    };
  }
  function sanitizePublicQuote(q) {
    const copy = Object.assign({}, q, {
      items: (q.items || []).map(it => {
        const out = Object.assign({}, it);
        delete out.saleUnit;
        delete out.saleTotal;
        return out;
      })
    });
    delete copy.internal;
    delete copy.suppliers;
    return copy;
  }
  function buildMessage(ctx, payload, fornecedor, link) {
    const os = payload.os || {};
    const v = payload.cotPayload?.veiculo || {};
    const itens = payload.itensPayload || [];
    const lines = [
      'Olá, ' + supplierName(fornecedor) + '.',
      '',
      'Solicito cotação de peças para ' + osLabel(os) + '.',
      'Veículo: ' + (veiculoTexto(v) || '-'),
      '',
      'Itens:',
      ...itens.map((it, idx) => (idx + 1) + '. ' + itemTitulo(it) + ' | Qtd: ' + (it.qtd || 1)),
      '',
      payload.cotPayload?.observacao ? 'Observação: ' + payload.cotPayload.observacao : '',
      link ? 'Responda pelo formulário: ' + link : 'Pode responder aqui mesmo no WhatsApp com item, preço, marca/código e prazo.',
      '',
      'Formato recomendado: código ou nome da peça - R$ 0,00 - marca/código - prazo.',
      SIGNATURE
    ];
    return lines.filter(Boolean).join('\n');
  }
  function adminEmailsValorIA(ctx) {
    const oficina = J().oficina || {};
    const c = ctx.config || {};
    const raw = []
      .concat(asArray(c.adminEmails || c.emailsAdmin || c.adminsEmails))
      .concat(asArray(oficina.adminEmails || oficina.emailsAdmin || oficina.adminsEmails))
      .concat([c.adminEmail, oficina.email, oficina.usuario, J().adminEmail, sessionStorage.getItem('j_admin_email')])
      .filter(Boolean)
      .map(e => String(e).trim().toLowerCase())
      .filter(isEmail);
    return Array.from(new Set(raw));
  }
  function tenantProfileUpdates(ctx, payload) {
    const oficina = J().oficina || {};
    const c = ctx.config || {};
    const updates = {};
    const emails = adminEmailsValorIA(ctx);
    const meta = {
      tenantId: ctx.tenantId,
      thiaTenantId: J().tid || '',
      businessName: oficina.nomeFantasia || oficina.nome || oficina.razaoSocial || J().nomeOficina || 'Oficina',
      name: oficina.nomeFantasia || oficina.nome || oficina.razaoSocial || J().nomeOficina || 'Oficina',
      niche: oficina.nicho || c.nicho || 'oficina',
      managerPhone: oficina.wpp || oficina.telefone || c.managerPhone || '',
      phone: oficina.wpp || oficina.telefone || c.phone || '',
      city: oficina.cidade || '',
      responsible: oficina.responsavel || oficina.representante || J().nome || '',
      adminEmails: emails,
      active: true,
      source: 'thIAguinho_OFICIN_IA',
      lastOsId: payload.os?.id || payload.cotPayload?.osId || '',
      updatedAt: nowMs(),
      signature: SIGNATURE
    };
    updates['tenants/' + safeKey(ctx.tenantId) + '/meta'] = meta;
    updates[basePath(ctx) + 'settings/name'] = meta.businessName;
    updates[basePath(ctx) + 'settings/phone'] = meta.phone;
    updates[basePath(ctx) + 'settings/managerPhone'] = meta.managerPhone;
    updates[basePath(ctx) + 'settings/city'] = meta.city;
    updates[basePath(ctx) + 'settings/owner'] = meta.responsible;
    updates[basePath(ctx) + 'settings/niche'] = meta.niche;
    updates[basePath(ctx) + 'settings/signature'] = SIGNATURE;
    emails.forEach(email => {
      updates['tenantEmailIndex/' + safeEmail(email)] = {
        tenantId: ctx.tenantId,
        email,
        role: 'admin',
        active: true,
        source: 'thIAguinho_OFICIN_IA',
        updatedAt: nowMs()
      };
    });
    return updates;
  }
  function queueUpdates(ctx, payload, quote) {
    const updates = {};
    const queues = [];
    (payload.fornecedores || []).forEach(f => {
      const sid = safeKey(f.id || f.token || supplierName(f));
      const phone = supplierPhone(f);
      if (!phone) return;
      const qid = 'wa_' + safeKey(payload.cotacaoId).slice(0, 10) + '_' + sid + '_' + nowMs().toString(36);
      const link = fornecedorLink(ctx, payload.cotacaoId, sid);
      const message = buildMessage(ctx, payload, f, link);
      const item = {
        id: qid,
        tenantId: ctx.tenantId,
        quoteId: payload.cotacaoId,
        cotacaoId: payload.cotacaoId,
        quoteNumber: quote.number,
        supplierId: sid,
        fornecedorId: sid,
        supplierName: supplierName(f),
        fornecedorNome: supplierName(f),
        phone,
        to: phone,
        whatsapp: phone,
        message,
        status: 'pending',
        createdAt: nowMs(),
        updatedAt: nowMs(),
        type: 'quote_request',
        origin: 'thia_saas_os',
        publicLink: link,
        signature: SIGNATURE
      };
      updates[basePath(ctx) + 'whatsappQueue/' + qid] = item;
      updates['whatsappContacts/' + phone.replace(/^55/, '')] = {
        tenantId: ctx.tenantId,
        supplierId: sid,
        phone,
        lastQuoteId: payload.cotacaoId,
        lastQueueId: qid,
        mappedAt: nowMs()
      };
      queues.push({ id: qid, supplierId: sid, supplierName: supplierName(f), phone, publicLink: link });
    });
    return { updates, queues };
  }
  async function annotateOS(payload, meta) {
    const database = firestoreDb();
    const osId = payload.os?.id || payload.cotPayload?.osId;
    if (!database || !osId) return;
    const ref = database.collection('ordens_servico').doc(osId);
    const snap = await ref.get();
    const os = snap.exists ? { id: snap.id, ...snap.data() } : (payload.os || {});
    const map = cotMap(os);
    (payload.itensPayload || []).forEach((it, idx) => {
      const key = it.key || payload.itemKeys?.[idx];
      if (!key) return;
      const atual = Object.assign({ key, item: it, opcoes: [] }, map[key] || {});
      atual.solicitacoes = Array.isArray(atual.solicitacoes) ? atual.solicitacoes.slice() : [];
      const pos = atual.solicitacoes.findIndex(s => String(s.id || '') === String(payload.cotacaoId));
      const value = Object.assign({}, pos >= 0 ? atual.solicitacoes[pos] : {
        id: payload.cotacaoId,
        status: 'enviada',
        createdAt: payload.criadoEm || nowISO()
      }, {
        valorIA: {
          quoteId: meta.quoteId,
          tenantId: meta.tenantId,
          queueCount: meta.queueCount,
          queues: meta.queues,
          createdAt: meta.createdAt
        }
      });
      if (pos >= 0) atual.solicitacoes[pos] = value;
      else atual.solicitacoes.push(value);
      atual.updatedAt = nowISO();
      map[key] = atual;
    });
    const timeline = Array.isArray(os.timeline) ? os.timeline.slice() : [];
    timeline.push({
      dt: nowISO(),
      user: J().nome || 'Jarvis',
      acao: 'Cotação enviada para a fila do robô ValorIA: ' + meta.queueCount + ' fornecedor(es).',
      tipo: 'valoria_cotacao_robo',
      interno: true,
      cotacaoId: payload.cotacaoId,
      valorIAQuoteId: meta.quoteId
    });
    await ref.update({ cotacoesPecas: map, timeline, updatedAt: nowISO() });
    const local = (J().os || []).find(o => String(o.id || '') === String(osId));
    if (local) Object.assign(local, { cotacoesPecas: map, timeline, updatedAt: nowISO() });
  }

  W.thiaValorIAAfterSalvarCotacao = async function (payload) {
    if (!enabled()) return null;
    const ctx = contextoValorIA();
    const rtdb = valoriaDb(ctx);
    const quote = buildQuote(ctx, payload);
    const queued = queueUpdates(ctx, payload, quote);
    const updates = Object.assign({}, queued.updates);
    Object.assign(updates, tenantProfileUpdates(ctx, payload));
    updates[basePath(ctx) + 'quotes/' + safeKey(payload.cotacaoId)] = quote;
    updates[publicQuotePath(ctx, payload.cotacaoId)] = sanitizePublicQuote(quote);
    await rtdb.ref().update(updates);
    const meta = {
      quoteId: payload.cotacaoId,
      tenantId: ctx.tenantId,
      queueCount: queued.queues.length,
      queues: queued.queues,
      publicBaseUrl: normalizeFornecedorBaseUrl(ctx.config.publicBaseUrl || ctx.config.baseUrl || ctx.config.fornecedorUrl || ctx.config.urlFornecedor || W.THIA_PUBLIC_LINKS?.valorIAFornecedor || W.THIA_PUBLIC_LINKS?.valorIA),
      publicLinksBySupplier: queued.queues.reduce((acc, q) => {
        acc[q.supplierId] = q.publicLink;
        return acc;
      }, {}),
      createdAt: nowISO()
    };
    try { await annotateOS(payload, meta); } catch (err) { console.warn('ValorIA gravou fila, mas nao anotou O.S.', err); }
    if (queued.queues.length) W.toast?.('ValorIA: cotação colocada na fila do robô.', 'ok');
    else W.toast?.('ValorIA: cotação publicada, mas nenhum fornecedor tinha WhatsApp válido.', 'warn');
    return meta;
  };

  async function loadQuoteWithResponses(ctx, rtdb, quoteId) {
    const qPath = basePath(ctx) + 'quotes/' + safeKey(quoteId);
    const qSnap = await rtdb.ref(qPath).once('value');
    const quote = qSnap.val() || {};
    const responses = quote.responses || {};
    return { quote, responses };
  }
  function responseToOption(quoteId, supplierId, itemId, resp, quote, cot) {
    const items = Array.isArray(quote.items) ? quote.items : [];
    const qItem = items.find(i => String(i.id || '') === String(itemId || '')) || {};
    const itemKey = qItem.sourceItemKey || qItem.osItemKey || itemId;
    const item = cot.item || {
      key: itemKey,
      codigo: qItem.codigo || qItem.codigoOriginal || qItem.oem || '',
      desc: qItem.desc || qItem.descricao || qItem.descricaoOriginal || '',
      qtd: qItem.qty || qItem.quantidade || 1
    };
    const qtd = num(item.qtd || qItem.qty || qItem.quantidade || 1) || 1;
    const unit = num(resp.price || resp.precoUnitario || resp.valorUnitario || 0);
    const available = resp.available !== false && resp.temDisponivel !== false && unit > 0;
    const fornecedor = quote.suppliers?.[supplierId]?.name || quote.suppliers?.[supplierId]?.nome || resp.supplierName || resp.fornecedorNome || supplierId;
    return {
      id: 'valoria-' + safeKey(quoteId) + '-' + safeKey(supplierId) + '-' + safeKey(itemId),
      itemKey,
      fornecedorId: supplierId,
      fornecedor,
      valorUnitario: unit,
      valorTotal: +(unit * qtd).toFixed(2),
      prazo: resp.availability || resp.disponibilidade || resp.prazo || '',
      condicao: [
        available ? '' : 'Fornecedor informou indisponível',
        resp.brand || resp.marca ? 'Marca: ' + (resp.brand || resp.marca) : '',
        resp.brandCode || resp.codigoMarca ? 'Código: ' + (resp.brandCode || resp.codigoMarca) : '',
        resp.obs || resp.observacao || ''
      ].filter(Boolean).join(' | '),
      marca: resp.brand || resp.marca || '',
      modelo: resp.brandCode || resp.codigoMarca || resp.desc || resp.descricaoFornecedor || '',
      marcaModelo: [resp.brand || resp.marca || '', resp.brandCode || resp.codigoMarca || resp.desc || resp.descricaoFornecedor || ''].filter(Boolean).join(' / '),
      selecionado: false,
      comprado: false,
      disponivel: available,
      origem: 'valorIA_bot',
      valorIAQuoteId: quoteId,
      valorIASupplierId: supplierId,
      valorIAItemId: itemId,
      rawText: resp.rawText || '',
      recebidoEm: resp.atualizadoEm || resp.updatedAt || nowISO(),
      updatedAt: nowISO()
    };
  }
  function recomputeBest(cot) {
    const opcoes = Array.isArray(cot.opcoes) ? cot.opcoes : [];
    const best = opcoes
      .filter(op => num(op.valorUnitario) > 0 || num(op.valorTotal) > 0)
      .map(op => Object.assign({}, op, { _total: num(op.valorTotal) || num(op.valorUnitario) * (num(cot.item?.qtd || 1) || 1) }))
      .sort((a, b) => a._total - b._total)[0] || null;
    cot.melhorCotacao = best ? {
      id: best.id,
      fornecedorId: best.fornecedorId || '',
      fornecedor: best.fornecedor || '',
      valorUnitario: num(best.valorUnitario),
      valorTotal: num(best.valorTotal) || best._total,
      prazo: best.prazo || '',
      condicao: best.condicao || ''
    } : null;
  }
  function collectIntegrations(map) {
    const out = new Map();
    Object.values(map || {}).forEach(cot => {
      (cot.solicitacoes || []).forEach(sol => {
        const v = sol.valorIA || sol.valoria;
        if (!v?.quoteId) return;
        out.set(String(v.quoteId), v);
      });
    });
    return Array.from(out.values());
  }

  W.thiaValorIASincronizarOS = async function (osId) {
    const database = firestoreDb();
    if (!database) { W.toast?.('Banco da oficina indisponível.', 'warn'); return; }
    if (!enabled()) { W.toast?.('ValorIA não está ativo para esta oficina.', 'warn'); return; }
    const ctx = contextoValorIA();
    const rtdb = valoriaDb(ctx);
    const id = osId || D.getElementById('osId')?.value || '';
    if (!id) { W.toast?.('Abra uma O.S. antes de sincronizar o ValorIA.', 'warn'); return; }
    const ref = database.collection('ordens_servico').doc(id);
    const snap = await ref.get();
    if (!snap.exists) { W.toast?.('O.S. não encontrada para sincronizar ValorIA.', 'warn'); return; }
    const os = { id: snap.id, ...snap.data() };
    const map = cotMap(os);
    const integrations = collectIntegrations(map);
    if (!integrations.length) { W.toast?.('Esta O.S. ainda não tem cotação vinculada ao ValorIA.', 'warn'); return; }
    let adicionadas = 0;
    for (const integ of integrations) {
      const loaded = await loadQuoteWithResponses(ctx, rtdb, integ.quoteId);
      const quote = loaded.quote || {};
      const responses = loaded.responses || {};
      Object.entries(responses).forEach(([supplierId, items]) => {
        Object.entries(items || {}).forEach(([itemId, resp]) => {
          if (!resp || typeof resp !== 'object') return;
          const quoteItem = (quote.items || []).find(i => String(i.id || '') === String(itemId || '')) || {};
          const itemKey = quoteItem.sourceItemKey || quoteItem.osItemKey || itemId;
          const cot = Object.assign({ key: itemKey, item: {}, opcoes: [] }, map[itemKey] || {});
          cot.opcoes = Array.isArray(cot.opcoes) ? cot.opcoes.slice() : [];
          const exists = cot.opcoes.some(op => String(op.valorIAQuoteId || '') === String(integ.quoteId) && String(op.valorIASupplierId || '') === String(supplierId) && String(op.valorIAItemId || '') === String(itemId));
          if (exists) return;
          const option = responseToOption(integ.quoteId, supplierId, itemId, resp, quote, cot);
          cot.opcoes.push(option);
          cot.item = cot.item && Object.keys(cot.item).length ? cot.item : {
            key: itemKey,
            codigo: quoteItem.codigo || quoteItem.codigoOriginal || quoteItem.oem || '',
            desc: quoteItem.desc || quoteItem.descricao || quoteItem.descricaoOriginal || '',
            qtd: quoteItem.qty || quoteItem.quantidade || 1
          };
          cot.updatedAt = nowISO();
          recomputeBest(cot);
          map[itemKey] = cot;
          adicionadas++;
        });
      });
    }
    if (!adicionadas) { W.toast?.('ValorIA sincronizado. Nenhuma resposta nova encontrada.', 'ok'); return; }
    const timeline = Array.isArray(os.timeline) ? os.timeline.slice() : [];
    timeline.push({
      dt: nowISO(),
      user: J().nome || 'Jarvis',
      acao: 'Sincronizou ' + adicionadas + ' resposta(s) do robô ValorIA na cotação da O.S.',
      tipo: 'valoria_respostas_sync',
      interno: true
    });
    await ref.update({ cotacoesPecas: map, timeline, updatedAt: nowISO() });
    const local = (J().os || []).find(o => String(o.id || '') === String(id));
    if (local) Object.assign(local, { cotacoesPecas: map, timeline, updatedAt: nowISO() });
    if (D.getElementById('osId')?.value === id && typeof W.aplicarMarcadoresAprovacaoOS === 'function') {
      W.aplicarMarcadoresAprovacaoOS(local || Object.assign(os, { cotacoesPecas: map, timeline }));
    }
    if (D.getElementById('osId')?.value === id && typeof W.atualizarCotacaoPecasOrcamentoAtualOS === 'function') {
      W.atualizarCotacaoPecasOrcamentoAtualOS(local || Object.assign(os, { cotacoesPecas: map, timeline }));
    }
    W.toast?.('ValorIA: respostas sincronizadas na O.S.', 'ok');
  };

  W.thiaValorIAAbrirLinksOS = async function (osId) {
    const id = osId || D.getElementById('osId')?.value || '';
    if (!id) { W.toast?.('Abra uma O.S. antes de ver os links do ValorIA.', 'warn'); return; }
    let os = (J().os || []).find(o => String(o.id || '') === String(id));
    const database = firestoreDb();
    if (database) {
      try {
        const snap = await database.collection('ordens_servico').doc(id).get();
        if (snap.exists) os = { id: snap.id, ...snap.data() };
      } catch (_) {}
    }
    const integrations = collectIntegrations(cotMap(os || {}));
    const queues = integrations.flatMap(v => Array.isArray(v.queues) ? v.queues : []);
    if (!queues.length) { W.toast?.('Esta O.S. ainda nao tem links ValorIA gerados.', 'warn'); return; }
    D.getElementById('modalValorIALinksOS')?.remove();
    const rows = queues.map((q, idx) => `
      <div style="border:1px solid var(--border);background:rgba(255,255,255,.04);border-radius:4px;padding:9px;margin-top:8px;">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
          <strong style="color:var(--text);">${escAttr(q.supplierName || q.fornecedorNome || q.supplierId || 'Fornecedor')}</strong>
          <small style="font-family:var(--fm);color:var(--muted);">${escAttr(q.phone || q.whatsapp || '')}</small>
        </div>
        <div style="display:grid;grid-template-columns:minmax(180px,1fr) auto auto;gap:7px;align-items:center;">
          <input class="j-input thia-valoria-link" readonly value="${escAttr(q.publicLink || '')}" style="font-size:.68rem;font-family:var(--fm);">
          <button type="button" class="btn-outline" onclick="navigator.clipboard?.writeText(document.querySelectorAll('.thia-valoria-link')[${idx}].value);window.toast?.('Link copiado.','ok')">Copiar</button>
          <button type="button" class="btn-primary" onclick="window.thiaOpenExternalUrl?window.thiaOpenExternalUrl(document.querySelectorAll('.thia-valoria-link')[${idx}].value):window.open(document.querySelectorAll('.thia-valoria-link')[${idx}].value,'_blank')">Abrir</button>
        </div>
      </div>`).join('');
    D.body.insertAdjacentHTML('beforeend', `
      <div class="overlay" id="modalValorIALinksOS" style="display:flex;">
        <div class="modal" style="max-width:860px;width:94vw;">
          <div class="modal-head">
            <div class="modal-title">LINKS VALORIA / PREC_IA DA O.S.</div>
            <button class="modal-close" onclick="document.getElementById('modalValorIALinksOS')?.remove()">x</button>
          </div>
          <div class="modal-body">
            <small style="display:block;color:var(--muted);font-family:var(--fm);font-size:.64rem;margin-bottom:8px;">Estes sao os links publicos do Prec_IA gerados a partir da cotacao da O.S. O cotacaoId e o veiculo ficam vinculados ao mesmo tenant.</small>
            ${rows}
          </div>
          <div class="modal-foot"><button class="btn-ghost" onclick="document.getElementById('modalValorIALinksOS')?.remove()">FECHAR</button></div>
        </div>
      </div>`);
  };

  function injectSyncButton() {
    if (!enabled()) return;
    const root = D.getElementById('cotacaoPecasOS');
    if (!root || root.querySelector('[data-valoria-sync-btn]')) return;
    const bar = Array.from(root.querySelectorAll('button')).find(btn => /EXPORTAR ANÁLISE/i.test(btn.textContent || ''))?.parentElement;
    if (!bar) return;
    const osId = D.getElementById('osId')?.value || '';
    const btn = D.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-outline';
    btn.setAttribute('data-valoria-sync-btn', '1');
    btn.textContent = 'SINCRONIZAR VALORIA';
    btn.onclick = () => W.thiaValorIASincronizarOS(osId);
    bar.appendChild(btn);
    const links = D.createElement('button');
    links.type = 'button';
    links.className = 'btn-outline';
    links.setAttribute('data-valoria-links-btn', '1');
    links.textContent = 'LINKS VALORIA';
    links.onclick = () => W.thiaValorIAAbrirLinksOS(osId);
    bar.appendChild(links);
  }
  function patchRender() {
    if (W._valorIAPatchRender || typeof W.atualizarCotacaoPecasOrcamentoAtualOS !== 'function') return;
    const original = W.atualizarCotacaoPecasOrcamentoAtualOS;
    W.atualizarCotacaoPecasOrcamentoAtualOS = function () {
      const out = original.apply(this, arguments);
      setTimeout(injectSyncButton, 100);
      return out;
    };
    W._valorIAPatchRender = true;
  }
  D.addEventListener('DOMContentLoaded', function () {
    patchRender();
    setTimeout(function () { patchRender(); injectSyncButton(); }, 700);
    const timer = setInterval(function () {
      patchRender();
      injectSyncButton();
      if (W._valorIAPatchRender) clearInterval(timer);
    }, 1200);
  });

  W.thiaValorIAStatus = function () {
    const ctx = contextoValorIA();
    return {
      enabled: enabled(),
      tenantId: ctx.tenantId,
      tenantOnly: true,
      hasFirebaseConfig: !!ctx.firebaseConfig,
      hasDatabaseURL: !!ctx.firebaseConfig?.databaseURL
    };
  };
})();
