import type { SubscriptionPlan } from '@/types';
import { getPlanDefinition } from '@/lib/billing/plans';

export type UsageSnapshot = {
  users: number;
  products: number;
  aiQueriesThisMonth: number;
};

export type LimitCheck = {
  allowed: boolean;
  reason?: string;
  limit?: number;
  current?: number;
};

export function checkUserLimit(plan: SubscriptionPlan, currentUsers: number): LimitCheck {
  const limit = getPlanDefinition(plan).limits.users;
  if (currentUsers >= limit) {
    return { allowed: false, reason: `Tu plan permite máximo ${limit} usuario(s)`, limit, current: currentUsers };
  }
  return { allowed: true, limit, current: currentUsers };
}

export function checkProductLimit(plan: SubscriptionPlan, currentProducts: number): LimitCheck {
  const limit = getPlanDefinition(plan).limits.products;
  if (currentProducts >= limit) {
    return { allowed: false, reason: `Tu plan permite máximo ${limit.toLocaleString('es-CO')} productos`, limit, current: currentProducts };
  }
  return { allowed: true, limit, current: currentProducts };
}

export function checkAiQueryLimit(plan: SubscriptionPlan, queriesThisMonth: number): LimitCheck {
  const limit = getPlanDefinition(plan).limits.aiQueriesPerMonth;
  if (queriesThisMonth >= limit) {
    return { allowed: false, reason: `Límite de consultas IA alcanzado (${limit}/mes)`, limit, current: queriesThisMonth };
  }
  return { allowed: true, limit, current: queriesThisMonth };
}

export function canUseWhatsApp(plan: SubscriptionPlan): boolean {
  return getPlanDefinition(plan).limits.whatsapp;
}
