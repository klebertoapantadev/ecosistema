-- ==============================================================================
-- Migración: 20261018000001_crear_bucket_storage_catalogo.sql
-- Descripción: Creación del bucket público 'catalogo' en Supabase Storage
--              y configuración de políticas RLS para lectura pública y
--              gestión por usuarios autenticados (staff / administradores).
-- ==============================================================================

-- 1. Crear o actualizar el bucket público 'catalogo'
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalogo',
  'catalogo',
  true,
  5242880, -- 5 MB por imagen
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/svg+xml'
  ]
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/svg+xml'
  ];

-- 2. Políticas RLS en storage.objects
-- Lectura pública: Clientes, vitrina web, aplicaciones móviles y visitantes
drop policy if exists catalogo_imagenes_public_select on storage.objects;
create policy catalogo_imagenes_public_select on storage.objects
  for select
  using (bucket_id = 'catalogo');

-- Inserción: Usuarios autenticados del ecosistema
drop policy if exists catalogo_imagenes_authenticated_insert on storage.objects;
create policy catalogo_imagenes_authenticated_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'catalogo');

-- Actualización: Usuarios autenticados
drop policy if exists catalogo_imagenes_authenticated_update on storage.objects;
create policy catalogo_imagenes_authenticated_update on storage.objects
  for update to authenticated
  using (bucket_id = 'catalogo')
  with check (bucket_id = 'catalogo');

-- Eliminación: Usuarios autenticados
drop policy if exists catalogo_imagenes_authenticated_delete on storage.objects;
create policy catalogo_imagenes_authenticated_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'catalogo');
