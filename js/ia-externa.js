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

    const interno = /\b(estoque|financeiro|dre|caixa|contas?\s+a\s+pagar|contas?\s+a\s+receber|cliente|fornecedor|kardex|orcamento|orçamento|nota fiscal|nfe|nf-e|agenda|equipe|comissao|comissão|venda|relatorio|relatório)\b/.test(t);

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

  function montarContextoParaDiagnostico(pergunta, analise, perfil) {
    const contexto = {
      tenantId: getTid(),
      perfil: perfil || (location.pathname.toLowerCase().includes('equipe') ? 'equipe' : 'jarvis'),
      placa: analise.placa || '',
      origem: 'OFICIN-IA'
    };

    if (analise.tipo === 'HIBRIDA' && analise.placa) {
      const hist = respostaLocalTexto('historico da placa ' + analise.placa, perfil);
      if (hist && !/preciso de mais contexto/i.test(hist)) contexto.historicoOficina = hist;
    }

    const normalizada = normalizarCodigoFalha(pergunta);
    const instrucao = [
      'Você é um especialista em diagnóstico automotivo trabalhando junto com o OFICIN-IA.',
      'Responda em português do Brasil, de forma prática para oficina mecânica.',
      'Organize a resposta com: possíveis causas, checklist de diagnóstico, testes recomendados, interpretação dos resultados e próximo passo.',
      'Não peça placa se já houver informação suficiente para orientar o diagnóstico.',
      '',
      'Problema informado pelo usuário:',
      normalizada
    ];

    if (contexto.historicoOficina) {
      instrucao.push('', 'Contexto interno da oficina:', contexto.historicoOficina);
    }

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
        placa: analise.placa || '',
        origem: 'OFICIN-IA',
        historico
      })
    });

    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok || !data || data.ok === false) {
      throw new Error(data?.erro || data?.message || ('Falha no robô: HTTP ' + res.status));
    }
    return txt(data.resposta || data.answer || data.message || data.texto || data.result || '');
  }

  async function chamarIA(inputId, perfil) {
    const input = D.getElementById(inputId || 'iaInput');
    const message = txt(input?.value);
    if (!message) return;
    if (input) input.value = '';

    const analise = analisarIntencao(message);

    if (analise.tipo === 'LOCAL') {
      if (typeof original.thiaIAAsk === 'function') {
        if (input) input.value = message;
        return original.thiaIAAsk(inputId || 'iaInput', perfil);
      }
      addUser(message);
      addBot('Preciso do motor local carregado para responder esta consulta interna.', true);
      return;
    }

    addUser(message);
    const lid = addBot('<span class="j-spinner"></span> Consultando IA Diagnóstico com o contexto da oficina...', false);

    try {
      const resposta = await chamarRobo(message, analise, perfil);
      const final = resposta || 'A IA Diagnóstico não retornou conteúdo útil. Tente reformular o sintoma.';
      replaceBot(lid, esc(final).replace(/\n/g, '<br>'), true);
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
    perguntar: chamarRobo
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

  D.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      carregarConfigTenant(false);
      atualizarBarra();
      restaurarConversaVisual();
    }, 150);
  });
})();
