/*
 * thIAguinho + Prec_IA / ValorIA - teste DevTools sem gravar dados.
 * Como usar: abrir Jarvis, Superadmin, cliente ou clienteOficial, F12 > Console,
 * colar este arquivo inteiro e pressionar Enter.
 */
(function testeValorIAPrecia() {
  'use strict';

  const out = [];
  const J = window.J || {};
  const pass = (nome, detalhe) => out.push({ status: 'OK', nome, detalhe: detalhe || '' });
  const warn = (nome, detalhe) => out.push({ status: 'ATENCAO', nome, detalhe: detalhe || '' });
  const fail = (nome, detalhe) => out.push({ status: 'FALHA', nome, detalhe: detalhe || '' });
  const fn = nome => typeof window[nome] === 'function';
  const has = id => !!document.getElementById(id);

  console.log('%cthIAguinho + Prec_IA - teste de links e robo', 'background:#0f172a;color:#7dd3fc;padding:8px 12px;font-weight:700;');

  const cfg = window.THIA_PUBLIC_LINKS || {};
  cfg.baseUrl && /OFICIN-IA\/?$/i.test(cfg.baseUrl) ? pass('Base OFICIN-IA oficial', cfg.baseUrl) : warn('Base OFICIN-IA oficial', cfg.baseUrl || 'THIA_PUBLIC_LINKS ausente');
  cfg.valorIAFornecedor && /Prec_IA\/fornecedor\.html/i.test(cfg.valorIAFornecedor) ? pass('Base Prec_IA fornecedor', cfg.valorIAFornecedor) : fail('Base Prec_IA fornecedor', cfg.valorIAFornecedor || 'ausente');
  cfg.apkUrl ? pass('Link de instalacao APK', cfg.apkUrl) : warn('Link de instalacao APK', 'apkUrl nao configurado.');

  ['thiaGetPublicUrl', 'thiaGetClientePortalUrl', 'thiaOpenWhatsApp', 'thiaOpenExternalUrl', 'thiaInjectPortalInstallBar'].forEach(nome => {
    fn(nome) ? pass('Funcao ' + nome) : warn('Funcao ' + nome, 'Nao encontrada nesta tela.');
  });

  if (/cliente(?:Oficial)?\.html/i.test(location.pathname || '')) {
    fn('thiaInjectPortalInstallBar') && window.thiaInjectPortalInstallBar();
    has('thiaPublicInstallBar') ? pass('Barra portal publico', document.getElementById('thiaPublicInstallBar').innerText.replace(/\s+/g, ' | ')) : warn('Barra portal publico', 'Nao apareceu.');
  }

  if (fn('thiaValorIAStatus')) {
    try {
      const st = window.thiaValorIAStatus();
      st.enabled ? pass('ValorIA ativo no tenant', JSON.stringify(st)) : warn('ValorIA ativo no tenant', JSON.stringify(st));
      st.hasDatabaseURL ? pass('ValorIA databaseURL', 'Configurado') : warn('ValorIA databaseURL', 'Nao configurado no tenant.');
      const tenantAntigo = ['legacy', 'root'].join('_');
      st.tenantOnly && st.tenantId && st.tenantId !== tenantAntigo ? pass('ValorIA multi-tenant obrigatorio', st.tenantId) : fail('ValorIA multi-tenant obrigatorio', JSON.stringify(st));
    } catch (e) {
      fail('ValorIA status', e.message || e);
    }
  } else {
    warn('ValorIA status', 'js/valoria-integracao.js nao carregado nesta tela.');
  }

  const osId = document.getElementById('osId')?.value || '';
  if (osId && Array.isArray(J.os)) {
    const os = J.os.find(o => String(o.id || '') === String(osId)) || {};
    const cotacoes = os.cotacoesPecas || {};
    const links = [];
    Object.values(cotacoes).forEach(c => {
      (c.solicitacoes || []).forEach(s => {
        const qs = s.valorIA?.queues || s.valoria?.queues || [];
        qs.forEach(q => q.publicLink && links.push(q.publicLink));
      });
    });
    links.length ? pass('Links ValorIA na O.S. aberta', links.slice(0, 5).join(' | ')) : warn('Links ValorIA na O.S. aberta', 'Ainda nao ha link ValorIA vinculado.');
    const marcasAntigas = [['legacy', '1'].join('='), ['public', 'Cotacoes'].join(''), 'cotacao='];
    links.some(l => marcasAntigas.some(m => String(l).includes(m))) ? fail('Links ValorIA sem legado raiz', links.join(' | ')) : pass('Links ValorIA sem legado raiz', links.length ? 'Sem parametros antigos.' : 'Sem links para validar.');
  } else {
    warn('O.S. aberta para links ValorIA', 'Abra uma O.S. no Jarvis para validar links gerados.');
  }

  const body = document.body.innerText || '';
  if (/Gemini|generativelanguage\.googleapis/i.test(body)) fail('Sem Gemini/API externa visivel', 'Texto de Gemini/API apareceu na tela.');
  else pass('Sem Gemini/API externa visivel');

  const appUrl = fn('thiaBuildWhatsAppUrl') ? window.thiaBuildWhatsAppUrl('11999999999', 'teste', { transport: 'app' }) : '';
  appUrl && /^whatsapp:\/\/send\?/.test(appUrl) ? pass('WhatsApp desktop app preparado', appUrl) : warn('WhatsApp desktop app preparado', 'thiaBuildWhatsAppUrl app indisponivel nesta tela.');

  console.table(out);
  const falhas = out.filter(x => x.status === 'FALHA').length;
  const atencoes = out.filter(x => x.status === 'ATENCAO').length;
  console.log(`Resultado: ${out.length} verificacoes, ${falhas} falha(s), ${atencoes} atencao(oes).`);
  return { falhas, atencoes, detalhes: out };
})();
