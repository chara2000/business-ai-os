import type { SupabaseClient } from '@supabase/supabase-js';
import { getActiveChatSession, saveChatSession, clearChatSession, type ChatSession } from './session-manager';
import { readBusinessMemory, saveBusinessMemory } from './business-memory';
import type { ChatMessage } from '../provider';

export class MemoryManager {
  constructor(
    private supabase: SupabaseClient,
    private empresaId: string,
    private usuarioId: string
  ) {}

  async getShortTermMemory(): Promise<ChatSession | null> {
    return getActiveChatSession(this.supabase, this.usuarioId);
  }

  async saveShortTermMemory(history: ChatMessage[], sessionId?: string, state?: Record<string, any>): Promise<ChatSession> {
    return saveChatSession(this.supabase, {
      id: sessionId,
      empresa_id: this.empresaId,
      usuario_id: this.usuarioId,
      history,
      state
    });
  }

  async clearShortTermMemory(): Promise<void> {
    return clearChatSession(this.supabase, this.usuarioId);
  }

  async getLongTermMemory(category?: string) {
    // Fetches learned insights or preferences from 'business_memory' table
    return readBusinessMemory(this.supabase, this.empresaId);
  }

  async saveLongTermMemory(data: Record<string, unknown>) {
    // Saves insights that should persist beyond the session
    return saveBusinessMemory(this.supabase, this.empresaId, data);
  }
}
