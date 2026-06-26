/*
 * thIAguinho IA local
 * Motor interno baseado em dados carregados, regras e cerebro JSON.
 * Nao chama provedor externo.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;

  W.iaHistorico = W.iaHistorico || [];

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function norm(v) {
    return String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function num(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    const s = String(v == null ? '' : v).replace(/\s/g, '').replace(/R\$/gi, '');
    if (!s) return 0;
    return parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s) || 0;
  }

  function moeda(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num(v));
  }

  function dataISO(v) {
    const raw = String(v == null ? '' : v).trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return raw.slice(0, 10);
  }

  function dataBR(v) {
    const iso = dataISO(v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '-';
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  }

  function textoLivre(obj, campos) {
    return (campos || []).map(k => {
      try {
        const val = k.split('.').reduce((acc, p) => acc == null ? acc : acc[p], obj);
        if (Array.isArray(val)) return val.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ');
        if (val && typeof val === 'object') return JSON.stringify(val);
        return String(val == null ? '' : val);
      } catch (_) {
        return '';
      }
    }).join(' ');
  }

  function isPagoStatus(v) {
    const s = norm(v);
    return /\b(pago|paga|liquidado|liquidada|baixado|baixada|quitado|quitada|recebido|recebida)\b/.test(s);
  }

  function isCanceladoStatus(v) {
    return /\b(cancelado|cancelada|estornado|estornada|recusado|recusada)\b/.test(norm(v));
  }

  function isPendenteStatus(v) {
    return !isPagoStatus(v) && !isCanceladoStatus(v);
  }

  function textoFinanceiro(f) {
    return textoLivre(f, [
      'id','tipo','status','desc','descricao','observacao','obs','fornecedor','fornecedorNome',
      'cliente','clienteNome','numero','numeroNF','nf','nota','documento','osId','osNumero',
      'placa','veiculo','mecId','mecNome','responsavel','funcionario','colaborador','vinculo',
      'forma','pgto','categoria','subcategoria'
    ]);
  }

  function financeiroEhComissao(f) {
    return !!(f && (f.isComissao || /comiss/.test(norm(textoFinanceiro(f)))));
  }

  function funcionarioTexto(f) {
    return textoLivre(f, ['id','nome','usuario','cargo','apelido','email','wpp']);
  }

  function tokensPerguntaFuncionario(q) {
    return norm(q)
      .split(/\s+/)
      .map(t => t.trim())
      .filter(t => t.length >= 3)
      .filter(t => !/^\d{1,2}[\/.-]\d{1,2}/.test(t))
      .filter(t => !/^(comiss|comissao|comissoes|pagar|pagas|pago|pendente|funcionario|mecanico|mecanicos|colaborador|colaboradores|responsavel|responsaveis|servico|servicos|atendeu|atendimentos|realizou|executou|trabalhou|veiculo|veiculos|ordem|ordens|relatorio|valor|valores|total|para|ate|dia|dias|quais|qual|dos|das|do|da|de|com|sem|no|na|nos|nas|os|as|financeiro)$/.test(t));
  }

  function limparTermoFuncionarioPergunta(v) {
    return norm(v)
      .replace(/\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/g, ' ')
      .replace(/\b(?:ate|entre|periodo|periodos|dia|dias|servico|servicos|atendimento|atendimentos|realizou|executou|trabalhou|veiculo|veiculos|ordem|ordens|o\.?s\.?)\b/g, ' ')
      .replace(/\b(o|a|os|as|do|da|de|dos|das|no|na|nos|nas)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function funcionarioPorNomeExtraido(ctx, termo) {
    const equipe = Array.isArray(ctx?.equipe) ? ctx.equipe : [];
    const alvo = limparTermoFuncionarioPergunta(termo);
    if (alvo.length < 3) return null;
    let melhor = null;
    let melhorScore = 0;
    const alvoTokens = alvo.split(/\s+/).filter(t => t.length >= 3);
    equipe.forEach(f => {
      const candidatos = [f.nome, f.usuario, f.apelido, f.login, f.email]
        .map(v => norm(v).trim())
        .filter(v => v.length >= 3);
      let score = 0;
      candidatos.forEach(c => {
        if (!c) return;
        if (c === alvo) score = Math.max(score, 3000 + c.length);
        else if (c.includes(alvo) || alvo.includes(c)) score = Math.max(score, 2000 + Math.min(c.length, alvo.length));
        else {
          const cTokens = c.split(/\s+/).filter(t => t.length >= 3);
          const comuns = alvoTokens.filter(t => cTokens.includes(t)).length;
          if (comuns) score = Math.max(score, comuns * 100 + cTokens.join(' ').length);
        }
      });
      if (score > melhorScore) { melhor = f; melhorScore = score; }
    });
    return melhorScore >= 100 ? melhor : null;
  }

  function funcionarioPorPergunta(ctx, q) {
    const equipe = Array.isArray(ctx.equipe) ? ctx.equipe : [];
    const pergunta = norm(q);
    const termosQ = tokensPerguntaFuncionario(q);
    const tokensQ = new Set(pergunta.split(/\s+/).filter(Boolean));
    let melhor = null;
    let melhorScore = 0;
    equipe.forEach(f => {
      const nome = norm(funcionarioTexto(f));
      if (!nome) return;
      let score = 0;
      const aliases = [f.nome, f.usuario, f.apelido, f.login]
        .map(v => norm(v).trim())
        .filter(Boolean);
      aliases.forEach(alias => {
        if (alias.length >= 3) {
          if (pergunta.includes(alias)) score += 1000 + alias.length;
        } else if (tokensQ.has(alias)) {
          score += 100 + alias.length;
        }
      });
      termosQ.forEach(t => { if (nome.includes(t)) score += t.length; });
      const nomeTokens = norm(f.nome || '').split(/\s+/).filter(Boolean);
      nomeTokens.forEach(t => { if (t.length >= 3 && tokensQ.has(t)) score += t.length + 2; });
      if (score > melhorScore) { melhor = f; melhorScore = score; }
    });
    return melhorScore >= 3 ? melhor : null;
  }

  function financeiroDoFuncionario(f, func) {
    if (!func) return true;
    const ids = [func.id, func.uid, func.userId, func.usuario].map(v => String(v || '').trim()).filter(Boolean);
    const nome = norm(func.nome || func.usuario || '');
    const hay = norm(textoFinanceiro(f));
    if (ids.some(id => [f.mecId, f.funcId, f.funcionarioId, f.colaboradorId, f.userId, f.vinculo].map(v => String(v || '')).includes(id))) return true;
    if (nome && hay.includes(nome)) return true;
    const partes = nome.split(/\s+/).filter(t => t.length >= 3);
    return partes.length && partes.every(t => hay.includes(t));
  }

  function tipoFinanceiro(f) {
    return norm([f.tipo, f.natureza, f.operacao, f.categoria, f.desc, f.descricao].join(' '));
  }

  function formatarLinhaFinanceiro(f) {
    const desc = f.desc || f.descricao || f.titulo || f.nome || 'Lançamento';
    const venc = dataBR(f.venc || f.vencimento || f.data || f.dataPagamento || f.createdAt);
    const forma = f.pgto || f.forma || f.formaPagamento || '';
    const status = f.status || '-';
    return `- ${esc(venc)} | ${esc(desc)} | ${moeda(f.valor || f.total || 0)} | ${esc(status)}${forma ? ` | ${esc(forma)}` : ''}`;
  }

  function extrairNumeroNF(q) {
    const m = String(q || '').match(/\b(?:nf|nota\s*fiscal)?\s*([0-9]{3,})\b/i);
    return m ? m[1] : '';
  }

  function notaTexto(n) {
    return textoLivre(n, [
      'id','numero','numeroNF','nf','chave','fornecedorNome','fornecedorSnapshot.nome',
      'fornecedorSnapshot.cnpj','cnpj','dataNF','emissao','status','observacao','xmlNome'
    ]);
  }

  function formatarLinhaNota(n) {
    return `- NF ${esc(n.numero || n.numeroNF || n.nf || '-')} | ${esc(n.fornecedorSnapshot?.nome || n.fornecedorNome || n.fornecedor || '-')} | ${esc(dataBR(n.dataNF || n.emissao || n.createdAt))} | ${moeda(n.totalNF || n.totalItens || n.valor || 0)}`;
  }

  function responderNotasDetalhadas(texto, q, ctx) {
    if (!/nota fiscal|\bnf\b|xml|fornecedor/.test(q)) return null;
    if (!ctx.notas.length) return 'Nao ha notas fiscais carregadas nesta sessao.';
    const numeroNF = extrairNumeroNF(texto);
    const stop = /^(nota|fiscal|nf|xml|fornecedor|fornecedores|da|de|do|das|dos|a|o|e|com)$/;
    const termos = q.split(/\s+/).filter(t => t.length >= 3 && !stop.test(t) && !/^\d+$/.test(t));
    let lista = ctx.notas.slice();
    if (numeroNF) {
      lista = lista.filter(n => String(n.numero || n.numeroNF || n.nf || '').includes(numeroNF) || norm(notaTexto(n)).includes(numeroNF));
    }
    if (termos.length) {
      lista = lista.filter(n => {
        const hay = norm(notaTexto(n));
        return termos.every(t => hay.includes(t));
      });
    }
    if (!lista.length) return 'Nao encontrei nota fiscal com esses filtros nos dados carregados.';
    const total = lista.reduce((s, n) => s + num(n.totalNF || n.totalItens || n.valor || 0), 0);
    return `<strong>Notas fiscais localizadas (${lista.length}):</strong><br>${lista.slice(0, 25).map(formatarLinhaNota).join('<br>')}<br><br><strong>Total:</strong> ${moeda(total)}`;
  }

  function responderComissoesDetalhadas(texto, q, ctx, opts) {
    if (!/comiss|mecanico|funcionario|colaborador/.test(q)) {
      const funcSozinho = funcionarioPorPergunta(ctx, q);
      if (!funcSozinho) return null;
    }
    if (!podeFinanceiro(opts)) return 'Seu perfil nao tem permissao para consultar comissoes ou financeiro.';
    const func = funcionarioPorPergunta(ctx, q);
    let lista = ctx.financeiro.filter(financeiroEhComissao);
    if (func) lista = lista.filter(f => financeiroDoFuncionario(f, func));
    const querPagas = /\b(pagas|pago|pagos|pagamento|liquidadas|quitadas)\b/.test(q) && !/\ba\s+pagar\b/.test(q);
    const querPendentes = /\b(a\s+pagar|pagar|pendente|pendentes|aberto|abertas|em\s+aberto|devido|devidas)\b/.test(q) || !querPagas;
    if (querPagas) lista = lista.filter(f => isPagoStatus(f.status));
    else if (querPendentes) lista = lista.filter(f => isPendenteStatus(f.status));
    const tituloPessoa = func ? ` de ${esc(func.nome || func.usuario || 'colaborador')}` : '';
    if (!lista.length) return `Nao encontrei comissoes${tituloPessoa} ${querPagas ? 'pagas' : 'a pagar'} nos dados carregados.`;
    const total = lista.reduce((s, f) => s + num(f.valor || f.total || 0), 0);
    const porPessoa = {};
    lista.forEach(f => {
      const id = f.mecId || f.funcId || f.funcionarioId || f.colaboradorId || f.vinculo || 'sem-vinculo';
      const nome = (ctx.equipe.find(e => [e.id,e.uid,e.usuario].map(x=>String(x||'')).includes(String(id))) || {}).nome || f.mecNome || f.funcionario || f.colaborador || (func && (func.nome || func.usuario)) || 'Sem colaborador identificado';
      porPessoa[nome] = (porPessoa[nome] || 0) + num(f.valor || f.total || 0);
    });
    const resumo = Object.keys(porPessoa).length > 1
      ? '<br><strong>Resumo por colaborador:</strong><br>' + Object.entries(porPessoa).sort((a,b)=>b[1]-a[1]).map(([nome, total]) => `- ${esc(nome)}: ${moeda(total)}`).join('<br>')
      : '';
    return `<strong>Comissões ${querPagas ? 'pagas' : 'a pagar'}${tituloPessoa} (${lista.length}):</strong><br>${lista.slice(0, 30).map(formatarLinhaFinanceiro).join('<br>')}<br><br><strong>Total:</strong> ${moeda(total)}${resumo}`;
  }

  function responderFinanceiroDetalhado(texto, q, ctx, opts) {
    const consultaFinanceira = /boleto|boletos|conta|contas|titulo|duplicata|financeiro|pix|vencid|vencendo|vencimento|pagar|receber|paga|pagas|pago|pagos|pendente|pendentes|atrasad|hoje|amanha|dre|caixa|comiss/.test(q);
    if (!consultaFinanceira) return null;
    const comissoes = responderComissoesDetalhadas(texto, q, ctx, opts);
    if (comissoes && /comiss|mecanico|funcionario|colaborador/.test(q)) return comissoes;
    if (!podeFinanceiro(opts)) return 'Seu perfil nao tem permissao para consultar financeiro. Posso consultar O.S., historico tecnico, defeitos, veiculos e execucao.';
    const hoje = hojeISO();
    const amanha = (() => { const d = new Date(); d.setDate(d.getDate()+1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
    const analiseFinanceira = /analis|analise|resumo|risco|prioridade|dre|atual|geral/.test(q);
    let lista = ctx.financeiro.slice();

    if (/\bhoje\b/.test(q) || /vencimento\s+hoje/.test(q)) lista = lista.filter(f => dataISO(f.venc || f.vencimento || f.data) === hoje);
    if (/\bamanha\b/.test(q)) lista = lista.filter(f => dataISO(f.venc || f.vencimento || f.data) === amanha);
    if (/vencid|atrasad/.test(q)) lista = lista.filter(f => {
      const venc = dataISO(f.venc || f.vencimento || f.data);
      return venc && venc < hoje && isPendenteStatus(f.status);
    });

    const querPagas = /\b(contas?\s+pagas?|pagas|pago|pagos|liquidadas|quitadas)\b/.test(q) && !/\ba\s+pagar\b/.test(q);
    const querPendentes = /\b(contas?\s+a\s+pagar|a\s+pagar|pagar|pendente|pendentes|aberto|abertas|em\s+aberto|boletos?)\b/.test(q) && !querPagas;
    if (querPagas) lista = lista.filter(f => isPagoStatus(f.status));
    if (querPendentes) lista = lista.filter(f => isPendenteStatus(f.status));

    if (/receber|recebimento|entrada/.test(q) && !/pagar/.test(q)) lista = lista.filter(f => /entrada|receb/.test(tipoFinanceiro(f)));
    if (/pagar|boleto|conta/.test(q) && !/receber/.test(q)) {
      const saidas = lista.filter(f => !/entrada|recebimento/.test(tipoFinanceiro(f)));
      if (saidas.length) lista = saidas;
    }

    if (/pix/.test(q) && /parcel/.test(q)) {
      lista = ctx.financeiro.filter(f => /pix/i.test(String(f.pgto || f.forma || '')) && (num(f.pgtoParcelas || f.parcelas || 1) > 1 || /\(\d+\s*\/\s*\d+\)/.test(String(f.desc || ''))));
      if (!lista.length) return 'Nao encontrei PIX parcelado nos dados carregados.';
    }

    const numeroNF = extrairNumeroNF(texto);
    if (numeroNF && /\bnf\b|nota|fiscal/.test(q)) lista = lista.filter(f => norm(textoFinanceiro(f)).includes(numeroNF));

    const stop = /^(financeiro|boleto|boletos|conta|contas|pagar|pagas|pago|pagos|pendente|pendentes|vencimento|vencendo|vencidas|vencidos|atrasadas|atrasados|hoje|amanha|nf|nota|fiscal|a|o|as|os|de|do|da|das|dos|para|com|em|no|na)$/;
    const termos = q.split(/\s+/).filter(t => t.length >= 4 && !stop.test(t) && !/^\d+$/.test(t));
    if (termos.length) {
      const filtrada = lista.filter(f => {
        const hay = norm(textoFinanceiro(f));
        return termos.every(t => hay.includes(t));
      });
      if (filtrada.length) lista = filtrada;
    }

    if (analiseFinanceira) {
      const vencidos = ctx.financeiro.filter(f => {
        const venc = dataISO(f.venc || f.vencimento || f.data);
        return venc && venc < hoje && isPendenteStatus(f.status);
      });
      const hojeLista = ctx.financeiro.filter(f => dataISO(f.venc || f.vencimento || f.data) === hoje);
      const pendentes = ctx.financeiro.filter(f => isPendenteStatus(f.status));
      const totalPendente = pendentes.reduce((s, f) => s + num(f.valor || f.total || 0), 0);
      const linhas = [
        `<strong>Análise financeira local:</strong> ${ctx.financeiro.length} lançamento(s) carregado(s).`,
        `Pendentes/em aberto: ${pendentes.length} (${moeda(totalPendente)}).`,
        `Vencidos: ${vencidos.length}. Vencendo hoje: ${hojeLista.length}.`
      ];
      const prioridades = [...vencidos, ...hojeLista, ...pendentes]
        .filter((f, i, arr) => arr.findIndex(x => (x.id || x.desc || x.descricao) === (f.id || f.desc || f.descricao)) === i)
        .slice(0, 20);
      if (prioridades.length) linhas.push('<br><strong>Prioridades:</strong><br>' + prioridades.map(formatarLinhaFinanceiro).join('<br>'));
      return linhas.join('<br>');
    }

    if (!lista.length) return 'Nao encontrei lancamento financeiro para essa pergunta nos dados carregados.';
    const total = lista.reduce((s, f) => s + num(f.valor || f.total || 0), 0);
    return `<strong>Financeiro localizado (${lista.length}):</strong><br>${lista.slice(0, 30).map(formatarLinhaFinanceiro).join('<br>')}<br><br><strong>Total:</strong> ${moeda(total)}`;
  }

  function responderJarvisDadosPrecisos(texto, q, ctx, opts) {
    // Consultas operacionais de O.S./pátio devem cair no bloco próprio,
    // para listar TODAS as O.S. da condição pedida, e não virar resumo genérico.
    if (/\b(o\.?s\.?|os|ordem|ordens|veiculo|veiculos|patio|pátio)\b/.test(q) && /(patio|pátio|entreg|fechad|finaliz|concluid|receb|pagamento|sem receb|sem pagar|abert|abertas|andamento|orcamento|orçamento|triagem|pronto)/.test(q)) {
      return null;
    }
    const atendimentos = responderAtendimentosFuncionarioPeriodo(texto, q, ctx, opts);
    if (atendimentos) return atendimentos;
    const notas = responderNotasDetalhadas(texto, q, ctx);
    if (notas) return notas;
    const comissoes = responderComissoesDetalhadas(texto, q, ctx, opts);
    if (comissoes && /comiss|mecanico|funcionario|colaborador/.test(q)) return comissoes;
    const financeiro = responderFinanceiroDetalhado(texto, q, ctx, opts);
    if (financeiro) return financeiro;
    const func = funcionarioPorPergunta(ctx, q);
    if (func && podeFinanceiro(opts)) {
      const pend = ctx.financeiro.filter(f => financeiroEhComissao(f) && financeiroDoFuncionario(f, func) && isPendenteStatus(f.status));
      const pagas = ctx.financeiro.filter(f => financeiroEhComissao(f) && financeiroDoFuncionario(f, func) && isPagoStatus(f.status));
      const totalPend = pend.reduce((s, f) => s + num(f.valor || f.total || 0), 0);
      const totalPagas = pagas.reduce((s, f) => s + num(f.valor || f.total || 0), 0);
      return `<strong>Colaborador localizado:</strong> ${esc(func.nome || func.usuario || func.id)}<br>Cargo: ${esc(func.cargo || '-')}<br>Comissões a pagar: ${pend.length} (${moeda(totalPend)}).<br>Comissões pagas: ${pagas.length} (${moeda(totalPagas)}).`;
    }
    return null;
  }

  function hojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function uniq(arr) {
    return Array.from(new Set((arr || []).map(v => String(v || '').trim()).filter(Boolean)));
  }

  function asArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }
    if (typeof value === 'object') return Object.values(value);
    return [];
  }

  function getJ() {
    if (W.J && Object.keys(W.J).length) return W.J;
    try {
      if (typeof J !== 'undefined' && J) return J;
    } catch (_) {}
    return {};
  }

  function dataSets(opts) {
    const J = opts?.J || getJ();
    let osEquipe = [];
    let clientesEquipe = [];
    let veiculosEquipe = [];
    let estoqueEquipe = [];
    try { if (typeof dbOS !== 'undefined' && Array.isArray(dbOS)) osEquipe = dbOS; } catch (_) {}
    try { if (typeof dbClientes !== 'undefined' && Array.isArray(dbClientes)) clientesEquipe = dbClientes; } catch (_) {}
    try { if (typeof dbVeiculos !== 'undefined' && Array.isArray(dbVeiculos)) veiculosEquipe = dbVeiculos; } catch (_) {}
    try { if (typeof dbEstoque !== 'undefined' && Array.isArray(dbEstoque)) estoqueEquipe = dbEstoque; } catch (_) {}
    return {
      J,
      os: Array.isArray(J.os) ? J.os : (Array.isArray(W.dbOS) ? W.dbOS : osEquipe),
      clientes: Array.isArray(J.clientes) ? J.clientes : (Array.isArray(W.dbClientes) ? W.dbClientes : clientesEquipe),
      veiculos: Array.isArray(J.veiculos) ? J.veiculos : (Array.isArray(W.dbVeiculos) ? W.dbVeiculos : veiculosEquipe),
      estoque: Array.isArray(J.estoque) ? J.estoque : (Array.isArray(W.dbEstoque) ? W.dbEstoque : estoqueEquipe),
      financeiro: Array.isArray(J.financeiro) ? J.financeiro : [],
      equipe: Array.isArray(J.equipe) ? J.equipe : [],
      notas: Array.isArray(J.notasFiscaisEntrada) ? J.notasFiscaisEntrada : [],
      vinculos: Array.isArray(J.nfItensVinculos) ? J.nfItensVinculos : [],
      pacotes: Array.isArray(J.pacotesBoletos) ? J.pacotesBoletos : []
    };
  }

  function role(opts) {
    return norm(opts?.perfil || getJ().role || sessionStorage.getItem('j_role') || '');
  }

  function podeFinanceiro(opts) {
    const r = role(opts);
    return /superadmin|admin|jarvis|gestor|gerente|financeiro|vendedor|dono|proprietario|owner|oficina_admin|caixa/.test(r);
  }

  function placaLimpa(v) {
    return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function dataValidaPeriodo(dia, mes, ano) {
    const d = Number(dia);
    const m = Number(mes);
    let a = Number(ano);
    if (a > 0 && a < 100) a += 2000;
    if (!a || d < 1 || m < 1 || m > 12) return '';
    const dt = new Date(a, m - 1, d, 12, 0, 0);
    if (dt.getFullYear() !== a || dt.getMonth() !== m - 1 || dt.getDate() !== d) return '';
    return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function extrairPeriodoPergunta(texto) {
    const datas = Array.from(String(texto || '').matchAll(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/g));
    if (datas.length < 2) return null;
    const anoAtual = new Date().getFullYear();
    const anoExplicito = datas.map(m => Number(m[3] || 0)).find(Boolean);
    let anoInicio = Number(datas[0][3] || anoExplicito || anoAtual);
    let anoFim = Number(datas[1][3] || anoExplicito || anoAtual);
    if (anoInicio < 100) anoInicio += 2000;
    if (anoFim < 100) anoFim += 2000;
    let inicio = dataValidaPeriodo(datas[0][1], datas[0][2], anoInicio);
    let fim = dataValidaPeriodo(datas[1][1], datas[1][2], anoFim);
    if (!inicio || !fim) return null;
    if (!datas[0][3] && !datas[1][3] && inicio > fim) {
      anoInicio = anoFim - 1;
      inicio = dataValidaPeriodo(datas[0][1], datas[0][2], anoInicio);
    }
    if (inicio > fim) [inicio, fim] = [fim, inicio];
    return { inicio, fim };
  }

  function periodoContem(periodo, valor) {
    const iso = dataISO(valor);
    return !!(periodo && iso && iso >= periodo.inicio && iso <= periodo.fim);
  }

  function funcionarioDaPerguntaOperacional(ctx, texto, q) {
    const m = norm(texto).match(/\b(?:mecanico|funcionario|colaborador|responsavel)\s+(?:o|a|os|as|do|da|de|dos|das)?\s*(.+?)(?=\s+(?:atendeu|atendimentos?|realizou|executou|trabalhou|do\s+dia|entre|de\s+\d|no\s+periodo)|[?,.!]|$)/);
    const nome = limparTermoFuncionarioPergunta(m?.[1] || '');
    const porNome = funcionarioPorNomeExtraido(ctx, nome);
    if (porNome) return porNome;
    const cadastrado = funcionarioPorPergunta(ctx, q);
    if (cadastrado) return cadastrado;
    return nome.length >= 3 ? { id: '', nome, origemHistorica: true } : null;
  }

  function idsFuncionario(func) {
    return [func?.id, func?.uid, func?.userId, func?.usuarioId, func?.fid, func?.usuario, func?.login]
      .map(v => String(v || '').trim())
      .filter(Boolean);
  }

  function nomeCombinaFuncionario(valor, func) {
    const alvo = norm(func?.nome || func?.usuario || func?.apelido || '').trim();
    const hay = norm(valor).trim();
    if (!alvo || !hay) return false;
    if (hay.includes(alvo) || alvo.includes(hay)) return true;
    const tokens = alvo.split(/\s+/).filter(t => t.length >= 3);
    return tokens.length >= 2 && tokens.every(t => hay.includes(t));
  }

  function idCombinaFuncionario(valor, func) {
    const id = String(valor || '').trim();
    return !!id && idsFuncionario(func).includes(id);
  }

  function osAtribuidaFuncionario(os, func) {
    const ids = [
      os?.mecId, os?.mecanicoId, os?.responsavelId, os?.funcionarioId, os?.colaboradorId, os?.executorId,
      ...(Array.isArray(os?.mecIds) ? os.mecIds : []),
      ...(Array.isArray(os?.mecanicos) ? os.mecanicos.map(m => m?.id || m?.mecId) : []),
      ...(Array.isArray(os?.servicos) ? os.servicos.map(s => s?.mecId || s?.mecanicoId || s?.responsavelId) : [])
    ];
    if (ids.some(v => idCombinaFuncionario(v, func))) return true;
    return [
      os?.mecNome, os?.mecanicoNome, os?.mecanico, os?.responsavelNome, os?.responsavel, os?.executorNome,
      ...(Array.isArray(os?.mecanicos) ? os.mecanicos.map(m => m?.nome || m?.mecNome) : []),
      ...(Array.isArray(os?.servicos) ? os.servicos.map(s => s?.mecNome || s?.mecanicoNome || s?.responsavelNome) : [])
    ]
      .some(v => nomeCombinaFuncionario(v, func));
  }

  function itemPertenceFuncionario(item, func, os) {
    const itemIds = [item?.mecId, item?.mecanicoId, item?.responsavelId].filter(Boolean);
    const itemNomes = [item?.mecNome, item?.mecanicoNome, item?.responsavelNome].filter(Boolean);
    if (itemIds.length || itemNomes.length) {
      return itemIds.some(v => idCombinaFuncionario(v, func)) || itemNomes.some(v => nomeCombinaFuncionario(v, func));
    }
    const idsOS = [
      os?.mecId,
      ...(Array.isArray(os?.mecIds) ? os.mecIds : []),
      ...(Array.isArray(os?.mecanicos) ? os.mecanicos.map(m => m?.id || m?.mecId) : [])
    ].filter(Boolean);
    return idsOS.length <= 1 && osAtribuidaFuncionario(os, func);
  }

  function autoriaRegistroFuncionario(registro, func, osAtribuida) {
    const ids = [
      registro?.atualizadoPorId, registro?.usuarioId, registro?.mecId, registro?.mecanicoId,
      registro?.responsavelId, registro?.executorId, registro?.funcionarioId, registro?.colaboradorId
    ].filter(Boolean);
    const nomes = [
      registro?.atualizadoPor, registro?.usuario, registro?.user, registro?.por,
      registro?.mecNome, registro?.mecanicoNome, registro?.responsavel, registro?.executorNome
    ].filter(Boolean);
    if (ids.length || nomes.length) {
      return ids.some(v => idCombinaFuncionario(v, func)) || nomes.some(v => nomeCombinaFuncionario(v, func));
    }
    return osAtribuida;
  }

  function dataPrincipalOS(os) {
    return os?.data || os?.dataEntrada || os?.entrada || os?.createdAt || os?.updatedAt || '';
  }

  function itensOrcamentoParaIA(os, ctx) {
    const U = W.JOS || W.JarvisOSUtils || {};
    const cliente = (Array.isArray(ctx?.clientes) ? ctx.clientes : []).find(c => c.id === os?.clienteId) || null;
    const itens = U.buildBudgetItems?.(os, cliente);
    if (Array.isArray(itens) && itens.length) return itens;
    return (Array.isArray(os?.servicos) ? os.servicos : []).map((s, index) => ({
      key: `servico-${index}`,
      tipo: 'servico',
      desc: s?.desc || s?.descricao || s?.nome || '',
      valorFinal: num(s?.valorFinal ?? s?.total ?? s?.valor ?? s?.valorBruto ?? 0),
      mecId: s?.mecId || s?.mecanicoId || s?.responsavelId || '',
      mecNome: s?.mecNome || s?.mecanicoNome || s?.responsavelNome || ''
    }));
  }

  function osFinalizadaParaComissao(os) {
    const status = norm(os?.status || '').replace(/[_-]+/g, ' ');
    return /\b(pronto|entregue|concluido|finalizado|faturado|pronto retirada)\b/.test(status);
  }

  function somarValoresServicos(lista) {
    return +((Array.isArray(lista) ? lista : []).reduce((soma, item) => soma + num(item?.valor), 0)).toFixed(2);
  }

  function servicosFuncionarioNaOS(os, func, periodo, ctx) {
    const atribuida = osAtribuidaFuncionario(os, func);
    const U = W.JOS || W.JarvisOSUtils || {};
    const itensServico = itensOrcamentoParaIA(os, ctx).filter(it => norm(it?.tipo).includes('servico'));
    const mapa = new Map(itensServico.map(it => [String(it.key || ''), it]));
    const confirmados = [];
    Object.entries(os?.execucaoItens || {}).forEach(([key, registro]) => {
      const status = norm(registro?.status || '');
      if (!/^(executado|executado obs|concluido|finalizado|feito|realizado)$/.test(status.replace(/[_-]+/g, ' '))) return;
      const item = mapa.get(String(key)) || {};
      if (!norm(item?.tipo || registro?.tipo || '').includes('servico')) return;
      if (!autoriaRegistroFuncionario(registro, func, atribuida)) return;
      if (!itemPertenceFuncionario(Object.assign({}, item, {
        mecId: registro?.mecId || registro?.responsavelId || item?.mecId,
        mecNome: registro?.mecNome || registro?.responsavelNome || item?.mecNome
      }), func, os)) return;
      const dataExecucao = registro?.atualizadoEm || registro?.updatedAt || registro?.data || registro?.em || dataPrincipalOS(os);
      if (!periodoContem(periodo, dataExecucao)) return;
      const desc = item?.desc || registro?.desc || registro?.descricao || key;
      if (desc) {
        confirmados.push({
          key: String(key),
          desc,
          valor: num(item?.valorFinal ?? item?.total ?? item?.valorBruto ?? item?.valorUnit ?? registro?.valor ?? 0),
          status: registro?.status || 'executado',
          data: dataISO(dataExecucao)
        });
      }
    });
    const unicosConfirmados = Array.from(new Map(confirmados.map(s => [`${s.key}|${s.data}`, s])).values());
    const registrados = [];
    if (!unicosConfirmados.length && atribuida && periodoContem(periodo, dataPrincipalOS(os))) {
      const temAprovacao = typeof U.hasApproval === 'function'
        ? U.hasApproval(os)
        : !!((os?.aprovacao && Array.isArray(os.aprovacao.itens)) || Array.isArray(os?.itensAprovados));
      const aprovados = typeof U.getApprovedKeys === 'function'
        ? U.getApprovedKeys(os)
        : new Set((os?.itensAprovados || []).map(item => typeof item === 'string' ? item : item?.key).filter(Boolean));
      itensServico.forEach(item => {
        if (temAprovacao && !aprovados.has(item.key)) return;
        if (!itemPertenceFuncionario(item, func, os)) return;
        const desc = item?.desc || '';
        if (!desc) return;
        registrados.push({
          key: String(item.key || ''),
          desc,
          valor: num(item?.valorFinal ?? item?.total ?? item?.valorBruto ?? item?.valorUnit ?? 0)
        });
      });
    }
    const legadoFinalizado = !unicosConfirmados.length && registrados.length > 0 && osFinalizadaParaComissao(os);
    return {
      confirmados: unicosConfirmados,
      registrados,
      legadoFinalizado,
      totalConfirmado: somarValoresServicos(unicosConfirmados),
      totalRegistrado: somarValoresServicos(registrados)
    };
  }

  function evidenciaAtendimentoFuncionario(os, func, periodo) {
    const atribuida = osAtribuidaFuncionario(os, func);
    if (atribuida && periodoContem(periodo, dataPrincipalOS(os))) return true;
    const execucao = Object.values(os?.execucaoItens || {}).some(registro => {
      const data = registro?.atualizadoEm || registro?.updatedAt || registro?.data || registro?.em;
      return autoriaRegistroFuncionario(registro, func, atribuida) && periodoContem(periodo, data);
    });
    if (execucao) return true;
    return (Array.isArray(os?.timeline) ? os.timeline : []).some(evento => {
      const autor = evento?.user || evento?.usuario || evento?.por || evento?.atualizadoPor || '';
      const data = evento?.dt || evento?.data || evento?.createdAt || evento?.ts;
      return nomeCombinaFuncionario(autor, func) && periodoContem(periodo, data);
    });
  }

  function responderAtendimentosFuncionarioPeriodo(texto, q, ctx, opts) {
    const periodo = extrairPeriodoPergunta(texto);
    if (!periodo) return null;
    if (!/\b(mecanico|funcionario|colaborador|responsavel)\b/.test(q)) return null;
    if (!/(atendeu|atendimento|realizou|executou|trabalhou|servico|servicos|veiculo|veiculos|o\.?s\.?|ordem|ordens|comiss|relatorio|valor|valores|total)/.test(q)) return null;
    const func = funcionarioDaPerguntaOperacional(ctx, texto, q);
    if (!func) return 'Informe o nome do mec&acirc;nico para consultar os atendimentos por per&iacute;odo.';
    const lista = ctx.os
      .filter(os => evidenciaAtendimentoFuncionario(os, func, periodo))
      .map(os => ({ os, servicos: servicosFuncionarioNaOS(os, func, periodo, ctx) }))
      .sort((a, b) => dataISO(dataPrincipalOS(a.os)).localeCompare(dataISO(dataPrincipalOS(b.os))));
    const nome = func.nome || func.usuario || func.id || 'mec&acirc;nico';
    if (!lista.length) {
      return `N&atilde;o encontrei atendimento de <strong>${esc(nome)}</strong> entre ${esc(dataBR(periodo.inicio))} e ${esc(dataBR(periodo.fim))} nos dados carregados.`;
    }
    const veiculosUnicos = new Set(lista.map(({ os }) => os.veiculoId || placaOS(ctx, os) || os.id));
    const podeVerValores = podeFinanceiro(opts);
    const percentualRaw = func?.comissaoServico ?? func?.comissao;
    const percentualCadastrado = percentualRaw != null && String(percentualRaw).trim() !== '';
    const percentualComissao = percentualCadastrado ? num(percentualRaw) : null;
    const linhas = lista.map(({ os, servicos }) => {
      const veiculo = veiculoDeOS(ctx, os);
      const placa = placaOS(ctx, os) || '-';
      const modelo = veiculo.modelo || os.veiculoSnapshot?.modelo || os.veiculoModelo || os.veiculo || os.tipoVeiculo || '-';
      const osNumero = String(os.numero || os.id || '').slice(-6).toUpperCase();
      const data = dataBR(dataPrincipalOS(os));
      const confirmados = servicos.confirmados.length
        ? [
            '<br>&nbsp;&nbsp;<strong>Servi&ccedil;os confirmados como executados:</strong>',
            servicos.confirmados.map(s => `<br>&nbsp;&nbsp;- ${esc(s.desc)}${podeVerValores ? `: <strong>${moeda(s.valor)}</strong>` : ''}`).join(''),
            podeVerValores ? `<br>&nbsp;&nbsp;<strong>Subtotal confirmado da O.S.: ${moeda(servicos.totalConfirmado)}</strong>` : ''
          ].join('')
        : '';
      const legados = servicos.registrados.length
        ? [
            `<br>&nbsp;&nbsp;<strong>${servicos.legadoFinalizado
              ? 'Servi&ccedil;os de O.S. finalizada sem confirma&ccedil;&atilde;o individual (regra legada):'
              : 'Servi&ccedil;os somente registrados/or&ccedil;ados, fora da base de comiss&atilde;o:'}</strong>`,
            servicos.registrados.map(s => `<br>&nbsp;&nbsp;- ${esc(s.desc)}${podeVerValores ? `: <strong>${moeda(s.valor)}</strong>` : ''}`).join(''),
            podeVerValores
              ? `<br>&nbsp;&nbsp;<strong>Subtotal ${servicos.legadoFinalizado ? 'legado finalizado' : 'informativo'} da O.S.: ${moeda(servicos.totalRegistrado)}</strong>`
              : ''
          ].join('')
        : (!confirmados ? '<br>&nbsp;&nbsp;Nenhum servi&ccedil;o executado foi identificado nesta O.S.' : '');
      return `- ${esc(data)} | ${esc(placa)} | ${esc(modelo)} | O.S. #${esc(osNumero)} | ${esc(os.status || '-')}${confirmados}${legados}`;
    });
    const totalConfirmado = +lista.reduce((soma, item) => soma + num(item.servicos.totalConfirmado), 0).toFixed(2);
    const totalLegadoFinalizado = +lista
      .filter(item => item.servicos.legadoFinalizado)
      .reduce((soma, item) => soma + num(item.servicos.totalRegistrado), 0)
      .toFixed(2);
    const totalSomenteOrcado = +lista
      .filter(item => !item.servicos.legadoFinalizado)
      .reduce((soma, item) => soma + num(item.servicos.totalRegistrado), 0)
      .toFixed(2);
    const baseComissao = +(totalConfirmado + totalLegadoFinalizado).toFixed(2);
    const valorComissao = percentualComissao == null
      ? null
      : +(baseComissao * (percentualComissao / 100)).toFixed(2);
    const resumoComissao = podeVerValores ? [
      '<br><strong>Resumo para comiss&atilde;o:</strong>',
      `<br>- M&atilde;o de obra com execu&ccedil;&atilde;o confirmada: <strong>${moeda(totalConfirmado)}</strong>`,
      `<br>- M&atilde;o de obra de O.S. finalizada legada: <strong>${moeda(totalLegadoFinalizado)}</strong>`,
      `<br>- Base total considerada para comiss&atilde;o: <strong>${moeda(baseComissao)}</strong>`,
      totalSomenteOrcado > 0
        ? `<br>- Servi&ccedil;os apenas or&ccedil;ados/sem finaliza&ccedil;&atilde;o, exclu&iacute;dos da comiss&atilde;o: <strong>${moeda(totalSomenteOrcado)}</strong>`
        : '',
      percentualComissao == null
        ? '<br>- Percentual de comiss&atilde;o: <strong>n&atilde;o localizado no cadastro do colaborador</strong>'
        : `<br>- Percentual de comiss&atilde;o sobre m&atilde;o de obra: <strong>${esc(percentualComissao.toLocaleString('pt-BR'))}%</strong>`,
      valorComissao == null
        ? '<br>- Comiss&atilde;o a pagar: <strong>n&atilde;o calculada; cadastre o percentual do colaborador</strong>'
        : `<br>- Comiss&atilde;o calculada: <strong>${moeda(valorComissao)}</strong>`
    ].join('') : '';
    return [
      `<strong>Atendimentos de ${esc(nome)} de ${esc(dataBR(periodo.inicio))} at&eacute; ${esc(dataBR(periodo.fim))}:</strong>`,
      `${lista.length} O.S. em ${veiculosUnicos.size} ve&iacute;culo(s).`,
      linhas.join('<br><br>'),
      resumoComissao,
      '<br><small>Crit&eacute;rio: execu&ccedil;&atilde;o individual confirmada tem prioridade. O.S. legadas sem marca&ccedil;&atilde;o individual s&atilde;o identificadas separadamente para n&atilde;o afirmar servi&ccedil;o sem prova.</small>'
    ].join('<br>');
  }

  function extrairPlaca(txt) {
    const m = String(txt || '').match(/[A-Z]{3}[-\s]?\d[A-Z0-9]\d{2}/i);
    return m ? placaLimpa(m[0]) : '';
  }

  function clienteDeOS(ctx, os) {
    return ctx.clientes.find(c => c.id === os?.clienteId) || {};
  }

  function clienteTextoOS(ctx, os) {
    const c = clienteDeOS(ctx, os);
    return textoLivre(Object.assign({}, c || {}, os || {}), [
      'id','nome','razaoSocial','fantasia','apelido','cpf','cnpj','cliente','clienteNome','nomeCliente','clienteRazao',
      'clienteId','responsavel','contato','telefone','celular','placa','veiculo'
    ]);
  }

  function clienteFiltroDaPergunta(texto, q, ctx) {
    const raw = String(texto || '');
    let termo = '';
    const aspas = raw.match(/["“”']([^"“”']{2,80})["“”']/);
    if (aspas) termo = aspas[1];
    if (!termo) {
      const m = raw.match(/cliente\s+(.+?)(?:\s+(?:foram|foi|forao|tem|estao|está|entreg|sem|com|que|quais|quantos|quantas|do|da|depois)|[?.!,]|$)/i);
      if (m) termo = m[1];
    }
    termo = norm(termo).replace(/^(o|a|os|as|do|da|de|dos|das)\s+/, '').trim();

    let melhor = null;
    let melhorScore = 0;
    (Array.isArray(ctx.clientes) ? ctx.clientes : []).forEach(c => {
      const nome = norm([c.nome, c.razaoSocial, c.fantasia, c.apelido, c.cpf, c.cnpj].filter(Boolean).join(' '));
      if (!nome) return;
      let score = 0;
      if (termo && nome.includes(termo)) score += termo.length + 20;
      const tokensNome = nome.split(/\s+/).filter(t => t.length >= 3);
      tokensNome.forEach(t => { if (q.includes(t)) score += t.length; });
      if (score > melhorScore) { melhor = c; melhorScore = score; }
    });

    if (melhor && melhorScore >= 4) {
      const alvo = norm([melhor.nome, melhor.razaoSocial, melhor.fantasia, melhor.apelido, melhor.cpf, melhor.cnpj, melhor.id].filter(Boolean).join(' '));
      return { cliente: melhor, termo: alvo, label: melhor.nome || melhor.razaoSocial || melhor.fantasia || melhor.id || 'cliente' };
    }

    if (termo && termo.length >= 3) return { cliente: null, termo, label: termo };
    return null;
  }

  function filtrarOSPorClientePergunta(ctx, lista, texto, q) {
    if (!/cliente|clientes|frota|empresa|batalhao|batalhão|policia|polícia/i.test(texto)) return { lista, filtro: null };
    const filtro = clienteFiltroDaPergunta(texto, q, ctx);
    if (!filtro || !filtro.termo) return { lista, filtro: null };
    const termos = filtro.termo.split(/\s+/).filter(t => t.length >= 3);
    const filtrada = lista.filter(o => {
      const cliente = clienteDeOS(ctx, o);
      if (filtro.cliente && (String(o.clienteId || '') === String(filtro.cliente.id || '') || String(o.cliente?.id || '') === String(filtro.cliente.id || ''))) return true;
      const hay = norm(clienteTextoOS(ctx, o));
      if (hay.includes(filtro.termo)) return true;
      return termos.length && termos.every(t => hay.includes(t));
    });
    return { lista: filtrada, filtro };
  }

  function veiculoDeOS(ctx, os) {
    return ctx.veiculos.find(v => v.id === os?.veiculoId) || {};
  }

  function placaOS(ctx, os) {
    return placaLimpa(os?.placa || veiculoDeOS(ctx, os)?.placa || '');
  }

  function osMatchesPlaca(ctx, placa) {
    const p = placaLimpa(placa);
    if (!p) return [];
    return ctx.os.filter(o => placaOS(ctx, o) === p);
  }

  function itemExecucao(os, item) {
    const key = item?.key || item?.id || '';
    const e = key && os?.execucaoItens ? os.execucaoItens[key] : null;
    return e?.status || '';
  }

  function resumoOS(ctx, o, opts) {
    const c = clienteDeOS(ctx, o);
    const v = veiculoDeOS(ctx, o);
    const placa = placaOS(ctx, o) || '-';
    const partes = [
      `<strong>O.S. #${esc(String(o.numero || o.id || '').slice(-6).toUpperCase())}</strong>`,
      `placa ${esc(placa)}`,
      `status ${esc(o.status || '-')}`,
      `cliente ${esc(c.nome || o.cliente || '-')}`,
      `veiculo ${esc(v.modelo || o.veiculo || o.tipoVeiculo || '-')}`,
      `entrada ${esc(o.data || String(o.createdAt || '').slice(0, 10) || '-')}`
    ];
    if (opts?.comDiagnostico !== false && (o.desc || o.diagnostico)) {
      partes.push(`relato/diag: ${esc([o.desc, o.diagnostico].filter(Boolean).join(' | '))}`);
    }
    if (opts?.comValores && podeFinanceiro(opts)) partes.push(`total ${moeda(o.total || o.totalAprovado || 0)}`);
    return partes.join(' | ');
  }


  function valorOS(o) {
    return num(o?.totalAprovado || o?.total || o?.valorTotal || o?.valor || o?.orcamentoTotal || 0);
  }

  function financeiroMatchesOS(ctx, f, o) {
    if (!f || !o) return false;
    const txtF = norm(textoFinanceiro(f));
    const osId = norm(o.id || '');
    const osNum = norm(o.numero || '');
    const placa = norm(placaOS(ctx, o));
    const cliente = norm(clienteDeOS(ctx, o)?.nome || o.cliente || '');
    if (osId && txtF.includes(osId)) return true;
    if (osNum && txtF.includes(osNum)) return true;
    if (placa && txtF.includes(placa)) return true;
    if (cliente && cliente.length >= 4 && txtF.includes(cliente)) return true;
    return false;
  }

  function financeiroDaOS(ctx, o) {
    return ctx.financeiro.filter(f => financeiroMatchesOS(ctx, f, o));
  }

  function resumoRecebimentoOS(ctx, o) {
    const fins = financeiroDaOS(ctx, o);
    const pagos = fins.filter(f => isPagoStatus(f.status));
    const pendentes = fins.filter(f => isPendenteStatus(f.status));
    const totalPago = pagos.reduce((s, f) => s + num(f.valor || f.total || 0), 0);
    const totalPendente = pendentes.reduce((s, f) => s + num(f.valor || f.total || 0), 0);
    const totalOS = valorOS(o);
    const semRecebimento = totalOS > 0
      ? totalPago <= 0 && totalPendente <= 0
      : (!pagos.length && !pendentes.length);
    return { fins, pagos, pendentes, totalPago, totalPendente, totalOS, semRecebimento };
  }

  function resumoFaturamentoOS(ctx, o) {
    const fins = financeiroDaOS(ctx, o);
    const txtOS = norm(textoLivre(o, [
      'id','numero','status','faturado','nfEmitida','notaEmitida','nfeEmitida','numeroNF','nfNumero','nfeNumero','notaFiscal',
      'fatura','faturaId','documentoFiscal','financeiroGerado','orcamentoFaturado','cliente','clienteNome','placa'
    ]));
    const temFlagOS = o?.faturado === true || o?.nfEmitida === true || o?.notaEmitida === true || o?.nfeEmitida === true ||
      !!(o?.numeroNF || o?.nfNumero || o?.nfeNumero || o?.notaFiscal || o?.fatura || o?.faturaId || o?.documentoFiscal || o?.financeiroGerado || o?.orcamentoFaturado);
    const finsFaturamento = fins.filter(f => /receb|entrada|fatur|cliente|orcamento|orçamento|os|o\.s|nota|nf|nfe/.test(tipoFinanceiro(f) + ' ' + norm(textoFinanceiro(f))));
    const temTextoFaturado = /faturad|nf emitid|nota emitid|nfe emitid|fatura/.test(txtOS) && !/nao faturad|não faturad|sem fatur/.test(txtOS);
    const temFaturamento = !!temFlagOS || !!temTextoFaturado || finsFaturamento.length > 0;
    return { temFaturamento, semFaturamento: !temFaturamento, finsFaturamento };
  }

  function statusNormalizadoOS(o) {
    return norm(o?.status || '');
  }

  function isEntregueOS(o) {
    return /entreg|finaliz|concluid/.test(statusNormalizadoOS(o));
  }

  function isCanceladaOS(o) {
    return /cancel|recus/.test(statusNormalizadoOS(o));
  }

  function isAbertaOS(o) {
    return !isEntregueOS(o) && !isCanceladaOS(o);
  }

  function responderVeiculosOSOperacional(texto, q, ctx, opts) {
    const falaOS = /\b(o\.?s\.?|os|ordem|ordens|veiculo|veiculos|patio|pátio)\b/.test(q);
    if (!falaOS) return null;
    const querReceb = /receb|pago|pagas|pagos|pagamento|sem recebimento|sem receber|sem pagar/.test(q);
    const querFatur = /fatur|nota emitid|nf emitid|nfe emitid|sem nota|sem nf/.test(q);
    const querEntregue = /entreg|fechad|finaliz|concluid/.test(q);
    const querPatio = /patio|pátio|abert|abertas|andamento|aprovad|orcamento|orçamento|triagem|pronto/.test(q);
    const querHoje = /\bhoje\b/.test(q);
    let lista = ctx.os.slice();

    if (querEntregue) lista = lista.filter(isEntregueOS);
    else if (querPatio || /\bveiculos?\b/.test(q)) lista = lista.filter(isAbertaOS);

    const clienteFiltroAplicado = filtrarOSPorClientePergunta(ctx, lista, texto, q);
    lista = clienteFiltroAplicado.lista;

    if (querReceb || querFatur) {
      lista = lista.filter(o => {
        const r = resumoRecebimentoOS(ctx, o);
        const fat = resumoFaturamentoOS(ctx, o);
        const pedeSemReceber = /sem recebimento|sem receber|sem pagamento|sem pagar/.test(q);
        const pedeSemFaturar = /sem fatur|nao fatur|não fatur|sem nota|sem nf/.test(q);
        if (pedeSemReceber && pedeSemFaturar) return r.semRecebimento || r.totalPendente > 0 || fat.semFaturamento;
        if (pedeSemReceber) return r.semRecebimento || r.totalPendente > 0;
        if (pedeSemFaturar) return fat.semFaturamento;
        if (querFatur) return fat.temFaturamento || fat.semFaturamento;
        return r.fins.length || r.totalOS > 0;
      });
    }

    if (querHoje) {
      const hoje = hojeISO();
      lista = lista.filter(o => String(o.data || o.createdAt || o.updatedAt || '').slice(0, 10) === hoje);
    }

    if (!querPatio && !querEntregue && !querReceb && !querFatur && !/\b(os|o\.s\.)\b/.test(q)) return null;

    lista = lista.sort((a, b) => String(b.updatedAt || b.createdAt || b.data || '').localeCompare(String(a.updatedAt || a.createdAt || a.data || '')));

    if (!lista.length) {
      if (querReceb && querEntregue) return 'Não encontrei veículo entregue sem recebimento nos dados carregados.';
      if (querReceb) return 'Não encontrei O.S. sem recebimento nos dados carregados.';
      if (querEntregue) return 'Não encontrei veículo entregue/fechado nos dados carregados.';
      return 'Não encontrei O.S. nessa condição nos dados carregados.';
    }

    const tituloBase = querFatur && querReceb && querEntregue
      ? 'Veículos entregues sem faturar e/ou sem receber'
      : querFatur && querEntregue
        ? 'Veículos entregues sem faturar / sem NF'
        : querReceb && querEntregue
          ? 'Veículos entregues com pendência/sem recebimento'
          : querFatur
            ? 'O.S. sem faturamento/NF identificado'
            : querReceb
              ? 'O.S. com pendência/sem recebimento'
              : querEntregue
                ? 'Veículos entregues / O.S. fechadas'
                : 'Veículos no pátio / O.S. abertas';
    const titulo = clienteFiltroAplicado.filtro?.label ? `${tituloBase} — cliente ${esc(clienteFiltroAplicado.filtro.label)}` : tituloBase;

    const totalValor = lista.reduce((s, o) => s + valorOS(o), 0);
    const linhas = lista.slice(0, 30).map(o => {
      const r = resumoRecebimentoOS(ctx, o);
      const base = resumoOS(ctx, o, Object.assign({}, opts, { comDiagnostico: false, comValores: podeFinanceiro(opts) }));
      const fat = resumoFaturamentoOS(ctx, o);
      const rec = podeFinanceiro(opts)
        ? ` | recebido ${moeda(r.totalPago)} | pendente ${moeda(r.totalPendente)} | ${fat.temFaturamento ? 'faturado/NF localizado' : 'sem faturamento/NF localizado'}`
        : '';
      const prisma = String(o.prisma || o.numeroPrisma || '').trim();
      const prismaTxt = prisma && !isEntregueOS(o) ? ` | prisma ${esc(prisma)}` : '';
      return `- ${base}${prismaTxt}${rec}`;
    });

    const cab = `<strong>${titulo} (${lista.length}):</strong>`;
    const rod = podeFinanceiro(opts) ? `<br><br><strong>Total orçado/aprovado listado:</strong> ${moeda(totalValor)}` : '';
    return `${cab}<br>${linhas.join('<br>')}${rod}`;
  }

  function linhasExecucao(os) {
    const U = W.JOS || W.JarvisOSUtils || {};
    const itens = U.buildBudgetItems?.(os, null) || [];
    if (!itens.length) return '';
    const keys = U.getApprovedKeys?.(os) || new Set(os?.itensAprovados || []);
    const aprovados = itens.filter(it => keys.has(it.key)).slice(0, 12).map(it => {
      const st = itemExecucao(os, it) || 'pendente';
      return `- ${esc(it.labelTipo || it.tipo || 'item')}: ${esc(it.desc || '-')} | execucao ${esc(st)}`;
    }).join('<br>');
    if (!aprovados) return '';
    return `<br><br><strong>Itens aprovados/executados:</strong><br>${aprovados}`;
  }

  function normalizeBrainJson(raw, fallback) {
    let obj = raw;
    if (typeof raw === 'string') {
      const txt = raw.trim();
      if (!txt) obj = {};
      else obj = JSON.parse(txt);
    }
    obj = obj && typeof obj === 'object' ? obj : {};
    const comportamento = Object.assign({
      tom: 'direto',
      permitirPiadas: false
    }, obj.comportamento || {});
    const escopo = ['global', 'tenant'].includes(String(obj.escopo || '').toLowerCase())
      ? String(obj.escopo).toLowerCase()
      : (fallback?.escopo || 'tenant');
    return {
      versao: Number(obj.versao || 1),
      escopo,
      comportamento: {
        tom: ['direto', 'tecnico', 'brincalhao'].includes(norm(comportamento.tom)) ? norm(comportamento.tom) : 'direto',
        permitirPiadas: comportamento.permitirPiadas === true
      },
      contexto: obj.contexto || fallback?.contexto || '',
      catalogos: obj.catalogos || fallback?.catalogos || '',
      erros: obj.erros || fallback?.erros || '',
      regras: asArray(obj.regras || fallback?.regras),
      procedimentos: asArray(obj.procedimentos || fallback?.procedimentos),
      diagnosticos: asArray(obj.diagnosticos || fallback?.diagnosticos),
      conhecimento: asArray(obj.conhecimento || fallback?.conhecimento),
      fontes: asArray(obj.fontes || fallback?.fontes),
      pendenciasConhecimento: asArray(obj.pendenciasConhecimento || obj.pendencias || fallback?.pendenciasConhecimento),
      duvidasResolvidas: asArray(obj.duvidasResolvidas || fallback?.duvidasResolvidas),
      conflitosConhecimento: asArray(obj.conflitosConhecimento || fallback?.conflitosConhecimento),
      atualizadoEm: obj.atualizadoEm || new Date().toISOString()
    };
  }

  function brainLocal() {
    const ofi = (typeof W.thiaGetOficinaAtual === 'function' ? W.thiaGetOficinaAtual() : null) || getJ().oficina || {};
    const base = ofi.brain || ofi.cerebro || ofi.thiaguinhoBrain || {};
    try { return normalizeBrainJson(base, { escopo: 'tenant' }); }
    catch (_) { return normalizeBrainJson({}, { escopo: 'tenant' }); }
  }

  function brainGlobal() {
    try {
      const raw = sessionStorage.getItem('thia_cerebro_global') || localStorage.getItem('thia_cerebro_global') || '';
      return raw ? normalizeBrainJson(raw, { escopo: 'global' }) : null;
    } catch (_) {
      return null;
    }
  }

  async function carregarCerebroGlobal() {
    if (W._thiaCerebroGlobalCarregado) return brainGlobal();
    W._thiaCerebroGlobalCarregado = true;
    try {
      const cdb = typeof W.initCentralFirebase === 'function' ? W.initCentralFirebase() : null;
      if (!cdb) return brainGlobal();
      const doc = await cdb.collection('cerebros_ia').doc('global').get();
      if (doc.exists) {
        const data = normalizeBrainJson(doc.data(), { escopo: 'global' });
        sessionStorage.setItem('thia_cerebro_global', JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn('[thIAguinho IA] cerebro global nao carregado:', e.message || e);
    }
    return brainGlobal();
  }

  function juntarBrain() {
    const tenant = brainLocal();
    const global = brainGlobal();
    const comportamento = Object.assign({}, global?.comportamento || {}, tenant?.comportamento || {});
    return {
      comportamento: {
        tom: comportamento.tom || 'direto',
        permitirPiadas: comportamento.permitirPiadas === true
      },
      conhecimento: [...asArray(global?.conhecimento), ...asArray(tenant?.conhecimento)],
      regras: [...asArray(global?.regras), ...asArray(tenant?.regras)],
      procedimentos: [...asArray(global?.procedimentos), ...asArray(tenant?.procedimentos)],
      diagnosticos: [...asArray(global?.diagnosticos), ...asArray(tenant?.diagnosticos)],
      pendenciasConhecimento: [...asArray(global?.pendenciasConhecimento), ...asArray(tenant?.pendenciasConhecimento)],
      duvidasResolvidas: [...asArray(global?.duvidasResolvidas), ...asArray(tenant?.duvidasResolvidas)],
      textos: uniq([
        global?.contexto, global?.catalogos, global?.erros,
        tenant?.contexto, tenant?.catalogos, tenant?.erros
      ])
    };
  }

  function itemTexto(item) {
    if (item == null) return '';
    if (typeof item === 'string') return item;
    return [
      item.titulo, item.nome, item.marca, item.modelo, item.motor, item.sistema,
      item.placa, item.defeito, item.problema, item.solucao, item.texto,
      item.descricao, item.resposta, Array.isArray(item.codigos) ? item.codigos.join(' ') : '',
      item.fonte && item.fonte.arquivo ? item.fonte.arquivo : ''
    ]
      .filter(Boolean).join(' | ');
  }

  function buscarNoCerebro(q) {
    const tenant = brainLocal();
    const global = brainGlobal();
    const termos = norm(q).split(/\s+/).filter(t => t.length >= 4);
    const montar = (arr, tipo, prio) => asArray(arr).map(x => ({ tipo, txt: itemTexto(x), prio }));
    const textos = (brain, prio) => [brain?.contexto, brain?.catalogos, brain?.erros]
      .filter(Boolean).map(x => ({ tipo: 'Contexto', txt: x, prio }));
    const fontes = [
      ...montar(tenant?.conhecimento, 'Conhecimento da oficina', 2),
      ...montar(tenant?.diagnosticos, 'Diagnostico da oficina', 2),
      ...montar(tenant?.procedimentos, 'Procedimento da oficina', 2),
      ...montar(tenant?.regras, 'Regra da oficina', 2),
      ...textos(tenant, 2),
      ...montar(global?.conhecimento, 'Conhecimento global', 1),
      ...montar(global?.diagnosticos, 'Diagnostico global', 1),
      ...montar(global?.procedimentos, 'Procedimento global', 1),
      ...montar(global?.regras, 'Regra global', 1),
      ...textos(global, 1)
    ].filter(x => x.txt);
    const achados = fontes.map(f => {
      const n = norm(f.txt);
      const score = termos.reduce((s, t) => s + (n.includes(t) ? 1 : 0), 0);
      return Object.assign({ score }, f);
    }).filter(x => x.score > 0).sort((a, b) => (b.score - a.score) || (b.prio - a.prio)).slice(0, 6);
    return achados;
  }

  function aplicarComportamento(html) {
    const b = juntarBrain();
    if (b.comportamento.permitirPiadas && b.comportamento.tom === 'brincalhao') {
      return html + '<br><br><small>Pra descontrair: se o carro tossiu, eu nao passo xarope, passo scanner.</small>';
    }
    return html;
  }

  function responderSuperadmin(pergunta) {
    const q = norm(pergunta);
    const tenants = Array.isArray(W.allTenants) ? W.allTenants : [];
    if (!tenants.length) return null;
    const ativos = tenants.filter(t => t.status === 'Online').length;
    const bloqueados = tenants.filter(t => t.status === 'Bloqueado').length;
    const modCount = nome => tenants.filter(t => t.modulos?.[nome] !== false).length;
    if (/tenant|oficina|modulo|licenca|bloquead|online|resumo|saas/.test(q)) {
      return aplicarComportamento([
        `<strong>Resumo Superadmin:</strong> ${tenants.length} tenant(s), ${ativos} online, ${bloqueados} bloqueado(s).`,
        `Modulos liberados: O.S. ${modCount('os')}, Financeiro ${modCount('financeiro')}, Estoque ${modCount('estoque')}, IA ${modCount('ia')}, Chat ${modCount('chat')}.`,
        `Tenants recentes: ${esc(tenants.slice(0, 12).map(t => `${t.nomeFantasia || t.id} (${t.status || 'sem status'})`).join(' | '))}`
      ].join('<br>'));
    }
    return null;
  }

  function thiaResponderLocal(pergunta, opts) {
    const texto = String(pergunta || '').trim();
    const q = norm(texto);
    const ctx = dataSets(opts);
    const r = role(opts);

    if (!texto) return '';

    if (/superadmin/.test(r) || location.pathname.toLowerCase().includes('superadmin')) {
      const sup = responderSuperadmin(texto);
      if (sup) return sup;
    }

    const respostaDadosPrecisos = responderJarvisDadosPrecisos(texto, q, ctx, opts);
    if (respostaDadosPrecisos) return aplicarComportamento(respostaDadosPrecisos);

    const respostaOSOperacional = responderVeiculosOSOperacional(texto, q, ctx, opts);
    if (respostaOSOperacional) return aplicarComportamento(respostaOSOperacional);

    const placa = extrairPlaca(texto);
    if (placa) {
      const lista = osMatchesPlaca(ctx, placa).sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
      if (!lista.length) return `Nao encontrei O.S. carregada para a placa ${esc(placa)}. Confirme se a placa esta correta ou se os dados ja sincronizaram.`;
      if (/histor|defeit|problema|resolvid|garantia|ja.*fez|troco|trocad|diagnost/.test(q)) {
        const linhas = lista.slice(0, 8).map(o => resumoOS(ctx, o, opts) + linhasExecucao(o));
        return aplicarComportamento(`<strong>Historico da placa ${esc(placa)}:</strong><br>${linhas.join('<br><br>')}`);
      }
      return aplicarComportamento(lista.slice(0, 5).map(o => resumoOS(ctx, o, opts)).join('<br>'));
    }

    if (/histor|defeit|problema|resolvid|garantia|diagnost/.test(q)) {
      const termos = q.split(/\s+/).filter(t => t.length >= 4 && !/histor|defeit|problema|resolvid|garantia|diagnost|geral/.test(t));
      const encontrados = ctx.os.filter(o => {
        const v = veiculoDeOS(ctx, o);
        const hay = norm([o.desc, o.diagnostico, o.status, v.modelo, v.marca, o.veiculo, (o.pecas || []).map(p => p.desc).join(' '), (o.servicos || []).map(s => s.desc).join(' ')].join(' '));
        return termos.length && termos.every(t => hay.includes(t));
      }).slice(0, 10);
      if (encontrados.length) {
        return aplicarComportamento(`<strong>Historico encontrado:</strong><br>${encontrados.map(o => resumoOS(ctx, o, opts) + linhasExecucao(o)).join('<br><br>')}`);
      }
      return 'Para buscar historico tecnico com precisao, informe a placa, modelo ou o defeito principal. Exemplo: "historico da ETR7E65" ou "falhas de arrefecimento do Siena".';
    }

    if (/resumo|geral|painel|patio/.test(q) && /(oficina|geral|hoje|dados|patio|os)/.test(q)) {
      const abertas = ctx.os.filter(o => !/entreg|cancel|recus|finaliz/i.test(String(o.status || '')));
      const estoqueCritico = ctx.estoque.filter(p => num(p.qtd) <= num(p.min || p.minimo || 0));
      const linhas = [
        `<strong>Resumo local do tenant ${esc(ctx.J.tid || '-')}:</strong>`,
        `O.S.: ${ctx.os.length} (${abertas.length} abertas)`,
        `Clientes: ${ctx.clientes.length}`,
        `Veiculos: ${ctx.veiculos.length}`,
        `Estoque: ${ctx.estoque.length} itens (${estoqueCritico.length} criticos)`,
        `Equipe: ${ctx.equipe.length}`
      ];
      if (podeFinanceiro(opts)) linhas.push(`Financeiro: ${ctx.financeiro.length} lancamento(s)`);
      return aplicarComportamento(linhas.join('<br>'));
    }

    if (/estoque|peca|pecas|critico|minimo|comprar/.test(q)) {
      const crit = ctx.estoque.filter(p => num(p.qtd) <= num(p.min || p.minimo || 0));
      if (/critico|minimo|baixo|comprar/.test(q)) {
        if (!crit.length) return 'Nao ha peca abaixo do minimo nos dados carregados.';
        return `<strong>Estoque critico:</strong><br>${crit.slice(0, 25).map(p => `- ${esc(p.codigo ? '[' + p.codigo + '] ' : '')}${esc(p.desc || p.descricao || 'Peca')} | saldo ${esc(p.qtd || 0)} | minimo ${esc(p.min || p.minimo || 0)}`).join('<br>')}`;
      }
      const termos = q.split(/\s+/).filter(t => t.length >= 4);
      const achados = ctx.estoque.filter(p => termos.some(t => norm([p.codigo, p.desc, p.descricao, p.oem, p.ean].join(' ')).includes(t))).slice(0, 20);
      if (!achados.length) return 'Qual peca, codigo ou aplicacao voce quer consultar no estoque?';
      return `<strong>Pecas localizadas:</strong><br>${achados.map(p => `- ${esc(p.codigo || '')} ${esc(p.desc || p.descricao || 'Peca')} | saldo ${esc(p.qtd || 0)}`).join('<br>')}`;
    }

    if (/boleto|conta|titulo|duplicata|financeiro|pix|vencid|vencendo|pagar|receber/.test(q)) {
      if (!podeFinanceiro(opts)) return 'Seu perfil nao tem permissao para consultar financeiro. Posso consultar O.S., historico tecnico, defeitos, veiculos e execucao.';
      const hoje = hojeISO();
      const analiseFinanceira = /analis|analise|resumo|risco|prioridade|dre|atual|geral/.test(q);
      let lista = ctx.financeiro;
      if (/hoje/.test(q)) lista = lista.filter(f => String(f.venc || f.vencimento || '').slice(0, 10) === hoje);
      if (!analiseFinanceira && /vencid|atrasad/.test(q)) lista = lista.filter(f => {
        const venc = String(f.venc || f.vencimento || '').slice(0, 10);
        return venc && venc < hoje && !/pago|liquid|baix|cancel/.test(norm(f.status));
      });
      if (/pix/.test(q) && /parcel/.test(q)) {
        lista = ctx.financeiro.filter(f => /pix/i.test(String(f.pgto || f.forma || '')) && (num(f.pgtoParcelas || f.parcelas || 1) > 1 || /\(\d+\s*\/\s*\d+\)/.test(String(f.desc || ''))));
        if (!lista.length) return 'Nao encontrei PIX parcelado nos dados carregados.';
      }
      if (analiseFinanceira) {
        const vencidos = ctx.financeiro.filter(f => {
          const venc = String(f.venc || f.vencimento || '').slice(0, 10);
          return venc && venc < hoje && !/pago|liquid|baix|cancel/.test(norm(f.status));
        });
        const hojeLista = ctx.financeiro.filter(f => String(f.venc || f.vencimento || '').slice(0, 10) === hoje);
        const pendentes = ctx.financeiro.filter(f => !/pago|liquid|baix|cancel/.test(norm(f.status)));
        const pixParcelado = ctx.financeiro.filter(f => /pix/i.test(String(f.pgto || f.forma || '')) && (num(f.pgtoParcelas || f.parcelas || 1) > 1 || /\(\d+\s*\/\s*\d+\)/.test(String(f.desc || ''))));
        const totalPendente = pendentes.reduce((s, f) => s + num(f.valor), 0);
        const linhas = [
          `<strong>Análise financeira local:</strong> ${ctx.financeiro.length} lançamento(s) carregado(s).`,
          `Pendentes/em aberto: ${pendentes.length} (${moeda(totalPendente)}).`,
          `Vencidos: ${vencidos.length}. Vencendo hoje: ${hojeLista.length}. PIX parcelado suspeito: ${pixParcelado.length}.`
        ];
        const prioridades = [...vencidos, ...hojeLista, ...pixParcelado, ...pendentes]
          .filter((f, i, arr) => arr.findIndex(x => (x.id || x.desc || x.descricao) === (f.id || f.desc || f.descricao)) === i)
          .slice(0, 20);
        if (prioridades.length) linhas.push('<br><strong>Prioridades:</strong><br>' + prioridades.map(f => `- ${esc(f.venc || f.vencimento || '-')} | ${esc(f.desc || f.descricao || 'Lancamento')} | ${moeda(f.valor)} | ${esc(f.status || '-')}`).join('<br>'));
        return linhas.join('<br>');
      }
      if (!lista.length) return 'Nao encontrei lancamento financeiro para essa pergunta nos dados carregados.';
      const total = lista.reduce((s, f) => s + num(f.valor), 0);
      return `<strong>Financeiro localizado (${lista.length}):</strong><br>${lista.slice(0, 25).map(f => `- ${esc(f.venc || f.vencimento || '-')} | ${esc(f.desc || f.descricao || 'Lancamento')} | ${moeda(f.valor)} | ${esc(f.status || '-')}`).join('<br>')}<br><br><strong>Total:</strong> ${moeda(total)}`;
    }

    if (/equipe|mecanico|mecanicos|funcionario|responsavel/.test(q)) {
      if (!ctx.equipe.length) return 'Nao ha equipe carregada nesta sessao.';
      return `<strong>Equipe carregada:</strong><br>${ctx.equipe.slice(0, 30).map(f => `- ${esc(f.nome || f.usuario || f.id)} | ${esc(f.cargo || 'equipe')}`).join('<br>')}`;
    }

    if (/nota fiscal|\bnf\b|xml|fornecedor/.test(q)) {
      if (!ctx.notas.length) return 'Nao ha notas fiscais carregadas nesta sessao.';
      return `<strong>Notas fiscais carregadas:</strong><br>${ctx.notas.slice(0, 20).map(n => `- NF ${esc(n.numero || '-')} | ${esc(n.fornecedorSnapshot?.nome || n.fornecedorNome || '-')} | ${esc(n.dataNF || '-')} | ${moeda(n.totalNF || n.totalItens || 0)}`).join('<br>')}`;
    }

    const brainHits = buscarNoCerebro(texto);
    if (brainHits.length) {
      return aplicarComportamento(`<strong>Base de conhecimento:</strong><br>${brainHits.map(h => `- ${esc(h.tipo)}: ${esc(h.txt).slice(0, 280)}`).join('<br>')}`);
    }

    if (/ajuda|o que voce|o que consegue|comando/.test(q)) {
      return 'Posso responder internamente sobre O.S. por placa, historico de defeitos, problemas resolvidos, estoque, equipe, notas fiscais, pecas vinculadas e, para perfis autorizados, financeiro. Se a pergunta ficar aberta, vou pedir placa, modelo, periodo ou entidade.';
    }

    return 'Preciso de mais contexto para responder com dado verdadeiro. Informe placa, modelo, cliente, periodo ou modulo. Exemplo: "historico da placa ETR7E65", "estoque critico" ou "defeitos recorrentes do Siena".';
  }

  function addUser(txt) {
    if (typeof W._iaMsgUser === 'function') return W._iaMsgUser(txt);
    if (typeof W.adicionarMsgIA === 'function') return W.adicionarMsgIA('user', esc(txt));
    const c = D.getElementById('iaMsgs');
    if (!c) return null;
    const d = D.createElement('div');
    d.className = 'ia-msg user';
    d.textContent = txt;
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
    const c = D.getElementById('iaMsgs');
    if (!c) return null;
    const id = 'ia-local-' + Date.now();
    const d = D.createElement('div');
    d.id = id;
    d.className = 'ia-msg bot';
    d.innerHTML = '<strong>thIAguinho:</strong> ' + html;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
    return id;
  }

  function replaceBot(id, html) {
    if (typeof W._iaReplace === 'function' && id && id !== '__legacy__') return W._iaReplace(id, html);
    const c = D.getElementById('iaMsgs');
    const el = id === '__legacy__' ? c?.lastElementChild : D.getElementById(id);
    if (el) el.innerHTML = '<strong>thIAguinho:</strong> ' + html;
  }

  async function thiaIAAsk(inputId, perfil) {
    const input = D.getElementById(inputId || 'iaInput');
    const msg = input?.value?.trim();
    if (!msg) return;
    input.value = '';
    addUser(msg);
    const lid = addBot('<span class="j-spinner"></span> Consultando dados internos...');
    try { await carregarCerebroGlobal(); } catch (_) {}
    const resp = thiaResponderLocal(msg, { perfil });
    W.iaHistorico.push({ role: 'user', text: msg });
    W.iaHistorico.push({ role: 'model', text: String(resp).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '') });
    replaceBot(lid, resp);
  }

  function setPromptAndAsk(txt, perfil) {
    const el = D.getElementById('iaInput');
    if (el) el.value = txt;
    if (W.ir) W.ir('ia');
    setTimeout(() => thiaIAAsk('iaInput', perfil), 100);
  }

  W.thiaNormalizeBrainJson = normalizeBrainJson;
  W.thiaCarregarCerebroGlobal = carregarCerebroGlobal;
  W.thiaResponderLocal = thiaResponderLocal;
  W.thiaIAAsk = thiaIAAsk;
  W.thiaResponderPendenciaConhecimento = async function (pergunta, resposta) {
    const J = getJ();
    const database = W.db || J.db;
    const textoPergunta = String(pergunta || '').trim();
    const textoResposta = String(resposta || '').trim();
    if (!textoPergunta || !textoResposta) throw new Error('Informe pergunta/pendencia e resposta validada.');
    const payload = {
      tenantId: J.tid || '',
      pergunta: textoPergunta,
      resposta: textoResposta,
      respondidoPor: J.nome || J.usuario || J.role || 'jarvis',
      perfil: J.role || 'jarvis',
      origem: 'jarvis_validacao_conhecimento',
      createdAt: new Date().toISOString()
    };
    if (database) {
      await database.collection('cerebro_respostas').add(payload);
      const FieldValue = W.firebase?.firestore?.FieldValue;
      if (FieldValue && J.tid) {
        const item = Object.assign({ atualizadoEm: payload.createdAt }, payload);
        try { await database.collection('oficinas').doc(J.tid).set({ brain: { duvidasResolvidas: FieldValue.arrayUnion(item), atualizadoEm: payload.createdAt } }, { merge: true }); } catch (_) {}
        try { await database.collection('tenants').doc(J.tid).set({ brain: { duvidasResolvidas: FieldValue.arrayUnion(item), atualizadoEm: payload.createdAt } }, { merge: true }); } catch (_) {}
      }
    }
    const ofi = J.oficina = J.oficina || {};
    ofi.brain = ofi.brain || ofi.cerebro || {};
    ofi.brain.duvidasResolvidas = asArray(ofi.brain.duvidasResolvidas);
    ofi.brain.duvidasResolvidas.push(payload);
    return payload;
  };

  W.iaPerguntar = function () { return thiaIAAsk('iaInput', podeFinanceiro({ perfil: getJ().role }) ? 'jarvis' : getJ().role); };
  W.iaEnviar = function () { return thiaIAAsk('iaInput', 'equipe'); };
  W.iaAnalisarDRE = function () { return setPromptAndAsk('Analise o financeiro atual e aponte riscos, vencidos e prioridades.', 'jarvis'); };
  W.iaAnalisarEstoque = function () { return setPromptAndAsk('Quais pecas estao em nivel critico para reposicao?', getJ().role || 'jarvis'); };

  W.thiaGerarModeloCerebroJSON = function (escopo) {
    return JSON.stringify({
      versao: 1,
      escopo: escopo || 'tenant',
      comportamento: { tom: 'direto', permitirPiadas: false },
      conhecimento: [
        { titulo: 'Exemplo', texto: 'Descreva conhecimento verdadeiro da oficina.' }
      ],
      regras: ['Nunca afirmar peca trocada sem execucao registrada.'],
      procedimentos: [],
      diagnosticos: []
    }, null, 2);
  };

  W.adicionarMsgIA = W.adicionarMsgIA || function (roleName, html) {
    const el = D.getElementById('iaMsgs');
    if (!el) return;
    const div = D.createElement('div');
    div.className = 'ia-msg ' + roleName;
    div.innerHTML = roleName === 'bot' ? '<strong>thIAguinho:</strong> ' + html : html;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  };

  D.addEventListener('DOMContentLoaded', function () {
    const input = D.getElementById('iaInput');
    if (input && !input.__thiaLocalEnter) {
      input.__thiaLocalEnter = true;
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          if (location.pathname.toLowerCase().includes('equipe')) W.iaEnviar();
          else W.iaPerguntar();
        }
      });
    }
    carregarCerebroGlobal();
  });
})();
