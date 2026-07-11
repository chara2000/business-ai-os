-- Activar RLS en las tablas
ALTER TABLE public.items_venta ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.gastos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  concepto text NOT NULL,
  categoria text NOT NULL,
  monto numeric NOT NULL,
  fecha timestamp with time zone DEFAULT now(),
  metodo_pago text NOT NULL,
  notas text,
  usuario_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

-- Politicas para items_venta
DROP POLICY IF EXISTS "Usuarios ven items_venta de su empresa" ON public.items_venta;
CREATE POLICY "Usuarios ven items_venta de su empresa"
ON public.items_venta FOR SELECT
USING (
  venta_id IN (
    SELECT id FROM public.ventas WHERE empresa_id = (
      SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Usuarios insertan items_venta en su empresa" ON public.items_venta;
CREATE POLICY "Usuarios insertan items_venta en su empresa"
ON public.items_venta FOR INSERT
WITH CHECK (
  venta_id IN (
    SELECT id FROM public.ventas WHERE empresa_id = (
      SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()
    )
  )
);

-- Politicas para gastos
DROP POLICY IF EXISTS "Usuarios ven gastos de su empresa" ON public.gastos;
CREATE POLICY "Usuarios ven gastos de su empresa"
ON public.gastos FOR ALL
USING (
  empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
)
WITH CHECK (
  empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);
