-- 1. Create a function to get the current user's empresa_id securely
-- This avoids infinite recursion in RLS policies by using SECURITY DEFINER
create or replace function public.get_user_empresa_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select empresa_id from usuarios where auth_user_id = auth.uid() limit 1;
$$;

-- 2. Drop existing recursive policies
drop policy if exists empresa_tenant_isolation on empresas;
drop policy if exists usuarios_tenant_isolation on usuarios;
drop policy if exists categorias_tenant_isolation on categorias;
drop policy if exists marcas_tenant_isolation on marcas;
drop policy if exists productos_tenant_isolation on productos;
drop policy if exists movimientos_tenant_isolation on movimientos_inventario;
drop policy if exists proveedores_tenant_isolation on proveedores;
drop policy if exists ordenes_tenant_isolation on ordenes_compra;
drop policy if exists clientes_tenant_isolation on clientes;
drop policy if exists ventas_tenant_isolation on ventas;
drop policy if exists creditos_tenant_isolation on creditos;
drop policy if exists abonos_tenant_isolation on abonos;
drop policy if exists gastos_tenant_isolation on gastos;
drop policy if exists devoluciones_tenant_isolation on devoluciones;
drop policy if exists auditoria_tenant_isolation on auditoria_logs;

-- 3. Recreate policies using the secure function
create policy empresa_tenant_isolation on empresas
  for all using (id = public.get_user_empresa_id());

create policy usuarios_tenant_isolation on usuarios
  for all using (empresa_id = public.get_user_empresa_id() or auth_user_id = auth.uid());

create policy categorias_tenant_isolation on categorias
  for all using (empresa_id = public.get_user_empresa_id());

create policy marcas_tenant_isolation on marcas
  for all using (empresa_id = public.get_user_empresa_id());

create policy productos_tenant_isolation on productos
  for all using (empresa_id = public.get_user_empresa_id());

create policy movimientos_tenant_isolation on movimientos_inventario
  for all using (empresa_id = public.get_user_empresa_id());

create policy proveedores_tenant_isolation on proveedores
  for all using (empresa_id = public.get_user_empresa_id());

create policy ordenes_tenant_isolation on ordenes_compra
  for all using (empresa_id = public.get_user_empresa_id());

create policy clientes_tenant_isolation on clientes
  for all using (empresa_id = public.get_user_empresa_id());

create policy ventas_tenant_isolation on ventas
  for all using (empresa_id = public.get_user_empresa_id());

create policy creditos_tenant_isolation on creditos
  for all using (empresa_id = public.get_user_empresa_id());

create policy abonos_tenant_isolation on abonos
  for all using (empresa_id = public.get_user_empresa_id());

create policy gastos_tenant_isolation on gastos
  for all using (empresa_id = public.get_user_empresa_id());

create policy devoluciones_tenant_isolation on devoluciones
  for all using (empresa_id = public.get_user_empresa_id());

create policy auditoria_tenant_isolation on auditoria_logs
  for all using (empresa_id = public.get_user_empresa_id());
