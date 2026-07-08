'use client';

import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';

export function AuthThemeToggle() {
  const { resolved, toggle } = useThemeStore();

  return (
    <button
      type="button"
      className="auth-theme-toggle"
      onClick={toggle}
      aria-label={resolved === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
      title={resolved === 'light' ? 'Modo oscuro' : 'Modo claro'}
    >
      {resolved === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
