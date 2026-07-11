import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { transcribeAudioBuffer } from '@/lib/ai/ask';
import { runActionEngine } from '@/lib/ai/engine';

export const dynamic = 'force-dynamic';

const WA_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}`;

async function sendWhatsAppMessage(to: string, message: string) {
  await fetch(`${WA_API_URL}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message },
    }),
  });
}

async function transcribeAudio(audioId: string): Promise<string> {
  const mediaRes = await fetch(`https://graph.facebook.com/v18.0/${audioId}`, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
  });
  const mediaData = await mediaRes.json();
  const audioRes = await fetch(mediaData.url, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
  });
  const audioBuffer = await audioRes.arrayBuffer();
  return transcribeAudioBuffer(audioBuffer, 'audio.ogg');
}

async function getUsuarioByPhone(phone: string) {
  const supabase = await createAdminClient();
  const { data } = await supabase
    .from('usuarios')
    .select('id, empresa_id, permisos, rol')
    .eq('whatsapp_number', phone)
    .single();
  return data;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const value = body.entry?.[0]?.changes?.[0]?.value;
    if (!value?.messages?.[0]) return NextResponse.json({ status: 'ok' });

    const msg = value.messages[0];
    const from = msg.from;
    const contactName = value.contacts?.[0]?.profile?.name ?? 'Usuario';

    let userText = '';
    if (msg.type === 'text') userText = msg.text?.body?.trim() ?? '';

    if (msg.type === 'audio' && msg.audio?.id) {
      await sendWhatsAppMessage(from, '🎤 Procesando tu mensaje de voz...');
      userText = await transcribeAudio(msg.audio.id);
      if (!userText) {
        await sendWhatsAppMessage(from, '❌ No pude transcribir el audio. Intenta de nuevo o escribe tu mensaje.');
        return NextResponse.json({ status: 'ok' });
      }
    }

    if (!userText) return NextResponse.json({ status: 'ok' });

    if (['hola', 'hi', 'hello', 'buenas', 'inicio'].includes(userText.toLowerCase())) {
      await sendWhatsAppMessage(from,
        `👋 ¡Hola ${contactName}!\n\nSoy *Business Assistant* — tu gerente digital.\n\nPuedo ayudarte con inventario, ventas, compras, devoluciones y reportes.\n\nEscribe o envía un audio con lo que necesitas.`,
      );
      return NextResponse.json({ status: 'ok' });
    }

    const usuario = await getUsuarioByPhone(from);
    if (!usuario?.empresa_id) {
      await sendWhatsAppMessage(from,
        `⚠️ Tu número no está vinculado.\n\nVe a *Configuración → Bots* y vincula: *${from}*`,
      );
      return NextResponse.json({ status: 'ok' });
    }

    const supabase = await createAdminClient();
    const permisos = usuario.permisos?.length
      ? usuario.permisos
      : usuario.rol === 'owner' || usuario.rol === 'super_admin' ? ['*'] : [];

    const response = await runActionEngine({
      supabase,
      empresaId: usuario.empresa_id,
      usuarioId: usuario.id,
      message: userText,
      permisos,
      channel: 'telegram',
    });

    const text = response.texto
      || response.resultado?.message
      || (response.tipo === 'confirmacion' ? 'Revisa la propuesta y confirma con "registrar" o "cancelar".' : 'Listo.');

    await sendWhatsAppMessage(from, text.slice(0, 4000));
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('[WhatsApp Webhook Error]', error);
    return NextResponse.json({ status: 'ok' });
  }
}
