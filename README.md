# Business AI OS

CRM empresarial con IA ejecutable, inventario, ventas, finanzas, bots (Telegram/WhatsApp) y facturación Wompi (Colombia).

## Stack

- Next.js 16 · React 19 · TypeScript · Tailwind v4
- Supabase (auth, DB, storage)
- Gemini / OpenAI (asistente IA)
- Telegram Bot · WhatsApp Business API
- Wompi (pagos Colombia)

## Inicio rápido

```bash
npm install
cp .env.example .env.local   # configurar variables
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

**Demo:** `superadmin@demo.com` / `Demo2026!`

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (webhooks/bots) |
| `AI_PROVIDER` | `gemini` o `openai` |
| `GEMINI_API_KEY` | API key de Google AI |
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram |
| `TELEGRAM_WEBHOOK_SECRET` | Secreto del webhook |
| `NEXT_PUBLIC_APP_URL` | URL pública de la app |

## Telegram

1. Busca `@Saas_ia_bot` en Telegram → `/start`
2. Vincula en **Configuración → Asistente IA** con el código `TG-{chatId}`
3. Chatea por texto o voz — las acciones se ejecutan automáticamente (sin confirmación)

### Webhook local (ngrok)

```bash
ngrok http 3000
```

```bash
curl -X POST http://localhost:3000/api/telegram/setup \
  -H "Content-Type: application/json" \
  -d "{\"webhook_url\": \"https://TU-URL.ngrok-free.app/api/webhooks/telegram\"}"
```

## Módulos

- Dashboard, ventas POS, inventario/kardex, compras, clientes, créditos
- Finanzas, reportes, OCR facturas, predicción de demanda
- Asistente IA (`/ai`) con acciones ejecutables
- PWA + notificaciones push
- Superadmin SaaS (MRR, planes, empresas)
- Facturación Wompi

## Licencia

Privado — uso del propietario.
