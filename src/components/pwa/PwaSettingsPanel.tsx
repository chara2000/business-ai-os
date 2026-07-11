'use client';

import { Smartphone, Download, Globe, CheckCircle, Monitor } from 'lucide-react';
import { usePwa } from '@/lib/hooks/usePwa';
import { ActionButton } from '@/components/ui/ActionButton';
import { PushNotificationsPanel } from '@/components/pwa/PushNotificationsPanel';
import toast from 'react-hot-toast';

export function PwaSettingsPanel() {
  const { isStandalone, canInstall, isIOS, swReady, install } = usePwa();

  const handleInstall = async () => {
    const ok = await install();
    if (ok) toast.success('App instalada correctamente');
    else if (isIOS) toast('Safari → Compartir → Añadir a pantalla de inicio', { icon: '📱', duration: 6000 });
    else toast('Usa el menú del navegador (⋮) → Instalar aplicación', { icon: '💡' });
  };

  return (
    <div className="pwa-settings-panel">
      <div className="card" style={{ padding: 24, background: 'var(--bg-input)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Smartphone size={24} color="var(--brand)" />
          </div>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: 16 }}>App móvil (PWA)</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Para administradores y empleados — misma cuenta, mismos permisos
            </p>
          </div>
          {isStandalone ? (
            <span className="badge badge-success" style={{ marginLeft: 'auto' }}>
              <CheckCircle size={12} /> App instalada
            </span>
          ) : swReady ? (
            <span className="badge badge-info" style={{ marginLeft: 'auto' }}>Lista para instalar</span>
          ) : null}
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          Puedes usar Business OS de dos formas sin perder funciones según tu rol:
        </p>

        <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
            <Monitor size={20} color="var(--brand)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ fontSize: 14 }}>Versión web</strong>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Abre la URL en Chrome, Edge o Safari. Ideal en escritorio y para multitarea.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
            <Smartphone size={20} color="var(--brand)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ fontSize: 14 }}>App instalada (PWA)</strong>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Icono en inicio. Mismos módulos que ves en web según tus permisos de empleado o admin.
              </p>
            </div>
          </div>
        </div>

        {!isStandalone && (
          <ActionButton loading={false} icon={<Download size={16} />} onClick={handleInstall}>
            {canInstall ? 'Instalar en este dispositivo' : 'Ver instrucciones de instalación'}
          </ActionButton>
        )}

        {isStandalone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            <Globe size={14} />
            Para la versión web, abre tu navegador y entra a la misma URL de siempre.
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Instrucciones por dispositivo</h4>
        <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
          <li><strong>Android / Chrome:</strong> Menú ⋮ → Instalar aplicación, o usa el botón de arriba.</li>
          <li><strong>iPhone / iPad:</strong> Safari → Compartir → Añadir a pantalla de inicio.</li>
          <li><strong>Windows / Mac:</strong> Icono de instalación en la barra de direcciones del navegador.</li>
        </ul>
      </div>

      <PushNotificationsPanel />
    </div>
  );
}
