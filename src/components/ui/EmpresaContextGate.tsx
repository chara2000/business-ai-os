'use client';

import Link from 'next/link';
import { Building2, Crown } from 'lucide-react';
import { useEmpresa } from '@/lib/hooks/useEmpresa';

export function EmpresaContextGate({ children }: { children: React.ReactNode }) {
  const { empresaId, isSuperAdmin, isImpersonating } = useEmpresa();

  if (isSuperAdmin && !isImpersonating) {
    return (
      <div className="empresa-context-empty animate-fade-in">
        <div className="empresa-context-empty-card">
          <div className="empresa-context-empty-icon">
            <Crown size={28} strokeWidth={2} />
          </div>
          <h2>Selecciona un establecimiento</h2>
          <p>
            Como Super Admin, debes entrar al perfil de un establecimiento para ver su información.
            Fuera de ese contexto no se muestran datos de ningún negocio.
          </p>
          <Link href="/superadmin" className="btn-action empresa-context-empty-btn">
            <Building2 size={18} />
            Ir a Establecimientos
          </Link>
        </div>
      </div>
    );
  }

  if (!empresaId && !isSuperAdmin) {
    return (
      <div className="empresa-context-empty animate-fade-in">
        <div className="empresa-context-empty-card">
          <div className="empresa-context-empty-icon">
            <Building2 size={28} strokeWidth={2} />
          </div>
          <h2>Sin establecimiento asignado</h2>
          <p>Tu cuenta no tiene un negocio vinculado. Contacta al administrador del sistema.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
