'use client';

import { useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';

export function useEmpresa() {
  const empresaId = useAppStore((s) => s.getEffectiveEmpresaId());
  const empresa = useAppStore((s) => s.getActiveEmpresa());
  const usuario = useAppStore((s) => s.usuario);
  const isSuperAdmin = useAppStore((s) => s.isSuperAdmin());
  const isImpersonating = useAppStore((s) => s.isImpersonating());
  const impersonatedEmpresa = useAppStore((s) => s.impersonatedEmpresa);

  const requireEmpresaId = useCallback(() => {
    if (!empresaId) throw new Error('Sin empresa asignada');
    return empresaId;
  }, [empresaId]);

  return {
    empresaId,
    empresa,
    usuario,
    isSuperAdmin,
    isImpersonating,
    impersonatedEmpresa,
    requireEmpresaId,
  };
}
