# Correção profissional — IA Diagnóstico trabalhando junto com Jarvis

Esta versão muda o fluxo da IA externa para modo profissional:

- O iframe/login visual não é mais o caminho principal.
- O campo normal do Jarvis/Equipe chama o robô `/api/diagnostico`.
- A busca interna continua ativa para histórico de O.S., placa, estoque, financeiro etc.
- Quando a pergunta é diagnóstico automotivo, sintoma ou código de falha, o sistema envia ao robô com o contexto interno da oficina.
- Perguntas curtas de continuação, como `código P0301`, usam o histórico recente da conversa.
- A conversa técnica é salva no navegador e restaurada ao sair e voltar.

## Como testar

1. No Superadmin, deixe o módulo IA Diagnóstico liberado.
2. No endpoint/proxy, use:

```txt
/api/diagnostico
```

3. No Jarvis, pergunte:

```txt
Gol 1.0 falhando em marcha lenta. Me dê um diagnóstico organizado.
```

4. Depois pergunte:

```txt
código P0301
```

A segunda pergunta deve continuar a conversa com a IA Diagnóstico, sem pedir placa obrigatoriamente.

## Observação

Se quiser apenas histórico interno, pergunte:

```txt
histórico da placa DSV-1460
```

Se quiser histórico + diagnóstico, pergunte:

```txt
DSV-1460 com falha em marcha lenta. Analise o histórico e monte diagnóstico.
```

thIAguinho Soluções — tecnologia sob medida.
