import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { activateEmpresaPlan, getPendingPaymentByReference, markPaymentDeclined } from '@/lib/billing/activate';
import type { WompiEvent } from '@/lib/billing/wompi';
import { verifyWompiEventChecksum } from '@/lib/billing/wompi';
import type { SubscriptionPlan } from '@/types';

export async function POST(req: NextRequest) {
  if (!process.env.WOMPI_EVENTS_SECRET) {
    return NextResponse.json({ error: 'Webhook Wompi no configurado' }, { status: 503 });
  }

  let event: WompiEvent;
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (event.event !== 'transaction.updated') {
    return NextResponse.json({ received: true });
  }

  if (!verifyWompiEventChecksum(event)) {
    return NextResponse.json({ error: 'Checksum inválido' }, { status: 401 });
  }

  const tx = event.data.transaction;
  if (!tx?.reference) {
    return NextResponse.json({ received: true });
  }

  const pending = await getPendingPaymentByReference(tx.reference);
  if (!pending) {
    return NextResponse.json({ received: true });
  }

  if (tx.status === 'APPROVED') {
    await activateEmpresaPlan({
      empresaId: pending.empresa_id,
      plan: pending.plan as SubscriptionPlan,
      billingStatus: 'active',
      wompiTransactionId: tx.id,
      reference: tx.reference,
      amountCOP: tx.amount_in_cents / 100,
      providerEventId: `${tx.id}-${event.sent_at}`,
    });
  } else if (['DECLINED', 'VOIDED', 'ERROR'].includes(tx.status)) {
    await markPaymentDeclined(tx.reference, tx.id);
  }

  return NextResponse.json({ received: true });
}
