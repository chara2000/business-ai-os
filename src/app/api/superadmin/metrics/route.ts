import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifySuperAdmin } from '@/lib/server/auth-admin';
import { calculateMRR, PLAN_CATALOG } from '@/lib/billing/plans';
import type { SubscriptionPlan } from '@/types';

export async function GET() {
  const adminUser = await verifySuperAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const admin = await createAdminClient();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000).toISOString();

  const [
    { data: empresas },
    { data: billingEvents },
    { count: newTenants30d },
    { count: churned30d },
  ] = await Promise.all([
    admin.from('empresas').select('id, plan, activa, billing_status, created_at, plan_expira_en'),
    admin.from('billing_events').select('*').order('created_at', { ascending: false }).limit(20),
    admin.from('empresas').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    admin.from('empresas').select('*', { count: 'exact', head: true })
      .eq('activa', false)
      .gte('updated_at', thirtyDaysAgo),
  ]);

  const all = empresas ?? [];
  const active = all.filter((e) => e.activa);
  const mrr = calculateMRR(all);
  const arr = mrr * 12;

  const byPlan: Record<SubscriptionPlan, number> = {
    free: 0, starter: 0, pro: 0, enterprise: 0,
  };
  active.forEach((e) => {
    const plan = (e.plan as SubscriptionPlan) ?? 'free';
    byPlan[plan] = (byPlan[plan] ?? 0) + 1;
  });

  const revenueByPlan = (Object.keys(byPlan) as SubscriptionPlan[]).map((plan) => ({
    plan,
    tenants: byPlan[plan],
    mrr: byPlan[plan] * (PLAN_CATALOG[plan]?.priceCOP ?? 0),
  }));

  const growth: { mes: string; nuevos: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const label = d.toLocaleDateString('es-CO', { month: 'short' });
    const count = all.filter((e) => {
      const created = new Date(e.created_at);
      return created >= d && created < next;
    }).length;
    growth.push({ mes: label, nuevos: count });
  }

  const totalAtStart = all.filter((e) => new Date(e.created_at) < new Date(thirtyDaysAgo)).length;
  const churnRate = totalAtStart > 0 ? Math.round(((churned30d ?? 0) / totalAtStart) * 1000) / 10 : 0;

  const trialsExpiring = all.filter((e) => {
    if (!e.plan_expira_en) return false;
    const exp = new Date(e.plan_expira_en);
    return exp > now && exp < new Date(now.getTime() + 7 * 86400000);
  }).length;

  const wompiConnected = all.filter((e) => e.billing_status && e.billing_status !== 'manual').length;

  const recentPayments = (billingEvents ?? [])
    .filter((e) => ['checkout.completed', 'invoice.paid', 'subscription.active'].includes(e.event_type))
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      event_type: e.event_type,
      plan: e.plan,
      amount: e.amount,
      created_at: e.created_at,
    }));

  return NextResponse.json({
    success: true,
    data: {
      mrr,
      arr,
      activeTenants: active.length,
      totalTenants: all.length,
      newTenants30d: newTenants30d ?? 0,
      churnRate,
      churned30d: churned30d ?? 0,
      trialsExpiring,
      wompiConnected,
      byPlan,
      revenueByPlan,
      growth,
      recentPayments,
      arpu: active.length > 0 ? Math.round(mrr / active.length) : 0,
      paidSince60d: all.filter((e) =>
        e.activa && new Date(e.created_at) >= new Date(sixtyDaysAgo),
      ).length,
    },
  });
}
