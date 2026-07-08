import { createAdminClient } from '@/lib/supabase/server';
import {
  processBusinessChat,
} from '@/lib/ai/chat-engine';
import { transcribeAudioBuffer, downloadTelegramFile } from '@/lib/ai/ask';
import {
  getTelegramSession,
  saveTelegramSession,
  appendToHistory,
} from '@/lib/telegram/session';
import {
  normalizeTelegramCommand,
  sendTelegramMessage,
  sendTelegramPlain,
  sendTelegramLinkCode,
  buildTelegramLinkCode,
} from '@/lib/telegram/messages';

async function getUsuarioByChatId(chatId: number) {
  const supabase = await createAdminClient();
  const { data } = await supabase
    .from('usuarios')
    .select('id, empresa_id, nombre, empresas(nombre)')
    .eq('telegram_chat_id', chatId.toString())
    .single();
  return data;
}

async function getVentasHoy(empresaId: string) {
  const supabase = await createAdminClient();
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('ventas')
    .select('total')
    .eq('empresa_id', empresaId)
    .eq('estado', 'completada')
    .gte('created_at', `${today}T00:00:00`);
  const total = data?.reduce((s, v) => s + (v.total || 0), 0) ?? 0;
  return { count: data?.length ?? 0, total };
}

async function getStockBajo(empresaId: string) {
  const supabase = await createAdminClient();
  const { data } = await supabase
    .from('productos')
    .select('nombre, stock_actual, stock_minimo')
    .eq('empresa_id', empresaId)
    .eq('activo', true);
  return data?.filter((p) => p.stock_actual <= p.stock_minimo) ?? [];
}

async function getDeudas(empresaId: string) {
  const supabase = await createAdminClient();
  const { data } = await supabase
    .from('creditos')
    .select('saldo_pendiente, clientes(nombre)')
    .eq('empresa_id', empresaId)
    .in('estado', ['pendiente', 'parcial', 'vencido']);
  return data ?? [];
}

export async function handleTelegramUpdate(body: Record<string, unknown>) {
  const message = body?.message as Record<string, unknown> | undefined;
  if (!message) return;

  const chat = message.chat as { id: number };
  const chatId = chat.id;
  const from = message.from as { first_name?: string } | undefined;
  const firstName = from?.first_name ?? 'Usuario';
  const text = (message.text as string | undefined)?.trim() ?? '';
  let userText = text;
  const isVoice = !!(message.voice as { file_id?: string } | undefined)?.file_id;

  if (isVoice) {
    const voice = message.voice as { file_id: string };
    await sendTelegramMessage(chatId, '🎤 Transcribiendo tu mensaje de voz...');
    try {
      const buffer = await downloadTelegramFile(voice.file_id);
      userText = await transcribeAudioBuffer(buffer, 'voice.ogg');
      if (!userText) {
        await sendTelegramMessage(chatId, '❌ No pude entender el audio. Intenta de nuevo o escribe tu mensaje.');
        return;
      }
    } catch {
      await sendTelegramMessage(chatId, '❌ Error al procesar el audio.');
      return;
    }
  }

  if (!userText) return;

  const command = normalizeTelegramCommand(userText);

  if (command === '/start') {
    await sendTelegramLinkCode(chatId, firstName);
    return;
  }

  if (command === '/codigo' || command === '/code') {
    await sendTelegramPlain(chatId, buildTelegramLinkCode(chatId, firstName));
    await sendTelegramPlain(chatId, `TG-${chatId}`);
    return;
  }

  if (command === '/ayuda' || command === '/help') {
    await sendTelegramMessage(chatId, `📋 *Comandos:*\n\n/start — Vincular cuenta\n/ayuda — Esta ayuda\n/ventas — Ventas de hoy\n/inventario — Stock bajo\n/deudas — Cartera pendiente\n/chat — Modo conversación IA\n\n💬 También puedes *escribir o hablar* como en la web:\n_"¿Cuánto vendí hoy?"_\n_"¿Quién me debe?"_\n_"Agrega 10 tornillos"_`);
    return;
  }

  const usuarioData = await getUsuarioByChatId(chatId);
  if (!usuarioData) {
    await sendTelegramPlain(chatId, `⚠️ Cuenta no vinculada.\n\nTu código es:\nTG-${chatId}\n\nPégalo en Configuración → Asistente IA`);
    return;
  }

  const supabase = await createAdminClient();
  const empresaId = usuarioData.empresa_id;
  const usuarioId = usuarioData.id;
  let session = await getTelegramSession(supabase, usuarioId);

  if (command === '/ventas') {
    const { count, total } = await getVentasHoy(empresaId);
    await sendTelegramMessage(chatId, `💰 *Ventas de Hoy*\n\n📊 Transacciones: ${count}\n💵 Total: $${total.toLocaleString('es-CO')}`);
    return;
  }

  if (command === '/inventario') {
    const bajo = await getStockBajo(empresaId);
    if (bajo.length === 0) {
      await sendTelegramMessage(chatId, '✅ *Inventario OK*\n\nNo hay productos con stock bajo.');
    } else {
      const list = bajo.slice(0, 10).map((p) => `• ${p.nombre}: ${p.stock_actual}/${p.stock_minimo}`).join('\n');
      await sendTelegramMessage(chatId, `⚠️ *Stock Bajo* (${bajo.length})\n\n${list}`);
    }
    return;
  }

  if (command === '/deudas') {
    const deudas = await getDeudas(empresaId);
    if (deudas.length === 0) {
      await sendTelegramMessage(chatId, '✅ *Sin deudas pendientes*');
    } else {
      const total = deudas.reduce((s, d) => s + (d.saldo_pendiente || 0), 0);
      const list = deudas.slice(0, 10).map((d) => {
        const cliente = (d.clientes as { nombre?: string })?.nombre ?? 'Cliente';
        return `• ${cliente}: $${(d.saldo_pendiente || 0).toLocaleString('es-CO')}`;
      }).join('\n');
      await sendTelegramMessage(chatId, `💳 *Cartera Pendiente*\n\nTotal: $${total.toLocaleString('es-CO')}\n\n${list}`);
    }
    return;
  }

  if (command === '/chat') {
    await sendTelegramMessage(chatId, '💬 *Modo chat activo*\n\nPregúntame lo que quieras sobre tu negocio. Recuerdo las últimas conversaciones.\n\nEjemplos:\n• ¿Cuántos clientes tengo?\n• Productos con stock bajo\n• ¿Cuánto vendí hoy?');
    return;
  }

  await sendTelegramMessage(chatId, '🤔 Procesando...');

  const result = await processBusinessChat({
    supabase,
    empresaId,
    usuarioId,
    message: userText,
    history: session.history,
    forTelegram: true,
  });

  const prefix = isVoice ? `🎤 _"${userText}"_\n\n` : '';
  const responseText = prefix + result.text;

  session = appendToHistory(session, userText, result.text);
  await saveTelegramSession(supabase, usuarioId, session);
  await sendTelegramMessage(chatId, responseText);
}
