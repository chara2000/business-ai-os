'use client';

import { useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import { FormModal } from '@/components/ui/FormModal';
import { generateQrDataUrl, productQrPayload } from '@/lib/barcode/qr';

type Props = {
  open: boolean;
  onClose: () => void;
  codigo: string;
  nombre: string;
  empresaId: string;
  codigoBarras?: string;
};

export function ProductQrModal({ open, onClose, codigo, nombre, empresaId, codigoBarras }: Props) {
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    if (!open || !codigo) return;
    const payload = productQrPayload(codigoBarras || codigo, empresaId);
    generateQrDataUrl(payload, 220).then(setQrUrl);
  }, [open, codigo, codigoBarras, empresaId]);

  if (!open) return null;

  return (
    <FormModal
      open
      onClose={onClose}
      title="Código QR del producto"
      subtitle={nombre}
      icon={QrCode}
      size="sm"
      footer={
        <button type="button" className="btn-ghost" onClick={onClose}>Cerrar</button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0' }}>
        {qrUrl ? (
          <img src={qrUrl} alt={`QR ${codigo}`} width={220} height={220} style={{ borderRadius: 12, border: '1px solid var(--border)' }} />
        ) : (
          <div className="skeleton" style={{ width: 220, height: 220, borderRadius: 12 }} />
        )}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Código interno</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{codigo}</p>
          {codigoBarras && (
            <>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Código de barras</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{codigoBarras}</p>
            </>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
          Escanea desde Inventario o Ventas para ubicar este producto al instante.
        </p>
      </div>
    </FormModal>
  );
}
