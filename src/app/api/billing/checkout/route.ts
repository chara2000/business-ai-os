import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { resolveServerEmpresaId } from '@/lib/server/empresa-context';
import { getNextPlan, getPlanDefinition } from '@/lib/billing/plans';
import {
  buildCheckoutParams,
  copToCents,
  generatePaymentReference,
  isWompiConfigured,
} from '@/lib/billing/wompi';
import type { SubscriptionPlan } from '@/types';

export async function POST(req: NextRequest) {
  const ctx = await resolveServerEmpresaId();
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const requestedPlan = body.plan as SubscriptionPlan | undefined;

  const admin = await createAdminClient();
  const { data: empresa } = await admin
    .from('empresas')
    .select('id, nombre, email, plan')
    .eq('id', ctx.empresaId)
    .single();

  if (!empresa) {
    return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 });
  }

  const targetPlan = requestedPlan ?? getNextPlan(empresa.plan) ?? 'starter';
  const planDef = getPlanDefinition(targetPlan);

  if (planDef.priceCOP <= 0) {
    return NextResponse.json({ error: 'Plan no pagable' }, { status: 400 });
  }

  if (!isWompiConfigured()) {
    return NextResponse.json({
      error: 'Wompi no configurado. Agrega las claves en .env',
      fallback: true,
    }, { status: 503 });
  }

  const reference = generatePaymentReference(ctx.empresaId, targetPlan);
  const amountCents = copToCents(planDef.priceCOP);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectUrl = `${appUrl}/configuracion?tab=facturacion&checkout=return&ref=${reference}`;

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 2);

  const { error: pendingError } = await admin.from('billing_pending_payments').insert([{
    empresa_id: ctx.empresaId,
    usuario_id: ctx.usuario.id,
    plan: targetPlan,
    reference,
    amount_cents: amountCents,
    currency: 'COP',
    status: 'pending',
    expires_at: expiresAt.toISOString(),
  }]);

  if (pendingError) {
    if (pendingError.message.includes('billing_pending_payments')) {
      return NextResponse.json({
        error: 'Tabla billing_pending_payments no existe. Ejecuta supabase-wompi.sql',
      }, { status: 500 });
    }
    return NextResponse.json({ error: pendingError.message }, { status: 500 });
  }

  const checkout = buildCheckoutParams({
    reference,
    amountInCents: amountCents,
    redirectUrl,
    customerEmail: empresa.email ?? ctx.usuario.email,
    customerFullName: `${ctx.usuario.nombre} ${ctx.usuario.apellido}`.trim(),
  });

  return NextResponse.json({
    success: true,
    provider: 'wompi',
    plan: targetPlan,
    reference,
    checkout,
  });
}
