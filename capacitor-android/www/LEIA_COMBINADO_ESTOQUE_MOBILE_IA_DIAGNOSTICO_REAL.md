# Ajuste combinado — Estoque mobile + IA Diagnóstico real

## O que este pacote corrige

1. **Jarvis mobile / estoque**
   - Mantém a lógica original da tela.
   - Adiciona a visualização mobile em cartões para as peças em estoque.
   - Mantém Kardex e Fornecedores.
   - Mantém a tabela original no desktop.
   - Atualiza o service worker para o PWA buscar a versão nova.

2. **IA Diagnóstico Automotivo**
   - Mantém a opção antiga de abrir portal integrado.
   - Adiciona integração real via Supabase:
     - `https://luazuifwvyeabuldlvzw.supabase.co`
     - `/functions/v1/diagnostic-chat`
   - Usa usuário/senha cadastrados no Superadmin por tenant.
   - Tenta login por API Supabase.
   - Envia a pergunta do Jarvis/Equipe para a função `diagnostic-chat`.
   - Se encontrar uma placa na pergunta, tenta anexar histórico do OFICIN-IA ao contexto.
   - Se a API falhar, volta para a IA local sem quebrar o fluxo.

## Arquivos principais

- `js/ia-externa.js`
- `jarvis.html`
- `equipe.html`
- `superadmin.html`
- `js/mobile-estoque-fix.js`
- `service-worker.js`

E as cópias equivalentes em:

- `capacitor-android/www/`

## Atenção sobre a apikey/anon key

A rota real da IA foi identificada, mas o Supabase normalmente exige uma chave pública `apikey`/`anon key` para fazer login por API.

No Superadmin foi adicionado o campo:

- **Supabase anon/apiKey pública**

Se a integração mostrar erro pedindo API key, será necessário capturar esse valor no DevTools do site externo e colar nesse campo do tenant.

Não cole token `Authorization: Bearer` de sessão nesse campo. Token de sessão expira e é sensível.

## Sem remoção de lógica

Este pacote não foi feito para simplificar ou remover funções existentes. A integração foi adicionada por cima do fluxo atual, preservando fallback e comportamento original.
