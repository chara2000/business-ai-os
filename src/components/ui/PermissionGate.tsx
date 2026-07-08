'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldOff } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { canAccessRoute } from '@/lib/permissions';

export function PermissionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const usuario = useAppStore((s) => s.usuario);
  const isLoading = useAppStore((s) => s.isLoading);

  if (isLoading) return null;

  if (pathname === '/superadmin') {
    return <>{children}</>;
  }

  if (!usuario || !canAccessRoute(usuario, pathname)) {
    return (
      <div className="empresa-context-empty animate-fade-in">
        <div className="empresa-context-empty-card">
          <div className="empresa-context-empty-icon">
            <ShieldOff size={28} strokeWidth={2} />
          </div>
          <h2>Acceso restringido</h2>
          <p>No tienes permisos para acceder a este módulo. Contacta al administrador de tu empresa.</p>
          <Link href="/dashboard" className="btn-action empresa-context-empty-btn">
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
