'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Settings, Bell, ChevronDown, LogOut, Crown, Sun, Moon,
  Share2, HelpCircle, ChevronRight, Filter, Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/stores/appStore';
import { useThemeStore } from '@/stores/themeStore';
import { getUserInitials } from '@/lib/utils';
import type { AppNotification } from '@/lib/notifications/alerts';

const TOP_NAV = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Ventas', href: '/ventas' },
  { label: 'Inventario', href: '/inventario' },
  { label: 'Clientes', href: '/clientes' },
  { label: 'Finanzas', href: '/finanzas' },
  { label: 'Ayuda', href: '/ai' },
];

const BREADCRUMB: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/ventas': 'Ventas',
  '/inventario': 'Inventario',
  '/compras': 'Compras',
  '/clientes': 'Clientes',
  '/proveedores': 'Proveedores',
  '/creditos': 'Créditos',
  '/finanzas': 'Finanzas',
  '/reportes': 'Reportes',
  '/ai': 'Asistente IA',
  '/empresa': 'Mi Empresa',
  '/configuracion': 'Configuración',
  '/equipo': 'Equipo',
  '/superadmin': 'Establecimientos',
};

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export function Topbar({ title, subtitle }: TopbarProps) {
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();
  const { toggle, resolved } = useThemeStore();

  const usuario = useAppStore((s) => s.usuario);
  const isSuperAdmin = useAppStore((s) => s.isSuperAdmin());
  const isImpersonating = useAppStore((s) => s.isImpersonating());
  const impersonatedEmpresa = useAppStore((s) => s.impersonatedEmpresa);
  const hasEmpresaContext = useAppStore((s) => !!s.getEffectiveEmpresaId());
  const clearImpersonation = useAppStore((s) => s.clearImpersonation);

  const displayName = usuario ? `${usuario.nombre} ${usuario.apellido}`.trim() : 'Usuario';
  const firstName = usuario?.nombre?.split(' ')[0] ?? 'Usuario';
  const avatarInitials = isSuperAdmin ? 'SA' : getUserInitials(usuario);
  const crumb = BREADCRUMB[pathname] ?? title;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!hasEmpresaContext) return;
    fetch('/api/notificaciones')
      .then((r) => r.json())
      .then((json) => { if (json.data) setNotifications(json.data); })
      .catch(() => {});
    const interval = setInterval(() => {
      fetch('/api/notificaciones')
        .then((r) => r.json())
        .then((json) => { if (json.data) setNotifications(json.data); })
        .catch(() => {});
    }, 120000);
    return () => clearInterval(interval);
  }, [hasEmpresaContext]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearImpersonation();
    router.push('/login');
  };

  const exitImpersonation = async () => {
    clearImpersonation();
    await fetch('/api/superadmin/impersonate', { method: 'DELETE' });
    router.push('/superadmin');
  };

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <>
      {isImpersonating && impersonatedEmpresa && (
        <motion.div className="impersonation-banner" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Crown size={16} />
            <span>Super Admin — <strong>{impersonatedEmpresa.nombre}</strong></span>
          </div>
          <button type="button" onClick={exitImpersonation}>Salir</button>
        </motion.div>
      )}

      <header className="topbar-fintech">
        {/* Row 1 — Calescence horizontal nav */}
        <div className="topbar-fintech-row">
          <nav className="topbar-nav-pills" aria-label="Navegación principal">
            {TOP_NAV.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className={`topbar-nav-pill ${isActive(href) ? 'active' : ''}`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="topbar-fintech-utils">
            <button type="button" className="topbar-icon-btn" onClick={toggle} aria-label="Tema">
              {resolved === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <Link href="/configuracion" className="topbar-icon-btn"><HelpCircle size={18} /></Link>
            <button type="button" className="topbar-icon-btn"><Search size={18} /></button>
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button type="button" className="topbar-icon-btn" onClick={() => setShowNotif(!showNotif)}>
                <Bell size={18} />
                {notifications.length > 0 && <span className="notification-dot" />}
              </button>
              <AnimatePresence>
                {showNotif && (
                  <motion.div className="dropdown-fintech" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                    <div className="dropdown-fintech-head">Notificaciones ({notifications.length})</div>
                    {notifications.length === 0 ? (
                      <div className="dropdown-fintech-item" style={{ color: 'var(--text-muted)' }}>Sin alertas pendientes</div>
                    ) : notifications.slice(0, 8).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className="dropdown-fintech-item"
                        style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer' }}
                        onClick={() => { if (n.href) router.push(n.href); setShowNotif(false); }}
                      >
                        <strong style={{ display: 'block', fontSize: 13 }}>{n.title}</strong>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{n.message}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div ref={menuRef} className="topbar-user">
              <button type="button" className="topbar-user-trigger" onClick={() => setShowMenu(!showMenu)}>
                <div className="avatar-fintech" aria-label={displayName}>
                  <span className="avatar-fintech-initials">{avatarInitials}</span>
                </div>
                <ChevronDown size={14} />
              </button>
              <AnimatePresence>
                {showMenu && (
                  <motion.div className="dropdown-fintech topbar-user-menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                    <div className="dropdown-fintech-head">
                      <strong>{displayName}</strong>
                      <span>{usuario?.email}</span>
                    </div>
                    {isSuperAdmin && (
                      <Link href="/superadmin" className="dropdown-fintech-link" onClick={() => setShowMenu(false)}>
                        <Crown size={15} /> Super Admin
                      </Link>
                    )}
                    <Link href="/configuracion" className="dropdown-fintech-link" onClick={() => setShowMenu(false)}>
                      <Settings size={15} /> Configuración
                    </Link>
                    <button type="button" className="dropdown-fintech-link danger" onClick={handleLogout}>
                      <LogOut size={15} /> Cerrar sesión
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {hasEmpresaContext && (
              <Link href="/ventas" className="btn-share-fintech">
                <Share2 size={15} /> Nueva venta
              </Link>
            )}
          </div>
        </div>

        {/* Row 2 — OripioFin breadcrumbs + Calescence greeting */}
        <div className="topbar-fintech-sub">
          <div className="topbar-breadcrumb">
            <span>BusinessOS</span>
            <ChevronRight size={14} />
            <span className="active">{crumb}</span>
          </div>
          <div className="topbar-greeting-block">
            <h1 className="topbar-greeting">Hola, {firstName}</h1>
            {(subtitle || (isImpersonating && impersonatedEmpresa)) && (
              <p className="topbar-greeting-sub">
                {isImpersonating && impersonatedEmpresa
                  ? `Perfil: ${impersonatedEmpresa.nombre}`
                  : subtitle}
              </p>
            )}
          </div>
          <div className="topbar-sub-actions">
            <button type="button" className="topbar-filter-btn" onClick={() => router.push('/reportes')} title="Ir a reportes y filtros">
              <Filter size={15} />
            </button>
            <button type="button" className="topbar-date-range">
              {new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' — '}
              {new Date(Date.now() + 365 * 86400000).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
            </button>
            {hasEmpresaContext && (
              <Link href="/ventas" className="btn-add-wallet">
                <Plus size={15} /> Nueva transacción
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
