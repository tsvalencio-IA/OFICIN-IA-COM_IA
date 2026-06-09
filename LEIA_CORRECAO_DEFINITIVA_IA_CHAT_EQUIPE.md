# Correção definitiva — OFICIN-IA COM IA

Base usada: `OFICIN-IA-COM_IA-main.zip` enviado por você.

## O que foi corrigido

- Vercel restaurado com `outputDirectory: "."` e rewrites para links curtos.
- IA Diagnóstico agora funciona pelo robô `/api/diagnostico`.
- Fluxo principal por iframe/auto-login visual foi desativado.
- Front-end não envia usuário, senha ou anon key para o backend.
- Backend `/api/diagnostico` usa somente variáveis de ambiente da Vercel.
- Jarvis mantém consulta local para estoque, financeiro, O.S. e histórico puro.
- Diagnóstico automotivo chama o robô.
- Placa + sintoma monta contexto interno e chama o robô.
- Chat equipe passou a usar `senderId`, `senderName` e `senderRole` para autoria.
- Conversa da IA é preservada no `localStorage`, limitada a 50 mensagens e 7 dias.
- Cache do PWA foi atualizado para forçar novo JS.

## Arquivos alterados

- `equipe.html`
- `jarvis.html`
- `service-worker.js`
- `vercel.json`
- `api/diagnostico.js`
- `capacitor-android/www/equipe.html`
- `capacitor-android/www/jarvis.html`
- `capacitor-android/www/service-worker.js`
- `capacitor-android/www/js/ia-externa.js`
- `capacitor-android/www/js/service-worker.js`
- `js/ia-externa.js`
- `js/service-worker.js`
- `robo-vercel-ia-diagnostico/api/diagnostico.js`

## Testes técnicos feitos

- `node --check js/ia-externa.js`
- `node --check api/diagnostico.js`
- `node --check robo-vercel-ia-diagnostico/api/diagnostico.js`
- `node --check service-worker.js`
- `node --check js/service-worker.js`
- `node --check js/mobile-estoque-fix.js`

Todos passaram sem erro de sintaxe.

## Como subir

1. Extraia o ZIP completo.
2. Suba os arquivos no GitHub substituindo o repositório atual.
3. Espere a Vercel fazer redeploy automático.
4. Abra em aba anônima primeiro.
5. No Superadmin, use:
   - IA Diagnóstico: liberado
   - Endpoint/proxy: `/api/diagnostico`

## Variáveis necessárias na Vercel

- `DIAGNOSTICO_EMAIL`
- `DIAGNOSTICO_PASSWORD`
- `DIAGNOSTICO_SUPABASE_ANON_KEY`
- `ALLOWED_ORIGIN`

## Testes de uso esperados

- `DSV-1460` → histórico interno.
- `histórico da placa DSV1460` → histórico interno.
- `Gol falhando` → IA Diagnóstico via `/api/diagnostico`.
- `código P0301` → IA Diagnóstico via `/api/diagnostico`.
- `DSV-1460 com falha em marcha lenta` → histórico interno + IA Diagnóstico.
- `estoque crítico` → módulo interno.
- `fluxo de caixa` → módulo financeiro interno.
