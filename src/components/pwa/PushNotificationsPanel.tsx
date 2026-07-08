'use client';

import { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { ActionButton } from '@/components/ui/ActionButton';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushNotificationsPanel() {
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const subscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast.error('Tu navegador no soporta notificaciones push');
      return;
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      toast('Push disponible cuando configures NEXT_PUBLIC_VAPID_PUBLIC_KEY en .env', { icon: '🔔' });
      return;
    }

    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Permiso de notificaciones denegado');
        setLoading(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = sub.toJSON();
      const res = await fetch('/api/notificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al suscribir');

      setEnabled(true);
      toast.success('Notificaciones push activadas');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al activar push';
      toast.error(msg);
    }
    setLoading(false);
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/notificaciones', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEnabled(false);
      toast.success('Notificaciones desactivadas');
    } catch {
      toast.error('No se pudo desactivar');
    }
    setLoading(false);
  };

  return (
    <div className="card" style={{ padding: 24, background: 'var(--bg-input)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--warning-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bell size={22} color="var(--warning)" />
        </div>
        <div>
          <h3 style={{ fontWeight: 700, fontSize: 16 }}>Notificaciones push</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Alertas de stock bajo y créditos en tu celular (PWA o web)
          </p>
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
        Funciona para administradores y empleados con la app instalada o con el sitio abierto en el navegador.
      </p>
      <ActionButton
        loading={loading}
        icon={enabled ? <BellOff size={16} /> : <Bell size={16} />}
        onClick={enabled ? unsubscribe : subscribe}
      >
        {enabled ? 'Desactivar notificaciones' : 'Activar notificaciones push'}
      </ActionButton>
    </div>
  );
}
