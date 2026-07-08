import type { SupabaseClient } from '@supabase/supabase-js';
import type { AIAction } from '@/lib/ai/types';
import type { AISessionState, EnrichedField } from './types';

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

export async function getActiveSession(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<AISessionState | null> {
  const { data } = await supabase
    .from('ai_sessions')
    .select('*')
    .eq('usuario_id', usuarioId)
    .gt('expires_at', new Date().toISOString())
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return mapRow(data);
}

export async function saveSession(
  supabase: SupabaseClient,
  session: Omit<AISessionState, 'id' | 'created_at'> & { id?: string },
): Promise<AISessionState> {
  const expires_at = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const payload = {
    usuario_id: session.usuario_id,
    empresa_id: session.empresa_id,
    accion: session.accion,
    entidad: session.entidad,
    state: {
      datos: session.datos,
      campos: session.campos,
      campos_pendientes: session.campos_pendientes,
      campos_inferidos: session.campos_inferidos,
      action: session.action,
    },
    expires_at,
    updated_at: new Date().toISOString(),
  };

  if (session.id) {
    const { data, error } = await supabase
      .from('ai_sessions')
      .update(payload)
      .eq('id', session.id)
      .select('*')
      .single();
    if (error) throw error;
    return mapRow(data);
  }

  await supabase.from('ai_sessions').delete().eq('usuario_id', session.usuario_id);

  const { data, error } = await supabase
    .from('ai_sessions')
    .insert([payload])
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function clearSession(supabase: SupabaseClient, usuarioId: string) {
  await supabase.from('ai_sessions').delete().eq('usuario_id', usuarioId);
}

export async function patchSessionField(
  supabase: SupabaseClient,
  session: AISessionState,
  fieldKey: string,
  value: unknown,
): Promise<AISessionState> {
  const datos = { ...session.datos, [fieldKey]: value };
  const campos = session.campos.map((c) =>
    c.key === fieldKey
      ? { ...c, value, displayValue: String(value), source: 'usuario' as const }
      : c,
  );
  if (!campos.find((c) => c.key === fieldKey)) {
    campos.push({
      key: fieldKey,
      label: fieldKey,
      value,
      displayValue: String(value),
      source: 'usuario',
    });
  }

  const action: AIAction = {
    accion: session.accion,
    entidad: session.entidad,
    datos,
    confirmacion_requerida: true,
  };

  return saveSession(supabase, {
    ...session,
    datos,
    campos,
    campos_pendientes: session.campos_pendientes.filter((k) => k !== fieldKey),
    action,
  });
}

function mapRow(row: Record<string, unknown>): AISessionState {
  const state = (row.state ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id),
    usuario_id: String(row.usuario_id),
    empresa_id: String(row.empresa_id),
    accion: String(row.accion),
    entidad: row.entidad as AISessionState['entidad'],
    datos: (state.datos ?? {}) as Record<string, unknown>,
    campos: (state.campos ?? []) as EnrichedField[],
    campos_pendientes: (state.campos_pendientes ?? []) as string[],
    campos_inferidos: (state.campos_inferidos ?? []) as string[],
    action: (state.action ?? { accion: row.accion, datos: state.datos }) as AIAction,
    expires_at: String(row.expires_at),
    created_at: String(row.created_at ?? row.updated_at),
  };
}
