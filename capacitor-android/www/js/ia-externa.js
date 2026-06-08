/*
 * OFICIN-IA — IA Diagnóstico Automotivo via robô /api/diagnostico
 *
 * Correção final:
 * - NÃO usa iframe como caminho principal.
 * - NÃO tenta preencher login em site externo.
 * - Jarvis/Equipe chamam o robô da Vercel direto pelo chat normal.
 * - Conversa curta persiste no localStorage ao sair e voltar.
 *
 * thIAguinho Soluções — tecnologia sob medida.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;

  const PORTAL_PADRAO = 'https://www.appdiagnosticoautomotivo.com.br/';
  const ROBO_PROXY_PADRAO = '/api/diagnostico';
  const STORAGE_CACHE_PREFIX = 'thia_diag_auto_cfg_';
  const STORAGE_CHAT_PREFIX = 'thia_diag_chat_v2_';

  const original = {
    thiaIAAsk: W.thiaIAAsk,
    iaPerguntar: W.iaPerguntar,
    iaEnviar: W.iaEnviar
  };

  let cfgCache = null;
  let cfgLoading = null;

  function txt(v) {
    return String(v == null ? '' : v).trim();
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  function stripHtml(v) {
    return String(v == null ? '' : v)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
  }

  function parseJsonSeguro(v, fallback) {
    try {
      return JSON.parse(v || 'null') || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function getJ() {
    return W.J || W.JARVIS || {};
  }

  function getTid() {
    const J = getJ();
    return txt(
      J.tid ||
      J.tenantId ||
      sessionStorage.getItem('j_tid') ||
      localStorage.getItem('j_tid') ||
      sessionStorage.getItem('tenantId') ||
      localStorage.getItem('tenantId') ||
      ''
    );
  }

  function oficinaSessao() {
    return getJ().oficina || parseJsonSeguro(sessionStorage.getItem('j_oficina'), {}) || {};
  }

  function cacheKey() {
    return STORAGE_CACHE_PREFIX + (getTid() || 'sem_tenant');
  }

  function salvarCacheLocal(cfg) {
    try {
      localStorage.setItem(cacheKey(), JSON.stringify(cfg || {}));
    } catch (_) {}
  }

  function lerCacheLocal() {
    try {
      return parseJsonSeguro(localStorage.getItem(cacheKey()), null);
    } catch (_) {
      return null;
    }
  }

  function perfilTela() {
    const p = location.pathname.toLowerCase();
    if (p.includes('equipe')) return 'equipe';
    if (p.includes('jarvis')) return 'jarvis';
    return 'geral';
  }

  function chatKey() {
    return STORAGE_CHAT_PREFIX + (getTid() || 'semtenant') + '_' + perfilTela();
  }

  function normalizarConfig(oficina) {
    oficina = oficina || {};
    const modulos = oficina.modulos || {};
    const integracoes = oficina.integracoes || oficina.integrations || {};
    const raw = integracoes.iaDiagnosticoAutomotivo ||
      oficina.iaDiagnosticoAutomotivo ||
      oficina.diagnosticoAutomotivoIA ||
      oficina.iaDiagnostico ||
      {};

    const moduloLiberado =
      modulos.iaDiagnosticoAutomotivo === true ||
      modulos.iaDiagnostico === true ||
      raw.moduloLiberado === true ||
      raw.ativo === true ||
      raw.enabled === true ||
      raw.liberado === true;

    const endpointRaw = txt(raw.endpoint || raw.proxyUrl || raw.roboUrl || raw.apiProxy || '');
    const endpoint = endpointRaw || ROBO_PROXY_PADRAO;

    const cfg = {
      ativo: raw.ativo !== false,
      moduloLiberado: !!moduloLiberado || raw.ativo === true || raw.enabled === true,
      portalUrl: txt(raw.portalUrl || raw.url || PORTAL_PADRAO) || PORTAL_PADRAO,
      endpoint,
      usuario: txt(raw.usuario || raw.login || raw.email || ''),
      senha: txt(raw.senha || raw.password || ''),
      anonKey: txt(raw.anonKey || raw.supabaseAnonKey || raw.publicAnonKey || raw.apiKey || raw.apikey || ''),
      nome: raw.nome || 'Diagnóstico Automotivo',
      modo: 'robo'
    };

    return cfg;
  }

  async function carregarConfigTenant(force) {
    if (cfgCache && !force) return cfgCache;
    if (cfgLoading && !force) return cfgLoading;

    cfgLoading = (async function () {
      let oficina = oficinaSessao();
      const tid = getTid();
      const db = getJ().db || W.db || (W.firebase && W.firebase.firestore ? W.firebase.firestore() : null);

      if (tid && db && db.collection) {
        try {
          const doc = await db.collection('oficinas').doc(tid).get();
          if (doc && doc.exists) {
            oficina = { id: doc.id, ...doc.data() };
            try {
              sessionStorage.setItem('j_oficina', JSON.stringify({
                ...(oficinaSessao() || {}),
                modulos: oficina.modulos || {},
                integracoes: oficina.integracoes || {},
                iaDiagnosticoAutomotivo: oficina.iaDiagnosticoAutomotivo || null
              }));
            } catch (_) {}
          }
        } catch (e) {
          console.warn('[IA Diagnóstico] Não foi possível atualizar config do tenant:', e.message);
        }
      }

      let cfg = normalizarConfig(oficina);
      const cached = lerCacheLocal();

      if (cached) {
        cfg = {
          ...cfg,
          usuario: cfg.usuario || cached.usuario || '',
          senha: cfg.senha || cached.senha || '',
          anonKey: cfg.anonKey || cached.anonKey || '',
          endpoint: cfg.endpoint || cached.endpoint || ROBO_PROXY_PADRAO
        };
      }

      cfgCache = cfg;
      salvarCacheLocal(cfgCache);
      atualizarBarra();
      return cfgCache;
    })();

    try {
      return await cfgLoading;
    } finally {
      cfgLoading = null;
    }
  }

  function lerConversa() {
    try {
      return JSON.parse(localStorage.getItem(chatKey()) || '{"session_id":"","mensagens":[]}') || { session_id: '', mensagens: [] };
    } catch (_) {
      return { session_id: '', mensagens: [] };
    }
  }

  function salvarConversa(conv) {
    try {
      conv = conv || { session_id: '', mensagens: [] };
      conv.mensagens = Array.isArray(conv.mensagens) ? conv.mensagens.slice(-60) : [];
      conv.atualizadoEm = new Date().toISOString();
      localStorage.setItem(chatKey(), JSON.stringify(conv));
    } catch (_) {}
  }

  function registrarMensagemConversa(role, text) {
    const clean = stripHtml(text);
    if (!clean) return;
    const conv = lerConversa();
    conv.mensagens = conv.mensagens || [];
    conv.mensagens.push({
      role: role === 'assistant' ? 'assistant' : 'user',
      text: clean,
      at: Date.now()
    });
    salvarConversa(conv);
  }

  function salvarSessionIdConversa(sessionId) {
    if (!sessionId) return;
    const conv = lerConversa();
    conv.session_id = sessionId;
    salvarConversa(conv);
  }

  function historicoParaApi() {
    const conv = lerConversa();
    return (conv.mensagens || []).slice(-12).map(function (m) {
      return {
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.text || '')
      };
    });
  }

  function getMsgBox() {
    return D.getElementById('iaMsgs') || D.querySelector('.ia-messages');
  }

  function addUser(message, registrar) {
    const box = getMsgBox();
    if (!box) return null;

    const div = D.createElement('div');
    div.className = 'ia-msg user thia-diag-msg';
    div.style.cssText = div.style.cssText || '';
    div.innerHTML = esc(message).replace(/\n/g, '<br>');
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;

    if (registrar !== false) registrarMensagemConversa('user', message);
    return div.id || null;
  }

  function addBot(html, registrar) {
    const box = getMsgBox();
    if (!box) return null;

    const id = 'ia-ext-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
    const div = D.createElement('div');
    div.id = id;
    div.className = 'ia-msg bot thia-diag-msg';
    div.innerHTML = '<strong>thIAguinho:</strong> ' + html;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;

    if (registrar === true) registrarMensagemConversa('assistant', stripHtml(html));
    return id;
  }

  function replaceBot(id, html, registrar) {
    const div = id ? D.getElementById(id) : null;
    if (!div) {
      const novo = addBot(html, registrar === true);
      return novo;
    }
    div.innerHTML = '<strong>thIAguinho:</strong> ' + html;
    if (registrar === true) registrarMensagemConversa('assistant', stripHtml(html));
    const box = getMsgBox();
    if (box) box.scrollTop = box.scrollHeight;
    return id;
  }

  function restaurarConversaVisual() {
    try {
      const box = getMsgBox();
      if (!box || box.dataset.thiaDiagRestaurado === '1') return;

      const conv = lerConversa();
      const hist = (conv.mensagens || []).slice(-30);
      if (!hist.length) return;

      box.dataset.thiaDiagRestaurado = '1';

      const sep = D.createElement('div');
      sep.className = 'ia-msg bot thia-diag-restored';
      sep.innerHTML = '<strong>thIAguinho:</strong> Conversa anterior restaurada neste dispositivo.';
      box.appendChild(sep);

      hist.forEach(function (m) {
        const div = D.createElement('div');
        div.className = 'ia-msg ' + (m.role === 'assistant' ? 'bot' : 'user') + ' thia-diag-restored';
        div.innerHTML = m.role === 'assistant'
          ? '<strong>thIAguinho:</strong> ' + esc(m.text || '').replace(/\n/g, '<br>')
          : esc(m.text || '').replace(/\n/g, '<br>');
        box.appendChild(div);
      });

      box.scrollTop = box.scrollHeight;
    } catch (_) {}
  }

  function limparConversaDiagnostico() {
    try {
      localStorage.removeItem(chatKey());
    } catch (_) {}
    const box = getMsgBox();
    if (box) {
      box.querySelectorAll('.thia-diag-restored,.thia-diag-msg').forEach(el => el.remove());
      box.dataset.thiaDiagRestaurado = '';
    }
    if (typeof W.toast === 'function') W.toast('Conversa da IA Diagnóstico limpa neste dispositivo.', 'ok');
  }

  function extrairPlaca(texto) {
    const s = String(texto || '').toUpperCase();
    const m = s.match(/\b([A-Z]{3}[-\s]?\d[A-Z0-9]\d{2}|[A-Z]{3}[-\s]?\d{4})\b/);
    return m ? m[1].replace(/[-\s]/g, '') : '';
  }

  async function buscarHistoricoPlaca(pergunta) {
    const placa = extrairPlaca(pergunta);
    if (!placa) return null;

    const db = getJ().db || W.db || (W.firebase && W.firebase.firestore ? W.firebase.firestore() : null);
    if (!db || !db.collection) return { placa, registros: [], aviso: 'Firestore indisponível na tela.' };

    const encontrados = [];
    const colecoes = ['ordensServico', 'os', 'ordens', 'servicos', 'orcamentos'];

    for (const nome of colecoes) {
      try {
        const ref = db.collection(nome);
        let snap = null;

        try {
          snap = await ref.where('tenantId', '==', getTid()).limit(80).get();
        } catch (_) {
          snap = await ref.limit(80).get();
        }

        snap.forEach(doc => {
          const d = doc.data() || {};
          const p = String(
            d.placa ||
            d.veiculoPlaca ||
            d.placaVeiculo ||
            (d.veiculo && d.veiculo.placa) ||
            ''
          ).toUpperCase().replace(/[-\s]/g, '');

          if (p && p === placa) {
            encontrados.push({
              colecao: nome,
              id: doc.id,
              placa,
              cliente: d.clienteNome || d.cliente || d.nomeCliente || '',
              veiculo: d.veiculo || d.modelo || d.veiculoModelo || '',
              defeito: d.defeito || d.reclamacao || d.queixa || d.problema || '',
              diagnostico: d.diagnostico || d.laudo || '',
              servicos: d.servicos || d.itens || [],
              status: d.status || '',
              data: d.data || d.criadoEm || d.createdAt || d.abertura || ''
            });
          }
        });
      } catch (_) {}
      if (encontrados.length >= 8) break;
    }

    return { placa, registros: encontrados.slice(0, 8) };
  }

  function montarContexto(perfil) {
    const J = getJ();
    const oficina = oficinaSessao();

    return {
      perfil: perfil || perfilTela(),
      tenantId: getTid(),
      oficina: {
        nome: oficina.razaoSocial || oficina.nome || oficina.nomeFantasia || '',
        cidade: oficina.cidade || '',
        uf: oficina.uf || ''
      },
      usuario: J.user ? {
        nome: J.user.nome || J.user.email || '',
        perfil: J.user.perfil || perfil || ''
      } : null,
      origem: 'OFICIN-IA',
      pagina: location.pathname
    };
  }

  async function perguntarRobo(pergunta, perfil) {
    const cfg = await carregarConfigTenant(false);
    const conv = lerConversa();
    const contexto = montarContexto(perfil);
    const historicoPlaca = await buscarHistoricoPlaca(pergunta);

    if (historicoPlaca) contexto.historicoPlaca = historicoPlaca;

    const endpoint = cfg.endpoint || ROBO_PROXY_PADRAO;

    const payload = {
      pergunta,
      message: pergunta,
      session_id: conv.session_id || '',
      historico: historicoParaApi(),
      history: historicoParaApi(),
      context: contexto,
      credenciais: {
        usuario: cfg.usuario || '',
        email: cfg.usuario || '',
        senha: cfg.senha || '',
        password: cfg.senha || ''
      },
      anonKey: cfg.anonKey || '',
      supabaseAnonKey: cfg.anonKey || ''
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });

    const raw = await res.text();
    let data = null;
    try { data = JSON.parse(raw); } catch (_) { data = { resposta: raw }; }

    if (!res.ok || data.ok === false) {
      throw new Error(data.erro || data.error || data.message || raw || ('HTTP ' + res.status));
    }

    if (data.session_id || data.sessionId) salvarSessionIdConversa(data.session_id || data.sessionId);

    return data.resposta || data.answer || data.message || data.texto || data.text || '';
  }

  async function chamarIA(inputId, perfil) {
    const input = D.getElementById(inputId || 'iaInput');
    const message = txt(input && input.value);
    if (!message) return;

    if (input) input.value = '';

    const cfg = await carregarConfigTenant(false);
    const liberado = cfg.moduloLiberado !== false && cfg.ativo !== false;

    if (!liberado) {
      addUser(message);
      addBot('IA Diagnóstico bloqueada para este tenant. Libere o módulo no Superadmin.', true);
      return;
    }

    addUser(message);
    const loadingId = addBot('<span class="j-spinner"></span> Consultando IA Diagnóstico pelo robô...', false);

    try {
      const resposta = await perguntarRobo(message, perfil || perfilTela());
      const html = resposta
        ? esc(resposta).replace(/\n/g, '<br>')
        : 'A IA Diagnóstico respondeu, mas não veio texto interpretável.';

      W.iaHistorico = W.iaHistorico || [];
      W.iaHistorico.push({ role: 'user', text: message });
      W.iaHistorico.push({ role: 'model', text: resposta || '' });

      replaceBot(loadingId, html, true);
    } catch (err) {
      const motivo = err && err.message ? err.message : String(err);
      replaceBot(
        loadingId,
        'Não consegui consultar o robô da IA Diagnóstico agora.<br>' +
        '<small style="color:var(--muted,#94a3b8)">Motivo: ' + esc(motivo) + '</small><br><br>' +
        'Conferir na Vercel se as variáveis <b>DIAGNOSTICO_EMAIL</b>, <b>DIAGNOSTICO_PASSWORD</b> e <b>DIAGNOSTICO_SUPABASE_ANON_KEY</b> estão configuradas.',
        true
      );
    }
  }

  async function testarRobo() {
    const input = D.getElementById('iaInput');
    if (input) input.value = 'Gol 1.0 falhando em marcha lenta. Me dê um diagnóstico organizado.';
    return chamarIA('iaInput', perfilTela());
  }

  function usarIaNoChat() {
    addBot(
      '<b>IA Diagnóstico pronta no chat.</b><br>' +
      'Digite a pergunta no campo abaixo e clique em <b>PROCESSAR</b>. O OFICIN-IA vai chamar <b>/api/diagnostico</b>, sem iframe e sem copiar senha.<br>' +
      '<small style="color:var(--muted,#94a3b8)">Para histórico de veículo, informe a placa na pergunta.</small>',
      true
    );
  }

  function abrirPortalExterno() {
    window.open(PORTAL_PADRAO, '_blank', 'noopener,noreferrer');
  }

  async function mostrarStatus() {
    const cfg = await carregarConfigTenant(true);
    addBot(
      '<b>Status IA Diagnóstico:</b><br>' +
      'Modo: robô Vercel<br>' +
      'Endpoint: <code>' + esc(cfg.endpoint || ROBO_PROXY_PADRAO) + '</code><br>' +
      'Módulo: ' + (cfg.moduloLiberado ? 'liberado' : 'não liberado no tenant') + '<br>' +
      'Usuário: ' + (cfg.usuario ? 'cadastrado no Superadmin' : 'usando variável da Vercel ou não cadastrado') + '<br>' +
      '<small style="color:var(--muted,#94a3b8)">O portal externo fica só como emergência. O chat normal usa o robô.</small>',
      true
    );
  }

  async function atualizarBarra() {
    const cfg = cfgCache || normalizarConfig(oficinaSessao());
    const ativo = cfg.moduloLiberado !== false && cfg.ativo !== false;
    const texto = ativo ? 'IA Diagnóstico conectada pelo robô' : 'IA Diagnóstico bloqueada';
    const cor = ativo ? 'var(--success,#22c55e)' : 'var(--muted,#94a3b8)';

    const conteudo = `
      <span id="thiaDiagIaStatus" style="padding:5px 9px;border-radius:999px;border:1px solid rgba(148,163,184,.25);color:${cor};">${esc(texto)}</span>
      <button type="button" class="btn-primary" onclick="window.thiaUsarDiagnosticoNoChat()">Usar IA no chat</button>
      <button type="button" class="btn-ghost" onclick="window.thiaTestarRoboDiagnosticoIA()">Testar robô</button>
      <button type="button" class="btn-ghost" onclick="window.thiaMostrarStatusDiagnosticoIA()">Status</button>
      <button type="button" class="btn-ghost" onclick="window.thiaAbrirPortalExternoDiagnosticoIA()">Abrir portal externo</button>
      <button type="button" class="btn-ghost" onclick="window.thiaLimparConversaDiagnosticoIA()">Limpar conversa</button>
    `;

    const inline = D.getElementById('thiaDiagIaInlineStatus');
    if (inline) {
      inline.innerHTML = conteudo;
      inline.style.display = 'flex';
      return;
    }

    const host = getMsgBox()?.parentElement || D.getElementById('s-ia') || D.getElementById('t-ia');
    if (!host) return;

    let bar = D.getElementById('thiaDiagIaBar');
    if (!bar) {
      bar = D.createElement('div');
      bar.id = 'thiaDiagIaBar';
      bar.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.45);font-size:.75rem;';
      const msgs = getMsgBox();
      if (msgs && msgs.parentElement) msgs.parentElement.insertBefore(bar, msgs);
      else host.prepend(bar);
    }
    bar.innerHTML = conteudo;
  }

  function instalarEnter() {
    D.getElementById('iaInput')?.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chamarIA('iaInput', perfilTela());
      }
    });
  }

  W.thiaDiagnosticoIA = {
    carregarConfig: carregarConfigTenant,
    perguntar: perguntarRobo,
    usarIaNoChat,
    testarRobo,
    limpar: limparConversaDiagnostico,
    restaurar: restaurarConversaVisual
  };

  W.thiaIAAsk = chamarIA;
  W.iaPerguntar = function () { return chamarIA('iaInput', 'jarvis'); };
  W.iaEnviar = function () { return chamarIA('iaInput', 'equipe'); };
  W.thiaUsarDiagnosticoNoChat = usarIaNoChat;
  W.thiaTestarRoboDiagnosticoIA = testarRobo;
  W.thiaMostrarStatusDiagnosticoIA = mostrarStatus;
  W.thiaAbrirPortalExternoDiagnosticoIA = abrirPortalExterno;
  W.thiaLimparConversaDiagnosticoIA = limparConversaDiagnostico;
  W.thiaRestaurarConversaDiagnosticoIA = restaurarConversaVisual;

  // Compatibilidade com botões antigos: não abre iframe; só informa o fluxo certo.
  W.thiaAbrirDiagnosticoAutomotivo = usarIaNoChat;
  W.thiaAbrirDiagnosticoAutomotivoIntegrado = usarIaNoChat;
  W.thiaEntrarAutomaticoDiagnosticoIA = usarIaNoChat;
  W.thiaMostrarCredenciaisDiagnosticoIA = mostrarStatus;
  W.thiaRecarregarConfigDiagnosticoIA = async function () {
    await carregarConfigTenant(true);
    mostrarStatus();
  };

  D.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      carregarConfigTenant(false);
      atualizarBarra();
      restaurarConversaVisual();
      instalarEnter();
    }, 150);
  });
})();
