-- Tabla para tokens de vinculacion seguros con expiracion
CREATE TABLE IF NOT EXISTS public.telegram_pending_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id bigint NOT NULL,
  first_name text,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '10 minutes'),
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indice para busqueda rapida por token
CREATE INDEX IF NOT EXISTS idx_telegram_pending_links_token ON public.telegram_pending_links(token);

-- RLS: Solo el service role puede acceder (se accede via API, no desde el cliente)
ALTER TABLE public.telegram_pending_links ENABLE ROW LEVEL SECURITY;

-- Limpiar tokens vencidos automaticamente (puede ejecutarse con pg_cron si tienes el addon)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('cleanup-telegram-tokens', '*/5 * * * *', 'DELETE FROM public.telegram_pending_links WHERE expires_at < now() OR used = true');
