# CORREÇÃO FINAL — IA Diagnóstico no chat sem iframe

O fluxo foi corrigido para não tentar mais controlar o site externo dentro de iframe.

Agora:
- Jarvis e Equipe usam o chat normal.
- O botão PROCESSAR chama o robô `/api/diagnostico`.
- O portal externo fica apenas como emergência.
- A conversa curta é salva no navegador e restaurada ao voltar.
- O cache do PWA foi atualizado.

Configuração no Superadmin:
- IA Diagnóstico: liberado
- Endpoint/proxy: `/api/diagnostico`

Na Vercel, mantenha as variáveis:
- DIAGNOSTICO_EMAIL
- DIAGNOSTICO_PASSWORD
- DIAGNOSTICO_SUPABASE_ANON_KEY
- ALLOWED_ORIGIN

Depois de subir no GitHub, aguarde a Vercel redeployar e abra em aba anônima ou use Ctrl+F5 para evitar cache antigo.
