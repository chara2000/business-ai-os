'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/stores/appStore';
import type { Empresa, Usuario } from '@/types';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { setUsuario, setEmpresa, setLoading } = useAppStore();

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setUsuario(null);
          setEmpresa(null);
          return;
        }

        const { data: userData } = await supabase
          .from('usuarios')
          .select('*')
          .eq('auth_user_id', user.id)
          .single();

        if (userData) {
          setUsuario(userData as Usuario);

          if (userData.rol !== 'super_admin') {
            const { data: empresaData } = await supabase
              .from('empresas')
              .select('*')
              .eq('id', userData.empresa_id)
              .single();

            if (empresaData) {
              setEmpresa(empresaData as Empresa);
            }
          } else {
            setEmpresa(null);
          }
        }
      } finally {
        setLoading(false);
      }
    }

    async function loadImpersonation() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
          .from('usuarios')
          .select('rol')
          .eq('auth_user_id', user.id)
          .single();

        if (userData?.rol !== 'super_admin') return;

        const res = await fetch('/api/superadmin/impersonate');
        const json = await res.json();
        if (json.success && json.data) {
          useAppStore.getState().setImpersonatedEmpresa(json.data);
        }
      } catch { /* ignore */ }
    }

    loadUser();
    loadImpersonation();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => subscription.unsubscribe();
  }, [setUsuario, setEmpresa, setLoading]);

  return <>{children}</>;
}
