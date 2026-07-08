-- Storage para comprobantes / facturas OCR (ejecutar en Supabase SQL Editor)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes',
  'comprobantes',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

drop policy if exists comprobantes_tenant_read on storage.objects;
create policy comprobantes_tenant_read on storage.objects
  for select using (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = (
      select empresa_id::text from usuarios where auth_user_id = auth.uid() limit 1
    )
  );

drop policy if exists comprobantes_tenant_insert on storage.objects;
create policy comprobantes_tenant_insert on storage.objects
  for insert with check (
    bucket_id = 'comprobantes'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = (
      select empresa_id::text from usuarios where auth_user_id = auth.uid() limit 1
    )
  );

drop policy if exists comprobantes_tenant_delete on storage.objects;
create policy comprobantes_tenant_delete on storage.objects
  for delete using (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = (
      select empresa_id::text from usuarios where auth_user_id = auth.uid() limit 1
    )
  );

create table if not exists facturas_ocr (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  usuario_id uuid not null references usuarios(id),
  archivo_url text not null,
  estado text not null default 'procesado',
  proveedor_nombre text,
  nit text,
  fecha_factura date,
  subtotal numeric(12,2),
  iva numeric(12,2),
  total numeric(12,2),
  datos jsonb default '{}'::jsonb,
  gasto_id uuid references gastos(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table facturas_ocr enable row level security;

drop policy if exists facturas_ocr_tenant on facturas_ocr;
create policy facturas_ocr_tenant on facturas_ocr
  for all using (
    empresa_id = (select empresa_id from usuarios where auth_user_id = auth.uid())
  );
