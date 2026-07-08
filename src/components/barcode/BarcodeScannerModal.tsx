'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Scan, X } from 'lucide-react';
import { FormModal } from '@/components/ui/FormModal';
import { ActionButton } from '@/components/ui/ActionButton';

type Props = {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
};

export function BarcodeScannerModal({ open, onClose, onScan, title = 'Escanear código' }: Props) {
  const [manual, setManual] = useState('');
  const [error, setError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = 'barcode-scanner-region';

  useEffect(() => {
    if (!open) return;

    let active = true;
    const scanner = new Html5Qrcode(regionId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          if (!active) return;
          active = false;
          onScan(decoded);
          onClose();
        },
        () => { /* frame sin código */ },
      )
      .catch(() => {
        setError('No se pudo acceder a la cámara. Usa entrada manual o permisos del navegador.');
      });

    return () => {
      active = false;
      scanner.stop().catch(() => {}).finally(() => {
        try { scanner.clear(); } catch { /* ignore */ }
      });
      scannerRef.current = null;
    };
  }, [open, onClose, onScan]);

  const handleManual = () => {
    const code = manual.trim();
    if (!code) return;
    onScan(code);
    onClose();
  };

  if (!open) return null;

  return (
    <FormModal
      open
      onClose={onClose}
      title={title}
      subtitle="Apunta al código de barras o QR del producto"
      icon={Scan}
      size="md"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            <X size={14} /> Cerrar
          </button>
          <ActionButton onClick={handleManual} disabled={!manual.trim()}>
            Usar código manual
          </ActionButton>
        </>
      }
    >
      <div className="modal-form">
        <div id={regionId} style={{ width: '100%', borderRadius: 12, overflow: 'hidden', minHeight: 240 }} />
        {error && <p style={{ fontSize: 13, color: 'var(--warning)', marginTop: 12 }}>{error}</p>}
        <div className="input-wrapper" style={{ marginTop: 16 }}>
          <label className="form-label">O escribe el código</label>
          <input
            className="input"
            placeholder="EAN / código interno"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManual()}
          />
        </div>
      </div>
    </FormModal>
  );
}
