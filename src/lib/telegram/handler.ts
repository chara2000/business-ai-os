import { createAdminClient } from '@/lib/supabase/server';
import { transcribeAudioBuffer, downloadTelegramFile } from '@/lib/ai/ask';
import { ContextBuilder } from '@/lib/ai/core/understanding/context-builder';
import { runActionEngine } from '@/lib/ai/engine/pipeline';
import { getActiveChatSession, clearChatSession } from '@/lib/ai/engine/session-manager';
import { saveBusinessMemory } from '@/lib/ai/engine/enrichment-engine';
import { executeAIAction } from '@/lib/ai/executor';
import type { EngineResponse } from '@/lib/ai/engine/types';
import {
  sendTelegramMessage,
  sendTelegramPlain,
  sendTelegramLinkCode,
  buildTelegramLinkCode,
  normalizeTelegramCommand,
  sendTelegramWithKeyboard,
  answerTelegramCallback,
  removeTelegramKeyboard,
} from '@/lib/telegram/messages';
import {
  formatTelegramConfirmation,
  buildConfirmationKeyboard,
  parseConfirmationCallback,
} from '@/lib/telegram/confirmation-format';
import {
  analyzeTelegramImage,
  buildMessageFromImageAnalysis,
  followUpForImageAnalysis,
} from '@/lib/telegram/image-analysis';

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

async function runEngineForUser(
  empresaId: string,
  usuarioId: string,
  message: string,
  prefillDatos?: Record<string, unknown>,
) {
  const supabase = await createAdminClient();
  const { data: usuarioRow } = await supabase
    .from('usuarios')
    .select('permisos, rol')
    .eq('id', usuarioId)
    .single();

  const permisos = Array.isArray(usuarioRow?.permisos) ? usuarioRow.permisos as string[] : [];

  return runActionEngine({
    supabase,
    empresaId,
    usuarioId,
    message,
    permisos,
    channel: 'telegram',
    prefillDatos,
  });
}

async function sendEngineResponse(chatId: number, result: EngineResponse) {
  if (result.confirmacion) {
    const text = formatTelegramConfirmation(result.confirmacion);
    if (result.confirmacion.listo_para_confirmar) {
      await sendTelegramWithKeyboard(chatId, text, buildConfirmationKeyboard(result.confirmacion.session_id));
    } else {
      await sendTelegramPlain(chatId, text);
    }
    return;
  }

  await sendTelegramPlain(chatId, result.texto);
}

const EDIT_PROMPT = `✏️ ¿Qué deseas cambiar?

Puedes escribir o hablar, por ejemplo:
• "Cambia la cantidad a 20"
• "El precio de venta es 18000"
• "La categoría es Eléctrico"
• "El proveedor es Suzuki"`;

async function handleCallbackQuery(callback: Record<string, unknown>) {
  const id = callback.id as string;
  const data = callback.data as string;
  const message = callback.message as { chat: { id: number }; message_id: number } | undefined;
  if (!message) return;

  const chatId = message.chat.id;
  const parsed = parseConfirmationCallback(data);

  // Responder al toque del botón de inmediato (Telegram exige < 1s)
  if (!parsed) {
    await answerTelegramCallback(id, 'Acción no reconocida');
    return;
  }

  await answerTelegramCallback(
    id,
    parsed.action === 'confirm' ? 'Guardando...' : parsed.action === 'edit' ? 'Modo edición' : 'Cancelado',
  );

  void removeTelegramKeyboard(chatId, message.message_id).catch(() => {});

  const usuarioData = await getUsuarioByChatId(chatId);
  if (!usuarioData) {
    await sendTelegramPlain(chatId, '⚠️ Cuenta no vinculada.');
    return;
  }

  if (parsed.action === 'edit') {
    await sendTelegramPlain(chatId, EDIT_PROMPT);
    return;
  }

  const supabase = await createAdminClient();

  if (parsed.action === 'cancel') {
    await clearChatSession(supabase, usuarioData.id);
    await sendTelegramPlain(chatId, '❌ Acción cancelada. ¿En qué más te ayudo?');
    return;
  }

  if (parsed.action === 'confirm') {
    const session = await getActiveChatSession(supabase, usuarioData.id);
    const pendingAction = session?.state?.pending_action;
    
    if (!pendingAction) {
      await sendTelegramPlain(chatId, '❌ No se encontró ninguna acción pendiente para confirmar.');
      return;
    }

    try {
      const { ToolOrchestrator } = await import('../ai/engine/tool-orchestrator');
      const orchestrator = new ToolOrchestrator(supabase, usuarioData.empresa_id, usuarioData.id, 'admin', []);
      const result = await orchestrator.executeTool(pendingAction.toolName, pendingAction.args);
      
      if (result && result.success === false) {
        throw new Error(result.message || 'Error desconocido al ejecutar');
      }
      
      await clearChatSession(supabase, usuarioData.id);
      
      const finalMessage = result?.message ? `✅ ¡Listo! ${result.message}` : '✅ ¡Listo! La acción ha sido guardada correctamente en el sistema.';
      await sendTelegramPlain(chatId, finalMessage);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await sendTelegramPlain(chatId, `❌ Hubo un error al ejecutar la acción: ${msg}`);
    }
  }
}

async function handleImageMessage(
  chatId: number,
  empresaId: string,
  usuarioId: string,
  fileId: string,
  mimeType: string,
) {
  await sendTelegramPlain(chatId, '📸 Analizando imagen con IA...');
  try {
    const buffer = await downloadTelegramFile(fileId);
    const analysis = await analyzeTelegramImage(buffer, mimeType);

    if (analysis.tipo === 'desconocido') {
      await sendTelegramPlain(chatId, analysis.mensaje);
      return;
    }

    const { message, prefill } = buildMessageFromImageAnalysis(analysis);
    const followUp = followUpForImageAnalysis(analysis);

    const result = await runEngineForUser(empresaId, usuarioId, message, prefill);
    await sendEngineResponse(chatId, result);

    if (followUp && !result.confirmacion?.listo_para_confirmar) {
      await sendTelegramPlain(chatId, followUp);
    }
  } catch {
    await sendTelegramPlain(chatId, '❌ No pude procesar la imagen. Intenta con mejor luz o envía los datos por texto.');
  }
}

export async function handleTelegramUpdate(body: Record<string, unknown>) {
  const callbackQuery = body?.callback_query as Record<string, unknown> | undefined;
  if (callbackQuery) {
    await handleCallbackQuery(callbackQuery);
    return;
  }

  const message = body?.message as Record<string, unknown> | undefined;
  if (!message) return;

  const chat = message.chat as { id: number };
  const chatId = chat.id;
  const from = message.from as { first_name?: string } | undefined;
  const firstName = from?.first_name ?? 'Usuario';
  const text = (message.text as string | undefined)?.trim() ?? '';
  let userText = text;
  const isVoice = !!(message.voice as { file_id?: string } | undefined)?.file_id;
  const photos = message.photo as { file_id: string }[] | undefined;
  const document = message.document as { file_id: string; mime_type?: string } | undefined;

  if (isVoice) {
    const voice = message.voice as { file_id: string };
    await sendTelegramMessage(chatId, '🎤 Transcribiendo tu mensaje de voz...');
    try {
      const buffer = await downloadTelegramFile(voice.file_id);

      // Obtener contexto dinámico del negocio para mejorar la transcripción de Whisper
      const supabaseForContext = await createAdminClient();
      const userDataForContext = await getUsuarioByChatId(chatId);
      let contextPrompt: string | undefined;
      if (userDataForContext?.empresa_id) {
        contextPrompt = await ContextBuilder.buildAudioPrompt(supabaseForContext, userDataForContext.empresa_id);
      }

      userText = await transcribeAudioBuffer(buffer, 'voice.ogg', contextPrompt);
      if (!userText) {
        await sendTelegramMessage(chatId, '❌ No pude entender el audio. Intenta de nuevo o escribe tu mensaje.');
        return;
      }
      await sendTelegramPlain(chatId, `📝 Entendí: "${userText.trim()}"`);
    } catch {
      await sendTelegramMessage(chatId, '❌ Error al procesar el audio.');
      return;
    }
  }

  const hasImage = (photos?.length ?? 0) > 0
    || (document?.mime_type?.startsWith('image/') ?? false);

  if (!userText && !hasImage) return;

  const command = userText ? normalizeTelegramCommand(userText) : '';

  if (command === '/start') {
    await sendTelegramLinkCode(chatId, firstName);
    return;
  }

  if (command === '/codigo' || command === '/code') {
    // Generar un nuevo token seguro — redirigir al mismo flujo de /start
    await sendTelegramLinkCode(chatId, firstName);
    return;
  }

  if (command === '/ayuda' || command === '/help') {
    await sendTelegramMessage(chatId, `📋 *Comandos:*\n\n/start — Vincular cuenta\n/ayuda — Esta ayuda\n/ventas — Ventas de hoy\n/inventario — Stock bajo\n/deudas — Cartera pendiente\n\n💬 *Inventario por voz o texto:*\n_"Agrega 10 baterías Suzuki, compra 10 mil venta 15 mil"_\n\n📸 *Envía foto de factura* → extrae producto, cantidad y costo\n📷 *Envía foto del producto* → detecta nombre y categoría`);
    return;
  }

  const usuarioData = await getUsuarioByChatId(chatId);
  if (!usuarioData) {
    await sendTelegramPlain(chatId, `⚠️ Cuenta no vinculada.\n\nTu código es:\nTG-${chatId}\n\nPégalo en Configuración → Asistente IA`);
    return;
  }

  const empresaId = usuarioData.empresa_id;
  const usuarioId = usuarioData.id;

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
    await sendTelegramMessage(chatId, '💬 *Modo chat activo*\n\nPregúntame sobre tu negocio o registra productos por voz.\n\nEjemplos:\n• Agrega 20 baterías Bosch\n• ¿Cuánto vendí hoy?\n• Productos con stock bajo');
    return;
  }

  if (hasImage) {
    const fileId = photos?.length
      ? photos[photos.length - 1].file_id
      : document!.file_id;
    const mimeType = document?.mime_type ?? 'image/jpeg';
    await handleImageMessage(chatId, empresaId, usuarioId, fileId, mimeType);
    return;
  }

  if (!isVoice && !hasImage) {
    await sendTelegramPlain(chatId, '🤔 Procesando...');
  }

  if (['editar', 'editar datos', 'modificar'].includes(userText.toLowerCase())) {
    await sendTelegramPlain(chatId, EDIT_PROMPT);
    return;
  }

  const result = await runEngineForUser(empresaId, usuarioId, userText);
  await sendEngineResponse(chatId, result);
}
