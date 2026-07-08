-- Suscripciones Web Push por usuario
create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table push_subscriptions enable row level security;

drop policy if exists push_subs_own on push_subscriptions;
create policy push_subs_own on push_subscriptions
  for all using (
    usuario_id = (select id from usuarios where auth_user_id = auth.uid())
  );
