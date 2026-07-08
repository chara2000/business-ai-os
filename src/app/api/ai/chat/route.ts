import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveServerEmpresaId } from '@/lib/server/empresa-context';
import { processBusinessChat } from '@/lib/ai/chat-engine';
import { getActiveProviderLabel } from '@/lib/ai/provider';

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveServerEmpresaId();
    if (!ctx) {
      return NextResponse.json({ error: 'No autenticado o sin empresa' }, { status: 401 });
    }

    const { message, history = [] } = await req.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 });
    }

    const supabase = await createClient();
    const result = await processBusinessChat({
      supabase,
      empresaId: ctx.empresaId,
      usuarioId: ctx.usuario.id,
      message,
      history: history.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    return NextResponse.json({
      text: result.text,
      action: result.action,
      executed: result.executed,
      executionResult: result.executionResult,
      provider: result.provider,
      model: result.model,
      providerLabel: getActiveProviderLabel(),
    });
  } catch (error: unknown) {
    console.error('[AI Chat Error]', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json(
      { error: message, text: 'Hubo un error procesando tu solicitud. Verifica GEMINI_API_KEY en .env.local' },
      { status: 500 },
    );
  }
}
