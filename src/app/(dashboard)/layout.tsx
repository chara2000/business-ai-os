'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { AppProvider } from '@/components/providers/AppProvider';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { EmpresaContextGate } from '@/components/ui/EmpresaContextGate';
import { PermissionGate } from '@/components/ui/PermissionGate';
import { PwaInstallBanner } from '@/components/pwa/PwaInstallBanner';
import { MobileFab } from '@/components/layout/MobileFab';
import { MobileModulesSheet } from '@/components/layout/MobileModulesSheet';
import { MobileNavProvider, useMobileNav } from '@/components/layout/MobileNavContext';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { MOBILE_QUICK_NAV } from '@/lib/navigation';
import { useEffect, useState } from 'react';

const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard':    { title: 'Overview', subtitle: 'Resumen inteligente de tu negocio' },
  '/ventas':       { title: 'Transacciones', subtitle: 'Ventas, facturación y cobros' },
  '/devoluciones': { title: 'Devoluciones', subtitle: 'Reversos y garantías' },
  '/inventario':   { title: 'Inventario', subtitle: 'Stock, productos y movimientos' },
  '/compras':      { title: 'Compras', subtitle: 'Órdenes y proveedores' },
  '/clientes':     { title: 'Clientes', subtitle: 'CRM y cartera de clientes' },
  '/proveedores':  { title: 'Proveedores', subtitle: 'Alianzas y suministros' },
  '/creditos':     { title: 'Créditos', subtitle: 'Fiados y cobranza' },
  '/finanzas':     { title: 'Finanzas', subtitle: 'Flujo de caja e ingresos' },
  '/reportes':     { title: 'Analytics', subtitle: 'Inteligencia de negocio' },
  '/ai':           { title: 'Asistente IA', subtitle: 'Tu gerente digital inteligente' },
  '/empresa':      { title: 'Mi Empresa', subtitle: 'Perfil del establecimiento' },
  '/configuracion':{ title: 'Configuración', subtitle: 'Preferencias y seguridad' },
  '/auditoria':    { title: 'Auditoría', subtitle: 'Registro de acciones del sistema' },
  '/equipo':       { title: 'Equipo', subtitle: 'Usuarios, roles y credenciales' },
  '/superadmin':   { title: 'Establecimientos', subtitle: 'Gestión multi-tenant' },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <MobileNavProvider>
        <DashboardLayoutInner>{children}</DashboardLayoutInner>
      </MobileNavProvider>
    </AppProvider>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { openModules, modulesOpen } = useMobileNav();
  const meta = PAGE_META[pathname] ?? { title: 'Business OS' };
  const skipEmpresaGate = pathname === '/superadmin';
  const [forceWebMode, setForceWebMode] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('businessos-force-web-mode');
    setForceWebMode(saved === '1');

    const mq = window.matchMedia('(max-width: 900px)');
    const syncViewport = () => setIsMobileViewport(mq.matches);
    syncViewport();
    mq.addEventListener('change', syncViewport);
    return () => mq.removeEventListener('change', syncViewport);
  }, []);

  const effectiveForceWebMode = forceWebMode && !isMobileViewport;

  const toggleWebMode = () => {
    setForceWebMode((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('businessos-force-web-mode', next ? '1' : '0');
      }
      return next;
    });
  };

  return (
    <div className={`app-shell ${effectiveForceWebMode ? 'force-web-mode' : ''}`}>
      <AmbientBackground />
      <Sidebar />
      <div className="app-main" id="app-main">
        <Topbar
          title={meta.title}
          subtitle={meta.subtitle}
          forceWebMode={effectiveForceWebMode}
          onToggleWebMode={toggleWebMode}
        />
        <PwaInstallBanner />
        <main className="page-content page-content--fintech">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              className="page-route-shell"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {skipEmpresaGate ? children : (
                <EmpresaContextGate>
                  <PermissionGate>{children}</PermissionGate>
                </EmpresaContextGate>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
        <nav className="mobile-bottom-nav" aria-label="Navegacion movil">
          {MOBILE_QUICK_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link key={href} href={href} className={`mobile-bottom-nav__item ${active ? 'is-active' : ''}`}>
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className={`mobile-bottom-nav__item mobile-bottom-nav__item--more ${modulesOpen ? 'is-active' : ''}`}
            onClick={openModules}
            aria-label="Ver todos los módulos"
            aria-expanded={modulesOpen}
          >
            <LayoutGrid size={20} />
            <span>Módulos</span>
          </button>
        </nav>
        <MobileFab />
        <MobileModulesSheet />
      </div>
    </div>
  );
}
