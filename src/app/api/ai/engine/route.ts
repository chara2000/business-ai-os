import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveServerEmpresaId } from '@/lib/server/empresa-context';
import { getEffectivePermisos } from '@/lib/permissions';
import { runActionEngine } from '@/lib/ai/engine/pipeline';
import { getActiveProviderLabel } from '@/lib/ai/provider';

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveServerEmpresaId();
    if (!ctx) {
      return NextResponse.json({ error: 'No autenticado o sin empresa' }, { status: 401 });
    }

    const { message } = await req.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 });
    }

    const supabase = await createClient();
    const permisos = getEffectivePermisos(ctx.usuario);

    const result = await runActionEngine({
      supabase,
      empresaId: ctx.empresaId,
      usuarioId: ctx.usuario.id,
      message: message.trim(),
      permisos,
    });

    return NextResponse.json({
      ...result,
      providerLabel: getActiveProviderLabel(),
    });
  } catch (error: unknown) {
    console.error('[AI Engine Error]', error);
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ tipo: 'error', texto: msg }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const ctx = await resolveServerEmpresaId();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const supabase = await createClient();
    const { clearChatSession } = await import('@/lib/ai/engine/session-manager');
    await clearChatSession(supabase, ctx.usuario.id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
