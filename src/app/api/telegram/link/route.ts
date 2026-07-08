import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { telegram_code } = await req.json();
  if (!telegram_code) {
    return NextResponse.json({ error: 'Código requerido' }, { status: 400 });
  }

  const chatId = telegram_code.replace(/^TG-/, '');
  if (!/^\d+$/.test(chatId)) {
    return NextResponse.json({ error: 'Código inválido. Formato: TG-123456789' }, { status: 400 });
  }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  const { error } = await supabase
    .from('usuarios')
    .update({ telegram_chat_id: chatId })
    .eq('id', usuario.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Telegram vinculado correctamente',
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
    .update({ telegram_chat_id: null })
    .eq('auth_user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
