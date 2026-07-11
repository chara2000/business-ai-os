import type { Metadata, Viewport } from 'next';
import './theme-fintech.css';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

export const metadata: Metadata = {
  title: {
    default: 'Business AI OS — CRM Premium con IA',
    template: '%s | Business AI OS',
  },
  description: 'Plataforma SaaS empresarial premium con inteligencia artificial.',
  manifest: '/manifest.json',
  applicationName: 'Business OS',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Business OS',
  },
  icons: {
    icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#C8F542',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="light" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('business-os-theme');if(!s)return;var p=JSON.parse(s);var t=p.state&&p.state.theme||'light';var r=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.setAttribute('data-theme',r);}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--bg-glass-strong)',
                backdropFilter: 'blur(20px)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-glass)',
                borderRadius: '14px',
                fontSize: '14px',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                boxShadow: 'var(--shadow-lg)',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
