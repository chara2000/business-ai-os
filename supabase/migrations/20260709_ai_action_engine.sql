-- AI Action Engine: sesiones y memoria de negocio
create table if not exists ai_sessions (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  accion text not null,
  entidad text not null default 'consulta',
  state jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_ai_sessions_usuario on ai_sessions(usuario_id);
create index if not exists idx_ai_sessions_expires on ai_sessions(expires_at);

create table if not exists ai_business_memory (
  empresa_id uuid not null references empresas(id) on delete cascade,
  memory_key text not null,
  memory_value jsonb not null default '{}'::jsonb,
  hit_count int not null default 1,
  updated_at timestamptz default now(),
  primary key (empresa_id, memory_key)
);

alter table ai_sessions enable row level security;
alter table ai_business_memory enable row level security;

create policy ai_sessions_tenant on ai_sessions
  for all using (
    empresa_id in (select empresa_id from usuarios where auth_user_id = auth.uid())
  );

create policy ai_memory_tenant on ai_business_memory
  for all using (
    empresa_id in (select empresa_id from usuarios where auth_user_id = auth.uid())
  );
