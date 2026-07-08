import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveServerEmpresaId } from '@/lib/server/empresa-context';
import { fetchAppNotifications } from '@/lib/notifications/alerts';

export async function GET() {
  const ctx = await resolveServerEmpresaId();
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const supabase = await createClient();
  const notifications = await fetchAppNotifications(supabase, ctx.empresaId);

  return NextResponse.json({ success: true, data: notifications, count: notifications.length });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveServerEmpresaId();
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await req.json();
  const { endpoint, keys } = body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from('push_subscriptions').upsert(
    [{
      usuario_id: ctx.usuario.id,
      empresa_id: ctx.empresaId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }],
    { onConflict: 'endpoint' },
  );

  if (error) {
    if (error.message.includes('push_subscriptions')) {
      return NextResponse.json({
        error: 'Tabla push_subscriptions no existe. Ejecuta supabase-push.sql',
      }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const ctx = await resolveServerEmpresaId();
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { endpoint } = await req.json();
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint requerido' }, { status: 400 });
  }

  const supabase = await createClient();
  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('usuario_id', ctx.usuario.id);

  return NextResponse.json({ success: true });
}
