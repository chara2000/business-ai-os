import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveServerEmpresaId } from '@/lib/server/empresa-context';
import { activateEmpresaPlan, getPendingPaymentByReference } from '@/lib/billing/activate';
import { fetchWompiTransaction } from '@/lib/billing/wompi';
import type { SubscriptionPlan } from '@/types';

export async function GET(req: NextRequest) {
  const ctx = await resolveServerEmpresaId();
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const ref = req.nextUrl.searchParams.get('ref');
  const transactionId = req.nextUrl.searchParams.get('id');

  if (!ref && !transactionId) {
    return NextResponse.json({ error: 'ref o id requerido' }, { status: 400 });
  }

  let reference = ref;
  let tx = transactionId ? await fetchWompiTransaction(transactionId) : null;

  if (tx?.reference) reference = tx.reference;
  if (!reference) {
    return NextResponse.json({ error: 'Referencia no encontrada' }, { status: 404 });
  }

  const pending = await getPendingPaymentByReference(reference);
  if (!pending || pending.empresa_id !== ctx.empresaId) {
    return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
  }

  if (!tx && pending.wompi_transaction_id) {
    tx = await fetchWompiTransaction(pending.wompi_transaction_id);
  }

  if (pending.status === 'approved') {
    const supabase = await createClient();
    const { data: emp } = await supabase
      .from('empresas')
      .select('plan, plan_expira_en, billing_status')
      .eq('id', ctx.empresaId)
      .single();

    return NextResponse.json({
      success: true,
      status: 'APPROVED',
      plan: emp?.plan ?? pending.plan,
      plan_expira_en: emp?.plan_expira_en,
    });
  }

  if (tx?.status === 'APPROVED') {
    await activateEmpresaPlan({
      empresaId: pending.empresa_id,
      plan: pending.plan as SubscriptionPlan,
      wompiTransactionId: tx.id,
      reference,
      amountCOP: tx.amount_in_cents / 100,
      providerEventId: `verify-${tx.id}`,
    });

    return NextResponse.json({
      success: true,
      status: 'APPROVED',
      plan: pending.plan,
    });
  }

  return NextResponse.json({
    success: true,
    status: tx?.status ?? pending.status,
    pending: true,
  });
}
