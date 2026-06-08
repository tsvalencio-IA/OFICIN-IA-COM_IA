// OFICIN-IA — Robô virtual para IA Diagnóstico Automotivo
// Backend leve para Vercel.
// Não usa iframe. Não abre navegador. Faz login Supabase e chama /functions/v1/diagnostic-chat.

const SUPABASE_URL = "https://luazuifvwyeabuldlvzw.supabase.co";
const SUPABASE_ANON_KEY_PADRAO = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1YXp1aWZ2d3llYWJ1bGRsdnp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjM0MjUsImV4cCI6MjA4NDgzOTQyNX0.1UxZkY5q0ousoInOZ-4kZFfWRppiGEsag-vVrzBxJ8Y";

function corsOrigin(req) {
  const permitido = process.env.ALLOWED_ORIGIN || "*";
  if (permitido === "*") return "*";
  const origin = req.headers.origin || "";
  return origin === permitido ? permitido : permitido;
}

function sendJson(req, res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", corsOrigin(req));
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Body JSON inválido.");
  }
}

function pickPergunta(body) {
  return String(body.pergunta || body.message || body.text || body.prompt || "").trim();
}

function montarPerguntaComContexto(body) {
  const pergunta = pickPergunta(body);
  if (!pergunta) throw new Error("Pergunta vazia.");

  const contexto = body.contexto || body.context || {};
  const partes = [pergunta];

  if (contexto && Object.keys(contexto).length) {
    partes.push("\n\nContexto vindo do OFICIN-IA:");
    partes.push(JSON.stringify(contexto, null, 2));
  }

  return partes.join("\n");
}

function credenciais(body) {
  const c = body.credenciais || body.credentials || {};

  const email =
    process.env.DIAGNOSTICO_EMAIL ||
    c.usuario ||
    c.email ||
    body.usuario ||
    body.email ||
    "";

  const password =
    process.env.DIAGNOSTICO_PASSWORD ||
    c.senha ||
    c.password ||
    body.senha ||
    body.password ||
    "";

  const anonKey =
    process.env.DIAGNOSTICO_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    body.anonKey ||
    body.supabaseAnonKey ||
    SUPABASE_ANON_KEY_PADRAO;

  if (!email || !password) {
    throw new Error("E-mail/senha da IA Diagnóstico ausentes. Configure na Vercel ou envie via credenciais do tenant.");
  }

  return { email, password, anonKey };
}

async function loginSupabase(body) {
  const { email, password, anonKey } = credenciais(body);

  const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": anonKey
    },
    body: JSON.stringify({ email, password })
  });

  const data = await resp.json().catch(() => null);

  if (!resp.ok || !data?.access_token) {
    throw new Error("Falha no login Supabase da IA Diagnóstico: " + resp.status + " " + JSON.stringify(data));
  }

  return { ...data, anonKey };
}

async function criarSessao(token, anonKey, userId, titulo) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/diagnostic_sessions?select=*`, {
    method: "POST",
    headers: {
      "accept": "application/vnd.pgrst.object+json",
      "apikey": anonKey,
      "authorization": `Bearer ${token}`,
      "content-profile": "public",
      "content-type": "application/json",
      "prefer": "return=representation",
      "x-client-info": "oficin-ia-robo-vercel/1.0.0"
    },
    body: JSON.stringify({
      user_id: userId,
      title: String(titulo || "Diagnóstico OFICIN-IA").slice(0, 120)
    })
  });

  const text = await resp.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!resp.ok) {
    throw new Error("Falha ao criar sessão: " + resp.status + " " + text);
  }

  return data;
}

async function salvarMensagem(token, anonKey, sessionId, role, content) {
  if (!sessionId) return null;

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/diagnostic_messages`, {
    method: "POST",
    headers: {
      "apikey": anonKey,
      "authorization": `Bearer ${token}`,
      "content-profile": "public",
      "content-type": "application/json",
      "x-client-info": "oficin-ia-robo-vercel/1.0.0"
    },
    body: JSON.stringify({
      session_id: sessionId,
      role,
      content,
      images: null
    })
  });

  // O app original não precisa de corpo aqui. Status 201 basta.
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.warn("Não consegui salvar mensagem", resp.status, text);
  }

  return true;
}

function parseSseDiagnosticChat(text) {
  if (!text) return "";

  const linhas = String(text).split(/\r?\n/);
  let saida = "";

  for (const linha of linhas) {
    const l = linha.trim();
    if (!l.startsWith("data:")) continue;

    const raw = l.slice(5).trim();
    if (!raw || raw === "[DONE]") continue;

    try {
      const obj = JSON.parse(raw);
      const delta = obj?.choices?.[0]?.delta?.content;
      if (delta) saida += delta;
    } catch {
      // Ignora chunk que não for JSON.
    }
  }

  return saida.trim();
}

async function chamarDiagnosticChat(token, anonKey, perguntaComContexto, historico = []) {
  const mensagens = [];

  if (Array.isArray(historico) && historico.length) {
    for (const item of historico.slice(-12)) {
      const role = item.role === "assistant" || item.role === "user" ? item.role : "user";
      const content = String(item.content || item.text || item.message || "").trim();
      if (content) mensagens.push({ role, content });
    }
  }

  if (!mensagens.length) {
    mensagens.push({ role: "assistant", content: "welcome" });
  }

  mensagens.push({ role: "user", content: perguntaComContexto });

  const payload = {
    messages: mensagens,
    language: "pt"
  };

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/diagnostic-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": anonKey
    },
    body: JSON.stringify(payload)
  });

  const text = await resp.text();

  if (!resp.ok) {
    throw new Error("Falha no diagnostic-chat: " + resp.status + " " + text);
  }

  const resposta = parseSseDiagnosticChat(text) || text;

  return {
    resposta,
    raw: text,
    payload
  };
}

async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return sendJson(req, res, 200, { ok: true });
  }

  if (req.method !== "POST") {
    return sendJson(req, res, 405, { ok: false, erro: "Use POST." });
  }

  try {
    const body = await readJsonBody(req);
    const perguntaOriginal = pickPergunta(body);
    const perguntaComContexto = montarPerguntaComContexto(body);

    const sessao = await loginSupabase(body);
    const token = sessao.access_token;
    const anonKey = sessao.anonKey;
    const userId = sessao.user?.id || body.user_id || body.userId || null;

    let sessionId = body.session_id || body.sessionId || null;

    if (!sessionId && userId) {
      const novaSessao = await criarSessao(token, anonKey, userId, perguntaOriginal);
      sessionId = novaSessao?.id || null;
    }

    if (sessionId) {
      await salvarMensagem(token, anonKey, sessionId, "user", perguntaOriginal);
    }

    const resultado = await chamarDiagnosticChat(
      token,
      anonKey,
      perguntaComContexto,
      body.historico || body.history || []
    );

    if (sessionId && resultado.resposta) {
      await salvarMensagem(token, anonKey, sessionId, "assistant", resultado.resposta);
    }

    return sendJson(req, res, 200, {
      ok: true,
      resposta: resultado.resposta,
      session_id: sessionId,
      provider: "appdiagnosticoautomotivo-supabase",
      rawPayload: resultado.payload
    });
  } catch (error) {
    return sendJson(req, res, 500, {
      ok: false,
      erro: error.message || "Erro interno no robô virtual."
    });
  }
}


module.exports = handler;
