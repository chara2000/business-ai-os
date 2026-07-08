import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { transcribeAudioBuffer } from '@/lib/ai/ask';

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

async function getEmpresaByPhone(phone: string) {
  const supabase = await createAdminClient();
  const { data } = await supabase
    .from('usuarios')
    .select('empresa_id, empresas(*)')
    .eq('whatsapp_number', phone)
    .single();
  return data;
}

async function callAI(message: string, empresaContext: Record<string, unknown>) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history: [] }),
  });
  if (!res.ok) return '❌ Error procesando tu consulta.';
  const data = await res.json();
  return data.text || '❌ Sin respuesta.';
}

// ── GET — Verify webhook from Meta ────────────────────────────────
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

// ── POST — Handle incoming messages ──────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages?.[0]) {
      return NextResponse.json({ status: 'ok' });
    }

    const msg = value.messages[0];
    const from = msg.from; // WhatsApp number
    const contactName = value.contacts?.[0]?.profile?.name ?? 'Usuario';

    let userText = '';

    // Handle text message
    if (msg.type === 'text') {
      userText = msg.text?.body?.trim() ?? '';
    }

    // Handle audio (voice note) — Transcribe with Whisper
    if (msg.type === 'audio' && msg.audio?.id) {
      await sendWhatsAppMessage(from, '🎤 Procesando tu mensaje de voz...');
      userText = await transcribeAudio(msg.audio.id);
      if (!userText) {
        await sendWhatsAppMessage(from, '❌ No pude transcribir el audio. Intenta de nuevo o escribe tu mensaje.');
        return NextResponse.json({ status: 'ok' });
      }
    }

    if (!userText) return NextResponse.json({ status: 'ok' });

    // Handle greeting
    if (['hola', 'hi', 'hello', 'buenas', 'inicio'].includes(userText.toLowerCase())) {
      await sendWhatsAppMessage(from,
        `👋 ¡Hola ${contactName}!\n\nSoy *Business Assistant* 🤖, tu asistente de administración empresarial.\n\nPuedo ayudarte con:\n📦 Inventario y stock\n💰 Ventas del día\n👥 Clientes y deudas\n📊 Reportes\n🎤 También puedo entender mensajes de voz\n\n¿En qué te ayudo hoy?`
      );
      return NextResponse.json({ status: 'ok' });
    }

    // Get empresa context
    const usuarioData = await getEmpresaByPhone(from);
    if (!usuarioData) {
      await sendWhatsAppMessage(from,
        `⚠️ Tu número de WhatsApp no está vinculado a ninguna empresa en Business AI OS.\n\nVe a *Configuración → Bots* en tu panel web y vincula este número: *${from}*`
      );
      return NextResponse.json({ status: 'ok' });
    }

    // Process with AI
    const empresaRaw = (usuarioData as { empresas?: Record<string, unknown> | Record<string, unknown>[] })?.empresas;
    const empresaContext = Array.isArray(empresaRaw) ? empresaRaw[0] : empresaRaw ?? {};
    const aiResponse = await callAI(userText, empresaContext);
    await sendWhatsAppMessage(from, aiResponse);

    return NextResponse.json({ status: 'ok' });

  } catch (error) {
    console.error('[WhatsApp Webhook Error]', error);
    return NextResponse.json({ status: 'ok' }); // Always 200 to Meta
  }
}
