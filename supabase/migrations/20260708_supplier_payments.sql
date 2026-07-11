-- Abonos / pagos a proveedores para cerrar CxP
create table if not exists abonos_proveedor (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  cuenta_por_pagar_id uuid not null references cuentas_por_pagar_proveedor(id) on delete cascade,
  monto numeric(12,2) not null default 0.00,
  metodo_pago text not null default 'efectivo',
  notas text,
  usuario_id uuid references usuarios(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_abonos_proveedor_empresa on abonos_proveedor(empresa_id, cuenta_por_pagar_id);

alter table abonos_proveedor enable row level security;

create policy abonos_proveedor_tenant on abonos_proveedor
  for all using (
    empresa_id in (select empresa_id from usuarios where auth_user_id = auth.uid())
  );

