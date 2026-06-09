# Correção: IA Diagnóstico como auxiliar do Jarvis/Equipe com contexto de veículo

## O que foi adicionado

- Contexto ativo por tenant/usuário/tela.
- Quando o usuário consulta uma placa, essa placa fica fixada como contexto da conversa.
- Perguntas seguintes como "código P0301", "deu 12V", "compressão baixa" ou "continua falhando" usam o mesmo veículo até limpar/trocar o contexto.
- Placa + sintoma busca histórico interno e envia junto para `/api/diagnostico`.
- Após resposta da IA, aparecem botões:
  - Salvar conversa na O.S.
  - Registrar teste na O.S.
  - Limpar contexto
- O registro é salvo na O.S. em `iaDiagnosticoRegistros`, `ultimoDiagnosticoIA` e `timeline`.
- Funciona no `jarvis.html` e no `equipe.html`, porque a lógica fica em `js/ia-externa.js`.
- O service worker teve a versão de cache atualizada.

## Regras

- `DSV-1460` sozinho: histórico interno e fixa contexto.
- `código P0301` depois de uma placa: chama IA externa usando o veículo fixado.
- `DSV-1460 com falha em marcha lenta`: histórico interno + IA externa.
- `novo diagnóstico` ou `limpar contexto`: zera o veículo ativo.
- Estoque/financeiro/O.S. continuam locais.

## Vercel

Mantém as mesmas variáveis já configuradas:

- `DIAGNOSTICO_EMAIL`
- `DIAGNOSTICO_PASSWORD`
- `DIAGNOSTICO_SUPABASE_ANON_KEY`
- `ALLOWED_ORIGIN`

No Superadmin, manter:

- endpoint/proxy: `/api/diagnostico`
