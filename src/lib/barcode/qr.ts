import QRCode from 'qrcode';

export async function generateQrDataUrl(text: string, size = 200): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 2,
    color: { dark: '#1A1A1A', light: '#FFFFFF' },
  });
}

export function productQrPayload(codigo: string, empresaId: string) {
  return JSON.stringify({ type: 'business-os-product', codigo, empresaId });
}

export function parseQrPayload(raw: string): { codigo?: string; empresaId?: string } | null {
  try {
    const data = JSON.parse(raw);
    if (data?.type === 'business-os-product' && data.codigo) {
      return { codigo: data.codigo, empresaId: data.empresaId };
    }
  } catch {
    // Código de barras plano
  }
  if (/^[A-Za-z0-9\-_.]+$/.test(raw.trim()) && raw.trim().length >= 3) {
    return { codigo: raw.trim() };
  }
  return null;
}
