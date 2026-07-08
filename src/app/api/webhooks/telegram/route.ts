import { NextRequest, NextResponse } from 'next/server';
import { handleTelegramUpdate } from '@/lib/telegram/handler';

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-telegram-bot-api-secret-token');
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expectedSecret && secret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    await handleTelegramUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Telegram Webhook Error]', error);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Business OS Telegram Webhook Active ✓', bot: '@Saas_ia_bot' });
}
