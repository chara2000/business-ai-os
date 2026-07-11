-- db-setup-sql.sql
-- Ejecuta este script en el SQL Editor de Supabase para habilitar Text-to-SQL seguro.

CREATE OR REPLACE FUNCTION execute_ai_sql(sql_query text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Validaciones de seguridad básicas:
  -- Impedir múltiples sentencias o mutaciones.
  IF sql_query ~* ';\s*.' OR sql_query ~* '\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|commit|rollback)\b' THEN
    RAISE EXCEPTION 'Sólo se permiten consultas SELECT de lectura única.';
  END IF;

  -- Impersonar al usuario para que apliquen las políticas RLS
  EXECUTE 'SET LOCAL role = ''authenticated''';
  EXECUTE 'SET LOCAL request.jwt.claims = ''{"sub": "' || p_user_id || '"}'';';

  -- Ejecutar la consulta generada por la IA
  EXECUTE 'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (' || sql_query || ') t' INTO result;
  
  RETURN result;
END;
$$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION execute_ai_sql TO authenticated;
GRANT EXECUTE ON FUNCTION execute_ai_sql TO service_role;
