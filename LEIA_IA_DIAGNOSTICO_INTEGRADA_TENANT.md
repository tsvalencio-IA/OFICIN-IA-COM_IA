# Recriação — IA Diagnóstico Automotivo integrada ao tenant

## Objetivo
Atender ao fluxo solicitado: o Superadmin libera o módulo por oficina, cadastra usuário/senha do portal e o usuário da oficina acessa a IA Diagnóstico dentro do OFICIN-IA, sem abrir uma nova aba externa.

## O que foi alterado

### Superadmin
Arquivo:
- `superadmin.html`
- `capacitor-android/www/superadmin.html`

Na área da oficina, em **IA Diagnóstico Automotivo Externa**, foram adicionadas/ajustadas as opções:

- Liberar módulo para esta oficina
- Usuário do portal externo
- Senha do portal externo
- URL do portal integrado
- Endpoint/proxy seguro opcional
- Abrir dentro do OFICIN-IA
- Tentar auto-login do tenant

A configuração salva em cada tenant/oficina agora inclui:

```js
integracoes: {
  iaDiagnosticoAutomotivo: {
    ativo: true,
    moduloLiberado: true,
    modo: 'integrado', // ou 'endpoint'
    portalUrl: 'https://www.appdiagnosticoautomotivo.com.br/',
    endpoint: '',
    embedInterno: true,
    autoLogin: true,
    usuario: '',
    senha: ''
  }
}
```

### Chat IA / JARVIS / Equipe
Arquivo:
- `js/ia-externa.js`
- `capacitor-android/www/js/ia-externa.js`

Comportamento novo:

1. Se o módulo estiver bloqueado para o tenant, o chat local continua normal.
2. Se o módulo estiver liberado e houver endpoint/proxy, o chat envia a pergunta para o endpoint.
3. Se o módulo estiver liberado e não houver endpoint, o OFICIN-IA abre uma janela interna com iframe/WebView do portal.
4. O sistema tenta preencher usuário e senha automaticamente com base no cadastro do Superadmin.
5. Se o navegador bloquear acesso ao formulário por origem diferente/CORS, o sistema mostra aviso e oferece botões para copiar usuário/senha.

## Limite técnico importante
Sem endpoint/API do fornecedor, o front-end não consegue garantir login 100% automático em um site de outro domínio.

O navegador pode bloquear:
- leitura do formulário dentro do iframe;
- preenchimento automático do iframe;
- carregamento do site dentro de iframe;
- cookies/sessão de terceiro;
- scripts cross-origin.

Isso não é falha do OFICIN-IA. É proteção normal do navegador.

## Caminho definitivo
Para ficar realmente “já logado no tenant”, o melhor corte técnico é:

1. Criar um backend/proxy seguro.
2. Guardar credenciais fora do front-end.
3. Fazer login/consulta pelo servidor.
4. Retornar a resposta da IA Diagnóstico direto no chat do OFICIN-IA.

Enquanto o endpoint não existe, esta versão entrega a melhor experiência possível só com front-end: portal embutido + tentativa de auto-login + credenciais do tenant controladas no Superadmin.
