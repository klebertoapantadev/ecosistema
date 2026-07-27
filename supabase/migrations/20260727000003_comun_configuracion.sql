-- comun_configuracion: implementa PLT-008 (datos generales del negocio).
-- cfg_negocio guarda la identidad legal/comercial (NIT, razon social, nombre
-- comercial); redes sociales, canales, terminos y locales quedan en el JSONB
-- de detalle hasta que su volumen justifique tablas propias.

create schema if not exists comun_configuracion;

create table comun_configuracion.cfg_negocio (
  cfg_id uuid primary key default gen_random_uuid(),
  cfg_secuencial bigint generated always as identity,
  cfg_negocio text not null unique, -- 'tranqi' | 'fastfix' | 'tinkay' | 'margaritas'
  cfg_identificacion text, -- NIT / RUC / Cedula
  cfg_nombre_comercial text,
  cfg_razon_social text,
  cfg_detalle_configuracion jsonb not null default '{}'::jsonb,
  cfg_creado_en timestamptz not null default now(),
  cfg_actualizado_en timestamptz not null default now()
);

alter table comun_configuracion.cfg_negocio enable row level security;

-- Informacion corporativa de vitrina (nombre, redes, terminos) es publica.
create policy cfg_negocio_lectura_publica on comun_configuracion.cfg_negocio
  for select using (true);

create policy cfg_negocio_admin_escritura on comun_configuracion.cfg_negocio
  for update using (comun_seguridad.seg_fn_es_admin_negocio(cfg_negocio))
  with check (comun_seguridad.seg_fn_es_admin_negocio(cfg_negocio));

create trigger trg_auditoria_cfg_negocio after insert or update or delete on comun_configuracion.cfg_negocio for each row execute function comun_auditoria.aud_fn_auditar_tabla();

insert into comun_configuracion.cfg_negocio (cfg_negocio, cfg_nombre_comercial) values
  ('tranqi', 'Tranqi'),
  ('fastfix', 'FastFix Home'),
  ('tinkay', 'Tinkay'),
  ('margaritas', 'Margaritas Floristería')
on conflict (cfg_negocio) do nothing;

grant usage on schema comun_configuracion to anon, authenticated;
grant select on comun_configuracion.cfg_negocio to anon, authenticated;
grant update on comun_configuracion.cfg_negocio to authenticated;
