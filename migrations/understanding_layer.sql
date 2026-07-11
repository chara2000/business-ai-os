-- Habilitar extensiones requeridas para AI y búsquedas
create extension if not exists vector;
create extension if not exists pg_trgm;

-- Tabla de Alias Inteligentes para Learning Engine
create table if not exists public.entity_aliases (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.empresas(id) on delete cascade,
  entity_type text not null check (entity_type in ('producto', 'cliente', 'proveedor', 'empleado', 'marca', 'categoria', 'sucursal')),
  entity_id uuid not null,
  alias text not null,
  confidence float not null default 1.0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(company_id, entity_type, entity_id, alias)
);

-- Habilitar RLS en entity_aliases
alter table public.entity_aliases enable row level security;

create policy "Usuarios pueden ver alias de su empresa"
on public.entity_aliases for select
using (
  exists (
    select 1 from public.usuarios
    where usuarios.id = auth.uid()
    and usuarios.empresa_id = entity_aliases.company_id
  )
);

create policy "Usuarios pueden crear alias de su empresa"
on public.entity_aliases for insert
with check (
  exists (
    select 1 from public.usuarios
    where usuarios.id = auth.uid()
    and usuarios.empresa_id = entity_aliases.company_id
  )
);

create policy "Usuarios pueden actualizar alias de su empresa"
on public.entity_aliases for update
using (
  exists (
    select 1 from public.usuarios
    where usuarios.id = auth.uid()
    and usuarios.empresa_id = entity_aliases.company_id
  )
);

-- Agregar columnas de embedding a las entidades principales
alter table public.productos add column if not exists embedding vector(1536);
alter table public.clientes add column if not exists embedding vector(1536);
alter table public.proveedores add column if not exists embedding vector(1536);

-- Índices para mejorar la búsqueda vectorial (HNSW)
create index if not exists productos_embedding_idx on public.productos using hnsw (embedding vector_cosine_ops);
create index if not exists clientes_embedding_idx on public.clientes using hnsw (embedding vector_cosine_ops);
create index if not exists proveedores_embedding_idx on public.proveedores using hnsw (embedding vector_cosine_ops);

-- Índices Trigram para búsquedas ILIKE súper rápidas y similitud
create index if not exists productos_nombre_trgm_idx on public.productos using gin (nombre gin_trgm_ops);
create index if not exists clientes_nombre_trgm_idx on public.clientes using gin (nombre gin_trgm_ops);
create index if not exists clientes_apellido_trgm_idx on public.clientes using gin (apellido gin_trgm_ops);
create index if not exists proveedores_nombre_trgm_idx on public.proveedores using gin (nombre gin_trgm_ops);
create index if not exists entity_aliases_alias_trgm_idx on public.entity_aliases using gin (alias gin_trgm_ops);
