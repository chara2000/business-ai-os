import type { SubscriptionPlan } from '@/types';
import { isWompiConfigured } from '@/lib/billing/wompi';

export type PlanLimits = {
  users: number;
  products: number;
  aiQueriesPerMonth: number;
  whatsapp: boolean;
  pwa: boolean;
};

export type PlanDefinition = {
  id: SubscriptionPlan;
  name: string;
  priceCOP: number;
  limits: PlanLimits;
  features: string[];
};

export const PLAN_CATALOG: Record<SubscriptionPlan, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    priceCOP: 0,
    limits: { users: 1, products: 100, aiQueriesPerMonth: 20, whatsapp: false, pwa: false },
    features: ['1 usuario', '100 productos', 'IA básica (20 consultas/mes)', 'Bot Telegram'],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceCOP: 49900,
    limits: { users: 1, products: 500, aiQueriesPerMonth: 100, whatsapp: false, pwa: true },
    features: ['1 usuario', '500 productos', 'IA básica (100 consultas/mes)', 'Bot Telegram', 'PWA móvil'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceCOP: 99900,
    limits: { users: 5, products: 999999, aiQueriesPerMonth: 1000, whatsapp: true, pwa: true },
    features: ['5 usuarios', 'Productos ilimitados', 'IA avanzada', 'Telegram + WhatsApp', 'PWA móvil'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceCOP: 249900,
    limits: { users: 999999, products: 999999, aiQueriesPerMonth: 999999, whatsapp: true, pwa: true },
    features: ['Usuarios ilimitados', 'Multi-empresa', 'IA sin límites', 'Todos los bots', 'API acceso'],
  },
};

export const UPGRADE_ORDER: SubscriptionPlan[] = ['free', 'starter', 'pro', 'enterprise'];

export function getPlanDefinition(plan: SubscriptionPlan): PlanDefinition {
  return PLAN_CATALOG[plan] ?? PLAN_CATALOG.free;
}

export function getNextPlan(plan: SubscriptionPlan): SubscriptionPlan | null {
  const idx = UPGRADE_ORDER.indexOf(plan);
  if (idx < 0 || idx >= UPGRADE_ORDER.length - 1) return null;
  return UPGRADE_ORDER[idx + 1];
}

export function calculateMRR(empresas: { plan: SubscriptionPlan; activa: boolean }[]): number {
  return empresas
    .filter((e) => e.activa)
    .reduce((sum, e) => sum + (PLAN_CATALOG[e.plan]?.priceCOP ?? 0), 0);
}

export function isPaymentConfigured(): boolean {
  return isWompiConfigured();
}

/** @deprecated Usar isPaymentConfigured */
export function isStripeConfigured(): boolean {
  return isPaymentConfigured();
}
