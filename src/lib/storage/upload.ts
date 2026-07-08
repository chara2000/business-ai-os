import { createClient } from '@/lib/supabase/client';

const BUCKET = 'productos';
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function uploadProductImage(empresaId: string, file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error('Formato no permitido. Usa JPG, PNG o WebP.');
  }
  if (file.size > MAX_SIZE) {
    throw new Error('La imagen no puede superar 5 MB.');
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
      throw new Error('Bucket de Storage no configurado. Ejecuta supabase-storage.sql en Supabase.');
    }
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteProductImage(publicUrl: string) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = publicUrl.slice(idx + marker.length);
  const supabase = createClient();
  await supabase.storage.from(BUCKET).remove([path]);
}
