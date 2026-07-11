import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage } from '../provider';

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

export type ChatSession = {
  id: string;
  usuario_id: string;
  empresa_id: string;
  history: ChatMessage[];
  expires_at: string;
  state?: {
    pending_action?: { toolName: string; args: any };
    [key: string]: any;
  };
};

export async function getActiveChatSession(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<ChatSession | null> {
  const { data } = await supabase
    .from('ai_sessions')
    .select('*')
    .eq('usuario_id', usuarioId)
    .gt('expires_at', new Date().toISOString())
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  
  return {
    id: data.id,
    usuario_id: data.usuario_id,
    empresa_id: data.empresa_id,
    history: (data.state?.history || data.datos?.history || []) as ChatMessage[],
    expires_at: data.expires_at,
    state: data.state,
  };
}

export async function saveChatSession(
  supabase: SupabaseClient,
  session: Omit<ChatSession, 'id' | 'expires_at'> & { id?: string },
): Promise<ChatSession> {
  const expires_at = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  
  const payload = {
    usuario_id: session.usuario_id,
    empresa_id: session.empresa_id,
    accion: 'chat',
    entidad: 'consulta',
    state: { ...session.state, history: session.history },
    expires_at,
  };

  if (session.id) {
    const { data } = await supabase
      .from('ai_sessions')
      .update(payload)
      .eq('id', session.id)
      .select('id')
      .single();
    if (data) return { ...session, id: data.id, expires_at };
  }

  // Delete any old session before inserting new one to avoid conflicts if needed
  await supabase.from('ai_sessions').delete().eq('usuario_id', session.usuario_id);

  const { data } = await supabase
    .from('ai_sessions')
    .insert([payload])
    .select('id')
    .single();

  return { ...session, id: data!.id, expires_at };
}

export async function clearChatSession(supabase: SupabaseClient, usuarioId: string) {
  await supabase.from('ai_sessions').delete().eq('usuario_id', usuarioId);
}
