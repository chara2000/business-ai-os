import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendTelegramLinkConfirmation } from '@/lib/telegram/messages';

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

  const rawToken = telegram_code.trim().toUpperCase();

  // ── NUEVO: Validar token seguro (tabla telegram_pending_links) ─────────
  const serviceClient = createServiceClient();
  const { data: pending, error: findError } = await serviceClient
    .from('telegram_pending_links')
    .select('*')
    .eq('token', rawToken)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  // ── FALLBACK: soporte legacy TG-{chatId} (transición) ─────────────────
  let chatId: string | null = null;
  let pendingFirstName: string | null = null;

  if (pending && !findError) {
    chatId = String(pending.chat_id);
    pendingFirstName = pending.first_name ?? null;
  } else {
    // Compatibilidad con el código viejo TG-xxxxx
    const legacyChatId = rawToken.replace(/^TG-/, '');
    if (/^\d+$/.test(legacyChatId)) {
      chatId = legacyChatId;
    } else {
      return NextResponse.json(
        { error: 'Código inválido o expirado. Pide uno nuevo con /start en el bot.' },
        { status: 400 }
      );
    }
  }

  // Obtener el usuario CRM
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, nombre')
    .eq('auth_user_id', user.id)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  // Limpiar el chat_id de otras cuentas para evitar duplicados
  if (chatId) {
    await serviceClient
      .from('usuarios')
      .update({ telegram_chat_id: null })
      .eq('telegram_chat_id', chatId);
  }

  // Guardar chat_id en el perfil del usuario
  const { error: updateError } = await serviceClient
    .from('usuarios')
    .update({ telegram_chat_id: chatId })
    .eq('id', usuario.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Marcar el token como usado (solo si es token seguro, no legacy)
  if (pending) {
    await serviceClient
      .from('telegram_pending_links')
      .update({ used: true })
      .eq('id', pending.id);
  }

  // ── MEJORA #2: Enviar confirmación al usuario en Telegram ──────────────
  try {
    const firstName = pendingFirstName ?? usuario.nombre ?? undefined;
    await sendTelegramLinkConfirmation(Number(chatId), firstName);
  } catch (confirmErr) {
    // No fallar si el mensaje de confirmación falla
    console.warn('[Telegram] Confirmación no enviada:', confirmErr);
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
