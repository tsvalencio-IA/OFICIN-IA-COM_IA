# Ajuste combinado — Estoque mobile + IA Diagnóstico via robô Vercel

## O que foi corrigido

1. Corrigido erro de sintaxe em `js/mobile-estoque-fix.js`.
2. Atualizado cache do PWA em `service-worker.js`.
3. Corrigido o project ref real do Supabase da IA Diagnóstico:
   `luazuifvwyeabuldlvzw`.
4. Preparado robô virtual separado para Vercel em:
   `robo_virtual_vercel_ia_diagnostico.zip`.

## Endpoint real confirmado

- `https://luazuifvwyeabuldlvzw.supabase.co/functions/v1/diagnostic-chat`

Payload capturado:

```json
{
  "messages": [
    { "role": "assistant", "content": "welcome" },
    { "role": "user", "content": "Gol 1.0 falhando em marcha lenta" }
  ],
  "language": "pt"
}
```

## Como usar no OFICIN-IA

Depois que o robô estiver publicado na Vercel, copie a URL:

`https://SEU-PROJETO.vercel.app/api/diagnostico`

No Superadmin da oficina, cole essa URL no campo de endpoint/proxy da IA Diagnóstico.

thIAguinho Soluções — tecnologia sob medida.
