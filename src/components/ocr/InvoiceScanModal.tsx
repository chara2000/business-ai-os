'use client';

import { useState, useRef } from 'react';
import { Scan, FileImage, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { FormModal } from '@/components/ui/FormModal';
import { ActionButton } from '@/components/ui/ActionButton';
import type { ParsedInvoice } from '@/lib/ocr/parse-invoice';

type Props = {
  open: boolean;
  onClose: () => void;
  onParsed: (data: ParsedInvoice) => void;
  title?: string;
};

export function InvoiceScanModal({ open, onClose, onParsed, title = 'Escanear factura' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Usa una imagen JPG o PNG de la factura');
      return;
    }

    setPreview(URL.createObjectURL(file));
    setLoading(true);

    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/ocr/invoice', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error OCR');

      toast.success(`Factura leída (${json.data.confianza}% confianza)`);
      onParsed(json.data);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo leer la factura');
    }
    setLoading(false);
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={title}
      subtitle="Sube una foto de la factura y la IA extraerá los datos"
      icon={Scan}
      size="md"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <ActionButton
            loading={loading}
            icon={<FileImage size={16} />}
            onClick={() => inputRef.current?.click()}
          >
            Seleccionar imagen
          </ActionButton>
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
      <div style={{
        border: '2px dashed var(--border)',
        borderRadius: 12,
        padding: 32,
        textAlign: 'center',
        background: 'var(--bg-input)',
      }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Loader2 size={32} className="animate-spin" color="var(--brand)" />
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Analizando factura con IA...</p>
          </div>
        ) : preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Vista previa" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8 }} />
        ) : (
          <>
            <Scan size={40} color="var(--text-muted)" style={{ marginBottom: 12 }} />
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Fotografía o escaneo de factura</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              JPG, PNG o WebP. La IA extrae proveedor, NIT, total e IVA.
            </p>
          </>
        )}
      </div>
    </FormModal>
  );
}
