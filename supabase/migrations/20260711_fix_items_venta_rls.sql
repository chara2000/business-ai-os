-- Fix RLS policies for items_venta and gastos to correctly resolve company ID using auth.uid() mapped to auth_user_id

-- 1. Fix items_venta policies
DROP POLICY IF EXISTS "Usuarios ven items_venta de su empresa" ON public.items_venta;
CREATE POLICY "Usuarios ven items_venta de su empresa"
ON public.items_venta FOR SELECT
USING (
  venta_id IN (
    SELECT id FROM public.ventas WHERE empresa_id = (
      SELECT empresa_id FROM public.usuarios WHERE auth_user_id = auth.uid() LIMIT 1
    )
  )
);

DROP POLICY IF EXISTS "Usuarios insertan items_venta en su empresa" ON public.items_venta;
CREATE POLICY "Usuarios insertan items_venta en su empresa"
ON public.items_venta FOR INSERT
WITH CHECK (
  venta_id IN (
    SELECT id FROM public.ventas WHERE empresa_id = (
      SELECT empresa_id FROM public.usuarios WHERE auth_user_id = auth.uid() LIMIT 1
    )
  )
);

-- 2. Fix gastos policies
DROP POLICY IF EXISTS "Usuarios ven gastos de su empresa" ON public.gastos;
CREATE POLICY "Usuarios ven gastos de su empresa"
ON public.gastos FOR ALL
USING (
  empresa_id = (SELECT empresa_id FROM public.usuarios WHERE auth_user_id = auth.uid() LIMIT 1)
)
WITH CHECK (
  empresa_id = (SELECT empresa_id FROM public.usuarios WHERE auth_user_id = auth.uid() LIMIT 1)
);

-- 3. Add items_orden_compra policies
DROP POLICY IF EXISTS "items_orden_compra_tenant_isolation" ON public.items_orden_compra;
CREATE POLICY "items_orden_compra_tenant_isolation" ON public.items_orden_compra
  FOR ALL USING (
    orden_compra_id IN (
      SELECT id FROM public.ordenes_compra WHERE empresa_id = (
        SELECT empresa_id FROM public.usuarios WHERE auth_user_id = auth.uid() LIMIT 1
      )
    )
  );
