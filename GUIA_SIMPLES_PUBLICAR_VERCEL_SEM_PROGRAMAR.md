# GUIA SIMPLES — Sistema completo com Estoque Mobile + IA Diagnóstico real

Thiago, esta versão foi feita para você não precisar entender programação.

## O que tem neste ZIP

Este ZIP tem tudo junto em UM projeto:

- OFICIN-IA completo;
- correção da aba Estoque no Jarvis mobile;
- integração da IA Diagnóstico por robô virtual;
- pasta `api/diagnostico.js`, que é o robô;
- persistência da conversa da IA Diagnóstico no aparelho;
- atualização do cache do PWA.

## Por que precisa da Vercel

O GitHub Pages só publica tela HTML, CSS e JavaScript.

Ele não roda backend.

A IA Diagnóstico precisa de um robô/backend para fazer o login e chamar o endpoint verdadeiro sem depender de iframe.

Por isso, nesta versão, o mais simples é:

1. GitHub guarda os arquivos.
2. Vercel publica o sistema e roda o robô.
3. Você instala o PWA pelo link da Vercel.

Não é outro GitHub.
É o MESMO repositório, só publicado pela Vercel.

## Caminho recomendado

Use a Vercel como link principal do sistema.

Depois que publicar na Vercel, o endereço será parecido com:

`https://oficin-ia.vercel.app`

E o robô ficará em:

`https://oficin-ia.vercel.app/api/diagnostico`

No Superadmin, coloque no campo endpoint/proxy:

`/api/diagnostico`

## Passo a passo no computador

### 1. Baixar e extrair

1. Baixe o ZIP.
2. Clique com o botão direito.
3. Escolha “Extrair tudo”.
4. Entre na pasta extraída.

### 2. Subir no GitHub

1. Abra o repositório do OFICIN-IA no GitHub.
2. Clique em “Add file”.
3. Clique em “Upload files”.
4. Arraste TODOS os arquivos da pasta extraída.
5. Marque para substituir arquivos existentes.
6. Clique em “Commit changes”.

### 3. Publicar na Vercel

1. Entre em https://vercel.com
2. Faça login.
3. Clique em “Add New”.
4. Clique em “Project”.
5. Escolha o mesmo repositório do OFICIN-IA.
6. Clique em “Import”.
7. Clique em “Deploy”.

A Vercel vai gerar o novo link do sistema.

### 4. Configurar no Superadmin

Entre no Superadmin e, na oficina/tenant:

1. Libere o módulo IA Diagnóstico Automotivo.
2. Cadastre o e-mail da IA Diagnóstico.
3. Cadastre a senha da IA Diagnóstico.
4. No campo endpoint/proxy, coloque:

`/api/diagnostico`

5. Marque para usar API real/robô, se aparecer essa opção.
6. Salve.

### 5. Testar no Jarvis

Abra o sistema pelo link da Vercel e pergunte no Jarvis:

`Gol 1.0 falhando em marcha lenta`

O Jarvis deve responder usando a IA Diagnóstico real.

## Sobre a conversa reiniciar

Nesta versão, o sistema salva no navegador:

- histórico curto da conversa;
- session_id da IA Diagnóstico;
- últimas mensagens.

Quando sair da tela e voltar, ele tenta restaurar a conversa no mesmo aparelho.

## Sobre o botão “Entrar automaticamente”

Esse botão antigo pode continuar aparecendo como emergência, mas o caminho principal agora é o robô.

O iframe pode continuar bloqueado pelo navegador. Isso é normal.

O correto é o chat chamar o robô e receber a resposta dentro do Jarvis/Equipe.

## Se usar GitHub Pages mesmo assim

Se você continuar abrindo pelo GitHub Pages, `/api/diagnostico` não vai existir.

Nesse caso, no Superadmin, no endpoint/proxy, coloque o link completo da Vercel:

`https://SEU-PROJETO.vercel.app/api/diagnostico`

Mas o caminho mais fácil é usar o próprio link da Vercel como sistema principal.

thIAguinho Soluções — tecnologia sob medida.
