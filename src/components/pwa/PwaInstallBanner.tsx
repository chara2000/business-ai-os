'use client';

import { Smartphone, X, Download, Globe, RefreshCw } from 'lucide-react';
import { usePwa } from '@/lib/hooks/usePwa';
import toast from 'react-hot-toast';

export function PwaInstallBanner() {
  const {
    isOnline,
    showInstallBanner,
    canInstall,
    isIOS,
    updateAvailable,
    install,
    applyUpdate,
    dismissBanner,
  } = usePwa();

  if (updateAvailable) {
    return (
      <div className="pwa-banner pwa-banner--update">
        <RefreshCw size={16} />
        <span>Hay una actualización de Business OS disponible.</span>
        <button type="button" className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={applyUpdate}>
          Actualizar
        </button>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="pwa-banner pwa-banner--offline">
        <span>Sin conexión — los datos en vivo se sincronizarán al volver internet.</span>
      </div>
    );
  }

  if (!showInstallBanner) return null;

  const handleInstall = async () => {
    const ok = await install();
    if (ok) toast.success('App instalada. También puedes seguir usando la versión web.');
    else if (isIOS) toast('En Safari: Compartir → Añadir a pantalla de inicio', { icon: '📱', duration: 6000 });
  };

  return (
    <div className="pwa-banner">
      <div className="pwa-banner-icon">
        <Smartphone size={18} />
      </div>
      <div className="pwa-banner-body">
        <strong>Instala Business OS en tu dispositivo</strong>
        <span>
          Disponible para administradores y empleados. La versión web en el navegador sigue funcionando igual.
        </span>
      </div>
      <div className="pwa-banner-actions">
        {canInstall ? (
          <button type="button" className="btn-primary" style={{ padding: '8px 14px', fontSize: 12 }} onClick={handleInstall}>
            <Download size={14} /> Instalar
          </button>
        ) : isIOS ? (
          <button type="button" className="btn-primary" style={{ padding: '8px 14px', fontSize: 12 }} onClick={handleInstall}>
            <Download size={14} /> Cómo instalar
          </button>
        ) : null}
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: '8px 12px', fontSize: 12 }}
          onClick={dismissBanner}
          title="Seguir en versión web"
        >
          <Globe size={14} /> Usar web
        </button>
        <button type="button" className="btn-icon" onClick={dismissBanner} aria-label="Cerrar">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
