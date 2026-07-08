import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  resolved: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      resolved: 'light',
      setTheme: (theme) => {
        const resolved = resolve(theme);
        set({ theme, resolved });
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', resolved);
        }
      },
      toggle: () => {
        const next = get().resolved === 'light' ? 'dark' : 'light';
        get().setTheme(next);
      },
    }),
    {
      name: 'business-os-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolve(state.theme);
          state.resolved = resolved;
          if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', resolved);
          }
        }
      },
    }
  )
);
