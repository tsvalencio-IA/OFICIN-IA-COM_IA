/*
 * OFICIN-IA — IA Diagnóstico Automotivo modular por oficina
 *
 * Recriação: experiência dentro do OFICIN-IA.
 * - Superadmin libera/bloqueia por tenant.
 * - Usuário/senha são lidos da configuração da oficina.
 * - Sem endpoint/API conhecido, o portal é carregado dentro de uma janela interna (iframe/WebView).
 * - Há tentativa de auto-preenchimento quando o navegador permitir acesso ao frame.
 * - Se o fornecedor bloquear iframe/CORS/X-Frame-Options, o front-end não consegue forçar login; nesse caso é preciso proxy/backend ou app WebView nativo.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const PORTAL_PADRAO = 'https://www.appdiagnosticoautomotivo.com.br/';
  const SUPABASE_DIAG_URL_PADRAO = 'https://luazuifvwyeabuldlvzw.supabase.co';
  const SUPABASE_DIAG_FUNCTION_PADRAO = 'diagnostic-chat';
  const SUPABASE_DIAG_FUNCTION_URL_PADRAO = SUPABASE_DIAG_URL_PADRAO + '/functions/v1/' + SUPABASE_DIAG_FUNCTION_PADRAO;
  const STORAGE_CACHE_PREFIX = 'thia_diag_auto_cfg_';
  const ROBO_PROXY_PADRAO = '/api/diagnostico';
  const STORAGE_CHAT_PREFIX = 'thia_diag_chat_';

  const original = {
    thiaIAAsk: W.thiaIAAsk,
    iaPerguntar: W.iaPerguntar,
    iaEnviar: W.iaEnviar
  };

  let cfgCache = null;
  let cfgLoading = null;

  function txt(v) { return String(v == null ? '' : v).trim(); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }
  function getJ() { return W.J || W.JARVIS || {}; }
  function getTid() {
    const J = getJ();
    return J.tid || J.tenantId || sessionStorage.getItem('j_tid') || localStorage.getItem('j_tid') || '';
  }
  function parseJsonSeguro(v, fallback) {
    try { return JSON.parse(v || 'null') || fallback; } catch (_) { return fallback; }
  }
  function oficinaSessao() {
    return getJ().oficina || parseJsonSeguro(sessionStorage.getItem('j_oficina'), {}) || {};
  }
  function cacheKey() { return STORAGE_CACHE_PREFIX + (getTid() || 'sem_tenant'); }
  function salvarCacheLocal(cfg) { try { localStorage.setItem(cacheKey(), JSON.stringify(cfg || {})); } catch (_) {} }
  function lerCacheLocal() { try { return parseJsonSeguro(localStorage.getItem(cacheKey()), null); } catch (_) { return null; } }

  function normalizarConfig(oficina) {
    oficina = oficina || {};
    const modulos = oficina.modulos || {};
    const integracoes = oficina.integracoes || oficina.integrations || {};
    const raw = integracoes.iaDiagnosticoAutomotivo || oficina.iaDiagnosticoAutomotivo || oficina.diagnosticoAutomotivoIA || {};
    const moduloLiberado = modulos.iaDiagnosticoAutomotivo === true || raw.moduloLiberado === true || raw.ativo === true || raw.enabled === true;
    const ativo = raw.ativo === true || raw.enabled === true || moduloLiberado;
    const endpointRaw = txt(raw.endpoint || raw.proxyUrl || raw.roboUrl || '');
    const usarProxyPadrao = raw.usarProxyPadrao !== false && raw.proxyPadrao !== false;
    const endpoint = endpointRaw || (usarProxyPadrao ? ROBO_PROXY_PADRAO : '');
    const supabaseUrl = txt(raw.supabaseUrl || raw.supabaseProjectUrl || raw.projectUrl || SUPABASE_DIAG_URL_PADRAO).replace(/\/$/, '');
    const functionName = txt(raw.functionName || raw.funcao || SUPABASE_DIAG_FUNCTION_PADRAO) || SUPABASE_DIAG_FUNCTION_PADRAO;
    const functionUrl = txt(raw.functionUrl || raw.diagnosticChatUrl || raw.diagnosticEndpoint || raw.urlFuncao || (supabaseUrl + '/functions/v1/' + functionName));
    const anonKey = txt(raw.anonKey || raw.supabaseAnonKey || raw.publicAnonKey || raw.apiKey || raw.apikey || '');
    const accessToken = txt(raw.accessToken || raw.sessionToken || raw.bearerToken || '');
    const usarApiReal = raw.usarApiReal !== false && raw.apiReal !== false && !!(functionUrl || endpoint);
    return {
      ativo: !!ativo,
      moduloLiberado: !!moduloLiberado,
      modo: endpoint ? 'endpoint' : (usarApiReal ? 'supabase' : (raw.modo || raw.mode || 'integrado')),
      portalUrl: txt(raw.portalUrl || raw.url || PORTAL_PADRAO) || PORTAL_PADRAO,
      endpoint,
      supabaseUrl,
      functionName,
      functionUrl,
      anonKey,
      accessToken,
      usarApiReal,
      usuario: txt(raw.usuario || raw.login || raw.email || ''),
      senha: txt(raw.senha || raw.password || ''),
      autoLogin: raw.autoLogin !== false,
      embedInterno: raw.embedInterno !== false,
      nome: raw.nome || 'Diagnóstico Automotivo',
      atualizadoEm: raw.atualizadoEm || raw.updatedAt || ''
    };
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

      cfgCache = normalizarConfig(oficina);
      const cached = lerCacheLocal();
      if ((!cfgCache.usuario && cached?.usuario) || (!cfgCache.senha && cached?.senha)) {
        cfgCache = { ...cfgCache, usuario: cfgCache.usuario || cached.usuario, senha: cfgCache.senha || cached.senha };
      }
      salvarCacheLocal(cfgCache);
      atualizarBarra();
      return cfgCache;
    })();

    try { return await cfgLoading; }
    finally { cfgLoading = null; }
  }


  function perfilTela() {
    if (location.pathname.toLowerCase().includes('equipe')) return 'equipe';
    if (location.pathname.toLowerCase().includes('jarvis')) return 'jarvis';
    return 'geral';
  }

  function chatKey() {
    return STORAGE_CHAT_PREFIX + (getTid() || 'semtenant') + '_' + perfilTela();
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
      conv.mensagens = Array.isArray(conv.mensagens) ? conv.mensagens.slice(-40) : [];
      conv.atualizadoEm = new Date().toISOString();
      localStorage.setItem(chatKey(), JSON.stringify(conv));
    } catch (_) {}
  }

  function registrarMensagemConversa(role, text) {
    const conv = lerConversa();
    conv.mensagens = conv.mensagens || [];
    conv.mensagens.push({ role: role === 'assistant' ? 'assistant' : 'user', text: String(text || ''), at: Date.now() });
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
      return { role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.text || '') };
    });
  }

  function restaurarConversaVisual() {
    try {
      const box = D.getElementById('iaMsgs');
      if (!box || box.dataset.thiaDiagRestaurado === '1') return;
      const conv = lerConversa();
      const hist = (conv.mensagens || []).slice(-20);
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
    try { localStorage.removeItem(chatKey()); } catch (_) {}
    if (typeof W.toast === 'function') W.toast('Conversa da IA Diagnóstico limpa neste dispositivo.', 'ok');
  }


  function addUser(message) {
    if (typeof W._iaMsgUser === 'function') return W._iaMsgUser(message);
    if (typeof W.adicionarMsgIA === 'function') return W.adicionarMsgIA('user', esc(message));
    const box = D.getElementById('iaMsgs');
    if (!box) return;
    const div = D.createElement('div');
    div.className = 'ia-msg user';
    div.innerHTML = esc(message);
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function addBot(html) {
    if (typeof W._iaMsgBot === 'function') return W._iaMsgBot(html);
    if (typeof W.adicionarMsgIA === 'function') return W.adicionarMsgIA('bot', html);
    const box = D.getElementById('iaMsgs');
    if (!box) return null;
    const id = 'ia-ext-' + Date.now();
    const div = D.createElement('div');
    div.id = id;
    div.className = 'ia-msg bot';
    div.innerHTML = '<strong>thIAguinho:</strong> ' + html;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return id;
  }

  function replaceBot(id, html) {
    const div = id ? D.getElementById(id) : null;
    if (!div) return addBot(html);
    div.innerHTML = '<strong>thIAguinho:</strong> ' + html;
  }

  function montarContexto(perfil) {
    const J = getJ();
    const oficina = oficinaSessao();
    return {
      perfil: perfil || '',
      tenantId: getTid(),
      oficina: {
        nome: oficina.razaoSocial || oficina.nome || oficina.nomeFantasia || '',
        cidade: oficina.cidade || '',
        uf: oficina.uf || ''
      },
      usuario: J.user ? { nome: J.user.nome || J.user.email || '', perfil: J.user.perfil || perfil || '' } : null,
      origem: 'OFICIN-IA'
    };
  }


  function parseRespostaDiagnostico(data) {
    if (data == null) return '';
    if (typeof data === 'string') return data;
    if (typeof data === 'object') {
      return data.resposta || data.answer || data.response || data.message || data.text || data.diagnosis ||
             data.diagnostico || data.result || data.output || data.content ||
             (data.data && parseRespostaDiagnostico(data.data)) ||
             (Array.isArray(data.messages) && data.messages.length ? parseRespostaDiagnostico(data.messages[data.messages.length - 1]) : '') ||
             '';
    }
    return String(data);
  }

  function headersSupabaseBase(cfg, token) {
    const h = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (cfg.anonKey) h.apikey = cfg.anonKey;
    if (token || cfg.anonKey) h.Authorization = 'Bearer ' + (token || cfg.anonKey);
    return h;
  }

  function supabaseSessionKey(cfg) {
    return 'thia_diag_supabase_session_' + btoa((cfg.usuario || '') + '|' + (cfg.supabaseUrl || '')).replace(/=+$/,'');
  }

  function lerSessaoSupabase(cfg) {
    try {
      const raw = sessionStorage.getItem(supabaseSessionKey(cfg));
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.access_token) return null;
      if (data.expires_at && Date.now() > (Number(data.expires_at) - 60000)) return null;
      return data;
    } catch (_) { return null; }
  }

  function salvarSessaoSupabase(cfg, data) {
    try {
      if (!data || !data.access_token) return;
      const expiresIn = Number(data.expires_in || 3600);
      sessionStorage.setItem(supabaseSessionKey(cfg), JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token || '',
        token_type: data.token_type || 'bearer',
        expires_at: Date.now() + (expiresIn * 1000),
        user: data.user || null
      }));
    } catch (_) {}
  }

  async function loginSupabaseDiagnostico(cfg) {
    if (cfg.accessToken) return { access_token: cfg.accessToken, user: null };
    const cache = lerSessaoSupabase(cfg);
    if (cache) return cache;

    if (!cfg.usuario || !cfg.senha) {
      throw new Error('Usuário e senha da IA Diagnóstico não estão cadastrados no Superadmin.');
    }

    const url = (cfg.supabaseUrl || SUPABASE_DIAG_URL_PADRAO).replace(/\/$/, '') + '/auth/v1/token?grant_type=password';
    const headers = headersSupabaseBase(cfg);
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: cfg.usuario, password: cfg.senha })
    });

    let data = null, text = '';
    try { data = await res.json(); } catch (_) { try { text = await res.text(); } catch(__){} }
    if (!res.ok) {
      const msg = data?.error_description || data?.msg || data?.message || text || ('HTTP ' + res.status);
      if (!cfg.anonKey && /api key|apikey|No API key/i.test(msg)) {
        throw new Error('O Supabase pediu a chave pública anon/apiKey. Cadastre esse campo no Superadmin para a IA Diagnóstico.');
      }
      throw new Error('Falha no login da IA Diagnóstico: ' + msg);
    }
    salvarSessaoSupabase(cfg, data);
    return data;
  }

  function extrairPlaca(txtMsg) {
    const m = String(txtMsg || '').toUpperCase().match(/\b[A-Z]{3}-?\d[A-Z0-9]\d{2}\b|\b[A-Z]{3}-?\d{4}\b/);
    return m ? m[0].replace('-', '') : '';
  }

  async function buscarHistoricoPlaca(pergunta) {
    const placa = extrairPlaca(pergunta);
    if (!placa) return null;
    const tid = getTid();
    const db = getJ().db || W.db || (W.firebase && W.firebase.firestore ? W.firebase.firestore() : null);
    if (!db || !db.collection) return { placa, aviso: 'Firestore indisponível no momento.' };

    const colecoes = ['ordens', 'ordensServico', 'os', 'veiculos'];
    const encontrados = [];
    for (const nome of colecoes) {
      try {
        let snap = null;
        const ref = db.collection(nome);
        try {
          snap = await ref.where('tenantId', '==', tid).limit(40).get();
        } catch (_) {
          snap = await ref.limit(40).get();
        }
        snap.forEach(doc => {
          const d = doc.data() || {};
          const p = String(d.placa || d.veiculoPlaca || d.placaVeiculo || (d.veiculo && d.veiculo.placa) || '').toUpperCase().replace('-', '');
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
              data: d.data || d.criadoEm || d.createdAt || d.abertura || ''
            });
          }
        });
      } catch (_) {}
      if (encontrados.length >= 5) break;
    }
    return { placa, registros: encontrados.slice(0, 5) };
  }

  async function perguntarSupabaseDiagnostico(pergunta, perfil) {
    const cfg = await carregarConfigTenant();
    const sessao = await loginSupabaseDiagnostico(cfg);
    const token = sessao.access_token;
    const contexto = montarContexto(perfil);
    const historicoPlaca = await buscarHistoricoPlaca(pergunta);
    if (historicoPlaca) contexto.historicoPlaca = historicoPlaca;

    const url = cfg.functionUrl || SUPABASE_DIAG_FUNCTION_URL_PADRAO;
    const payloads = [
      { message: pergunta, session_id: cfg.sessionId || null, context: contexto, locale: 'pt-BR', source: 'OFICIN-IA' },
      { message: pergunta, sessionId: cfg.sessionId || null, context: contexto, language: 'pt-BR' },
      { prompt: pergunta, context: contexto, locale: 'pt-BR' },
      { pergunta, contexto }
    ];

    let ultimoErro = null;
    for (const payload of payloads) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: headersSupabaseBase(cfg, token),
          body: JSON.stringify(payload)
        });
        let data = null, text = '';
        try { data = await res.json(); } catch (_) { try { text = await res.text(); } catch(__){} }
        if (!res.ok) {
          ultimoErro = new Error((data && (data.error || data.message || data.msg)) || text || ('HTTP ' + res.status));
          if (res.status >= 500) continue;
          if (res.status === 400 || res.status === 422) continue;
          throw ultimoErro;
        }
        return parseRespostaDiagnostico(data) || text || 'A IA Diagnóstico respondeu, mas não consegui interpretar o formato de retorno.';
      } catch (err) {
        ultimoErro = err;
        if (/Failed to fetch|CORS|NetworkError/i.test(String(err && err.message))) break;
      }
    }
    throw ultimoErro || new Error('A IA Diagnóstico não retornou resposta.');
  }

  async function perguntarEndpoint(pergunta, perfil) {
    const cfg = await carregarConfigTenant();
    if (!cfg.endpoint) throw new Error('Endpoint/proxy da IA Diagnóstico não configurado.');
    const conv = lerConversa();
    const payload = {
      pergunta,
      message: pergunta,
      session_id: conv.session_id || '',
      historico: historicoParaApi(),
      history: historicoParaApi(),
      context: montarContexto(perfil),
      credenciais: { usuario: cfg.usuario, senha: cfg.senha },
      anonKey: cfg.anonKey || '',
      supabaseAnonKey: cfg.anonKey || '',
      portalUrl: cfg.portalUrl
    };
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify(payload)
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(data?.erro || data?.message || ('HTTP ' + res.status));
    if (data?.session_id || data?.sessionId) salvarSessionIdConversa(data.session_id || data.sessionId);
    return {
      resposta: data?.resposta || data?.answer || data?.message || data?.texto || '',
      session_id: data?.session_id || data?.sessionId || ''
    };
  }

  async function tentarAutoLoginNoFrame(iframe, cfg) {
    if (!cfg.usuario || !cfg.senha || cfg.autoLogin === false) return false;
    let doc = null;
    try {
      doc = iframe.contentDocument || iframe.contentWindow.document;
    } catch (e) {
      console.warn('[IA Diagnóstico] Auto-login bloqueado por origem diferente/CORS:', e.message);
      return false;
    }
    if (!doc) return false;

    const camposUsuario = [
      'input[type="email"]', 'input[name*="email" i]', 'input[id*="email" i]',
      'input[name*="usuario" i]', 'input[id*="usuario" i]', 'input[name*="login" i]',
      'input[id*="login" i]', 'input[type="text"]'
    ];
    const camposSenha = ['input[type="password"]', 'input[name*="senha" i]', 'input[id*="senha" i]', 'input[name*="password" i]'];

    const userEl = camposUsuario.map(sel => doc.querySelector(sel)).find(Boolean);
    const passEl = camposSenha.map(sel => doc.querySelector(sel)).find(Boolean);

    function setVal(el, value) {
      if (!el) return;
      el.focus();
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (userEl) setVal(userEl, cfg.usuario);
    if (passEl) setVal(passEl, cfg.senha);

    if (userEl && passEl) {
      setTimeout(() => {
        const btn = doc.querySelector('button[type="submit"], input[type="submit"], button, [role="button"]');
        if (btn && cfg.autoLogin !== 'preencher_apenas') {
          try { btn.click(); } catch (_) {}
        }
      }, 450);
      return true;
    }
    return false;
  }

  async function abrirPortalIntegrado(pergunta) {
    const cfg = await carregarConfigTenant(true);
    if (!cfg.moduloLiberado || !cfg.ativo) {
      if (typeof W.toast === 'function') W.toast('IA Diagnóstico bloqueada para esta oficina.', 'warn');
      return;
    }

    const url = cfg.portalUrl || PORTAL_PADRAO;
    const existente = D.getElementById('thiaDiagIaEmbedOverlay');
    if (existente) existente.remove();

    const html = `
      <div id="thiaDiagIaEmbedOverlay" style="position:fixed;inset:0;background:rgba(2,6,23,.88);z-index:999999;display:flex;flex-direction:column;padding:10px;color:var(--text,#e5e7eb);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid rgba(148,163,184,.25);border-radius:12px 12px 0 0;background:rgba(15,23,42,.96);">
          <div style="min-width:0;">
            <div style="font-weight:900;">IA Diagnóstico Automotivo integrada ao tenant</div>
            <div style="font-size:.72rem;color:var(--muted,#94a3b8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${esc(cfg.usuario || 'usuário não cadastrado')} • ${esc(url)}
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
            <button type="button" class="btn-primary" onclick="window.thiaEntrarAutomaticoDiagnosticoIA()">Entrar automaticamente</button>
            <button type="button" class="btn-ghost" onclick="window.thiaRecarregarFrameDiagnosticoIA()">Recarregar</button>
            <button type="button" class="btn-warn" onclick="document.getElementById('thiaDiagIaEmbedOverlay').remove()">Fechar</button>
          </div>
        </div>
        ${pergunta ? `<div style="padding:8px 10px;background:rgba(255,184,0,.08);border-left:1px solid rgba(148,163,184,.25);border-right:1px solid rgba(148,163,184,.25);font-size:.78rem;">Pergunta do OFICIN-IA: <b>${esc(pergunta)}</b></div>` : ''}
        <div id="thiaDiagIaEmbedMsg" style="display:none;padding:8px 10px;background:rgba(239,68,68,.10);border-left:1px solid rgba(148,163,184,.25);border-right:1px solid rgba(148,163,184,.25);font-size:.78rem;"></div>
        <iframe id="thiaDiagIaFrame" src="${esc(url)}" title="Diagnóstico Automotivo" allow="clipboard-read; clipboard-write; fullscreen" referrerpolicy="no-referrer" style="flex:1;width:100%;border:1px solid rgba(148,163,184,.25);border-top:0;border-radius:0 0 12px 12px;background:#fff;"></iframe>
      </div>`;
    D.body.insertAdjacentHTML('beforeend', html);

    const iframe = D.getElementById('thiaDiagIaFrame');
    const msg = D.getElementById('thiaDiagIaEmbedMsg');
    let carregou = false;

    iframe.addEventListener('load', async () => {
      carregou = true;
      const ok = await tentarAutoLoginNoFrame(iframe, cfg);
      if (!ok && msg) {
        msg.style.display = 'block';
        msg.innerHTML =
          'Portal carregado dentro do OFICIN-IA. Toque em “Entrar automaticamente” se os campos não entrarem sozinhos. ' +
          'Se o navegador bloquear acesso ao formulário por ser outro domínio, o botão vai avisar na tela.';
      }
    });

    setTimeout(() => {
      if (!carregou && msg) {
        msg.style.display = 'block';
        msg.innerHTML =
          'Se a área abaixo ficar em branco, o fornecedor bloqueia abertura em iframe. A solução definitiva é criar um proxy/backend ou abrir em WebView nativa no app.';
      }
    }, 3500);
  }

  function copiarTexto(valor, label) {
    if (!valor) {
      if (typeof W.toast === 'function') W.toast(label + ' não cadastrado para esta oficina.', 'warn');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(valor).then(() => {
        if (typeof W.toast === 'function') W.toast(label + ' copiado.', 'ok');
      }).catch(() => prompt(label, valor));
    } else {
      prompt(label, valor);
    }
  }

  async function copiarCredencial(tipo) {
    const cfg = await carregarConfigTenant();
    if (tipo === 'senha') return copiarTexto(cfg.senha, 'Senha');
    return copiarTexto(cfg.usuario, 'Usuário');
  }

  async function mostrarCredenciais() {
    const cfg = await carregarConfigTenant(true);
    const status = cfg.moduloLiberado && cfg.ativo ? 'Liberado' : 'Bloqueado';
    const senhaMask = cfg.senha ? '••••••••' : 'Não cadastrada';
    const html = `
      <div id="thiaDiagIaOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;">
        <div style="width:min(720px,96vw);background:var(--surf,#111827);border:1px solid var(--border,#334155);border-radius:14px;padding:18px;color:var(--text,#e5e7eb);box-shadow:0 20px 70px rgba(0,0,0,.45)">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;">
            <div>
              <div style="font-weight:800;font-size:1.05rem;">IA Diagnóstico Automotivo</div>
              <div style="font-size:.78rem;color:var(--muted,#94a3b8);margin-top:4px;">Status do módulo: <b>${esc(status)}</b> • modo: <b>${esc(cfg.endpoint ? 'endpoint' : 'integrado')}</b></div>
            </div>
            <button class="btn-ghost" onclick="document.getElementById('thiaDiagIaOverlay').remove()">✕</button>
          </div>
          <div style="display:grid;gap:10px;margin-top:8px;">
            <div><label style="display:block;font-size:.72rem;color:var(--muted,#94a3b8);margin-bottom:4px;">Portal integrado</label><div class="j-input" style="height:auto;min-height:38px;display:flex;align-items:center;">${esc(cfg.portalUrl || PORTAL_PADRAO)}</div></div>
            <div><label style="display:block;font-size:.72rem;color:var(--muted,#94a3b8);margin-bottom:4px;">Usuário do tenant</label><div class="j-input" style="height:auto;min-height:38px;display:flex;align-items:center;">${esc(cfg.usuario ? 'Cadastrado no Superadmin' : 'Não cadastrado')}</div></div>
            <div><label style="display:block;font-size:.72rem;color:var(--muted,#94a3b8);margin-bottom:4px;">Senha do tenant</label><div class="j-input" style="height:auto;min-height:38px;display:flex;align-items:center;">${esc(senhaMask)}</div></div>
            <div style="font-size:.72rem;color:var(--muted,#94a3b8);line-height:1.5;background:rgba(148,163,184,.08);padding:10px;border-radius:10px;">
              O OFICIN-IA usa o login e a senha cadastrados no Superadmin para tentar preencher e entrar sozinho. O usuário da oficina não precisa copiar credencial. Se o site externo bloquear automação por segurança, o sistema vai avisar.
            </div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:16px;">
            <button class="btn-ghost" onclick="window.thiaRecarregarConfigDiagnosticoIA()">Recarregar config</button>
            <button class="btn-primary" onclick="document.getElementById('thiaDiagIaOverlay').remove();window.thiaAbrirDiagnosticoAutomotivoIntegrado();setTimeout(function(){window.thiaEntrarAutomaticoDiagnosticoIA&&window.thiaEntrarAutomaticoDiagnosticoIA();},900)">Abrir e entrar automaticamente</button>
          </div>
        </div>
      </div>`;
    D.getElementById('thiaDiagIaOverlay')?.remove();
    D.body.insertAdjacentHTML('beforeend', html);
  }

  async function recarregarConfig() {
    await carregarConfigTenant(true);
    if (typeof W.toast === 'function') W.toast('Configuração da IA Diagnóstico recarregada.', 'ok');
    D.getElementById('thiaDiagIaOverlay')?.remove();
    mostrarCredenciais();
  }

  function recarregarFrame() {
    const iframe = D.getElementById('thiaDiagIaFrame');
    if (iframe) iframe.src = iframe.src;
  }

  async function entrarAutomatico() {
    const cfg = await carregarConfigTenant(true);
    const iframe = D.getElementById('thiaDiagIaFrame');
    const msg = D.getElementById('thiaDiagIaEmbedMsg');

    if (!cfg.usuario || !cfg.senha) {
      if (msg) {
        msg.style.display = 'block';
        msg.innerHTML = 'Login e/ou senha da IA Diagnóstico não cadastrados no Superadmin para este tenant.';
      }
      if (typeof W.toast === 'function') W.toast('Credencial da IA Diagnóstico não cadastrada.', 'warn');
      return false;
    }

    if (!iframe) {
      await abrirPortalIntegrado();
      setTimeout(entrarAutomatico, 1200);
      return false;
    }

    const ok = await tentarAutoLoginNoFrame(iframe, cfg);
    if (ok) {
      if (msg) {
        msg.style.display = 'block';
        msg.style.background = 'rgba(34,197,94,.10)';
        msg.innerHTML = 'Auto-login enviado com o usuário e senha cadastrados no Superadmin.';
      }
      if (typeof W.toast === 'function') W.toast('Auto-login enviado.', 'ok');
      return true;
    }

    if (msg) {
      msg.style.display = 'block';
      msg.style.background = 'rgba(239,68,68,.10)';
      msg.innerHTML =
        'Não consegui preencher automaticamente. Normalmente isso acontece quando o site externo bloqueia acesso ao formulário dentro do iframe. ' +
        'A credencial está cadastrada no tenant, mas o navegador não permite injetar o login nesse portal.';
    }
    if (typeof W.toast === 'function') W.toast('Auto-login bloqueado pelo portal/navegador.', 'warn');
    return false;
  }

  async function chamarIA(inputId, perfil) {
    const input = D.getElementById(inputId || 'iaInput');
    const message = txt(input?.value);
    if (!message) return;
    if (input) input.value = '';

    const cfg = await carregarConfigTenant();

    if (!cfg.moduloLiberado || !cfg.ativo) {
      if (typeof original.thiaIAAsk === 'function') {
        if (input) input.value = message;
        return original.thiaIAAsk(inputId || 'iaInput', perfil);
      }
      addUser(message);
      addBot('IA Diagnóstico bloqueada para este tenant. IA local indisponível.');
      return;
    }

    if (cfg.usarApiReal || cfg.endpoint) {
      addUser(message);
      const lid = addBot('<span class="j-spinner"></span> Consultando IA Diagnóstico Automotivo real...');
      try {
        const resultado = cfg.endpoint ? await perguntarEndpoint(message, perfil) : await perguntarSupabaseDiagnostico(message, perfil);
        const answer = typeof resultado === 'object' ? (resultado.resposta || resultado.answer || resultado.texto || '') : resultado;
        if (resultado && typeof resultado === 'object' && (resultado.session_id || resultado.sessionId)) salvarSessionIdConversa(resultado.session_id || resultado.sessionId);
        W.iaHistorico = W.iaHistorico || [];
        W.iaHistorico.push({ role: 'user', text: message });
        W.iaHistorico.push({ role: 'model', text: answer || '' });
        registrarMensagemConversa('user', message);
        registrarMensagemConversa('assistant', answer || '');
        replaceBot(lid, answer ? esc(answer).replace(/\n/g, '<br>') : 'A IA externa não retornou resposta.');
      } catch (err) {
        const motivo = esc(err.message || err);
        replaceBot(lid,
          'Não consegui consultar a IA Diagnóstico por API agora.<br>' +
          '<small style="color:var(--muted,#94a3b8)">Motivo: ' + motivo + '</small><br><br>' +
          'Vou manter o atendimento pelo Jarvis local e deixar o portal externo como emergência.'
        );
        if (typeof original.thiaIAAsk === 'function') {
          if (input) input.value = message;
          return original.thiaIAAsk(inputId || 'iaInput', perfil);
        }
      }
      return;
    }

    addUser(message);
    addBot(
      '<b>IA Diagnóstico Automotivo liberada para este tenant.</b><br>' +
      'Como ainda não temos endpoint/API, vou abrir o portal dentro do OFICIN-IA usando as credenciais configuradas no Superadmin.<br><br>' +
      '<button class="btn-primary" onclick="window.thiaAbrirDiagnosticoAutomotivoIntegrado(' + JSON.stringify(message).replace(/"/g, '&quot;') + ');setTimeout(function(){window.thiaEntrarAutomaticoDiagnosticoIA&&window.thiaEntrarAutomaticoDiagnosticoIA();},900)">Abrir e entrar automático</button> ' +
      '<button class="btn-ghost" onclick="window.thiaMostrarCredenciaisDiagnosticoIA()">Ver status</button><br><br>' +
      '<small style="color:var(--muted,#94a3b8)">Se o fornecedor bloquear iframe ou auto-login por segurança, será necessário proxy/backend para login 100% transparente.</small>'
    );
    abrirPortalIntegrado(message);

    if (typeof original.thiaIAAsk === 'function') {
      if (input) input.value = message;
      return original.thiaIAAsk(inputId || 'iaInput', perfil);
    }
  }

  async function atualizarBarra() {
    const cfg = cfgCache || normalizarConfig(oficinaSessao());
    const ativo = cfg.moduloLiberado && cfg.ativo;
    const endpoint = !!cfg.endpoint;
    const real = !!cfg.usarApiReal && !endpoint;
    const texto = ativo ? (endpoint ? 'IA Diagnóstico conectada por endpoint' : (real ? 'IA Diagnóstico real conectada' : 'IA Diagnóstico integrada ao tenant')) : 'IA Diagnóstico bloqueada';
    const cor = ativo ? 'var(--success,#22c55e)' : 'var(--muted,#94a3b8)';
    const conteudo = `
      <span id="thiaDiagIaStatus" style="padding:5px 9px;border-radius:999px;border:1px solid rgba(148,163,184,.25);color:${cor};">${esc(texto)}</span>
      <button type="button" class="btn-primary" onclick="window.thiaAbrirDiagnosticoAutomotivoIntegrado();setTimeout(function(){window.thiaEntrarAutomaticoDiagnosticoIA&&window.thiaEntrarAutomaticoDiagnosticoIA();},900)">Entrar na IA</button>
      <button type="button" class="btn-ghost" onclick="window.thiaMostrarCredenciaisDiagnosticoIA()">Credenciais / status</button>
    `;

    const inline = D.getElementById('thiaDiagIaInlineStatus');
    if (inline) {
      inline.innerHTML = conteudo;
      inline.style.display = 'flex';
      return;
    }

    const host = D.getElementById('iaMsgs')?.parentElement || D.getElementById('s-ia') || D.getElementById('t-ia');
    if (!host) return;
    let bar = D.getElementById('thiaDiagIaBar');
    if (!bar) {
      bar = D.createElement('div');
      bar.id = 'thiaDiagIaBar';
      bar.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.45);font-size:.75rem;';
      const msgs = D.getElementById('iaMsgs');
      if (msgs && msgs.parentElement) msgs.parentElement.insertBefore(bar, msgs);
      else host.prepend(bar);
    }
    bar.innerHTML = conteudo;
  }

  W.thiaDiagnosticoIA = {
    portalUrl: PORTAL_PADRAO,
    carregarConfig: carregarConfigTenant,
    montarContexto,
    perguntar: perguntarEndpoint,
    perguntarSupabase: perguntarSupabaseDiagnostico,
    abrirIntegrado: abrirPortalIntegrado
  };

  W.thiaIAAsk = chamarIA;
  W.iaPerguntar = function () { return chamarIA('iaInput', 'jarvis'); };
  W.iaEnviar = function () { return chamarIA('iaInput', 'equipe'); };
  W.thiaAbrirDiagnosticoAutomotivo = abrirPortalIntegrado;
  W.thiaAbrirDiagnosticoAutomotivoIntegrado = abrirPortalIntegrado;
  W.thiaMostrarCredenciaisDiagnosticoIA = mostrarCredenciais;
  W.thiaCopiarDiagnosticoIA = copiarCredencial;
  W.thiaRecarregarConfigDiagnosticoIA = recarregarConfig;
  W.thiaRecarregarFrameDiagnosticoIA = recarregarFrame;
  W.thiaEntrarAutomaticoDiagnosticoIA = entrarAutomatico;
  W.thiaLimparConversaDiagnosticoIA = limparConversaDiagnostico;
  W.thiaRestaurarConversaDiagnosticoIA = restaurarConversaVisual;

  D.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () { carregarConfigTenant(false); atualizarBarra(); restaurarConversaVisual(); }, 120);
  });
})();


/* ==========================================================================
 * OFICIN-IA — Orquestrador profissional IA Diagnóstico + Jarvis interno
 * Data: 2026-06-08
 *
 * Objetivo:
 *  - O chat normal do Jarvis/Equipe decide quando usar dados internos e quando chamar o robô.
 *  - Perguntas de diagnóstico automotivo vão para /api/diagnostico sem iframe.
 *  - Perguntas de base da oficina continuam usando a busca interna.
 *  - Perguntas curtas de continuação, como "código P0301", usam o contexto anterior.
 *  - Conversa é restaurada ao sair e voltar para a tela.
 *
 * Camada aditiva: não remove funções originais do sistema.
 * ========================================================================== */
(function () {
  'use strict';

  var W = window;
  var D = document;
  var ORQ_FLAG = '__THIA_DIAG_ORQ_PRO_INSTALADO__';

  if (W[ORQ_FLAG]) return;
  W[ORQ_FLAG] = true;

  var oldAsk = W.thiaIAAsk;
  var oldIaPerguntar = W.iaPerguntar;
  var oldIaEnviar = W.iaEnviar;

  function txt(v) { return String(v == null ? '' : v).trim(); }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function strip(html) {
    return String(html == null ? '' : html)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function getJ() {
    return W.JARVIS || W.ThiaERP || W.appState || {};
  }

  function getTid() {
    var J = getJ();
    return txt(J.tid || J.tenantId || J.oficinaId || localStorage.getItem('tenantId') || localStorage.getItem('tid') || 'default');
  }

  function perfilKey(perfil) {
    return txt(perfil || getJ().role || getJ().perfil || (location.pathname.indexOf('equipe') >= 0 ? 'equipe' : 'jarvis')) || 'jarvis';
  }

  function storageKey(perfil) {
    return 'thia_diag_orq_pro_' + getTid() + '_' + perfilKey(perfil);
  }

  function lerEstado(perfil) {
    try {
      return JSON.parse(localStorage.getItem(storageKey(perfil)) || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function salvarEstado(perfil, patch) {
    try {
      var atual = lerEstado(perfil);
      var novo = Object.assign({}, atual, patch || {}, { atualizadoEm: new Date().toISOString() });
      if (Array.isArray(novo.mensagens)) novo.mensagens = novo.mensagens.slice(-40);
      localStorage.setItem(storageKey(perfil), JSON.stringify(novo));
      return novo;
    } catch (_) {
      return patch || {};
    }
  }

  function registrar(perfil, role, text, origem) {
    var estado = lerEstado(perfil);
    var mensagens = Array.isArray(estado.mensagens) ? estado.mensagens : [];
    mensagens.push({
      role: role === 'assistant' ? 'assistant' : 'user',
      text: txt(text),
      origem: origem || '',
      at: new Date().toISOString()
    });
    salvarEstado(perfil, { mensagens: mensagens });
  }

  function historico(perfil) {
    var estado = lerEstado(perfil);
    return (Array.isArray(estado.mensagens) ? estado.mensagens : [])
      .filter(function (m) { return txt(m.text); })
      .slice(-12)
      .map(function (m) {
        return {
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: txt(m.text)
        };
      });
  }

  function box() {
    return D.getElementById('iaMsgs') || D.querySelector('[data-ia-msgs]') || D.querySelector('.ia-messages');
  }

  function addUser(message) {
    if (typeof W._iaMsgUser === 'function') return W._iaMsgUser(message);
    if (typeof W.adicionarMsgIA === 'function') return W.adicionarMsgIA('user', esc(message));
    var c = box();
    if (!c) return null;
    var d = D.createElement('div');
    d.className = 'ia-msg user';
    d.innerHTML = esc(message).replace(/\n/g, '<br>');
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
    return d.id || null;
  }

  function addBot(html) {
    if (typeof W._iaMsgBot === 'function') return W._iaMsgBot(html);
    if (typeof W.adicionarMsgIA === 'function') {
      W.adicionarMsgIA('bot', html);
      return '__legacy__';
    }
    var c = box();
    if (!c) return null;
    var id = 'ia-orq-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
    var d = D.createElement('div');
    d.id = id;
    d.className = 'ia-msg bot';
    d.innerHTML = '<strong>thIAguinho:</strong> ' + html;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
    return id;
  }

  function replaceBot(id, html) {
    if (typeof W._iaReplace === 'function' && id && id !== '__legacy__') return W._iaReplace(id, html);
    var c = box();
    var el = id === '__legacy__' ? (c && c.lastElementChild) : D.getElementById(id);
    if (el) {
      el.innerHTML = '<strong>thIAguinho:</strong> ' + html;
      if (c) c.scrollTop = c.scrollHeight;
      return id;
    }
    return addBot(html);
  }

  function respostaLocal(pergunta, perfil) {
    try {
      if (typeof W.thiaResponderLocal === 'function') {
        return W.thiaResponderLocal(pergunta, { perfil: perfilKey(perfil) });
      }
    } catch (e) {
      return '';
    }
    return '';
  }

  function localTemDadoUtil(resp) {
    var s = strip(resp).toLowerCase();
    if (!s) return false;
    if (/^preciso de mais contexto/.test(s)) return false;
    if (/nao encontrei|não encontrei|nao ha|não há|sem dados/.test(s) && s.length < 180) return false;
    return true;
  }

  function ehPerguntaSomentePlaca(q) {
    var s = txt(q).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(s) || /^[A-Z]{3}[0-9]{4}$/.test(s);
  }

  function temCodigoFalha(q) {
    return /\bP\s*0?\d{3,4}\b/i.test(q) || /\bP[0-9A-F]{4}\b/i.test(q) || /\bDTC\b/i.test(q) || /\bc[oó]digo\s*(de\s*)?(falha)?\s*[PCBU]?\d+/i.test(q);
  }

  function pareceDiagnostico(q) {
    var s = txt(q).toLowerCase();
    if (!s) return false;
    if (temCodigoFalha(s)) return true;
    return /(falh|falhando|marcha lenta|lenta|sem for[cç]a|engasg|oscil|apaga|morrendo|partida|n[aã]o pega|superaque|aquec|barulho|ru[ií]do|vibra|luz no painel|inje[cç][aã]o|scanner|obd|sensor|bobina|vela|cabo|bico|combust[ií]vel|bomba|tbi|corpo de borboleta|map|maf|lambda|sonda|catalis|arrefecimento|ventoinha|radiador|alternador|bateria|arranque|diagn[oó]stico|checklist|causa|defeito|sintoma|motor|gol|palio|uno|siena|corsa|onix|hb20|fox|saveiro|strada|hilux|corolla|civic)/i.test(s);
  }

  function perguntaInternaOficina(q) {
    var s = txt(q).toLowerCase();
    return /(estoque|pe[cç]a|kardex|fornecedor|financeiro|dre|fluxo de caixa|cliente|agenda|nota fiscal|\bnf\b|xml|equipe|funcion[aá]rio|hist[oó]rico da placa|os da placa|ordem de servi[cç]o|o\.s\.)/i.test(s);
  }

  function deveChamarRobo(pergunta, localResp, perfil) {
    var q = txt(pergunta);
    var estado = lerEstado(perfil);
    var ultimaFoiRobo = estado.ultimaOrigem === 'robo' || (estado.mensagens || []).slice(-4).some(function (m) { return m.origem === 'robo'; });

    if (temCodigoFalha(q)) return true;
    if (pareceDiagnostico(q) && !ehPerguntaSomentePlaca(q)) return true;

    // Continuação curta depois de uma conversa técnica.
    if (ultimaFoiRobo && q.length <= 80 && !perguntaInternaOficina(q)) {
      if (!/^(ok|sim|nao|não|obrigado|valeu|v)$/i.test(q)) return true;
    }

    // Quando a busca interna pediu contexto, mas a pergunta tem cara de sintoma automotivo.
    if (/^preciso de mais contexto/i.test(strip(localResp)) && pareceDiagnostico(q)) return true;

    return false;
  }

  function montarContextoInterno(pergunta, localResp, perfil) {
    var partes = [];
    var estado = lerEstado(perfil);
    var hist = (estado.mensagens || []).slice(-8).map(function (m) {
      return (m.role === 'assistant' ? 'Assistente' : 'Usuário') + ': ' + txt(m.text).slice(0, 1000);
    }).join('\n');

    if (hist) {
      partes.push('Histórico recente do chat OFICIN-IA:\n' + hist);
    }

    if (localTemDadoUtil(localResp)) {
      partes.push('Dados internos encontrados no OFICIN-IA para esta pergunta:\n' + strip(localResp).slice(0, 5000));
    }

    var J = getJ();
    partes.push('Instrução de uso: responda como assistente técnico automotivo para mecânico/oficina. Use checklist, causas prováveis, testes e próximo passo. Se houver histórico interno, considere esse histórico antes de sugerir troca de peça.');
    partes.push('Origem: OFICIN-IA | perfil=' + perfilKey(perfil) + ' | tenant=' + getTid() + (J.user ? ' | usuario=' + (J.user.nome || J.user.email || '') : ''));

    return partes.join('\n\n');
  }

  async function cfgExterna() {
    try {
      if (W.thiaDiagnosticoIA && typeof W.thiaDiagnosticoIA.carregarConfig === 'function') {
        return await W.thiaDiagnosticoIA.carregarConfig();
      }
    } catch (_) {}
    return { ativo: true, moduloLiberado: true, endpoint: '/api/diagnostico' };
  }

  async function chamarRobo(pergunta, localResp, perfil) {
    var cfg = await cfgExterna();
    var endpoint = txt(cfg.endpoint || '/api/diagnostico') || '/api/diagnostico';
    var contextoInterno = montarContextoInterno(pergunta, localResp, perfil);

    var payload = {
      pergunta: pergunta,
      message: pergunta,
      context: {
        perfil: perfilKey(perfil),
        tenantId: getTid(),
        contextoInterno: contextoInterno
      },
      contextoInterno: contextoInterno,
      historico: historico(perfil),
      history: historico(perfil),
      session_id: lerEstado(perfil).session_id || '',
      credenciais: {
        usuario: cfg.usuario || '',
        senha: cfg.senha || ''
      },
      anonKey: cfg.anonKey || '',
      supabaseAnonKey: cfg.anonKey || ''
    };

    var res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify(payload)
    });

    var data = null, text = '';
    try { data = await res.json(); } catch (_) { try { text = await res.text(); } catch(__){} }

    if (!res.ok) {
      throw new Error((data && (data.erro || data.message || data.error)) || text || ('HTTP ' + res.status));
    }

    var resposta = (data && (data.resposta || data.answer || data.message || data.texto || data.response)) || text || '';
    if (data && (data.session_id || data.sessionId)) salvarEstado(perfil, { session_id: data.session_id || data.sessionId });
    return resposta;
  }

  async function perguntarProfissional(inputId, perfil) {
    var input = D.getElementById(inputId || 'iaInput');
    var pergunta = txt(input && input.value);
    if (!pergunta) return;
    if (input) input.value = '';

    var perfilAtual = perfilKey(perfil);
    var localResp = respostaLocal(pergunta, perfilAtual);
    var chamarExterno = deveChamarRobo(pergunta, localResp, perfilAtual);

    addUser(pergunta);
    registrar(perfilAtual, 'user', pergunta, chamarExterno ? 'robo' : 'local');

    if (!chamarExterno) {
      var htmlLocal = localResp || 'Preciso de mais contexto para responder com dado verdadeiro. Informe placa, modelo, cliente, período ou módulo.';
      addBot(htmlLocal);
      registrar(perfilAtual, 'assistant', strip(htmlLocal), 'local');
      salvarEstado(perfilAtual, { ultimaOrigem: 'local', ultimoContextoInterno: strip(htmlLocal).slice(0, 5000) });
      return;
    }

    var intro = '';
    if (localTemDadoUtil(localResp) && !/^preciso de mais contexto/i.test(strip(localResp))) {
      intro = '<div style="margin-bottom:8px;color:var(--muted,#94a3b8);font-size:.78rem;">Cruzei com os dados internos da oficina e enviei o contexto para a IA Diagnóstico.</div>';
    }

    var lid = addBot(intro + '<span class="j-spinner"></span> Consultando IA Diagnóstico com contexto do OFICIN-IA...');
    try {
      var resposta = await chamarRobo(pergunta, localResp, perfilAtual);
      var html = resposta ? esc(resposta).replace(/\n/g, '<br>') : 'A IA Diagnóstico respondeu vazio.';
      replaceBot(lid, html);
      registrar(perfilAtual, 'assistant', resposta || '', 'robo');
      salvarEstado(perfilAtual, {
        ultimaOrigem: 'robo',
        ultimoContextoInterno: strip(localResp || '').slice(0, 5000)
      });
    } catch (erro) {
      var fallback = localTemDadoUtil(localResp)
        ? localResp
        : 'Não consegui consultar a IA Diagnóstico agora. Para manter dado verdadeiro, informe placa, modelo, sintoma ou código de falha.';
      replaceBot(
        lid,
        '<b>Não consegui consultar o robô da IA Diagnóstico.</b><br>' +
        '<small style="color:var(--muted,#94a3b8)">Motivo: ' + esc(erro && erro.message || erro) + '</small><br><br>' +
        fallback
      );
      registrar(perfilAtual, 'assistant', strip(fallback), 'fallback');
      salvarEstado(perfilAtual, { ultimaOrigem: 'fallback' });
    }
  }

  function restaurar(perfil) {
    try {
      var c = box();
      if (!c || c.dataset.thiaOrqProRestaurado === '1') return;
      var estado = lerEstado(perfil);
      var msgs = (estado.mensagens || []).slice(-18);
      if (!msgs.length) return;

      c.dataset.thiaOrqProRestaurado = '1';
      var aviso = D.createElement('div');
      aviso.className = 'ia-msg bot thia-orq-restored';
      aviso.innerHTML = '<strong>thIAguinho:</strong> Conversa anterior restaurada neste dispositivo.';
      c.appendChild(aviso);

      msgs.forEach(function (m) {
        var div = D.createElement('div');
        div.className = 'ia-msg ' + (m.role === 'assistant' ? 'bot' : 'user') + ' thia-orq-restored';
        div.innerHTML = m.role === 'assistant'
          ? '<strong>thIAguinho:</strong> ' + esc(m.text || '').replace(/\n/g, '<br>')
          : esc(m.text || '').replace(/\n/g, '<br>');
        c.appendChild(div);
      });
      c.scrollTop = c.scrollHeight;
    } catch (_) {}
  }

  function limpar(perfil) {
    try { localStorage.removeItem(storageKey(perfil)); } catch (_) {}
    if (typeof W.toast === 'function') W.toast('Conversa técnica limpa neste dispositivo.', 'ok');
  }

  function ajustarBotoes() {
    // Remove o fluxo visual antigo como caminho principal. Mantém portal externo apenas emergência.
    var labels = Array.from(D.querySelectorAll('button'));
    labels.forEach(function (btn) {
      var t = (btn.textContent || '').trim().toLowerCase();
      if (t === 'entrar automaticamente' || t === 'entrar na ia') {
        btn.textContent = 'Usar IA no chat';
        btn.onclick = function () {
          addBot('<b>IA Diagnóstico pronta para trabalhar junto com o Jarvis.</b><br>Digite sintoma, código de falha ou placa + problema no campo abaixo e clique em PROCESSAR.');
        };
      }
      if (t === 'credenciais / status') {
        btn.textContent = 'Testar robô';
        btn.onclick = async function () {
          var lid = addBot('<span class="j-spinner"></span> Testando robô da IA Diagnóstico...');
          try {
            var r = await chamarRobo('Teste rápido: responda apenas "Robô ativo" em português.', '', perfilKey());
            replaceBot(lid, '<b>Robô respondeu.</b><br>' + esc(r).replace(/\n/g, '<br>'));
          } catch (e) {
            replaceBot(lid, '<b>Robô não respondeu.</b><br><small style="color:var(--muted,#94a3b8)">' + esc(e.message || e) + '</small>');
          }
        };
      }
    });
  }

  W.thiaIAAsk = function (inputId, perfil) { return perguntarProfissional(inputId || 'iaInput', perfil || 'jarvis'); };
  W.iaPerguntar = function () { return perguntarProfissional('iaInput', 'jarvis'); };
  W.iaEnviar = function () { return perguntarProfissional('iaInput', 'equipe'); };
  W.thiaDiagnosticoPerguntarProfissional = perguntarProfissional;
  W.thiaDiagnosticoLimparConversaProfissional = limpar;

  W.thiaEntrarAutomaticoDiagnosticoIA = function () {
    addBot('<b>O login visual foi desativado como fluxo principal.</b><br>Agora a IA trabalha pelo robô <code>/api/diagnostico</code>. Digite sua pergunta no chat e clique em PROCESSAR.');
    return false;
  };

  D.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      restaurar(perfilKey());
      ajustarBotoes();
    }, 350);
    setTimeout(ajustarBotoes, 1300);
    setTimeout(ajustarBotoes, 3000);
  });

  console.log('[OFICIN-IA] Orquestrador profissional IA Diagnóstico instalado.');
})();
