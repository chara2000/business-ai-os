-- Supabase Storage: bucket para imágenes de productos (ejecutar en SQL Editor)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'productos',
  'productos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Lectura pública de imágenes
drop policy if exists productos_storage_public_read on storage.objects;
create policy productos_storage_public_read on storage.objects
  for select using (bucket_id = 'productos');

-- Subida solo usuarios autenticados de su tenant
drop policy if exists productos_storage_tenant_insert on storage.objects;
create policy productos_storage_tenant_insert on storage.objects
  for insert with check (
    bucket_id = 'productos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = (
      select empresa_id::text from usuarios where auth_user_id = auth.uid() limit 1
    )
  );

drop policy if exists productos_storage_tenant_update on storage.objects;
create policy productos_storage_tenant_update on storage.objects
  for update using (
    bucket_id = 'productos'
    and (storage.foldername(name))[1] = (
      select empresa_id::text from usuarios where auth_user_id = auth.uid() limit 1
    )
  );

drop policy if exists productos_storage_tenant_delete on storage.objects;
create policy productos_storage_tenant_delete on storage.objects
  for delete using (
    bucket_id = 'productos'
    and (storage.foldername(name))[1] = (
      select empresa_id::text from usuarios where auth_user_id = auth.uid() limit 1
    )
  );
