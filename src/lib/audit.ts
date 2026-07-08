import type { SupabaseClient } from '@supabase/supabase-js';

type AuditInput = {
  empresaId: string;
  usuarioId: string | null;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  datosAnteriores?: Record<string, unknown> | null;
  datosNuevos?: Record<string, unknown> | null;
};

export async function logAudit(supabase: SupabaseClient, input: AuditInput) {
  try {
    await supabase.from('auditoria_logs').insert([{
      empresa_id: input.empresaId,
      usuario_id: input.usuarioId,
      accion: input.accion,
      entidad: input.entidad,
      entidad_id: input.entidadId ?? null,
      datos_anteriores: input.datosAnteriores ?? null,
      datos_nuevos: input.datosNuevos ?? null,
    }]);
  } catch {
    // No bloquear operaciones por fallo de auditoría
  }
}
