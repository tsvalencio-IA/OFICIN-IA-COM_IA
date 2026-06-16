/*
 * OFICIN-IA — Orquestrador estável da IA Diagnóstico
 *
 * Correção cirúrgica:
 * - Não usa iframe como fluxo principal.
 * - Não tenta acessar frame externo nem preencher login visual.
 * - Não envia usuário/senha/anonKey pelo front-end.
 * - Chama somente o proxy interno /api/diagnostico para diagnóstico automotivo.
 * - Preserva o Jarvis local para estoque, financeiro, O.S., histórico puro e demais consultas internas.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const PORTAL_PADRAO = 'https://www.appdiagnosticoautomotivo.com.br/';
  const ENDPOINT_PADRAO = '/api/diagnostico';
  const CHAT_PREFIX = 'oficinia:jarvis:chat:';
  const original = {
    thiaIAAsk: W.thiaIAAsk,
    iaPerguntar: W.iaPerguntar,
    iaEnviar: W.iaEnviar,
    adicionarMsgIA: W.adicionarMsgIA,
    thiaResponderLocal: W.thiaResponderLocal
  };

  let cfgCache = null;

  function txt(v) { return String(v == null ? '' : v).trim(); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }
  function stripHtml(v) {
    return String(v == null ? '' : v)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
  }
  function norm(v) {
    return String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
  function getJ() { return W.J || W.JARVIS || {}; }
  function getTid() {
    const J = getJ();
    return txt(J.tid || J.tenantId || sessionStorage.getItem('j_tid') || localStorage.getItem('j_tid') || '');
  }
  function getUid() {
    const J = getJ();
    return txt(J.user?.uid || J.user?.id || J.uid || J.fid || sessionStorage.getItem('j_fid') || sessionStorage.getItem('j_uid') || J.nome || 'anon');
  }
  function getDb() {
    const J = getJ();
    return J.db || W.db || (W.firebase && W.firebase.firestore ? W.firebase.firestore() : null);
  }

  async function carregarConfigTenant(force) {
    if (cfgCache && !force) return cfgCache;

    let oficina = getJ().oficina || {};
    const tid = getTid();
    const db = getDb();

    if (tid && db && db.collection) {
      try {
        const doc = await db.collection('oficinas').doc(tid).get();
        if (doc && doc.exists) oficina = Object.assign({}, oficina || {}, doc.data() || {});
      } catch (_) {}
      try {
        const docTenant = await db.collection('tenants').doc(tid).get();
        if (docTenant && docTenant.exists) oficina = Object.assign({}, docTenant.data() || {}, oficina || {});
      } catch (_) {}
    }

    const cfg = Object.assign(
      {},
      oficina.iaDiagnosticoAutomotivo || {},
      (oficina.integracoes && oficina.integracoes.iaDiagnosticoAutomotivo) || {}
    );

    const modulos = oficina.modulos || {};
    const explicitamenteBloqueado = cfg.ativo === false || cfg.moduloLiberado === false || modulos.iaDiagnosticoAutomotivo === false;
    const explicitamenteLiberado = cfg.ativo === true || cfg.moduloLiberado === true || modulos.iaDiagnosticoAutomotivo === true;

    cfgCache = {
      ativo: explicitamenteLiberado || !explicitamenteBloqueado,
      endpoint: txt(cfg.endpoint || cfg.proxy || cfg.proxyUrl || ENDPOINT_PADRAO) || ENDPOINT_PADRAO,
      portalUrl: txt(cfg.portalUrl || PORTAL_PADRAO) || PORTAL_PADRAO
    };
    return cfgCache;
  }

  function chatKey() {
    const tela = location.pathname.toLowerCase().includes('equipe') ? 'equipe' : 'jarvis';
    return `${CHAT_PREFIX}${getTid() || 'default'}:${getUid() || 'anon'}:${tela}`;
  }

  function lerHistoricoLocal() {
    try {
      const arr = JSON.parse(localStorage.getItem(chatKey()) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function salvarMensagemLocal(role, text, origem) {
    try {
      const clean = stripHtml(text);
      if (!clean) return;
      let arr = lerHistoricoLocal();
      const last = arr[arr.length - 1];
      if (last && last.role === role && last.text === clean && Date.now() - Number(last.at || 0) < 2000) return;
      arr.push({ role: role === 'assistant' || role === 'bot' ? 'assistant' : 'user', text: clean, origem: origem || '', at: Date.now() });
      arr = arr.filter(m => Date.now() - Number(m.at || 0) < 7 * 24 * 60 * 60 * 1000).slice(-50);
      localStorage.setItem(chatKey(), JSON.stringify(arr));
    } catch (_) {}
  }

  function restaurarConversaVisual() {
    try {
      const box = D.getElementById('iaMsgs');
      if (!box || box.dataset.thiaDiagRestaurado === '1') return;
      const arr = lerHistoricoLocal();
      if (!arr.length) return;

      const temMensagensReais = Array.from(box.children || []).some(el => {
        const t = txt(el.textContent);
        return t && !/sistema operacional|ia diagnostico pronta|sem mensagens/i.test(t);
      });
      if (temMensagensReais) {
        box.dataset.thiaDiagRestaurado = '1';
        return;
      }

      box.dataset.thiaDiagRestaurado = '1';
      arr.forEach(m => {
        const div = D.createElement('div');
        div.className = 'ia-msg ' + (m.role === 'assistant' ? 'bot' : 'user');
        div.innerHTML = m.role === 'assistant'
          ? '<strong>thIAguinho:</strong> ' + esc(m.text).replace(/\n/g, '<br>')
          : esc(m.text).replace(/\n/g, '<br>');
        box.appendChild(div);
      });
      box.scrollTop = box.scrollHeight;
    } catch (_) {}
  }

  function addUser(message) {
    const box = D.getElementById('iaMsgs');
    if (!box) return null;
    const div = D.createElement('div');
    div.className = 'ia-msg user';
    div.textContent = message;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    salvarMensagemLocal('user', message, 'usuario');
    return div;
  }

  function addBot(html, salvar) {
    const box = D.getElementById('iaMsgs');
    if (!box) return null;
    const id = 'ia-diag-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    const div = D.createElement('div');
    div.id = id;
    div.className = 'ia-msg bot';
    div.innerHTML = '<strong>thIAguinho:</strong> ' + html;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    if (salvar) salvarMensagemLocal('assistant', stripHtml(html), 'sistema');
    return id;
  }

  function replaceBot(id, html, salvar) {
    const el = D.getElementById(id);
    if (!el) return;
    el.innerHTML = '<strong>thIAguinho:</strong> ' + html;
    const box = D.getElementById('iaMsgs');
    if (box) box.scrollTop = box.scrollHeight;
    if (salvar) salvarMensagemLocal('assistant', stripHtml(html), 'diagnostico');
  }

  function extrairPlaca(texto) {
    const m = String(texto || '').toUpperCase().match(/\b[A-Z]{3}-?\d[A-Z0-9]\d{2}\b/);
    return m ? m[0].replace('-', '') : null;
  }

  function normalizarCodigoFalha(texto) {
    const s = String(texto || '').toUpperCase();
    const m = s.match(/\bP\s*0?([0-9]{3,4})\b/);
    if (!m) return texto;
    const n = m[1].padStart(4, '0').slice(-4);
    return s.replace(/\bP\s*0?[0-9]{3,4}\b/, 'P' + n);
  }

  function analisarIntencao(texto) {
    const raw = txt(texto);
    const t = norm(raw);
    const placa = extrairPlaca(raw);
    const compact = t.replace(/[^a-z0-9]/g, '');
    const placaCompact = placa ? placa.toLowerCase() : '';

    const somentePlaca = !!placa && compact === placaCompact;
    const historicoExplicito = !!placa && /\b(historico|histórico|passagem|passagens|os|ordem|ordens)\b/i.test(raw) &&
      !/\b(falh|lenta|engasg|forc|força|partida|aquec|barulho|ruido|vibr|apag|morrendo|injec|ignic|vela|bobina|bico|sensor|sonda|dtc|codigo|código|p\s*0?\d{3,4})\b/i.test(raw);

    const interno = /\b(estoque|financeiro|dre|caixa|contas?\s+a\s+pagar|contas?\s+a\s+receber|cliente|fornecedor|kardex|orcamento|orçamento|nota fiscal|nfe|nf-e|agenda|equipe|comissao|comissão|venda|relatorio|relatório|faturar|faturado|faturamento|receber|recebimento|sem\s+receber|sem\s+faturar)\b/.test(t);

    const diagnostico = /\b(falh|falhando|falha|lenta|marcha lenta|engasg|engasga|sem forca|sem força|fraco|partida|sem partida|aquec|superaquec|barulho|ruido|ruído|vibr|apag|apaga|morrendo|morre|injec|injeção|ignic|ignição|vela|velas|bobina|bico|sensor|sonda|scanner|obd|dtc|codigo|código|p\s*0?\d{3,4})\b/i.test(raw);

    if (somentePlaca || historicoExplicito) return { tipo: 'LOCAL', placa, motivo: 'placa_ou_historico' };
    if (interno && !diagnostico) return { tipo: 'LOCAL', placa, motivo: 'modulo_interno' };
    if (diagnostico && placa) return { tipo: 'HIBRIDA', placa, motivo: 'placa_com_diagnostico' };
    if (diagnostico) return { tipo: 'EXTERNA', placa: null, motivo: 'diagnostico' };
    return { tipo: 'LOCAL', placa, motivo: 'fallback_local' };
  }

  function respostaLocalTexto(pergunta, perfil) {
    try {
      if (typeof original.thiaResponderLocal === 'function') {
        return stripHtml(original.thiaResponderLocal(pergunta, { perfil: perfil || 'jarvis' }));
      }
      if (typeof W.thiaResponderLocal === 'function') {
        return stripHtml(W.thiaResponderLocal(pergunta, { perfil: perfil || 'jarvis' }));
      }
    } catch (_) {}
    return '';
  }

  function contextoKey() {
    const tela = location.pathname.toLowerCase().includes('equipe') ? 'equipe' : 'jarvis';
    return 'oficinia:diag:contexto:' + (getTid() || 'default') + ':' + getUid() + ':' + tela;
  }

  function normalizarPlaca(p) {
    return String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function limparContextoAtivo() {
    try { localStorage.removeItem(contextoKey()); } catch (_) {}
  }

  function lerContextoAtivo() {
    try {
      const ctx = JSON.parse(localStorage.getItem(contextoKey()) || 'null');
      if (!ctx || !ctx.placa) return null;
      if (Date.now() - Number(ctx.updatedAt || 0) > 12 * 60 * 60 * 1000) return null;
      return ctx;
    } catch (_) {
      return null;
    }
  }

  function salvarContextoAtivo(ctx) {
    try {
      if (!ctx || !ctx.placa) return null;
      const atual = lerContextoAtivo() || {};
      const novo = Object.assign({}, atual, ctx, {
        placa: normalizarPlaca(ctx.placa || atual.placa),
        updatedAt: Date.now()
      });
      localStorage.setItem(contextoKey(), JSON.stringify(novo));
      return novo;
    } catch (_) {
      return ctx;
    }
  }

  function listaOSDisponivel() {
    const J = getJ();
    const fontes = [
      J.os, J.OS, J.ordens, J.ordensServico, J.dbOS,
      W.os, W.OS, W.ordens, W.ordensServico, W.dbOS, W.__dbOS, W.listaOS, W.ordensAbertas
    ];
    const mapa = new Map();
    fontes.forEach(src => {
      if (!Array.isArray(src)) return;
      src.forEach(item => {
        if (!item || typeof item !== 'object') return;
        const id = item.id || item.docId || item._id || item.numero || item.codigo || JSON.stringify(item).slice(0, 80);
        if (!mapa.has(String(id))) mapa.set(String(id), item);
      });
    });
    return Array.from(mapa.values());
  }

  function encontrarOSPorPlaca(placa) {
    const p = normalizarPlaca(placa);
    if (!p) return null;
    const lista = listaOSDisponivel();

    const candidatas = lista.filter(o => {
      const op = normalizarPlaca(
        o.placa ||
        o.veiculoPlaca ||
        o.placaVeiculo ||
        o.veiculo?.placa ||
        o.dadosVeiculo?.placa ||
        o.clienteVeiculo?.placa ||
        ''
      );
      return op === p;
    });

    if (!candidatas.length) return null;

    const aberta = candidatas.find(o => !/entregue|cancelado|finalizado|fechado/i.test(String(o.status || '')));
    return aberta || candidatas[0];
  }

  function resumirOSParaIA(os) {
    if (!os) return '';
    const partes = [];
    partes.push('O.S. ' + (os.numero || os.codigo || ('#' + String(os.id || '').slice(-6))));
    partes.push('status: ' + (os.status || '-'));
    partes.push('placa: ' + (os.placa || os.veiculo?.placa || '-'));
    partes.push('veículo: ' + (os.veiculo || os.modelo || os.veiculoModelo || os.veiculo?.modelo || '-'));
    partes.push('cliente: ' + (os.cliente || os.clienteNome || os.nomeCliente || '-'));
    const relato = os.relato || os.defeito || os.diagnostico || os.diagnosticoTecnico || os.diagnosticoInterno || os.observacoes || os.obs || os.problema || '';
    if (relato) partes.push('relato/diagnóstico anterior: ' + relato);
    if (Array.isArray(os.servicos) && os.servicos.length) {
      partes.push('serviços: ' + os.servicos.slice(0, 8).map(s => s.desc || s.descricao || s.nome || s.servico || '').filter(Boolean).join('; '));
    }
    if (Array.isArray(os.pecas) && os.pecas.length) {
      partes.push('peças: ' + os.pecas.slice(0, 8).map(p => p.desc || p.descricao || p.nome || p.peca || '').filter(Boolean).join('; '));
    }
    return partes.filter(Boolean).join(' | ');
  }

  function atualizarContextoPorPlaca(placa, extra) {
    const p = normalizarPlaca(placa);
    if (!p) return null;
    const os = encontrarOSPorPlaca(p);
    const hist = respostaLocalTexto('historico da placa ' + p, extra?.perfil || 'jarvis');
    const ctx = {
      placa: p,
      osId: os?.id || '',
      osNumero: os?.numero || os?.codigo || '',
      veiculo: os?.veiculo || os?.modelo || os?.veiculoModelo || os?.veiculo?.modelo || '',
      cliente: os?.cliente || os?.clienteNome || os?.nomeCliente || '',
      status: os?.status || '',
      historicoOficina: hist && !/preciso de mais contexto/i.test(hist) ? hist : resumirOSParaIA(os),
      origem: extra?.origem || 'jarvis',
      fixado: true
    };
    return salvarContextoAtivo(ctx);
  }

  function usuarioPediuNovoContexto(texto) {
    return /\b(novo diagnostico|novo diagnóstico|limpar contexto|trocar veiculo|trocar veículo|zerar conversa|encerrar diagnostico|encerrar diagnóstico)\b/i.test(String(texto || ''));
  }

  function mensagemMostraContexto(ctx) {
    if (!ctx || !ctx.placa) return '';
    const meta = [ctx.placa, ctx.veiculo, ctx.cliente].filter(Boolean).join(' • ');
    return meta ? 'Contexto ativo: ' + meta : 'Contexto ativo: placa ' + ctx.placa;
  }

  function montarAcoesContextoHTML(ctx) {
    if (!ctx || !ctx.placa) return '';
    return [
      '<div class="ia-diag-actions" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">',
      "<button type=\"button\" class=\"btn-small\" onclick=\"window.thiaDiagSalvarNaOS('conversa')\">💾 Salvar conversa na O.S.</button>",
      "<button type=\"button\" class=\"btn-small\" onclick=\"window.thiaDiagSalvarNaOS('teste')\">🧪 Registrar teste na O.S.</button>",
      '<button type="button" class="btn-small" onclick="window.thiaDiagLimparContexto()">🧹 Limpar contexto</button>',
      '</div>'
    ].join('');
  }

  function ultimasMensagensParaResumo() {
    return lerHistoricoLocal()
      .slice(-10)
      .map(m => (m.role === 'assistant' ? 'thIAguinho: ' : 'Usuário: ') + String(m.text || ''))
      .join('\n');
  }

  async function salvarRegistroNaOS(tipo, textoExtra) {
    const ctx = lerContextoAtivo();
    const placa = ctx?.placa;
    if (!placa) throw new Error('Não há placa/contexto ativo para salvar na O.S.');

    const db = getDb();
    if (!db || !db.collection) throw new Error('Banco de dados indisponível para salvar na O.S.');

    let os = ctx.osId ? listaOSDisponivel().find(x => x.id === ctx.osId) : null;
    if (!os) os = encontrarOSPorPlaca(placa);
    if (!os || !os.id) throw new Error('Não encontrei O.S. vinculada à placa ' + placa + '.');

    const agora = new Date().toISOString();
    const usuario = getJ().nome || getJ().user?.nome || getJ().user?.displayName || 'OFICIN-IA';
    const registro = {
      tipo: tipo || 'conversa',
      placa,
      usuario,
      createdAt: agora,
      origem: location.pathname.toLowerCase().includes('equipe') ? 'equipe' : 'jarvis',
      resumo: String(textoExtra || '').trim() || ultimasMensagensParaResumo()
    };

    const registros = Array.isArray(os.iaDiagnosticoRegistros) ? os.iaDiagnosticoRegistros.slice() : [];
    registros.push(registro);

    const timeline = Array.isArray(os.timeline) ? os.timeline.slice() : [];
    timeline.push({
      dt: agora,
      user: usuario,
      acao: tipo === 'teste' ? 'Registrou resultado de teste da IA Diagnóstico.' : 'Salvou conversa/diagnóstico da IA na O.S.',
      tipo: 'ia_diagnostico',
      interno: true
    });

    let osAtual = os || {};
    try {
      const snapAtual = await db.collection('ordens_servico').doc(os.id).get();
      if (snapAtual && snapAtual.exists) osAtual = Object.assign({}, osAtual, snapAtual.data() || {});
    } catch (_) {}

    const anteriorDiag = String(
      osAtual.diagnostico ||
      osAtual.diagnosticoTecnico ||
      osAtual.diagnosticoInterno ||
      ''
    ).trim();

    const blocoDiag = [
      '',
      '--- thIAguinho IA • ' + (tipo === 'teste' ? 'Resultado de teste' : 'Conversa/diagnóstico') + ' • ' + new Date(agora).toLocaleString('pt-BR') + ' ---',
      'Usuário: ' + usuario,
      'Placa: ' + placa,
      registro.resumo
    ].filter(Boolean).join('\n');

    const diagnosticoAtualizado = (anteriorDiag ? anteriorDiag + '\n\n' : '') + blocoDiag;

    const patch = {
      diagnostico: diagnosticoAtualizado,
      diagnosticoTecnico: diagnosticoAtualizado,
      diagnosticoInterno: diagnosticoAtualizado,
      iaDiagnosticoRegistros: registros.slice(-80),
      ultimoDiagnosticoIA: registro.resumo.slice(0, 4000),
      timeline,
      updatedAt: agora
    };

    await db.collection('ordens_servico').doc(os.id).update(patch);

    Object.assign(os, patch);
    salvarContextoAtivo(Object.assign({}, ctx, { osId: os.id }));
    return os;
  }

  W.thiaDiagSalvarNaOS = async function(tipo) {
    try {
      let textoExtra = '';
      if (tipo === 'teste') {
        textoExtra = prompt('Descreva o teste realizado e o resultado encontrado:') || '';
        if (!txt(textoExtra)) return;
      }
      const os = await salvarRegistroNaOS(tipo, textoExtra);
      const msg = tipo === 'teste'
        ? 'Resultado de teste salvo na O.S. ' + (os.numero || os.id.slice(-6)) + '.'
        : 'Conversa da IA salva na O.S. ' + (os.numero || os.id.slice(-6)) + '.';
      if (W.toast) W.toast('✓ ' + msg, 'ok');
      addBot(esc(msg), true);
    } catch (err) {
      const msg = 'Não consegui salvar na O.S.: ' + (err.message || err);
      if (W.toast) W.toast(msg, 'warn');
      addBot(esc(msg), true);
    }
  };

  W.thiaDiagLimparContexto = function() {
    limparContextoAtivo();
    addBot('Contexto de veículo limpo. Informe uma nova placa ou um novo sintoma para começar outro diagnóstico.', true);
  };

  function montarContextoParaDiagnostico(pergunta, analise, perfil) {
    const perfilTela = perfil || (location.pathname.toLowerCase().includes('equipe') ? 'equipe' : 'jarvis');

    // Se veio placa + sintoma, fixa essa placa como contexto da conversa.
    // Se veio só sintoma/código, reaproveita o último contexto ativo do veículo.
    let contextoAtivo = null;
    if (analise.placa) contextoAtivo = atualizarContextoPorPlaca(analise.placa, { perfil: perfilTela, origem: perfilTela });
    if (!contextoAtivo) contextoAtivo = lerContextoAtivo();

    const contexto = {
      tenantId: getTid(),
      perfil: perfilTela,
      placa: analise.placa || contextoAtivo?.placa || '',
      osId: contextoAtivo?.osId || '',
      osNumero: contextoAtivo?.osNumero || '',
      veiculo: contextoAtivo?.veiculo || '',
      cliente: contextoAtivo?.cliente || '',
      status: contextoAtivo?.status || '',
      origem: 'OFICIN-IA',
      contextoAtivo: contextoAtivo || null
    };

    if (contextoAtivo?.historicoOficina) {
      contexto.historicoOficina = contextoAtivo.historicoOficina;
    } else if (analise.tipo === 'HIBRIDA' && analise.placa) {
      const hist = respostaLocalTexto('historico da placa ' + analise.placa, perfilTela);
      if (hist && !/preciso de mais contexto/i.test(hist)) contexto.historicoOficina = hist;
    }

    const normalizada = normalizarCodigoFalha(pergunta);
    const instrucao = [
      'Você é um especialista em diagnóstico automotivo trabalhando como auxiliar do Jarvis dentro do OFICIN-IA.',
      'Trabalhe em conjunto com os dados internos da oficina. Não substitua o Jarvis: complemente o diagnóstico técnico.',
      'Responda em português do Brasil, de forma prática para oficina mecânica.',
      'Organize a resposta com:',
      '1. Hipóteses principais',
      '2. Checklist de diagnóstico',
      '3. Testes recomendados',
      '4. Como interpretar os resultados',
      '5. Próximo passo na O.S.',
      '6. Peças/sistemas a conferir, sem afirmar troca antes do teste',
      '',
      'Problema informado pelo usuário:',
      normalizada
    ];

    if (contexto.placa) {
      instrucao.push('', 'Contexto ativo do veículo na conversa:');
      instrucao.push('Placa: ' + contexto.placa);
      if (contexto.veiculo) instrucao.push('Veículo: ' + contexto.veiculo);
      if (contexto.cliente) instrucao.push('Cliente: ' + contexto.cliente);
      if (contexto.osNumero || contexto.osId) instrucao.push('O.S.: ' + (contexto.osNumero || contexto.osId));
      instrucao.push('Considere esse veículo como contexto enquanto o usuário não pedir novo diagnóstico ou informar outra placa.');
    }

    if (contexto.historicoOficina) {
      instrucao.push('', 'Histórico interno da oficina/O.S. para considerar:');
      instrucao.push(contexto.historicoOficina);
    }

    instrucao.push('', 'Regra importante: se o usuário enviar resultado de teste depois, continue o raciocínio no mesmo veículo/contexto e diga como registrar na O.S.');

    return {
      pergunta: instrucao.join('\n'),
      contexto
    };
  }

  async function chamarRobo(pergunta, analise, perfil) {
    const cfg = await carregarConfigTenant();
    if (!cfg.ativo) throw new Error('Módulo IA Diagnóstico não liberado para esta oficina.');
    const endpoint = cfg.endpoint || ENDPOINT_PADRAO;
    const montado = montarContextoParaDiagnostico(pergunta, analise, perfil);

    const historico = lerHistoricoLocal()
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-8)
      .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }));

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify({
        pergunta: montado.pergunta,
        contexto: montado.contexto,
        tenantId: getTid(),
        placa: analise.placa || lerContextoAtivo()?.placa || '',
        session_id: lerContextoAtivo()?.session_id || '',
        origem: 'OFICIN-IA',
        historico
      })
    });

    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok || !data || data.ok === false) {
      throw new Error(data?.erro || data?.message || ('Falha no robô: HTTP ' + res.status));
    }

    const ctxNow = lerContextoAtivo();
    if (data.session_id && (analise.placa || ctxNow?.placa)) {
      salvarContextoAtivo(Object.assign({}, ctxNow || {}, {
        placa: analise.placa || ctxNow?.placa,
        session_id: data.session_id
      }));
    }

    return txt(data.resposta || data.answer || data.message || data.texto || data.result || '');
  }

  async function chamarIA(inputId, perfil) {
    const input = D.getElementById(inputId || 'iaInput');
    const message = txt(input?.value);
    if (!message) return;
    if (input) input.value = '';

    if (usuarioPediuNovoContexto(message)) {
      addUser(message);
      limparContextoAtivo();
      addBot('Contexto limpo. Pode informar outra placa ou outro sintoma para começar um novo diagnóstico.', true);
      return;
    }

    const analise = analisarIntencao(message);

    if (analise.tipo === 'LOCAL') {
      // Placa ou histórico puro: mantém o Jarvis local, mas fixa o contexto do veículo
      // para a próxima pergunta técnica ("código P0301", "deu 12V", "compressão baixa", etc.).
      if (analise.placa) atualizarContextoPorPlaca(analise.placa, { perfil: perfil || 'jarvis', origem: 'consulta_local' });

      if (typeof original.thiaIAAsk === 'function') {
        if (input) input.value = message;
        return original.thiaIAAsk(inputId || 'iaInput', perfil);
      }
      if (typeof original.iaPerguntar === 'function') {
        if (input) input.value = message;
        return original.iaPerguntar();
      }
      addUser(message);
      const local = respostaLocalTexto(message, perfil);
      if (local) {
        addBot(esc(local).replace(/\n/g, '<br>'), true);
      } else {
        addBot('Preciso do motor local carregado para responder esta consulta interna.', true);
      }
      return;
    }

    addUser(message);

    const ctxPreview = analise.placa
      ? atualizarContextoPorPlaca(analise.placa, { perfil: perfil || 'jarvis', origem: 'diagnostico' })
      : lerContextoAtivo();

    const avisoContexto = ctxPreview?.placa
      ? '<br><small style="color:var(--muted2,#7A9AB8);">' + esc(mensagemMostraContexto(ctxPreview)) + '</small>'
      : '';

    const lid = addBot('<span class="j-spinner"></span> Consultando IA Diagnóstico com o contexto da oficina...' + avisoContexto, false);

    try {
      const resposta = await chamarRobo(message, analise, perfil);
      const final = resposta || 'A IA Diagnóstico não retornou conteúdo útil. Tente reformular o sintoma.';
      const ctxFinal = lerContextoAtivo();
      replaceBot(lid, esc(final).replace(/\n/g, '<br>') + montarAcoesContextoHTML(ctxFinal), true);
    } catch (err) {
      const local = respostaLocalTexto(message, perfil);
      const erro = 'Não consegui acionar a IA Diagnóstico agora. ' + esc(err.message || err);
      const fallback = local && !/preciso de mais contexto/i.test(local)
        ? erro + '<br><br><strong>Resposta local:</strong><br>' + esc(local).replace(/\n/g, '<br>')
        : erro;
      replaceBot(lid, fallback, true);
    }
  }

  function setPromptAndAsk(txtPrompt, perfil) {
    const input = D.getElementById('iaInput');
    if (input) input.value = txtPrompt;
    if (typeof W.ir === 'function') W.ir('ia');
    setTimeout(() => chamarIA('iaInput', perfil), 80);
  }

  function atualizarBarra() {
    const inline = D.getElementById('thiaDiagIaInlineStatus');
    const conteudo = [
      '<span style="padding:5px 9px;border-radius:999px;border:1px solid rgba(148,163,184,.25);color:var(--success,#22c55e);">IA Diagnóstico via robô</span>',
      '<button type="button" class="btn-primary" onclick="window.thiaFocarDiagnosticoIA()">Usar IA no chat</button>',
      '<button type="button" class="btn-ghost" onclick="window.thiaAbrirDiagnosticoAutomotivoIntegrado()">Abrir portal externo</button>'
    ].join('');
    if (inline) {
      inline.innerHTML = conteudo;
      inline.style.display = 'flex';
      return;
    }
  }

  W.thiaDiagnosticoIA = {
    carregarConfig: carregarConfigTenant,
    analisarIntencao,
    perguntar: chamarRobo,
    lerContexto: lerContextoAtivo,
    limparContexto: limparContextoAtivo,
    salvarNaOS: salvarRegistroNaOS
  };

  W.thiaIAAsk = chamarIA;
  W.iaPerguntar = function () { return chamarIA('iaInput', 'jarvis'); };
  W.iaEnviar = function () { return chamarIA('iaInput', 'equipe'); };
  W.thiaFocarDiagnosticoIA = function () {
    const input = D.getElementById('iaInput');
    if (typeof W.ir === 'function') W.ir('ia');
    if (input) {
      input.focus();
      input.placeholder = 'Digite sintoma, código de falha ou placa + problema...';
    }
  };
  W.thiaAbrirDiagnosticoAutomotivoIntegrado = function () {
    const cfg = cfgCache || { portalUrl: PORTAL_PADRAO };
    W.open(cfg.portalUrl || PORTAL_PADRAO, '_blank', 'noopener');
  };
  W.thiaAbrirDiagnosticoAutomotivo = W.thiaAbrirDiagnosticoAutomotivoIntegrado;
  W.thiaEntrarAutomaticoDiagnosticoIA = function () {
    W.thiaFocarDiagnosticoIA();
    addBot('Use o campo do chat. O login visual por iframe foi desativado por segurança; a integração principal agora é pelo robô /api/diagnostico.', true);
  };
  W.thiaMostrarCredenciaisDiagnosticoIA = function () {
    addBot('As credenciais da IA Diagnóstico ficam protegidas na Vercel. O navegador não recebe senha nem token.', true);
  };
  W.thiaLimparConversaDiagnosticoIA = function () {
    try { localStorage.removeItem(chatKey()); } catch (_) {}
    const box = D.getElementById('iaMsgs');
    if (box) box.dataset.thiaDiagRestaurado = '';
  };
  W.iaChip = function (texto) { return setPromptAndAsk(texto, location.pathname.toLowerCase().includes('equipe') ? 'equipe' : 'jarvis'); };

  function instalarHookProcessarDiagnostico() {
    const input = D.getElementById('iaInput');
    if (!input) return;

    const area = input.closest('.ia-input-area') || input.closest('.ia-foot-wrap') || input.parentElement;
    const btns = area ? Array.from(area.querySelectorAll('button')) : [];
    const btnProximo = input.nextElementSibling && input.nextElementSibling.tagName === 'BUTTON' ? input.nextElementSibling : null;
    const btn = btns.find(b => /processar|enviar|perguntar/i.test(b.textContent || '')) ||
      btnProximo ||
      btns.find(b => b.id !== 'btnVozIA' && !/voz|falar|microfone|🎙/i.test((b.textContent || '') + ' ' + (b.title || ''))) ||
      null;

    function acionar(ev) {
      try {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
        }
      } catch (_) {}
      return chamarIA('iaInput', location.pathname.toLowerCase().includes('equipe') ? 'equipe' : 'jarvis');
    }

    if (btn && btn.dataset.thiaDiagHookFinal !== '1') {
      btn.dataset.thiaDiagHookFinal = '1';
      btn.onclick = acionar;
      btn.addEventListener('click', acionar, true);
      btn.textContent = btn.textContent || 'PROCESSAR';
    }

    if (input.dataset.thiaDiagEnterHookFinal !== '1') {
      input.dataset.thiaDiagEnterHookFinal = '1';
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') acionar(ev);
      }, true);
    }

    W.iaPerguntar = function () { return chamarIA('iaInput', 'jarvis'); };
    W.iaEnviar = function () { return chamarIA('iaInput', 'equipe'); };
    W.thiaIAAsk = chamarIA;
  }

  D.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      carregarConfigTenant(false);
      atualizarBarra();
      restaurarConversaVisual();
      instalarHookProcessarDiagnostico();
    }, 150);
    setTimeout(instalarHookProcessarDiagnostico, 700);
    setTimeout(instalarHookProcessarDiagnostico, 1600);
  });
})();
