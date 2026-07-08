-- Sesión de chat Telegram por usuario (historial + acción pendiente)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telegram_session jsonb DEFAULT '{}'::jsonb;
