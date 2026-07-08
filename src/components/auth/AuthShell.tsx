'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { LoginDecorations } from '@/components/ui/LoginDecorations';
import { AuthThemeToggle } from '@/components/auth/AuthThemeToggle';
import { LoginInfoPanel } from '@/components/auth/LoginInfoPanel';
import { LoginFormCard } from '@/components/auth/LoginFormCard';
import { RegisterInfoPanel } from '@/components/auth/RegisterInfoPanel';
import { RegisterFormCard } from '@/components/auth/RegisterFormCard';
import { cn } from '@/lib/utils';

const FORM_SPRING = {
  type: 'spring' as const,
  stiffness: 36,
  damping: 15,
  mass: 1.05,
};

interface AuthShellProps {
  isRegister: boolean;
}

export function AuthShell({ isRegister }: AuthShellProps) {
  return (
    <div className={cn('login-shell', isRegister && 'login-shell--register')}>
      <AuthThemeToggle />
      <LoginDecorations />

      <motion.div className="login-shell-panels" layoutRoot>
        {/* Info: cambia de lado al instante, solo fade en el contenido */}
        <div
          className="login-panel-left auth-panel-info hidden lg:flex"
          style={{ order: isRegister ? 2 : 1 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={isRegister ? 'register-info' : 'login-info'}
              className="auth-panel-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
            >
              {isRegister ? <RegisterInfoPanel /> : <LoginInfoPanel />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Formulario: único elemento que se desplaza de lado */}
        <motion.div
          layout="position"
          className="login-panel-right auth-panel-form auth-form-exchange"
          style={{ order: isRegister ? 1 : 2 }}
          transition={{ layout: FORM_SPRING }}
        >
          <div className="auth-form-panel-inner">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={isRegister ? 'register-form' : 'login-form'}
                className="auth-panel-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, delay: 0.12 }}
              >
                {isRegister ? <RegisterFormCard /> : <LoginFormCard />}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
