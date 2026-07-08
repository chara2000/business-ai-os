import { NextRequest, NextResponse } from 'next/server';
import { resolveServerEmpresaId } from '@/lib/server/empresa-context';
import { transcribeAudioBuffer } from '@/lib/ai/ask';

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveServerEmpresaId();
    if (!ctx) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get('audio') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Archivo de audio requerido' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const text = await transcribeAudioBuffer(buffer, file.name || 'audio.webm');

    if (!text) {
      return NextResponse.json({ error: 'No se pudo transcribir el audio' }, { status: 422 });
    }

    return NextResponse.json({ success: true, text });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al transcribir';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
