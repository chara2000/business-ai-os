import type { SupabaseClient } from '@supabase/supabase-js';
import { executeAIAction, isConsultaAction } from '@/lib/ai/executor';
import type { AIAction } from '@/lib/ai/types';
import { formatContextForPrompt, buildBusinessContext } from '@/lib/ai/context';
import { parseIntent } from './intent-parser';
import { enrichIntent, saveBusinessMemory } from './enrichment-engine';
import { validateBusinessRules } from './business-rules';
import {
  getActiveSession, saveSession, clearSession, patchSessionField,
} from './session-manager';
import { buildConfirmationCard, formatConfirmationText } from './confirmation-builder';
import { normalizeFieldKey } from './knowledge-engine';
import type { EngineResponse, EnrichedField } from './types';

export async function runActionEngine(params: {
  supabase: SupabaseClient;
  empresaId: string;
  usuarioId: string;
  message: string;
  permisos?: string[];
}): Promise<EngineResponse> {
  const { supabase, empresaId, usuarioId, message, permisos = [] } = params;

  const session = await getActiveSession(supabase, usuarioId);
  const businessCtx = await buildBusinessContext(supabase, empresaId);
  const contextHint = formatContextForPrompt(businessCtx);

  const intent = await parseIntent(message, contextHint, !!session);

  // ── Cancelar ──
  if (intent.es_cancelacion) {
    await clearSession(supabase, usuarioId);
    return { tipo: 'cancelado', texto: '❌ Acción cancelada. ¿En qué más te ayudo?' };
  }

  // ── Confirmar sesión activa ──
  if (intent.es_confirmacion && session) {
    if (session.campos_pendientes.length > 0) {
      return {
        tipo: 'confirmacion',
        texto: `Aún faltan campos: ${session.campos_pendientes.join(', ')}. Complétalos antes de confirmar.`,
        confirmacion: buildConfirmationCard({
          sessionId: session.id,
          accion: session.accion,
          entidad: session.entidad,
          campos: session.campos,
          campos_pendientes: session.campos_pendientes,
          listo: false,
        }),
        session_id: session.id,
      };
    }

    const result = await executeAIAction(supabase, empresaId, usuarioId, session.action);
    if (result.success && session.accion === 'crear_producto') {
      await saveBusinessMemory(supabase, empresaId, session.datos);
    }
    await clearSession(supabase, usuarioId);
    return {
      tipo: 'ejecutado',
      texto: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
      resultado: result,
    };
  }

  // ── Corrección de campo ──
  if (intent.es_correccion && session) {
    const fieldKey = normalizeFieldKey(intent.correccion_campo ?? '') ?? intent.correccion_campo ?? '';
    if (!fieldKey) {
      return { tipo: 'mensaje', texto: 'No entendí qué campo quieres cambiar. Ej: "Cambia el proveedor por Bosch".' };
    }
    const updated = await patchSessionField(supabase, session, fieldKey, intent.correccion_valor);
    const rules = validateBusinessRules(
      { ...intent, accion: updated.accion, entidad: updated.entidad, datos: updated.datos, es_consulta: false, es_confirmacion: false, es_cancelacion: false, es_correccion: false },
      updated.datos,
      updated.campos,
      permisos,
    );
    const card = buildConfirmationCard({
      sessionId: updated.id,
      accion: updated.accion,
      entidad: updated.entidad,
      campos: updated.campos,
      campos_pendientes: rules.campos_pendientes,
      listo: rules.valido,
    });
    await saveSession(supabase, { ...updated, campos_pendientes: rules.campos_pendientes });
    return {
      tipo: 'confirmacion',
      texto: `✏️ Actualicé **${fieldKey}**. Revisa la vista previa:\n\n${formatConfirmationText(card)}`,
      confirmacion: card,
      session_id: updated.id,
    };
  }

  // ── Consultas (solo lectura, sin confirmación) ──
  if (intent.es_consulta || isConsultaAction(intent.accion)) {
    const action: AIAction = { accion: intent.accion, entidad: intent.entidad, datos: intent.datos };
    const result = await executeAIAction(supabase, empresaId, usuarioId, action);
    return {
      tipo: 'consulta',
      texto: result.success ? result.message : `❌ ${result.message}`,
      resultado: result,
    };
  }

  // ── Nueva acción → enriquecer → validar → confirmar ──
  const { datos, campos } = await enrichIntent(supabase, empresaId, intent);
  const rules = validateBusinessRules(intent, datos, campos, permisos);

  if (!rules.valido && rules.errores.some((e) => e.includes('permiso'))) {
    return { tipo: 'error', texto: `❌ ${rules.errores.join(' ')}` };
  }

  const campos_inferidos = campos
    .filter((c) => c.source !== 'usuario')
    .map((c) => c.key);

  const action: AIAction = {
    accion: intent.accion,
    entidad: intent.entidad,
    datos,
    confirmacion_requerida: true,
  };

  const saved = await saveSession(supabase, {
    usuario_id: usuarioId,
    empresa_id: empresaId,
    accion: intent.accion,
    entidad: intent.entidad,
    datos,
    campos,
    campos_pendientes: rules.campos_pendientes,
    campos_inferidos,
    action,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });

  const card = buildConfirmationCard({
    sessionId: saved.id,
    accion: intent.accion,
    entidad: intent.entidad,
    campos,
    campos_pendientes: rules.campos_pendientes,
    listo: rules.valido,
  });

  const intro = intent.mensaje_usuario
    ? `${intent.mensaje_usuario}\n\n`
    : 'Preparé una propuesta con la información que pude completar automáticamente:\n\n';

  return {
    tipo: 'confirmacion',
    texto: intro + formatConfirmationText(card),
    confirmacion: card,
    session_id: saved.id,
  };
}

export function mergeCampos(
  existing: EnrichedField[],
  patch: Record<string, unknown>,
): EnrichedField[] {
  const keys = new Set(existing.map((c) => c.key));
  const merged = existing.map((c) =>
    patch[c.key] !== undefined
      ? { ...c, value: patch[c.key], displayValue: String(patch[c.key]), source: 'usuario' as const }
      : c,
  );
  for (const [key, value] of Object.entries(patch)) {
    if (!keys.has(key)) {
      merged.push({ key, label: key, value, displayValue: String(value), source: 'usuario' });
    }
  }
  return merged;
}
