-- comun_catalogo: catalogos compartidos entre negocios (ver
-- gobernanza/estandares/00-nomenclatura-base-datos.md regla "Catalogos
-- compartidos entre proyectos van en un esquema comun_*"). Primera tabla:
-- provincias de Ecuador -- la necesita TRQ-001 (cobertura geografica de la
-- solicitud de socio abogado), pero es reutilizable por cualquier negocio
-- que necesite ubicacion (ej. zona de cobertura de FastFix).

create schema if not exists comun_catalogo;

create table comun_catalogo.cat_provincia (
  cat_id uuid primary key default gen_random_uuid(),
  cat_nombre text not null unique,
  cat_creado_en timestamptz not null default now()
);

alter table comun_catalogo.cat_provincia enable row level security;

create policy cat_provincia_select on comun_catalogo.cat_provincia
  for select using (true);

create trigger trg_auditoria_cat_provincia
  after insert or update or delete on comun_catalogo.cat_provincia
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant usage on schema comun_catalogo to authenticated;
grant select on comun_catalogo.cat_provincia to authenticated;

insert into comun_catalogo.cat_provincia (cat_nombre) values
  ('Azuay'), ('Bolívar'), ('Cañar'), ('Carchi'), ('Chimborazo'), ('Cotopaxi'),
  ('El Oro'), ('Esmeraldas'), ('Galápagos'), ('Guayas'), ('Imbabura'), ('Loja'),
  ('Los Ríos'), ('Manabí'), ('Morona Santiago'), ('Napo'), ('Orellana'),
  ('Pastaza'), ('Pichincha'), ('Santa Elena'), ('Santo Domingo de los Tsáchilas'),
  ('Sucumbíos'), ('Tungurahua'), ('Zamora Chinchipe')
on conflict (cat_nombre) do nothing;
