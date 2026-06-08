# Ajuste Jarvis + Equipe — IA Diagnóstico por Tenant

Este pacote reforça a integração nos dois pontos onde o chat é usado:

## Jarvis / Gestor
Arquivo:
- `jarvis.html`
- `capacitor-android/www/jarvis.html`

Alterações:
- Barra visível da IA Diagnóstico dentro do painel `thIAguinho — DIAGNÓSTICO INTELIGENTE`.
- Botão `Abrir IA dentro do sistema`.
- Botão `Credenciais / status`.
- O envio do chat passa pelo adaptador `js/ia-externa.js`.

## Equipe / Mecânico
Arquivo:
- `equipe.html`
- `capacitor-android/www/equipe.html`

Alterações:
- Barra visível da IA Diagnóstico dentro do assistente do mecânico.
- Botão `Abrir IA dentro do sistema`.
- Botão `Credenciais / status`.
- O envio do chat `iaEnviar()` passa pelo adaptador `js/ia-externa.js`.

## Superadmin
O Superadmin continua sendo o lugar certo para liberar ou bloquear o módulo por oficina/tenant e cadastrar:
- usuário;
- senha;
- URL do portal;
- endpoint/proxy futuro;
- auto-login;
- embed interno.

## Observação técnica
Sem endpoint/API oficial, o sistema abre o portal externo dentro do OFICIN-IA via iframe/WebView e tenta preencher usuário/senha do tenant.

Se o fornecedor bloquear iframe, cookies de terceiro ou acesso ao formulário por segurança, o auto-login não pode ser garantido apenas pelo front-end. O próximo corte profissional é um proxy/backend seguro.
