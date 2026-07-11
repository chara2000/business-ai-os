import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuditRecord {
  empresaId: string;
  usuarioId: string;
  prompt?: string;
  toolUsed: string;
  arguments: unknown;
  success: boolean;
  error?: string;
  durationMs: number;
}

export class AuditManager {
  constructor(private supabase: SupabaseClient) {}

  async logAction(record: AuditRecord) {
    // Para no bloquear la ejecución principal, simplemente lanzamos la petición y hacemos catch silencioso
    this.supabase.from('ai_audit_logs').insert([{
      empresa_id: record.empresaId,
      usuario_id: record.usuarioId,
      prompt: record.prompt,
      tool_used: record.toolUsed,
      arguments: record.arguments,
      success: record.success,
      error: record.error,
      duration_ms: record.durationMs
    }]).then(({ error }) => {
      if (error) console.error('[AuditManager] Error guardando log:', error.message);
    });
  }
}
