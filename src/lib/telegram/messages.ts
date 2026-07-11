import { createServiceClient } from '@/lib/supabase/service';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

/** Normaliza /start@Saas_ia_bot → /start */
export function normalizeTelegramCommand(text: string): string {
  const first = text.trim().split(/\s+/)[0] ?? '';
  return first.split('@')[0].toLowerCase();
}

/** Genera un token aleatorio de 8 caracteres alfanuméricos */
function generateSecureToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let i = 0; i < 8; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export function buildTelegramLinkCode(token: string, firstName?: string) {
  const name = firstName ?? 'Usuario';
  return (
    `👋 ¡Hola ${name}!\n\n` +
    `Tu código para vincular Business AI OS es:\n\n` +
    `🔗 ${token}\n\n` +
    `⏳ Válido por 10 minutos\n\n` +
    `Pasos:\n` +
    `1. Copia el código de arriba\n` +
    `2. Ve a Configuración → Asistente IA en la app\n` +
    `3. Pégalo y pulsa Vincular\n\n` +
    `Luego podrás chatear por texto o voz 🎤\n` +
    `Comandos: /ventas /inventario /deudas /ayuda`
  );
}

export async function sendTelegramPlain(chatId: number, text: string) {
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[Telegram sendMessage]', res.status, err);
    throw new Error(`Telegram API ${res.status}`);
  }
}

export async function sendTelegramWithKeyboard(
  chatId: number,
  text: string,
  replyMarkup: { inline_keyboard: { text: string; callback_data: string }[][] },
) {
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[Telegram sendMessage+keyboard]', res.status, err);
    throw new Error(`Telegram API ${res.status}`);
  }
}

export async function answerTelegramCallback(callbackQueryId: string, text?: string) {
  const res = await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[Telegram answerCallbackQuery]', res.status, err);
  }
}

export async function removeTelegramKeyboard(chatId: number, messageId: number) {
  await fetch(`${TELEGRAM_API}/editMessageReplyMarkup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
  });
}

export async function sendTelegramMessage(chatId: number, text: string) {
  const chunks = splitTelegramMessage(text);
  for (const chunk of chunks) {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        parse_mode: 'Markdown',
      }),
    });
    if (!res.ok) {
      await sendTelegramPlain(chatId, chunk);
    }
  }
}

function splitTelegramMessage(text: string, max = 4000): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let idx = rest.lastIndexOf('\n', max);
    if (idx < max * 0.5) idx = max;
    parts.push(rest.slice(0, idx));
    rest = rest.slice(idx);
  }
  if (rest) parts.push(rest);
  return parts;
}

export async function sendTelegramLinkCode(chatId: number, firstName?: string) {
  try {
    const supabase = createServiceClient();
    const token = generateSecureToken();

    // Eliminar tokens anteriores no usados de este chat
    await supabase
      .from('telegram_pending_links')
      .delete()
      .eq('chat_id', chatId)
      .eq('used', false);

    // Insertar nuevo token con expiración de 10 minutos
    const { error } = await supabase.from('telegram_pending_links').insert({
      chat_id: chatId,
      first_name: firstName ?? null,
      token,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    if (error) throw error;

    const body = buildTelegramLinkCode(token, firstName);
    await sendTelegramPlain(chatId, body);
    // Segundo mensaje solo con el token — fácil de copiar en móvil
    await sendTelegramPlain(chatId, token);
  } catch (err) {
    console.error('[Telegram] Error generando token seguro:', err);
    // Fallback al código legacy si hay error de DB
    await sendTelegramPlain(chatId, `Tu código de vinculación: TG-${chatId}`);
  }
}

/** Envía confirmación de vinculación exitosa al usuario en Telegram */
export async function sendTelegramLinkConfirmation(chatId: number, firstName?: string) {
  const name = firstName ?? 'Usuario';
  await sendTelegramMessage(
    chatId,
    `✅ *¡Cuenta vinculada exitosamente!*\n\n` +
    `Hola ${name}, ya puedo ayudarte con tu negocio.\n\n` +
    `💬 Escríbeme o envíame un audio:\n` +
    `• _"Agrega 10 baterías a 15 mil"_\n` +
    `• _"Acabo de vender 2 bujías"_\n` +
    `• _"¿Cuánto vendí hoy?"_\n\n` +
    `Escribe /ayuda para ver todos los comandos.`
  );
}
