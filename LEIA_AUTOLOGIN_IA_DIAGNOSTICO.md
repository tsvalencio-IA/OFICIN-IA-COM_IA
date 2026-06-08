# Ajuste — Botão Entrar Automaticamente na IA Diagnóstico

Este pacote troca a experiência de "copiar usuário/senha" por um botão de auto-login.

## O que mudou

- A janela integrada da IA Diagnóstico agora mostra o botão **Entrar automaticamente**.
- A barra do Jarvis/Equipe agora mostra **Entrar na IA**.
- O botão tenta usar o login e a senha cadastrados no Superadmin para:
  1. abrir o portal dentro do OFICIN-IA;
  2. localizar campo de usuário;
  3. localizar campo de senha;
  4. preencher os dados do tenant;
  5. clicar no botão de login.

## Importante

Essa solução funciona quando o portal permite acesso ao formulário dentro do iframe/WebView.

Se o navegador bloquear por segurança de domínio externo, o sistema avisa na tela. Nesse caso, a credencial continua cadastrada corretamente no tenant, mas o navegador não permite injetar o login no site externo.

## Arquivos alterados

- js/ia-externa.js
- capacitor-android/www/js/ia-externa.js
