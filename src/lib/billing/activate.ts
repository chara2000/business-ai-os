import { createAdminClient } from '@/lib/supabase/server';
import { getPlanDefinition } from '@/lib/billing/plans';
import { planExpiresIn30Days } from '@/lib/billing/wompi';
import type { SubscriptionPlan } from '@/types';

export async function activateEmpresaPlan(params: {
  empresaId: string;
  plan: SubscriptionPlan;
  billingStatus?: string;
  wompiTransactionId?: string;
  reference?: string;
  amountCOP?: number;
  providerEventId?: string;
}) {
  const admin = await createAdminClient();
  const expiresAt = planExpiresIn30Days();

  await admin.from('empresas').update({
    plan: params.plan,
    activa: true,
    billing_status: params.billingStatus ?? 'active',
    plan_expira_en: expiresAt,
  }).eq('id', params.empresaId);

  if (params.reference) {
    await admin.from('billing_pending_payments').update({
      status: 'approved',
      wompi_transaction_id: params.wompiTransactionId ?? null,
      updated_at: new Date().toISOString(),
    }).eq('reference', params.reference);
  }

  const eventId = params.providerEventId ?? params.wompiTransactionId ?? `manual-${params.empresaId}-${Date.now()}`;

  await admin.from('billing_events').upsert([{
    empresa_id: params.empresaId,
    event_type: 'payment.approved',
    plan: params.plan,
    amount: params.amountCOP ?? getPlanDefinition(params.plan).priceCOP,
    currency: 'COP',
    stripe_event_id: eventId,
    provider_event_id: eventId,
    payment_reference: params.reference,
    metadata: {
      wompi_transaction_id: params.wompiTransactionId,
      provider: 'wompi',
    },
  }], { onConflict: 'stripe_event_id' });
}

export async function markPaymentDeclined(reference: string, wompiTransactionId?: string) {
  const admin = await createAdminClient();
  await admin.from('billing_pending_payments').update({
    status: 'declined',
    wompi_transaction_id: wompiTransactionId ?? null,
    updated_at: new Date().toISOString(),
  }).eq('reference', reference);
}

export async function getPendingPaymentByReference(reference: string) {
  const admin = await createAdminClient();
  const { data } = await admin
    .from('billing_pending_payments')
    .select('*')
    .eq('reference', reference)
    .single();
  return data;
}
