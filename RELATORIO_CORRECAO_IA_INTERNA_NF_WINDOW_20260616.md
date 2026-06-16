# Correção cirúrgica — IA interna Jarvis + exposição NF/XML → O.S.

Base usada: versão já corrigida `OFICIN-IA-COM_IA-main-CORRECAO-NF-OS-ESTOQUE-FINANCEIRO-20260616`, preservando os arquivos enviados anteriormente.

## Arquivos alterados
- `js/ia.js`
- `js/ia-externa.js`
- `js/nfe-real-pro.js`
- `service-worker.js`
- `capacitor-android/www/js/ia.js`
- `capacitor-android/www/js/ia-externa.js`
- `capacitor-android/www/js/nfe-real-pro.js`
- `capacitor-android/www/service-worker.js`

## O que foi corrigido
1. `refletirPecasNFNaOSTelaAtual` agora fica disponível em `window.refletirPecasNFNaOSTelaAtual`.
2. Foi criado alias seguro `window.refletirPecasNFNaOS`.
3. A IA interna do Jarvis ganhou filtro por cliente em perguntas operacionais.
4. A IA interna agora reconhece perguntas como:
   - `quantos veículos do cliente X foram entregues sem faturar`
   - `quantos veículos do cliente X foram entregues sem receber`
   - `veículos entregues sem faturar ou sem receber do cliente X`
5. A resposta cruza O.S. + cliente + status entregue/finalizado + financeiro/faturamento local.
6. O roteador da IA externa foi preservado: pergunta administrativa/financeira fica no Jarvis; diagnóstico automotivo continua podendo ir para IA externa.

## O que não foi alterado
- Chat equipe
- Prisma
- Cília
- Tempária
- Fiscal geral
- Financeiro geral
- Layout geral
- Regras Firebase
- Endpoint Vercel

## Validação feita
- `node --check js/ia.js`: OK
- `node --check js/ia-externa.js`: OK
- `node --check js/nfe-real-pro.js`: OK

## Observação técnica
A resposta da IA interna depende dos dados já carregados em `window.J`/arrays do Jarvis. Ela não inventa dados. Se o financeiro/faturamento da O.S. não estiver registrado com vínculo local identificável, ela avisará com base no que encontrou.
