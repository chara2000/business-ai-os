import { useAppStore } from '@/stores/appStore';

/** Get effective empresa_id from zustand store (supports superadmin impersonation) */
export function getEmpresaId(): string | null {
  return useAppStore.getState().getEffectiveEmpresaId();
}

/** Async helper for use inside callbacks — reads latest store state */
export async function resolveEmpresaId(): Promise<string> {
  const id = getEmpresaId();
  if (!id) throw new Error('Sin empresa asignada');
  return id;
}
