# CORREÇÃO PROFISSIONAL — Jarvis + IA Diagnóstico

Esta versão corrige o bug onde o Jarvis misturava a busca interna com a IA externa e acabava recebendo a resposta:
"Sou especialista apenas em diagnóstico automotivo".

## O que mudou

- O Jarvis só chama a IA Diagnóstico externa quando a pergunta contém sintoma, diagnóstico ou código de falha.
- Pergunta apenas com placa continua buscando histórico interno.
- Pergunta com placa + sintoma busca histórico interno e envia como contexto para o robô.
- O robô remove mensagens antigas inúteis do histórico antes de chamar o fornecedor.
- O prompt enviado para a IA externa agora é claro: problema informado, contexto interno e pedido de diagnóstico organizado.
- O iframe/login visual não é usado como caminho de diagnóstico.
- A conversa técnica continua salva localmente.

## Testes recomendados

1. `DSV-1460`
   - Deve retornar histórico interno da O.S.

2. `Gol 1.0 falhando em marcha lenta`
   - Deve chamar a IA Diagnóstico e retornar checklist técnico.

3. `código P0301`
   - Deve chamar a IA Diagnóstico.

4. `DSV-1460 com falha em marcha lenta`
   - Deve buscar histórico interno e usar junto no diagnóstico.

## Configuração no Superadmin

Módulo IA Diagnóstico: liberado

Endpoint/proxy:

`/api/diagnostico`

thIAguinho Soluções — tecnologia sob medida.
