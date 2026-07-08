-- Wompi billing: pagos pendientes y referencias (ejecutar en Supabase SQL Editor)

create table if not exists billing_pending_payments (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  usuario_id uuid references usuarios(id) on delete set null,
  plan subscription_plan not null,
  reference text not null unique,
  amount_cents integer not null,
  currency text not null default 'COP',
  status text not null default 'pending',
  wompi_transaction_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone
);

alter table billing_pending_payments enable row level security;

drop policy if exists billing_pending_tenant on billing_pending_payments;
create policy billing_pending_tenant on billing_pending_payments
  for select using (
    empresa_id = (select empresa_id from usuarios where auth_user_id = auth.uid())
  );

drop policy if exists billing_pending_super on billing_pending_payments;
create policy billing_pending_super on billing_pending_payments
  for all using (
    exists (select 1 from usuarios where auth_user_id = auth.uid() and rol = 'super_admin')
  );

create index if not exists idx_billing_pending_reference on billing_pending_payments(reference);
create index if not exists idx_billing_pending_empresa on billing_pending_payments(empresa_id);

-- Eventos Wompi (provider_event_id genérico)
alter table billing_events add column if not exists provider_event_id text;
alter table billing_events add column if not exists payment_reference text;

create unique index if not exists idx_billing_events_provider_event
  on billing_events(provider_event_id) where provider_event_id is not null;
