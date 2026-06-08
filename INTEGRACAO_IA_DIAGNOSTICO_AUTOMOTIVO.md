# Integração — Chat com IA de Diagnóstico Automotivo

## O que foi criado

Foi adicionada uma camada segura de integração no arquivo:

- `js/ia-externa.js`

E o script foi carregado em:

- `jarvis.html`
- `equipe.html`
- `capacitor-android/www/jarvis.html`
- `capacitor-android/www/equipe.html`

## Como funciona

O chat atual continua funcionando com a IA local (`js/ia.js`).

A nova camada faz o seguinte:

1. Mostra uma barra no chat com:
   - status da IA;
   - botão **Configurar IA externa**;
   - botão **Abrir Diagnóstico Automotivo**.

2. Se houver um endpoint proxy configurado, o sistema envia para ele:
   - pergunta do usuário;
   - perfil;
   - contexto resumido da oficina;
   - histórico recente do chat.

3. Se o endpoint falhar ou não existir, o sistema:
   - avisa o motivo;
   - mantém o botão para abrir o portal externo;
   - cai automaticamente para a IA local atual.

## Por que não usei usuário e senha no código

Não é seguro gravar login/senha de fornecedor em JavaScript, HTML, localStorage ou Git.

Qualquer pessoa com acesso ao navegador poderia ver a credencial.

O caminho correto é:

- criar uma API/proxy no servidor;
- guardar usuário, senha, token ou chave em variável de ambiente;
- o OFICIN-IA chama apenas esse proxy.

## Contrato esperado do endpoint proxy

### Requisição

`POST https://seu-endpoint-seguro`

```json
{
  "pergunta": "Quais causas para falha P0301?",
  "perfil": "equipe",
  "contexto": {
    "origem": "OFICIN-IA",
    "tenantId": "id-da-oficina",
    "resumo": {
      "ordensServico": 10,
      "clientes": 50,
      "veiculos": 60
    },
    "osAbertas": []
  },
  "historico": []
}
```

### Resposta

```json
{
  "resposta": "Comece verificando vela, bobina, compressão e bico injetor do cilindro 1..."
}
```

## Como ativar no sistema

1. Abrir `jarvis.html` ou `equipe.html`.
2. Ir até o chat da IA.
3. Clicar em **Configurar IA externa**.
4. Marcar **Usar IA externa quando houver endpoint configurado**.
5. Informar o endpoint proxy seguro.
6. Salvar.

## Observação importante

O site `https://www.appdiagnosticoautomotivo.com.br/` foi mantido como portal externo.

Sem documentação oficial de API ou endpoint técnico validado, a integração automática direta com login/senha não deve ser feita no front-end.

thIAguinho Soluções — tecnologia sob medida.
