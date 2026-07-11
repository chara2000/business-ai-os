import type { SupabaseClient } from '@supabase/supabase-js';
import { buildBusinessContext, formatContextForPrompt } from '../context';
import type { ChatSession } from './session-manager';

export interface AgentContext {
  empresaId: string;
  usuarioId: string;
  channel: 'web' | 'whatsapp' | 'telegram';
  businessContextStr: string;
  session: ChatSession | null;
  permisos: string[];
}

export async function buildAgentContext(
  supabase: SupabaseClient,
  empresaId: string,
  usuarioId: string,
  channel: 'web' | 'whatsapp' | 'telegram' = 'web',
  session: ChatSession | null = null,
  permisos: string[] = []
): Promise<AgentContext> {
  const businessCtx = await buildBusinessContext(supabase, empresaId);
  const businessContextStr = formatContextForPrompt(businessCtx);

  return {
    empresaId,
    usuarioId,
    channel,
    businessContextStr,
    session,
    permisos
  };
}
