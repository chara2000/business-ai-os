import type { SupabaseClient } from '@supabase/supabase-js';
import { buildBusinessContext, formatContextForPrompt } from '@/lib/ai/context';
import { executeAIAction } from '@/lib/ai/executor';
import { aiChatCompletion } from '@/lib/ai/provider';
import type { AIAction } from '@/lib/ai/types';
import type { ChatMessage } from '@/lib/ai/provider';

export function buildSystemPrompt(contextBlock: string, options?: { forTelegram?: boolean }) {
  const telegramNote = options?.forTelegram
    ? '\n- Responde en máximo 200 palabras, apto para Telegram, con emojis moderados.'
    : '';

  return `Eres Business Assistant, un asistente de inteligencia artificial especializado en administración empresarial para pequeñas y medianas empresas. Eres parte de Business AI OS.

Tu función principal es:
1. Ayudar al dueño del negocio a controlar inventario, ventas, compras, clientes y finanzas.
2. Interpretar intenciones y generar acciones estructuradas JSON cuando el usuario quiere hacer cambios.
3. Consultar información del negocio y responder de forma clara y concisa usando el CONTEXTO EN TIEMPO REAL.
4. Hablar siempre en español, de forma amigable pero profesional.

REGLAS CRÍTICAS:
- Usa el contexto del negocio para responder consultas sin inventar datos.
- Cuando el usuario pide una acción (crear, actualizar, eliminar), responde con texto breve Y genera el JSON de acción.
- Para consultas de datos, usa acciones consultar_* con confirmacion_requerida: false.
- Para acciones de escritura (crear, actualizar, registrar), ejecuta directamente con confirmacion_requerida: false — no pidas confirmación al usuario.
- Sé breve. Máximo 2-3 párrafos.
- Usa emojis con moderación.${telegramNote}

FORMATO DE ACCIÓN JSON (incluir SOLO cuando hay una acción a ejecutar):
\`\`\`json
{
  "accion": "crear_producto|actualizar_producto|crear_venta|crear_cliente|registrar_abono|consultar_ventas_hoy|consultar_stock_bajo|consultar_deudores|consultar_clientes",
  "entidad": "producto|venta|cliente|credito|consulta",
  "datos": { },
  "confirmacion_requerida": true|false
}
\`\`\`

ACCIONES DE CONSULTA (confirmacion_requerida: false):
- "¿Cuánto vendí hoy?" → consultar_ventas_hoy
- "Productos con stock bajo" → consultar_stock_bajo
- "¿Quién me debe?" → consultar_deudores
- "¿Cuántos clientes tengo?" → consultar_clientes

ACCIONES DE ESCRITURA (confirmacion_requerida: false — ejecutar de inmediato):
- "Agrega 20 baterías Bosch" → crear_producto con nombre y cantidad
- "Registra abono de Carlos por 200000" → registrar_abono

CONTEXTO DEL NEGOCIO (tiempo real):
${contextBlock}`;
}

export function extractAction(text: string): AIAction | null {
  let action: AIAction | null = null;
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    try { action = JSON.parse(jsonMatch[1]); } catch { /* ignore */ }
  }
  if (!action) {
    const inlineMatch = text.match(/\{[\s\S]*"accion"[\s\S]*\}/);
    if (inlineMatch) {
      try { action = JSON.parse(inlineMatch[0]); } catch { /* ignore */ }
    }
  }
  return action;
}

export function cleanChatText(text: string) {
  return text
    .replace(/```json\n[\s\S]*?\n```/g, '')
    .replace(/\{[\s\S]*"accion"[\s\S]*\}/g, '')
    .trim();
}

export type ProcessChatResult = {
  text: string;
  action: AIAction | null;
  executed: boolean;
  executionResult: { success: boolean; message: string } | null;
  pendingConfirmation: boolean;
  provider: string;
  model: string;
};

export async function processBusinessChat(params: {
  supabase: SupabaseClient;
  empresaId: string;
  usuarioId?: string | null;
  message: string;
  history?: ChatMessage[];
  forTelegram?: boolean;
  maxTokens?: number;
  pendingAction?: AIAction | null;
  confirmNow?: boolean;
}): Promise<ProcessChatResult> {
  const {
    supabase, empresaId, usuarioId, message, history = [],
    forTelegram, maxTokens, pendingAction, confirmNow,
  } = params;

  if (confirmNow && pendingAction) {
    if (!usuarioId) {
      return {
        text: '❌ No se pudo confirmar la acción sin usuario vinculado.',
        action: pendingAction,
        executed: false,
        executionResult: null,
        pendingConfirmation: false,
        provider: 'system',
        model: 'confirm',
      };
    }
    const executionResult = await executeAIAction(supabase, empresaId, usuarioId, pendingAction);
    return {
      text: executionResult.success
        ? `✅ ${executionResult.message}`
        : `❌ ${executionResult.message}`,
      action: pendingAction,
      executed: true,
      executionResult,
      pendingConfirmation: false,
      provider: 'system',
      model: 'confirm',
    };
  }

  const businessCtx = await buildBusinessContext(supabase, empresaId);
  const contextBlock = formatContextForPrompt(businessCtx);
  const systemPrompt = buildSystemPrompt(contextBlock, { forTelegram });

  const messages: ChatMessage[] = [
    ...history,
    { role: 'user', content: message },
  ];

  const completion = await aiChatCompletion({
    systemPrompt,
    messages,
    maxTokens: maxTokens ?? (forTelegram ? 768 : 1024),
    temperature: 0.7,
  });

  const rawText = completion.text || 'No pude generar una respuesta.';
  const action = extractAction(rawText);
  let cleanResponse = cleanChatText(rawText);
  let executionResult: { success: boolean; message: string } | null = null;
  let executed = false;
  let pendingConfirmation = false;

  if (action && usuarioId) {
    executionResult = await executeAIAction(supabase, empresaId, usuarioId, action);
    executed = true;
    if (executionResult.success) {
      cleanResponse = cleanResponse
        ? `${cleanResponse}\n\n✅ ${executionResult.message}`
        : `✅ ${executionResult.message}`;
    } else if (!cleanResponse) {
      cleanResponse = `❌ ${executionResult.message}`;
    }
  }

  if (!cleanResponse) {
    cleanResponse = 'Listo. ¿En qué más te ayudo?';
  }

  return {
    text: cleanResponse,
    action,
    executed,
    executionResult,
    pendingConfirmation,
    provider: completion.provider,
    model: completion.model,
  };
}

export function isConfirmationYes(text: string): boolean {
  const t = text.trim().toLowerCase();
  return ['si', 'sí', 'yes', 'confirmar', 'confirmo', 'ok', 'dale', 'hazlo'].includes(t);
}

export function isConfirmationNo(text: string): boolean {
  const t = text.trim().toLowerCase();
  return ['no', 'cancelar', 'cancela', 'nope'].includes(t);
}
