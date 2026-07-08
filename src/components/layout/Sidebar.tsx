'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Package, ShoppingCart, TrendingUp, Users,
  CreditCard, DollarSign, BarChart3, Settings, Truck,
  LogOut, Building2, Bot, Crown, Store, Search, Sparkles, RotateCcw, Shield,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/stores/appStore';
import { filterNavByPermissions } from '@/lib/permissions';
import toast from 'react-hot-toast';

const NAV_MAIN = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Ventas', href: '/ventas', icon: TrendingUp },
  { label: 'Devoluciones', href: '/devoluciones', icon: RotateCcw },
  { label: 'Inventario', href: '/inventario', icon: Package },
  { label: 'Compras', href: '/compras', icon: ShoppingCart },
  { label: 'Clientes', href: '/clientes', icon: Users },
  { label: 'Proveedores', href: '/proveedores', icon: Truck },
];

const NAV_FINANCE = [
  { label: 'Créditos', href: '/creditos', icon: CreditCard },
  { label: 'Finanzas', href: '/finanzas', icon: DollarSign },
  { label: 'Reportes', href: '/reportes', icon: BarChart3 },
];

const NAV_SYSTEM = [
  { label: 'Asistente IA', href: '/ai', icon: Bot, badge: 'IA' },
  { label: 'Equipo', href: '/equipo', icon: Users, managerOnly: true },
  { label: 'Auditoría', href: '/auditoria', icon: Shield, managerOnly: true },
  { label: 'Mi Empresa', href: '/empresa', icon: Building2 },
  { label: 'Configuración', href: '/configuracion', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState('');

  const isSuperAdmin = useAppStore((s) => s.isSuperAdmin());
  const usuario = useAppStore((s) => s.usuario);
  const empresa = useAppStore((s) => s.getActiveEmpresa());

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-current-w', 'var(--sidebar-w)');
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    useAppStore.getState().clearImpersonation();
    toast.success('Sesión cerrada');
    router.push('/login');
  };

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim()) {
      toast(`Buscando "${search.trim()}"...`, { icon: '🔍' });
    }
  };

  const renderNav = (items: Array<{ label: string; href: string; icon: typeof LayoutDashboard; badge?: string; managerOnly?: boolean }>, section: string) => (
    <>
      <div className="sidebar-section-label">{section}</div>
      {filterNavByPermissions(items, usuario).map(({ label, href, icon: Icon, badge }) => {
        const active = isActive(href);
        return (
          <Link key={`${section}-${label}`} href={href}>
            <motion.div
              className={`nav-item-fintech ${active ? 'active' : ''}`}
              whileTap={{ scale: 0.98 }}
            >
              <span className="nav-item-fintech-icon">
                <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
              </span>
              <span className="nav-item-fintech-label">{label}</span>
              {badge && <span className="nav-badge-lime">{badge}</span>}
            </motion.div>
          </Link>
        );
      })}
    </>
  );

  return (
    <aside className="sidebar-unified">
      <div className="sidebar-unified-head">
        <Link href="/dashboard" className="sidebar-brand-link">
          <div className="sidebar-rail-logo">
            <Sparkles size={20} color="#1A1A1A" />
          </div>
          <div>
            <div className="sidebar-brand-name">Business<span>OS</span></div>
            <div className="sidebar-brand-sub">CRM Financiero</div>
          </div>
        </Link>
      </div>

      <div className="sidebar-search">
        <Search size={15} />
        <input
          type="text"
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearch}
        />
        <kbd className="sidebar-kbd">⌘ K</kbd>
      </div>

      <nav className="sidebar-panel-nav">
        {isSuperAdmin && (
          <>
            <div className="sidebar-section-label">Super Admin</div>
            <Link href="/superadmin">
              <motion.div className={`nav-item-fintech ${isActive('/superadmin') ? 'active' : ''}`} whileTap={{ scale: 0.98 }}>
                <span className="nav-item-fintech-icon"><Crown size={17} /></span>
                <span className="nav-item-fintech-label">Establecimientos</span>
              </motion.div>
            </Link>
          </>
        )}
        {renderNav(NAV_MAIN, 'Menú principal')}
        {renderNav(NAV_FINANCE, 'Finanzas')}
        {renderNav(NAV_SYSTEM, 'General')}
      </nav>

      <div className="sidebar-panel-foot">
        {empresa && (
          <div className="sidebar-empresa-pill">
            <Store size={14} />
            <div>
              <div className="sidebar-empresa-name">{empresa.nombre}</div>
              <div className="sidebar-empresa-type">{empresa.tipo_negocio}</div>
            </div>
          </div>
        )}
        <button type="button" className="nav-item-fintech sidebar-logout" onClick={handleLogout}>
          <span className="nav-item-fintech-icon"><LogOut size={17} /></span>
          <span className="nav-item-fintech-label">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
