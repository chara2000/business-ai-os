import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveServerEmpresaId } from '@/lib/server/empresa-context';
import { fetchAppNotifications } from '@/lib/notifications/alerts';
import { sendWebPush } from '@/lib/notifications/web-push';

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

  try {
    await sendWebPush(
      { endpoint, p256dh: keys.p256dh, auth: keys.auth },
      {
        title: 'Business AI OS',
        body: 'Notificaciones push activadas correctamente',
        url: '/configuracion',
      },
    );
  } catch {
    // La suscripción quedó guardada aunque el push de bienvenida falle
  }

  return NextResponse.json({ success: true });
}

/** Envía una notificación de prueba a las suscripciones del usuario actual */
export async function PATCH() {
  const ctx = await resolveServerEmpresaId();
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'VAPID no configurado en el servidor' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('usuario_id', ctx.usuario.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!subs?.length) {
    return NextResponse.json({ error: 'No hay suscripciones push activas' }, { status: 404 });
  }

  let sent = 0;
  const stale: string[] = [];

  for (const sub of subs) {
    try {
      await sendWebPush(sub, {
        title: 'Prueba de notificación',
        body: 'Si ves esto, las alertas push están funcionando.',
        url: '/dashboard',
      });
      sent += 1;
    } catch (err) {
      const status = err && typeof err === 'object' && 'statusCode' in err
        ? (err as { statusCode?: number }).statusCode
        : 0;
      if (status === 404 || status === 410) stale.push(sub.endpoint);
    }
  }

  if (stale.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', stale);
  }

  return NextResponse.json({ success: true, sent, removed: stale.length });
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
