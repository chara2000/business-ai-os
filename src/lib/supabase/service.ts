import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase con Service Role (sin contexto de cookies).
 * Solo para uso en server-side sin sesión de usuario (webhooks, bot handlers).
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
