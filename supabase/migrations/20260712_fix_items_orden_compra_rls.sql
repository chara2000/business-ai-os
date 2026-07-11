-- ============================================================
-- Fix RLS for items_orden_compra: ensure SELECT, INSERT, UPDATE, DELETE
-- work for authenticated users in the same company.
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "items_orden_compra_tenant_isolation" ON public.items_orden_compra;
DROP POLICY IF EXISTS "items_orden_compra_select" ON public.items_orden_compra;
DROP POLICY IF EXISTS "items_orden_compra_insert" ON public.items_orden_compra;
DROP POLICY IF EXISTS "items_orden_compra_update" ON public.items_orden_compra;
DROP POLICY IF EXISTS "items_orden_compra_delete" ON public.items_orden_compra;

-- Make sure RLS is enabled
ALTER TABLE public.items_orden_compra ENABLE ROW LEVEL SECURITY;

-- SELECT: User can read items of orders belonging to their company
CREATE POLICY "items_orden_compra_select"
ON public.items_orden_compra
FOR SELECT
USING (
  orden_compra_id IN (
    SELECT id FROM public.ordenes_compra
    WHERE empresa_id IN (
      SELECT empresa_id FROM public.usuarios
      WHERE auth_user_id = auth.uid()
    )
  )
);

-- INSERT: User can insert items into orders of their company
CREATE POLICY "items_orden_compra_insert"
ON public.items_orden_compra
FOR INSERT
WITH CHECK (
  orden_compra_id IN (
    SELECT id FROM public.ordenes_compra
    WHERE empresa_id IN (
      SELECT empresa_id FROM public.usuarios
      WHERE auth_user_id = auth.uid()
    )
  )
);

-- UPDATE: User can update items of orders of their company
CREATE POLICY "items_orden_compra_update"
ON public.items_orden_compra
FOR UPDATE
USING (
  orden_compra_id IN (
    SELECT id FROM public.ordenes_compra
    WHERE empresa_id IN (
      SELECT empresa_id FROM public.usuarios
      WHERE auth_user_id = auth.uid()
    )
  )
);

-- DELETE: User can delete items of orders of their company
CREATE POLICY "items_orden_compra_delete"
ON public.items_orden_compra
FOR DELETE
USING (
  orden_compra_id IN (
    SELECT id FROM public.ordenes_compra
    WHERE empresa_id IN (
      SELECT empresa_id FROM public.usuarios
      WHERE auth_user_id = auth.uid()
    )
  )
);

-- Also verify ordenes_compra itself has proper RLS so items join works
ALTER TABLE public.ordenes_compra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ordenes_compra_tenant_isolation" ON public.ordenes_compra;

CREATE POLICY "ordenes_compra_tenant_isolation"
ON public.ordenes_compra
FOR ALL
USING (
  empresa_id IN (
    SELECT empresa_id FROM public.usuarios
    WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  empresa_id IN (
    SELECT empresa_id FROM public.usuarios
    WHERE auth_user_id = auth.uid()
  )
);
