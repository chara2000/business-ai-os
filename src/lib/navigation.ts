import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Package, TrendingUp, RotateCcw, ShoppingCart, Users,
  CreditCard, DollarSign, BarChart3, Settings, Truck, Bot, Building2, Shield,
} from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  managerOnly?: boolean;
};

export const NAV_MAIN: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Ventas', href: '/ventas', icon: TrendingUp },
  { label: 'Devoluciones', href: '/devoluciones', icon: RotateCcw },
  { label: 'Inventario', href: '/inventario', icon: Package },
  { label: 'Compras', href: '/compras', icon: ShoppingCart },
  { label: 'Clientes', href: '/clientes', icon: Users },
  { label: 'Proveedores', href: '/proveedores', icon: Truck },
];

export const NAV_FINANCE: NavItem[] = [
  { label: 'Gastos', href: '/gastos', icon: DollarSign },
  { label: 'Créditos', href: '/creditos', icon: CreditCard },
  { label: 'Finanzas', href: '/finanzas', icon: DollarSign },
  { label: 'Reportes', href: '/reportes', icon: BarChart3 },
];

export const NAV_SYSTEM: NavItem[] = [
  { label: 'Asistente IA', href: '/ai', icon: Bot, badge: 'IA' },
  { label: 'Equipo', href: '/equipo', icon: Users, managerOnly: true },
  { label: 'Auditoría', href: '/auditoria', icon: Shield, managerOnly: true },
  { label: 'Mi Empresa', href: '/empresa', icon: Building2 },
  { label: 'Configuración', href: '/configuracion', icon: Settings },
];

export const MOBILE_QUICK_NAV: NavItem[] = [
  { label: 'Inicio', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Ventas', href: '/ventas', icon: TrendingUp },
  { label: 'Inventario', href: '/inventario', icon: Package },
  { label: 'Clientes', href: '/clientes', icon: Users },
];

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  { title: 'Operaciones', items: NAV_MAIN },
  { title: 'Finanzas', items: NAV_FINANCE },
  { title: 'Sistema', items: NAV_SYSTEM },
];
