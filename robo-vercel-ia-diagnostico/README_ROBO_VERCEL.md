# Robô virtual OFICIN-IA → IA Diagnóstico Automotivo

Este mini backend foi feito para rodar na Vercel.

Ele resolve o bloqueio de iframe/CORS porque o Jarvis/Equipe chama este endpoint:

`/api/diagnostico`

E este backend chama a IA externa pelo endpoint real encontrado:

`https://luazuifvwyeabuldlvzw.supabase.co/functions/v1/diagnostic-chat`

## Variáveis recomendadas na Vercel

Configure em Settings → Environment Variables:

- `DIAGNOSTICO_EMAIL`
- `DIAGNOSTICO_PASSWORD`
- `ALLOWED_ORIGIN`

Use em `ALLOWED_ORIGIN`:

`https://tsvalencio-ia.github.io`

A chave anon pública já está no código porque foi capturada no front público do serviço. Não coloque token Bearer de sessão na Vercel.

## Endpoint final

Depois do deploy, use no Superadmin do OFICIN-IA:

`https://SEU-PROJETO.vercel.app/api/diagnostico`

## Body aceito

```json
{
  "pergunta": "Gol 1.0 falhando em marcha lenta",
  "context": {
    "placa": "ABC1D23"
  },
  "credenciais": {
    "usuario": "email do tenant",
    "senha": "senha do tenant"
  }
}
```

Se você configurar `DIAGNOSTICO_EMAIL` e `DIAGNOSTICO_PASSWORD` na Vercel, o backend usa essas credenciais globais e ignora as do body.

thIAguinho Soluções — tecnologia sob medida.
