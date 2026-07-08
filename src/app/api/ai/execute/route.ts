import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveServerEmpresaId } from '@/lib/server/empresa-context';
import { executeAIAction, isConsultaAction } from '@/lib/ai/executor';
import type { AIAction } from '@/lib/ai/types';

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveServerEmpresaId();
    if (!ctx) {
      return NextResponse.json({ error: 'No autenticado o sin empresa' }, { status: 401 });
    }

    const { action } = await req.json() as { action?: AIAction };
    if (!action?.accion) {
      return NextResponse.json({ error: 'Acción requerida' }, { status: 400 });
    }

    const supabase = await createClient();
    const result = await executeAIAction(
      supabase,
      ctx.empresaId,
      ctx.usuario.id,
      action,
    );

    return NextResponse.json({
      ...result,
      executed: true,
      consulta: isConsultaAction(action.accion),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al ejecutar acción';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
