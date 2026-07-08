import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'COP') {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompact(amount: number) {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString('es-CO')}`;
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getUserInitials(usuario: {
  nombre?: string;
  apellido?: string;
  rol?: string;
} | null | undefined) {
  if (!usuario) return 'U';
  if (usuario.rol === 'super_admin') return 'SA';
  const fullName = `${usuario.nombre ?? ''} ${usuario.apellido ?? ''}`.trim();
  return getInitials(fullName || 'Usuario');
}
