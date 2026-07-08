import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveServerEmpresaId } from '@/lib/server/empresa-context';
import { parseInvoiceFromImage } from '@/lib/ocr/parse-invoice';

import { resolveAIProvider } from '@/lib/ai/provider';

export async function POST(req: NextRequest) {
  const ctx = await resolveServerEmpresaId();
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const provider = resolveAIProvider();
  if (provider === 'gemini' && !process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 503 });
  }
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY no configurada' }, { status: 503 });
  }

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Solo imágenes JPG, PNG o WebP por ahora' }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  try {
    const parsed = await parseInvoiceFromImage(base64, file.type);

    const supabase = await createClient();
    const { data: ocrRecord } = await supabase.from('facturas_ocr').insert([{
      empresa_id: ctx.empresaId,
      usuario_id: ctx.usuario.id,
      archivo_url: file.name,
      proveedor_nombre: parsed.proveedor_nombre,
      nit: parsed.nit,
      fecha_factura: parsed.fecha || null,
      subtotal: parsed.subtotal,
      iva: parsed.iva,
      total: parsed.total,
      datos: parsed,
    }]).select('id').single();

    return NextResponse.json({
      success: true,
      data: parsed,
      ocr_id: ocrRecord?.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al procesar factura';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
