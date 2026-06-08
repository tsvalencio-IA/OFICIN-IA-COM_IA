# Recriação — IA Diagnóstico Automotivo modular no OFICIN-IA

## O que foi implementado

Foi criada uma integração modular para o portal:

https://www.appdiagnosticoautomotivo.com.br/

Como ainda não temos endpoint/API oficial, o sistema foi preparado em dois modos:

1. **Modo portal**
   - Superadmin libera ou bloqueia o módulo por oficina.
   - Superadmin cadastra usuário e senha por oficina.
   - O chat mostra o status do módulo.
   - O usuário pode abrir o portal externo e copiar as credenciais cadastradas.

2. **Modo endpoint/proxy**
   - Já existe campo no Superadmin para salvar um endpoint seguro.
   - Quando esse endpoint for preenchido, o chat passa a enviar perguntas via POST para a IA externa.
   - O endpoint deve retornar `{ "resposta": "..." }`.

## Arquivos alterados

- `superadmin.html`
- `index.html`
- `js/ia-externa.js`
- `capacitor-android/www/superadmin.html`
- `capacitor-android/www/index.html`
- `capacitor-android/www/js/ia-externa.js`

## Onde configurar no Superadmin

Abra o cadastro da oficina no Superadmin.

No modal da oficina, foi adicionada a área:

**IA DIAGNÓSTICO AUTOMOTIVO EXTERNA**

Campos:

- Liberar módulo para esta oficina
- Usuário do portal externo
- Senha do portal externo
- URL do portal
- Endpoint/proxy seguro, opcional

Também foi adicionada uma área na tela:

**IA Local / Cérebro > Credencial padrão IA Diagnóstico**

Ela permite:

- aplicar uma credencial padrão aos tenants;
- ou liberar e aplicar para todos os tenants.

## Estrutura salva no Firestore

No documento da oficina:

```js
modulos: {
  iaDiagnosticoAutomotivo: true
}

integracoes: {
  iaDiagnosticoAutomotivo: {
    ativo: true,
    moduloLiberado: true,
    modo: "portal",
    nome: "Diagnóstico Automotivo",
    portalUrl: "https://www.appdiagnosticoautomotivo.com.br/",
    endpoint: "",
    usuario: "...",
    senha: "...",
    atualizadoEm: "..."
  }
}
```

Também foi salvo um espelho em:

```js
iaDiagnosticoAutomotivo: {
  ativo: true,
  portalUrl: "...",
  endpoint: "",
  usuario: "...",
  senha: "...",
  atualizadoEm: "..."
}
```

## Como funciona no chat

Em `jarvis.html` e `equipe.html`, o script `js/ia-externa.js`:

- lê a oficina logada;
- verifica se `modulos.iaDiagnosticoAutomotivo` está ativo;
- busca a configuração atualizada no Firestore;
- mostra a barra de status no chat;
- se houver endpoint, envia a pergunta para a IA externa;
- se não houver endpoint, mantém a IA local e oferece botão para abrir o portal externo.

## Observação de segurança

O pedido foi para colocar login e senha no Superadmin por oficina. Isso foi feito no cadastro do tenant.

Porém, sem backend/proxy, qualquer credencial usada no navegador pode ser vista por usuários que tenham acesso ao sistema da oficina. Para produção mais segura, o ideal é:

1. Criar uma Firebase Function ou servidor proxy.
2. Guardar as credenciais somente no backend.
3. O front-end chamar apenas o endpoint seguro.
4. O endpoint consultar o fornecedor e devolver a resposta ao chat.

## Endpoint futuro esperado

Quando existir proxy/API, ele deve aceitar:

```http
POST /diagnosticoIA
Content-Type: application/json
```

Payload:

```js
{
  pergunta: "texto digitado no chat",
  perfil: "admin/gestor/mecanico",
  contexto: {
    origem: "OFICIN-IA",
    tenantId: "...",
    oficina: "...",
    resumo: {},
    osAbertas: []
  },
  historico: []
}
```

Resposta esperada:

```js
{
  resposta: "texto da IA externa"
}
```

thIAguinho Soluções — tecnologia sob medida.
