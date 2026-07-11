'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type MobileNavContextValue = {
  modulesOpen: boolean;
  openModules: () => void;
  closeModules: () => void;
  toggleModules: () => void;
};

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [modulesOpen, setModulesOpen] = useState(false);

  const openModules = useCallback(() => setModulesOpen(true), []);
  const closeModules = useCallback(() => setModulesOpen(false), []);
  const toggleModules = useCallback(() => setModulesOpen((v) => !v), []);

  useEffect(() => {
    if (!modulesOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modulesOpen]);

  const value = useMemo(
    () => ({ modulesOpen, openModules, closeModules, toggleModules }),
    [modulesOpen, openModules, closeModules, toggleModules],
  );

  return (
    <MobileNavContext.Provider value={value}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error('useMobileNav debe usarse dentro de MobileNavProvider');
  return ctx;
}
