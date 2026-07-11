'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, X } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { filterNavByPermissions } from '@/lib/permissions';
import { NAV_SECTIONS } from '@/lib/navigation';
import { useMobileNav } from './MobileNavContext';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export function MobileModulesSheet() {
  const pathname = usePathname();
  const router = useRouter();
  const { modulesOpen, closeModules } = useMobileNav();
  const usuario = useAppStore((s) => s.usuario);
  const isSuperAdmin = useAppStore((s) => s.isSuperAdmin());
  const clearImpersonation = useAppStore((s) => s.clearImpersonation);
  const supabase = createClient();

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearImpersonation();
    closeModules();
    toast.success('Sesión cerrada');
    router.push('/login');
  };

  return (
    <AnimatePresence>
      {modulesOpen && (
        <>
          <motion.button
            type="button"
            className="mobile-modules-backdrop"
            aria-label="Cerrar menú"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModules}
          />
          <motion.aside
            className="mobile-modules-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Módulos del sistema"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <div className="mobile-modules-sheet__head">
              <div>
                <strong>Todos los módulos</strong>
                <span>Operaciones, finanzas y configuración</span>
              </div>
              <button type="button" className="mobile-modules-sheet__close" onClick={closeModules} aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            <div className="mobile-modules-sheet__body">
              {isSuperAdmin && (
                <section className="mobile-modules-section">
                  <p className="mobile-modules-section__title">Super Admin</p>
                  <div className="mobile-modules-grid">
                    <Link
                      href="/superadmin"
                      className={`mobile-module-tile ${isActive('/superadmin') ? 'is-active' : ''}`}
                      onClick={closeModules}
                    >
                      <span>Establecimientos</span>
                    </Link>
                  </div>
                </section>
              )}

              {NAV_SECTIONS.map(({ title, items }) => {
                const visible = filterNavByPermissions(items, usuario);
                if (!visible.length) return null;
                return (
                  <section key={title} className="mobile-modules-section">
                    <p className="mobile-modules-section__title">{title}</p>
                    <div className="mobile-modules-grid">
                      {visible.map(({ label, href, icon: Icon, badge }) => (
                        <Link
                          key={href}
                          href={href}
                          className={`mobile-module-tile ${isActive(href) ? 'is-active' : ''}`}
                          onClick={closeModules}
                        >
                          <span className="mobile-module-tile__icon">
                            <Icon size={20} strokeWidth={1.9} />
                          </span>
                          <span className="mobile-module-tile__label">{label}</span>
                          {badge && <span className="mobile-module-tile__badge">{badge}</span>}
                        </Link>
                      ))}
                    </div>
                  </section>
                );
              })}

              <section className="mobile-modules-section mobile-modules-section--session">
                <button type="button" className="mobile-module-tile mobile-module-tile--danger" onClick={handleLogout}>
                  <span className="mobile-module-tile__icon">
                    <LogOut size={20} strokeWidth={1.9} />
                  </span>
                  <span className="mobile-module-tile__label">Cerrar sesión</span>
                </button>
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
