'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { AppProvider } from '@/components/providers/AppProvider';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { EmpresaContextGate } from '@/components/ui/EmpresaContextGate';
import { PermissionGate } from '@/components/ui/PermissionGate';
import { PwaInstallBanner } from '@/components/pwa/PwaInstallBanner';
import { usePathname } from 'next/navigation';

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
  const pathname = usePathname();
  const meta = PAGE_META[pathname] ?? { title: 'Business OS' };
  const skipEmpresaGate = pathname === '/superadmin';

  return (
    <AppProvider>
      <div className="app-shell">
        <AmbientBackground />
        <Sidebar />
        <div className="app-main" id="app-main">
          <Topbar title={meta.title} subtitle={meta.subtitle} />
          <PwaInstallBanner />
          <main className="page-content page-content--fintech">
            {skipEmpresaGate ? children : (
              <EmpresaContextGate>
                <PermissionGate>{children}</PermissionGate>
              </EmpresaContextGate>
            )}
          </main>
        </div>
      </div>
    </AppProvider>
  );
}
