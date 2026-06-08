# Correção final — IA Diagnóstico sem iframe

Esta versão remove o iframe como fluxo principal.

## O que mudou

- O botão antigo **Entrar automaticamente** não é mais o caminho principal.
- O Jarvis e a Equipe agora devem usar a IA Diagnóstico pelo chat normal.
- A chamada vai para `/api/diagnostico`, que roda na Vercel.
- A conversa curta fica salva no navegador e é restaurada ao voltar para a tela.
- O portal externo fica apenas como emergência manual.

## Como usar

1. Publique este ZIP completo na Vercel.
2. No Superadmin da oficina, deixe o módulo IA Diagnóstico liberado.
3. No campo endpoint/proxy, use:
   `/api/diagnostico`
4. No Jarvis ou Equipe, digite a pergunta no campo do chat.
5. Use o botão **Testar robô** para conferir a comunicação.

## Variáveis necessárias na Vercel

- DIAGNOSTICO_EMAIL
- DIAGNOSTICO_PASSWORD
- DIAGNOSTICO_SUPABASE_ANON_KEY
- ALLOWED_ORIGIN

`ALLOWED_ORIGIN` pode ficar `*` durante os testes.

## Importante

Use o link da Vercel, não o GitHub Pages. O GitHub Pages não roda `/api/diagnostico`.
