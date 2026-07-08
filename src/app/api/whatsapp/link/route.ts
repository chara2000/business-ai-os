import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function normalizeWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) throw new Error('Número inválido. Incluye código de país (ej: 573001234567)');
  return digits;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { whatsapp_number } = await req.json();
  if (!whatsapp_number?.trim()) {
    return NextResponse.json({ error: 'Número requerido' }, { status: 400 });
  }

  let phone: string;
  try {
    phone = normalizeWhatsAppNumber(whatsapp_number);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Número inválido';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from('usuarios')
    .select('id')
    .eq('whatsapp_number', phone)
    .neq('id', usuario.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Este número ya está vinculado a otra cuenta' }, { status: 409 });
  }

  const { error } = await supabase
    .from('usuarios')
    .update({ whatsapp_number: phone })
    .eq('id', usuario.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    whatsapp_number: phone,
    message: 'WhatsApp vinculado correctamente',
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { error } = await supabase
    .from('usuarios')
    .update({ whatsapp_number: null })
    .eq('auth_user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
