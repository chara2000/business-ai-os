'use client';

import Link from 'next/link';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="empresa-context-empty animate-fade-in" style={{ minHeight: '100vh' }}>
      <div className="empresa-context-empty-card">
        <div className="empresa-context-empty-icon">
          <WifiOff size={28} strokeWidth={2} />
        </div>
        <h2>Sin conexión</h2>
        <p>
          No hay internet en este momento. Puedes seguir usando la versión web cuando vuelva la conexión,
          o reabrir la app instalada.
        </p>
        <button type="button" className="btn-action empresa-context-empty-btn" onClick={() => window.location.reload()}>
          <RefreshCw size={18} />
          Reintentar
        </button>
        <Link href="/dashboard" className="register-back-link" style={{ marginTop: 16, display: 'inline-block' }}>
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
