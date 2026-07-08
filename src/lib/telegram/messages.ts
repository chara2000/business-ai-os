const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

/** Normaliza /start@Saas_ia_bot → /start */
export function normalizeTelegramCommand(text: string): string {
  const first = text.trim().split(/\s+/)[0] ?? '';
  return first.split('@')[0].toLowerCase();
}

export function buildTelegramLinkCode(chatId: number, firstName?: string) {
  const code = `TG-${chatId}`;
  const name = firstName ?? 'Usuario';
  return (
    `👋 ¡Hola ${name}!\n\n` +
    `Tu código para vincular Business AI OS es:\n\n` +
    `🔗 ${code}\n\n` +
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
  const code = `TG-${chatId}`;
  const body = buildTelegramLinkCode(chatId, firstName);
  await sendTelegramPlain(chatId, body);
  // Segundo mensaje solo con el código — fácil de copiar en móvil
  await sendTelegramPlain(chatId, code);
}
