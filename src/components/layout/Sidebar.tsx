'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  LogOut, Crown, Store, Search, Sparkles, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/stores/appStore';
import { filterNavByPermissions } from '@/lib/permissions';
import type { NavItem } from '@/lib/navigation';
import { NAV_FINANCE, NAV_MAIN, NAV_SYSTEM } from '@/lib/navigation';
import toast from 'react-hot-toast';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const isSuperAdmin = useAppStore((s) => s.isSuperAdmin());
  const usuario = useAppStore((s) => s.usuario);
  const empresa = useAppStore((s) => s.getActiveEmpresa());

  useEffect(() => {
    const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    setCollapsed(isCollapsed);
    document.documentElement.style.setProperty('--sidebar-current-w', isCollapsed ? '80px' : 'var(--sidebar-w)');
  }, []);

  const toggleCollapse = () => {
    const nextState = !collapsed;
    setCollapsed(nextState);
    localStorage.setItem('sidebar-collapsed', String(nextState));
    document.documentElement.style.setProperty('--sidebar-current-w', nextState ? '80px' : 'var(--sidebar-w)');
  };

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

  const renderNav = (items: NavItem[], section: string) => (
    <>
      {!collapsed && <div className="sidebar-section-label">{section}</div>}
      {collapsed && <div style={{ height: '1px', background: 'var(--border-default)', margin: '8px 6px' }} />}
      {filterNavByPermissions(items, usuario).map(({ label, href, icon: Icon, badge }) => {
        const active = isActive(href);
        return (
          <Link key={`${section}-${label}`} href={href} title={collapsed ? label : undefined}>
            <motion.div
              className={`nav-item-fintech ${active ? 'active' : ''}`}
              whileTap={{ scale: 0.98 }}
              style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '10px 0' : '10px 12px' }}
            >
              <span className="nav-item-fintech-icon" style={{ margin: 0 }}>
                <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
              </span>
              {!collapsed && <span className="nav-item-fintech-label" style={{ marginLeft: 10 }}>{label}</span>}
              {!collapsed && badge && <span className="nav-badge-lime">{badge}</span>}
            </motion.div>
          </Link>
        );
      })}
    </>
  );

  return (
    <aside className={`sidebar-unified ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-unified-head" style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 8 }}>
        <Link href="/dashboard" className="sidebar-brand-link">
          <div className="sidebar-rail-logo">
            <Sparkles size={20} color="#1A1A1A" />
          </div>
          {!collapsed && (
            <div>
              <div className="sidebar-brand-name">Business<span>OS</span></div>
              <div className="sidebar-brand-sub">CRM Financiero</div>
            </div>
          )}
        </Link>
        {!collapsed && (
          <button 
            type="button"
            onClick={toggleCollapse} 
            className="sidebar-toggle-btn"
            style={{ 
              background: 'var(--bg-hover)', 
              border: 'none', 
              borderRadius: '8px', 
              width: '28px', 
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-secondary)'
            }}
            title="Colapsar menú"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {collapsed && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
          <button 
            type="button"
            onClick={toggleCollapse} 
            className="sidebar-toggle-btn"
            style={{ 
              background: 'var(--bg-hover)', 
              border: 'none', 
              borderRadius: '8px', 
              width: '28px', 
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-secondary)'
            }}
            title="Expandir menú"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <div className="sidebar-search" style={{ margin: collapsed ? '0 10px 12px' : '0 14px 12px', justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '10px 0' : '10px 12px' }} title={collapsed ? "Buscar" : undefined}>
        <Search size={15} />
        {!collapsed && (
          <>
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearch}
              style={{ marginLeft: 8 }}
            />
            <kbd className="sidebar-kbd">⌘ K</kbd>
          </>
        )}
      </div>

      <nav className="sidebar-panel-nav" style={{ padding: collapsed ? '4px 6px 12px' : '4px 12px 12px' }}>
        {isSuperAdmin && (
          <>
            {!collapsed && <div className="sidebar-section-label">Super Admin</div>}
            {collapsed && <div style={{ height: '1px', background: 'var(--border-default)', margin: '8px 6px' }} />}
            <Link href="/superadmin" title={collapsed ? "Establecimientos" : undefined}>
              <motion.div 
                className={`nav-item-fintech ${isActive('/superadmin') ? 'active' : ''}`} 
                whileTap={{ scale: 0.98 }}
                style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '10px 0' : '10px 12px' }}
              >
                <span className="nav-item-fintech-icon" style={{ margin: 0 }}><Crown size={17} /></span>
                {!collapsed && <span className="nav-item-fintech-label" style={{ marginLeft: 10 }}>Establecimientos</span>}
              </motion.div>
            </Link>
          </>
        )}
        {renderNav(NAV_MAIN, 'Menú principal')}
        {renderNav(NAV_FINANCE, 'Finanzas')}
        {renderNav(NAV_SYSTEM, 'General')}
      </nav>

      <div className="sidebar-panel-foot" style={{ padding: collapsed ? '12px 6px' : '12px' }}>
        {empresa && (
          <div 
            className="sidebar-empresa-pill" 
            title={collapsed ? `${empresa.nombre} (${empresa.tipo_negocio})` : undefined} 
            style={{ 
              padding: collapsed ? '8px 0' : '8px 10px', 
              justifyContent: collapsed ? 'center' : 'flex-start',
              marginBottom: 10 
            }}
          >
            <Store size={14} style={{ flexShrink: 0 }} />
            {!collapsed && (
              <div style={{ marginLeft: 8 }}>
                <div className="sidebar-empresa-name">{empresa.nombre}</div>
                <div className="sidebar-empresa-type">{empresa.tipo_negocio}</div>
              </div>
            )}
          </div>
        )}
        <button 
          type="button" 
          className="nav-item-fintech sidebar-logout" 
          onClick={handleLogout}
          title={collapsed ? "Cerrar sesión" : undefined}
          style={{ 
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '10px 0' : '10px 12px',
            margin: 0
          }}
        >
          <span className="nav-item-fintech-icon" style={{ margin: 0 }}><LogOut size={17} /></span>
          {!collapsed && <span className="nav-item-fintech-label" style={{ marginLeft: 10 }}>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
