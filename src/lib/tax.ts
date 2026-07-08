import type { Empresa } from '@/types';

const DEFAULT_IVA = 0.19;

export function getTasaIva(empresa?: Partial<Empresa> | null): number {
  const config = empresa?.configuracion as { tasa_iva?: number } | undefined;
  const tasa = config?.tasa_iva;
  if (typeof tasa === 'number' && tasa >= 0 && tasa <= 1) return tasa;
  return DEFAULT_IVA;
}

export function calcImpuestos(subtotal: number, descuento: number, tasaIva: number) {
  const base = Math.max(0, subtotal - descuento);
  const impuestos = Math.round(base * tasaIva);
  const total = base + impuestos;
  return { base, impuestos, total };
}

export function formatTasaIva(tasa: number) {
  return `${(tasa * 100).toFixed(0)}%`;
}
