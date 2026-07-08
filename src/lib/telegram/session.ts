import type { SupabaseClient } from '@supabase/supabase-js';
import type { AIAction } from '@/lib/ai/types';
import type { ChatMessage } from '@/lib/ai/provider';

const MAX_HISTORY = 8;

export type TelegramSession = {
  history: ChatMessage[];
  pendingAction: AIAction | null;
};

const defaultSession = (): TelegramSession => ({ history: [], pendingAction: null });

export async function getTelegramSession(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<TelegramSession> {
  const { data } = await supabase
    .from('usuarios')
    .select('telegram_session')
    .eq('id', usuarioId)
    .single();

  const raw = data?.telegram_session as TelegramSession | null;
  if (!raw || typeof raw !== 'object') return defaultSession();
  return {
    history: Array.isArray(raw.history)
      ? raw.history
          .filter((m): m is ChatMessage => m?.role === 'user' || m?.role === 'assistant')
          .slice(-MAX_HISTORY)
      : [],
    pendingAction: raw.pendingAction ?? null,
  };
}

export async function saveTelegramSession(
  supabase: SupabaseClient,
  usuarioId: string,
  session: TelegramSession,
) {
  await supabase.from('usuarios').update({
    telegram_session: {
      history: session.history.slice(-MAX_HISTORY),
      pendingAction: session.pendingAction,
    },
  }).eq('id', usuarioId);
}

export function appendToHistory(
  session: TelegramSession,
  userMessage: string,
  assistantMessage: string,
): TelegramSession {
  return {
    ...session,
    history: [
      ...session.history,
      { role: 'user' as const, content: userMessage },
      { role: 'assistant' as const, content: assistantMessage },
    ].slice(-MAX_HISTORY),
  };
}
