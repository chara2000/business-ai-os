import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Empresa, Usuario } from '@/types';

interface AppState {
  usuario: Usuario | null;
  empresa: Empresa | null;
  impersonatedEmpresa: Empresa | null;
  isLoading: boolean;
  setUsuario: (usuario: Usuario | null) => void;
  setEmpresa: (empresa: Empresa | null) => void;
  setImpersonatedEmpresa: (empresa: Empresa | null) => void;
  setLoading: (loading: boolean) => void;
  getEffectiveEmpresaId: () => string | null;
  getActiveEmpresa: () => Empresa | null;
  isSuperAdmin: () => boolean;
  isImpersonating: () => boolean;
  clearImpersonation: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      usuario: null,
      empresa: null,
      impersonatedEmpresa: null,
      isLoading: true,

      setUsuario: (usuario) => set({ usuario }),
      setEmpresa: (empresa) => set({ empresa }),
      setImpersonatedEmpresa: (empresa) => set({ impersonatedEmpresa: empresa }),
      setLoading: (isLoading) => set({ isLoading }),

      getEffectiveEmpresaId: () => {
        const state = get();
        if (state.usuario?.rol === 'super_admin') {
          return state.impersonatedEmpresa?.id ?? null;
        }
        return state.empresa?.id ?? null;
      },

      getActiveEmpresa: () => {
        const state = get();
        if (state.usuario?.rol === 'super_admin') return state.impersonatedEmpresa;
        return state.empresa;
      },

      isSuperAdmin: () => get().usuario?.rol === 'super_admin',

      isImpersonating: () => !!get().impersonatedEmpresa,

      clearImpersonation: () => set({ impersonatedEmpresa: null }),
    }),
    {
      name: 'business-ai-os-store',
      partialize: (state) => ({
        impersonatedEmpresa: state.impersonatedEmpresa,
      }),
    }
  )
);
