-- Cuentas por pagar a proveedores para compras a credito
create table if not exists cuentas_por_pagar_proveedor (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id) on delete cascade,
  orden_compra_id uuid references ordenes_compra(id) on delete set null,
  monto_total numeric(12,2) not null default 0.00,
  monto_pagado numeric(12,2) not null default 0.00,
  saldo_pendiente numeric(12,2) not null default 0.00,
  estado credit_status not null default 'pendiente',
  fecha_vencimiento timestamptz not null,
  notas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_cxp_proveedor_empresa on cuentas_por_pagar_proveedor(empresa_id, proveedor_id);
create index if not exists idx_cxp_proveedor_estado on cuentas_por_pagar_proveedor(estado, fecha_vencimiento);

alter table cuentas_por_pagar_proveedor enable row level security;

create policy cxp_proveedor_tenant on cuentas_por_pagar_proveedor
  for all using (
    empresa_id in (select empresa_id from usuarios where auth_user_id = auth.uid())
  );
