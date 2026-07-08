import { NextRequest, NextResponse } from 'next/server';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

const BOT_COMMANDS = [
  { command: 'start', description: 'Obtener código de vinculación' },
  { command: 'codigo', description: 'Ver tu código TG-xxx otra vez' },
  { command: 'ayuda', description: 'Ver comandos disponibles' },
  { command: 'chat', description: 'Modo conversación con IA' },
  { command: 'ventas', description: 'Resumen de ventas del día' },
  { command: 'inventario', description: 'Productos con stock bajo' },
  { command: 'deudas', description: 'Clientes con saldo pendiente' },
];

async function setBotCommands() {
  await fetch(`${TELEGRAM_API}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands: BOT_COMMANDS }),
  });
}

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || 'business_ai_os_webhook_2026';

  if (!token) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN no configurado' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const overrideWebhook = typeof body.webhook_url === 'string' ? body.webhook_url.trim() : '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const webhookUrl = overrideWebhook || `${appUrl.replace(/\/$/, '')}/api/webhooks/telegram`;
  const isLocal = webhookUrl.includes('localhost') || webhookUrl.includes('127.0.0.1');

  await setBotCommands();

  const meRes = await fetch(`${TELEGRAM_API}/getMe`);
  const me = await meRes.json();

  if (isLocal && !overrideWebhook) {
    return NextResponse.json({
      success: true,
      bot: me.result,
      message: 'Comandos configurados. En localhost Telegram no recibe mensajes sin URL pública.',
      webhook_url: webhookUrl,
      local_dev: {
        step1: 'Instala ngrok: https://ngrok.com',
        step2: 'Ejecuta: ngrok http 3000',
        step3: 'Copia la URL https://xxxx.ngrok-free.app',
        step4: 'POST /api/telegram/setup con body: { "webhook_url": "https://xxxx.ngrok-free.app/api/webhooks/telegram" }',
        step5: 'Actualiza NEXT_PUBLIC_APP_URL en .env.local con la URL de ngrok',
      },
    });
  }

  const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message'],
    }),
  });

  const data = await res.json();

  if (!data.ok) {
    return NextResponse.json({ error: data.description }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    bot: me.result,
    webhook: webhookUrl,
    message: 'Bot @Saas_ia_bot configurado correctamente. Ya puedes chatear por Telegram.',
  });
}

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Token no configurado' }, { status: 500 });
  }

  const [meRes, webhookRes] = await Promise.all([
    fetch(`${TELEGRAM_API}/getMe`),
    fetch(`${TELEGRAM_API}/getWebhookInfo`),
  ]);

  const me = await meRes.json();
  const webhook = await webhookRes.json();

  return NextResponse.json({
    bot: me.result,
    webhook: webhook.result,
  });
}
