-- Billing Stripe + eventos (ejecutar en Supabase SQL Editor)

alter table empresas add column if not exists stripe_customer_id text;
alter table empresas add column if not exists stripe_subscription_id text;
alter table empresas add column if not exists billing_status text default 'manual';

create table if not exists billing_events (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references empresas(id) on delete set null,
  event_type text not null,
  plan subscription_plan,
  amount numeric(12,2),
  currency text default 'COP',
  stripe_event_id text unique,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table billing_events enable row level security;

drop policy if exists billing_events_super_admin on billing_events;
create policy billing_events_super_admin on billing_events
  for select using (
    exists (select 1 from usuarios where auth_user_id = auth.uid() and rol = 'super_admin')
  );

drop policy if exists billing_events_tenant_read on billing_events;
create policy billing_events_tenant_read on billing_events
  for select using (
    empresa_id = (select empresa_id from usuarios where auth_user_id = auth.uid())
  );

create index if not exists idx_billing_events_empresa on billing_events(empresa_id);
create index if not exists idx_billing_events_created on billing_events(created_at desc);
