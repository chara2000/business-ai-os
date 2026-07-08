import { createClient } from '@/lib/supabase/client';

const BUCKET = 'comprobantes';
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export async function uploadComprobante(empresaId: string, file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error('Formato no permitido. Usa JPG, PNG, WebP o PDF.');
  }
  if (file.size > MAX_SIZE) {
    throw new Error('El archivo no puede superar 10 MB.');
  }

  const supabase = createClient();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${empresaId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    if (error.message.includes('Bucket not found')) {
      throw new Error('Bucket de comprobantes no configurado. Ejecuta supabase-comprobantes.sql');
    }
    throw new Error(error.message);
  }

  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (!data?.signedUrl) {
    throw new Error('No se pudo generar URL del comprobante');
  }
  return data.signedUrl;
}

export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}
