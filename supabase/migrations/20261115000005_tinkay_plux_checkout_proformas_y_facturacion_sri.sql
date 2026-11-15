-- ==============================================================================
-- Migración Consolidada e Idempotente:
--   20261115000005_tinkay_plux_checkout_proformas_y_facturacion_sri.sql
--
-- Resuelve de punta a punta:
--   1. Error "permission denied for table com_proforma" en checkout PLUX y
--      proformas de eventos para compradores invitados (anon) y autenticados,
--      habilitando RPCs transaccionales SECURITY DEFINER en comun_comercio.
--   2. Pasarela PLUX multiempresa (Tinkay, Margaritas, FastFix, Tranqi) con
--      visibilidad activa en pruebas/producción y desglose exacto Subtotal 0% +
--      Subtotal 15% + IVA 15%.
--   3. Esquema comun_facturacion (PLT-006) 100% idempotente: emisores por
--      negocio, certificados .p12 custodiados en Supabase Vault, numeración
--      secuencial (01 Facturas / 04 Notas de Crédito), emisión automática con
--      líneas detalladas de pedido + envío al aprobarse pagos en PLUX o
--      registro manual, RLS + triggers de auditoría aud_fn_auditar_tabla().
--   4. RPCs puente en comun_comercio (expuesto en PostgREST) para administrar
--      los parámetros de Facturación Electrónica SRI desde el panel web sin
--      exponer comun_facturacion ni secretos de Vault al navegador.
--   5. Registro y pre-configuración por defecto (Regla 15 AGENTS.md) de los
--      widgets 'configuracion_facturacion_sri', 'facturacion_electronica',
--      'historial_pagos' y 'pasarela_payphone' en seg_widget y seg_rol_widget.
-- ==============================================================================

create schema if not exists comun_facturacion;
create extension if not exists supabase_vault with schema vault;

-- Asegurar columnas blandas requeridas por RPCs de proformas y usuarios
alter table comun_seguridad.seg_usuario
  add column if not exists usu_autorizacion_whatsapp boolean not null default false;

alter table comun_comercio.com_proforma
  add column if not exists prf_eliminado_en timestamptz;

alter table comun_comercio.com_proforma_item
  add column if not exists pfi_eliminado_en timestamptz;

alter table comun_comercio.com_pasarela_configuracion
  add column if not exists psc_eliminado_en timestamptz;

alter table comun_comercio.com_transaccion_pago
  add column if not exists pag_eliminado_en timestamptz;

-- Asegurar los 4 negocios base en comun_configuracion.cfg_negocio
insert into comun_configuracion.cfg_negocio (cfg_negocio, cfg_nombre_comercial)
values
  ('tranqi', 'Tranqi Legal'),
  ('fastfix', 'FastFix Home'),
  ('tinkay', 'Tinkay Floristería'),
  ('margaritas', 'Margaritas Floristería')
on conflict (cfg_negocio) do nothing;

-- ==============================================================================
-- SECCIÓN A: PREFIJO DE NEGOCIO Y SEMILLA PLUX MULTIEMPRESA
-- ==============================================================================
create or replace function comun_comercio.com_fn_prefijo_negocio(p_negocio text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(trim(coalesce(p_negocio, '')))
    when 'tinkay' then 'TNK'
    when 'tnk' then 'TNK'
    when 'margaritas' then 'MRG'
    when 'mrg' then 'MRG'
    when 'fastfix' then 'FFH'
    when 'ffh' then 'FFH'
    else 'TRQ'
  end;
$$;

grant execute on function comun_comercio.com_fn_prefijo_negocio(text) to anon, authenticated, service_role;

-- Asegurar que com_fn_obtener_pasarelas_activas pueda ser consultada por compradores invitados (anon) en vitrina
grant execute on function comun_comercio.com_fn_obtener_pasarelas_activas(text) to anon, authenticated, service_role;

do $$
declare
  v_tranqi comun_comercio.com_pasarela_configuracion%rowtype;
  v_remail text := 'admin.operaciones@tranqi24.com';
  v_ambiente text := 'PRUEBAS';
  v_privadas jsonb := '{}'::jsonb;
begin
  select * into v_tranqi
  from comun_comercio.com_pasarela_configuracion
  where psc_negocio = 'tranqi'
    and psc_pasarela = 'PLUX'
    and psc_eliminado_en is null
  limit 1;

  if found then
    v_remail := coalesce(nullif(trim(v_tranqi.psc_credenciales_publicas->>'remail'), ''), v_remail);
    v_ambiente := coalesce(v_tranqi.psc_ambiente, 'PRUEBAS');
    v_privadas := coalesce(v_tranqi.psc_credenciales_privadas, '{}'::jsonb);
  end if;

  insert into comun_comercio.com_pasarela_configuracion (
    psc_negocio, psc_pasarela, psc_nombre_visible, psc_ambiente, psc_activo,
    psc_credenciales_publicas, psc_credenciales_privadas, psc_orden_visual, psc_detalle_pasarela
  )
  values
    ('tinkay', 'PLUX', 'PLUX (Tarjeta de Crédito / Débito)', v_ambiente, true,
      jsonb_build_object('remail', v_remail, 'nombre_comercio', 'Tinkay Floristería'),
      v_privadas, 1, jsonb_build_object('visibilidad', 'TODOS', 'probadores', '[]'::jsonb)),
    ('margaritas', 'PLUX', 'PLUX (Tarjeta de Crédito / Débito)', v_ambiente, true,
      jsonb_build_object('remail', v_remail, 'nombre_comercio', 'Margaritas Floristería'),
      v_privadas, 1, jsonb_build_object('visibilidad', 'TODOS', 'probadores', '[]'::jsonb)),
    ('fastfix', 'PLUX', 'PLUX (Tarjeta de Crédito / Débito)', v_ambiente, true,
      jsonb_build_object('remail', v_remail, 'nombre_comercio', 'FastFix Home'),
      v_privadas, 1, jsonb_build_object('visibilidad', 'TODOS', 'probadores', '[]'::jsonb))
  on conflict (psc_negocio, psc_pasarela) do update set
    psc_activo = true,
    psc_eliminado_en = null,
    psc_credenciales_publicas = case
      when coalesce(comun_comercio.com_pasarela_configuracion.psc_credenciales_publicas->>'remail', '') = ''
      then excluded.psc_credenciales_publicas
      else comun_comercio.com_pasarela_configuracion.psc_credenciales_publicas
    end,
    psc_credenciales_privadas = case
      when comun_comercio.com_pasarela_configuracion.psc_credenciales_privadas is null
        or comun_comercio.com_pasarela_configuracion.psc_credenciales_privadas = '{}'::jsonb
      then excluded.psc_credenciales_privadas
      else comun_comercio.com_pasarela_configuracion.psc_credenciales_privadas
    end;
end $$;

-- ==============================================================================
-- SECCIÓN B: ESQUEMA comun_facturacion (PLT-006) — TABLAS, RLS Y AUDITORÍA
-- ==============================================================================
create or replace function comun_facturacion.fac_fn_negocio_canonico(p_negocio text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when upper(trim(coalesce(p_negocio, ''))) in ('TRANQ', 'TRANQI', 'LEGAL', 'TRQ') then 'tranqi'
    when upper(trim(coalesce(p_negocio, ''))) in ('FFH', 'FASTFIX') then 'fastfix'
    when upper(trim(coalesce(p_negocio, ''))) in ('TNK', 'TINKAY') then 'tinkay'
    when upper(trim(coalesce(p_negocio, ''))) in ('MRG', 'MARGARITAS') then 'margaritas'
    else lower(trim(coalesce(p_negocio, 'tranqi')))
  end;
$$;

create or replace function comun_facturacion.fac_fn_usuario_es_admin(p_usuario uuid, p_negocio text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from comun_seguridad.seg_usuario u
    where u.usu_id = p_usuario
      and (
        u.usu_superadmin_plataforma = true
        or lower(u.usu_correo) in ('kleber.toapanta.ch@gmail.com', 'tinkay.uio@gmail.com')
      )
  ) or exists (
    select 1
    from comun_seguridad.seg_membresia m
    where m.mem_usuario_id = p_usuario
      and m.mem_estado in ('ACTIVO', 'ACTIVA')
      and comun_facturacion.fac_fn_negocio_canonico(m.mem_negocio) = comun_facturacion.fac_fn_negocio_canonico(p_negocio)
      and (
        upper(m.mem_rol) in ('ADMINISTRADOR', 'SUPERADMIN', 'ADMIN')
        or exists (
          select 1
          from comun_seguridad.seg_membresia_perfil mp
          join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
          where mp.mpe_membresia_id = m.mem_id
            and upper(p.per_clave) in ('ADMINISTRADOR', 'SUPERADMIN', 'ADMIN')
        )
      )
  );
$$;

create or replace function comun_facturacion.fac_fn_es_admin(p_negocio text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select comun_facturacion.fac_fn_usuario_es_admin(auth.uid(), p_negocio);
$$;

create table if not exists comun_facturacion.fac_emisor (
  emi_id uuid primary key default gen_random_uuid(),
  emi_secuencial bigint generated always as identity,
  emi_negocio text not null unique references comun_configuracion.cfg_negocio(cfg_negocio) on delete restrict,
  emi_ruc text not null check (emi_ruc ~ '^[0-9]{10}001$'),
  emi_razon_social text not null check (length(btrim(emi_razon_social)) between 1 and 300),
  emi_nombre_comercial text,
  emi_direccion_matriz text not null check (length(btrim(emi_direccion_matriz)) between 1 and 300),
  emi_direccion_establecimiento text,
  emi_establecimiento text not null default '001' check (emi_establecimiento ~ '^[0-9]{3}$' and emi_establecimiento <> '000'),
  emi_punto_emision text not null default '001' check (emi_punto_emision ~ '^[0-9]{3}$' and emi_punto_emision <> '000'),
  emi_obligado_contabilidad boolean not null default false,
  emi_contribuyente_especial text,
  emi_agente_retencion text,
  emi_regimen text not null default 'GENERAL'
    check (emi_regimen in ('GENERAL', 'RIMPE_EMPRENDEDOR', 'RIMPE_NEGOCIO_POPULAR')),
  emi_ambiente smallint not null default 1 check (emi_ambiente in (1, 2)),
  emi_produccion_habilitada boolean not null default false,
  emi_certificado_id uuid,
  emi_emision_automatica boolean not null default true,
  emi_activo boolean not null default true,
  emi_correo_copia text,
  emi_detalle_emisor jsonb not null default '{}'::jsonb,
  emi_creado_en timestamptz not null default now(),
  emi_actualizado_en timestamptz not null default now(),
  check (emi_ambiente = 1 or emi_produccion_habilitada)
);

create table if not exists comun_facturacion.fac_certificado (
  cer_id uuid primary key default gen_random_uuid(),
  cer_secuencial bigint generated always as identity,
  cer_negocio text not null references comun_configuracion.cfg_negocio(cfg_negocio) on delete restrict,
  cer_titular text not null,
  cer_identificacion text,
  cer_emisor text not null,
  cer_serial text not null,
  cer_huella_sha1 text not null check (cer_huella_sha1 ~ '^[0-9A-F]{40}$'),
  cer_valido_desde timestamptz not null,
  cer_valido_hasta timestamptz not null,
  cer_cadena_verificada boolean,
  cer_p12_secreto_id uuid,
  cer_clave_secreto_id uuid,
  cer_activo boolean not null default true,
  cer_subido_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  cer_detalle_certificado jsonb not null default '{}'::jsonb,
  cer_creado_en timestamptz not null default now(),
  cer_actualizado_en timestamptz not null default now(),
  unique (cer_negocio, cer_huella_sha1),
  check (not cer_activo or (cer_p12_secreto_id is not null and cer_clave_secreto_id is not null))
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fac_emisor_certificado_fk'
  ) then
    alter table comun_facturacion.fac_emisor
      add constraint fac_emisor_certificado_fk
      foreign key (emi_certificado_id) references comun_facturacion.fac_certificado(cer_id) on delete set null;
  end if;
end $$;

create table if not exists comun_facturacion.fac_secuencial (
  sec_id uuid primary key default gen_random_uuid(),
  sec_secuencial bigint generated always as identity,
  sec_negocio text not null references comun_configuracion.cfg_negocio(cfg_negocio) on delete restrict,
  sec_ambiente smallint not null check (sec_ambiente in (1, 2)),
  sec_tipo text not null check (sec_tipo in ('01', '04')),
  sec_establecimiento text not null,
  sec_punto_emision text not null,
  sec_ultimo bigint not null default 0 check (sec_ultimo between 0 and 999999999),
  sec_detalle_secuencial jsonb not null default '{}'::jsonb,
  sec_creado_en timestamptz not null default now(),
  sec_actualizado_en timestamptz not null default now(),
  unique (sec_negocio, sec_ambiente, sec_tipo, sec_establecimiento, sec_punto_emision)
);

create table if not exists comun_facturacion.fac_comprobante (
  cmp_id uuid primary key default gen_random_uuid(),
  cmp_secuencial bigint generated always as identity,
  cmp_negocio text not null references comun_configuracion.cfg_negocio(cfg_negocio) on delete restrict,
  cmp_tipo text not null check (cmp_tipo in ('01', '04')),
  cmp_ambiente smallint check (cmp_ambiente in (1, 2)),
  cmp_establecimiento text,
  cmp_punto_emision text,
  cmp_numero bigint check (cmp_numero between 1 and 999999999),
  cmp_clave_acceso text unique check (cmp_clave_acceso ~ '^[0-9]{49}$'),
  cmp_fecha_emision date,
  cmp_comprador jsonb not null,
  cmp_formas_pago jsonb not null default '[]'::jsonb,
  cmp_info_adicional jsonb not null default '[]'::jsonb,
  cmp_modifica_id uuid references comun_facturacion.fac_comprobante(cmp_id) on delete restrict,
  cmp_motivo text,
  cmp_transaccion_pago_id uuid unique references comun_comercio.com_transaccion_pago(pag_id) on delete restrict,
  cmp_cliente_usuario_id uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  cmp_estado text not null default 'BORRADOR' check (cmp_estado in (
    'BORRADOR', 'PENDIENTE', 'RECIBIDO', 'AUTORIZADO', 'DEVUELTO', 'NO_AUTORIZADO', 'ERROR', 'ANULADO')),
  cmp_total_sin_impuestos numeric(12,2),
  cmp_total_descuento numeric(12,2),
  cmp_total_iva numeric(12,2),
  cmp_importe_total numeric(12,2),
  cmp_mensajes_sri jsonb not null default '[]'::jsonb,
  cmp_numero_autorizacion text,
  cmp_fecha_autorizacion timestamptz,
  cmp_certificado_id uuid references comun_facturacion.fac_certificado(cer_id) on delete restrict,
  cmp_xml_ruta text,
  cmp_ride_ruta text,
  cmp_correo_enviado_en timestamptz,
  cmp_intentos int not null default 0,
  cmp_proximo_intento timestamptz,
  cmp_bloqueado_en timestamptz,
  cmp_emitido_en timestamptz,
  cmp_anulado_en timestamptz,
  cmp_anulacion_referencia text,
  cmp_creado_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  cmp_detalle_comprobante jsonb not null default '{}'::jsonb,
  cmp_creado_en timestamptz not null default now(),
  cmp_actualizado_en timestamptz not null default now(),
  unique (cmp_negocio, cmp_ambiente, cmp_tipo, cmp_establecimiento, cmp_punto_emision, cmp_numero),
  check (cmp_estado = 'BORRADOR' or (cmp_numero is not null and cmp_clave_acceso is not null and cmp_ambiente is not null)),
  check ((cmp_tipo = '04') = (cmp_modifica_id is not null))
);

create index if not exists idx_fac_comprobante_negocio on comun_facturacion.fac_comprobante(cmp_negocio, cmp_estado, cmp_creado_en desc);
create index if not exists idx_fac_comprobante_cola on comun_facturacion.fac_comprobante(cmp_proximo_intento)
  where cmp_estado in ('PENDIENTE', 'RECIBIDO');
create index if not exists idx_fac_comprobante_cliente on comun_facturacion.fac_comprobante(cmp_cliente_usuario_id);

create table if not exists comun_facturacion.fac_comprobante_linea (
  lin_id uuid primary key default gen_random_uuid(),
  lin_secuencial bigint generated always as identity,
  lin_comprobante_id uuid not null references comun_facturacion.fac_comprobante(cmp_id) on delete cascade,
  lin_negocio text not null,
  lin_orden int not null check (lin_orden > 0),
  lin_codigo text not null check (length(btrim(lin_codigo)) between 1 and 25),
  lin_codigo_auxiliar text,
  lin_descripcion text not null check (length(btrim(lin_descripcion)) between 1 and 300),
  lin_cantidad numeric(18,6) not null check (lin_cantidad > 0),
  lin_precio_unitario numeric(18,6) not null check (lin_precio_unitario >= 0),
  lin_descuento numeric(12,2) not null default 0 check (lin_descuento >= 0),
  lin_codigo_iva text not null check (lin_codigo_iva in ('0', '4', '5', '6', '7', '10')),
  lin_base_imponible numeric(12,2),
  lin_valor_iva numeric(12,2),
  lin_detalle_linea jsonb not null default '[]'::jsonb,
  lin_creado_en timestamptz not null default now(),
  lin_actualizado_en timestamptz not null default now(),
  unique (lin_comprobante_id, lin_orden)
);

create table if not exists comun_facturacion.fac_evento (
  evt_id uuid primary key default gen_random_uuid(),
  evt_secuencial bigint generated always as identity,
  evt_comprobante_id uuid references comun_facturacion.fac_comprobante(cmp_id) on delete cascade,
  evt_negocio text not null,
  evt_tipo text not null,
  evt_detalle_evento jsonb not null default '{}'::jsonb,
  evt_creado_por uuid,
  evt_creado_en timestamptz not null default now(),
  evt_actualizado_en timestamptz not null default now()
);

create index if not exists idx_fac_evento_comprobante on comun_facturacion.fac_evento(evt_comprobante_id, evt_creado_en);

-- RLS 100% habilitado (Regla 1 AGENTS.md)
alter table comun_facturacion.fac_emisor enable row level security;
alter table comun_facturacion.fac_certificado enable row level security;
alter table comun_facturacion.fac_secuencial enable row level security;
alter table comun_facturacion.fac_comprobante enable row level security;
alter table comun_facturacion.fac_comprobante_linea enable row level security;
alter table comun_facturacion.fac_evento enable row level security;

drop policy if exists fac_emisor_lectura on comun_facturacion.fac_emisor;
create policy fac_emisor_lectura on comun_facturacion.fac_emisor
  for select using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(emi_negocio) or comun_facturacion.fac_fn_es_admin(emi_negocio));

drop policy if exists fac_certificado_lectura on comun_facturacion.fac_certificado;
create policy fac_certificado_lectura on comun_facturacion.fac_certificado
  for select using (comun_facturacion.fac_fn_es_admin(cer_negocio));

drop policy if exists fac_secuencial_lectura on comun_facturacion.fac_secuencial;
create policy fac_secuencial_lectura on comun_facturacion.fac_secuencial
  for select using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(sec_negocio) or comun_facturacion.fac_fn_es_admin(sec_negocio));

drop policy if exists fac_comprobante_lectura on comun_facturacion.fac_comprobante;
create policy fac_comprobante_lectura on comun_facturacion.fac_comprobante
  for select using (
    comun_seguridad.seg_fn_es_operador_o_admin_negocio(cmp_negocio)
    or comun_facturacion.fac_fn_es_admin(cmp_negocio)
    or (cmp_cliente_usuario_id = auth.uid() and cmp_estado in ('PENDIENTE', 'RECIBIDO', 'AUTORIZADO', 'ANULADO'))
  );

drop policy if exists fac_comprobante_linea_lectura on comun_facturacion.fac_comprobante_linea;
create policy fac_comprobante_linea_lectura on comun_facturacion.fac_comprobante_linea
  for select using (exists (
    select 1 from comun_facturacion.fac_comprobante c where c.cmp_id = lin_comprobante_id
  ));

drop policy if exists fac_evento_lectura on comun_facturacion.fac_evento;
create policy fac_evento_lectura on comun_facturacion.fac_evento
  for select using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(evt_negocio) or comun_facturacion.fac_fn_es_admin(evt_negocio));

-- Triggers de auditoría en el 100% de tablas (Regla 2 AGENTS.md)
drop trigger if exists trg_auditoria_fac_emisor on comun_facturacion.fac_emisor;
create trigger trg_auditoria_fac_emisor after insert or update or delete on comun_facturacion.fac_emisor
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

drop trigger if exists trg_auditoria_fac_certificado on comun_facturacion.fac_certificado;
create trigger trg_auditoria_fac_certificado after insert or update or delete on comun_facturacion.fac_certificado
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

drop trigger if exists trg_auditoria_fac_secuencial on comun_facturacion.fac_secuencial;
create trigger trg_auditoria_fac_secuencial after insert or update or delete on comun_facturacion.fac_secuencial
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

drop trigger if exists trg_auditoria_fac_comprobante on comun_facturacion.fac_comprobante;
create trigger trg_auditoria_fac_comprobante after insert or update or delete on comun_facturacion.fac_comprobante
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

drop trigger if exists trg_auditoria_fac_comprobante_linea on comun_facturacion.fac_comprobante_linea;
create trigger trg_auditoria_fac_comprobante_linea after insert or update or delete on comun_facturacion.fac_comprobante_linea
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

drop trigger if exists trg_auditoria_fac_evento on comun_facturacion.fac_evento;
create trigger trg_auditoria_fac_evento after insert or update or delete on comun_facturacion.fac_evento
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant usage on schema comun_facturacion to authenticated, service_role;
grant select on all tables in schema comun_facturacion to authenticated, service_role;
revoke insert, update, delete, truncate on all tables in schema comun_facturacion from authenticated, anon;

-- Semilla de emisores por defecto (ambiente 1 pruebas, emisión automática activa)
insert into comun_facturacion.fac_emisor (
  emi_negocio, emi_ruc, emi_razon_social, emi_nombre_comercial,
  emi_direccion_matriz, emi_direccion_establecimiento,
  emi_establecimiento, emi_punto_emision,
  emi_obligado_contabilidad, emi_regimen, emi_ambiente,
  emi_emision_automatica, emi_activo, emi_correo_copia
)
values
  ('tranqi',     '1790016919001', 'TRANQI LEGAL S.A.S.',           'Tranqi Legal',           'Av. República del Salvador y Moscú, Quito - Ecuador', 'Av. República del Salvador y Moscú, Quito - Ecuador', '001', '001', true,  'GENERAL',           1, true, true, 'facturacion@tranqi24.com'),
  ('fastfix',    '1790016927001', 'FASTFIX HOME SERVICIOS S.A.S.', 'FastFix Home',           'Av. Amazonas y Naciones Unidas, Quito - Ecuador',     'Av. Amazonas y Naciones Unidas, Quito - Ecuador',     '001', '001', true,  'GENERAL',           1, true, true, 'facturacion@fastfix.ec'),
  ('tinkay',     '1790016935001', 'TINKAY FLORISTERIA S.A.S.',     'Tinkay Floristería',     'Av. González Suárez y Orellana, Quito - Ecuador',     'Av. González Suárez y Orellana, Quito - Ecuador',     '001', '001', false, 'RIMPE_EMPRENDEDOR', 1, true, true, 'tinkay.uio@gmail.com'),
  ('margaritas', '1790016943001', 'MARGARITAS FLORISTERIA S.A.S.', 'Margaritas Floristería', 'Av. De los Shyris y Portugal, Quito - Ecuador',       'Av. De los Shyris y Portugal, Quito - Ecuador',       '001', '001', false, 'RIMPE_EMPRENDEDOR', 1, true, true, 'facturacion@margaritas.ec')
on conflict (emi_negocio) do nothing;

-- Semilla de secuenciales iniciales (ambientes 1 y 2; tipos 01 Factura y 04 Nota de Crédito)
insert into comun_facturacion.fac_secuencial (sec_negocio, sec_ambiente, sec_tipo, sec_establecimiento, sec_punto_emision, sec_ultimo)
select e.emi_negocio, a.amb, t.tipo, e.emi_establecimiento, e.emi_punto_emision, 0
from comun_facturacion.fac_emisor e
cross join (values (1::smallint), (2::smallint)) as a(amb)
cross join (values ('01'), ('04')) as t(tipo)
on conflict (sec_negocio, sec_ambiente, sec_tipo, sec_establecimiento, sec_punto_emision) do nothing;

-- ==============================================================================
-- SECCIÓN C: UTILIDADES SRI Y EMISIÓN AUTOMÁTICA CON DETALLE DE PEDIDO/ENVÍO
-- ==============================================================================
create or replace function comun_facturacion.fac_fn_evento(
  p_comprobante uuid,
  p_negocio text,
  p_tipo text,
  p_detalle jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into comun_facturacion.fac_evento (evt_comprobante_id, evt_negocio, evt_tipo, evt_detalle_evento, evt_creado_por)
  values (p_comprobante, p_negocio, p_tipo, coalesce(p_detalle, '{}'::jsonb), auth.uid());
$$;

create or replace function comun_facturacion.fac_fn_digito_verificador(p_base text)
returns int
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_suma int := 0;
  v_peso int := 2;
  v_dv int;
begin
  for i in reverse length(p_base)..1 loop
    v_suma := v_suma + substr(p_base, i, 1)::int * v_peso;
    v_peso := case when v_peso = 7 then 2 else v_peso + 1 end;
  end loop;
  v_dv := 11 - (v_suma % 11);
  return case v_dv when 11 then 0 when 10 then 1 else v_dv end;
end;
$$;

create or replace function comun_facturacion.fac_fn_clave_acceso(
  p_fecha date, p_tipo text, p_ruc text, p_ambiente smallint,
  p_establecimiento text, p_punto text, p_numero bigint, p_codigo text
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_base text;
begin
  v_base := to_char(p_fecha, 'DDMMYYYY') || p_tipo || p_ruc || p_ambiente::text || p_establecimiento
    || p_punto || lpad(p_numero::text, 9, '0') || p_codigo || '1';
  if v_base !~ '^[0-9]{48}$' then
    raise exception 'Datos de la clave de acceso con formato invalido';
  end if;
  return v_base || comun_facturacion.fac_fn_digito_verificador(v_base)::text;
end;
$$;

create or replace function comun_facturacion.fac_fn_cedula_valida(p_cedula text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_suma int := 0;
  v_valor int;
begin
  if p_cedula !~ '^[0-9]{10}$' then return false; end if;
  if substr(p_cedula, 1, 2)::int not between 1 and 24 and substr(p_cedula, 1, 2) <> '30' then return false; end if;
  if substr(p_cedula, 3, 1)::int >= 6 then return false; end if;
  for i in 1..9 loop
    v_valor := substr(p_cedula, i, 1)::int * case when i % 2 = 1 then 2 else 1 end;
    v_suma := v_suma + case when v_valor > 9 then v_valor - 9 else v_valor end;
  end loop;
  return (10 - v_suma % 10) % 10 = substr(p_cedula, 10, 1)::int;
end;
$$;

create or replace function comun_facturacion.fac_fn_normalizar_comprador(p_comprador jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tipo text := btrim(coalesce(p_comprador ->> 'tipo_identificacion', ''));
  v_id text := upper(btrim(coalesce(p_comprador ->> 'identificacion', '')));
  v_razon text := btrim(regexp_replace(coalesce(p_comprador ->> 'razon_social', ''), '\s+', ' ', 'g'));
  v_correo text := nullif(lower(btrim(coalesce(p_comprador ->> 'correo', ''))), '');
begin
  if v_tipo = '07' or v_id = '' or v_id = '9999999999999' then
    v_tipo := '07';
    v_id := '9999999999999';
    v_razon := coalesce(nullif(v_razon, ''), 'CONSUMIDOR FINAL');
  elsif v_tipo = '05' then
    if not comun_facturacion.fac_fn_cedula_valida(v_id) then
      if length(v_id) between 4 and 20 then
        v_tipo := '06';
      else
        v_tipo := '07';
        v_id := '9999999999999';
      end if;
    end if;
  elsif v_tipo = '04' then
    if v_id !~ '^[0-9]{10}001$' then
      if length(v_id) between 4 and 20 then
        v_tipo := '06';
      else
        v_tipo := '07';
        v_id := '9999999999999';
      end if;
    end if;
  elsif v_tipo in ('06', '08') then
    if length(v_id) not between 1 and 20 or v_id ~ '\s' then
      v_tipo := '07';
      v_id := '9999999999999';
    end if;
  else
    if v_id ~ '^[0-9]{10}001$' then
      v_tipo := '04';
    elsif comun_facturacion.fac_fn_cedula_valida(v_id) then
      v_tipo := '05';
    elsif length(v_id) between 1 and 20 then
      v_tipo := '06';
    else
      v_tipo := '07';
      v_id := '9999999999999';
      v_razon := coalesce(nullif(v_razon, ''), 'CONSUMIDOR FINAL');
    end if;
  end if;

  if v_razon = '' then
    v_razon := 'CLIENTE';
  end if;

  if v_correo is not null and v_correo !~ '^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$' then
    v_correo := null;
  end if;

  return jsonb_build_object(
    'tipo_identificacion', v_tipo,
    'identificacion', v_id,
    'razon_social', left(v_razon, 300),
    'direccion', coalesce(nullif(left(btrim(coalesce(p_comprador ->> 'direccion', '')), 300), ''), 'Quito - Ecuador'),
    'correo', v_correo,
    'telefono', nullif(left(btrim(coalesce(p_comprador ->> 'telefono', '')), 20), '')
  );
end;
$$;

create or replace function comun_facturacion.fac_fn_despertar_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_clave text;
begin
  if to_regproc('net.http_post') is null then
    return;
  end if;
  if not exists (
    select 1 from comun_facturacion.fac_comprobante
    where cmp_estado in ('PENDIENTE', 'RECIBIDO')
      and coalesce(cmp_proximo_intento, '-infinity'::timestamptz) <= now() + interval '5 seconds'
      and (cmp_bloqueado_en is null or cmp_bloqueado_en < now() - interval '5 minutes')
  ) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'facturacion_funcion_url';
  select decrypted_secret into v_clave from vault.decrypted_secrets where name = 'facturacion_funcion_clave';
  if v_url is null or v_clave is null then
    return;
  end if;
  execute 'select net.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := 150000)'
    using v_url,
          jsonb_build_object('Content-Type', 'application/json', 'x-facturacion-clave', v_clave),
          jsonb_build_object('accion', 'procesar');
exception when others then
  return;
end;
$$;

create or replace function comun_facturacion.fac_fn_crear_comprobante_interno(
  p_negocio text,
  p_tipo text,
  p_comprador jsonb,
  p_lineas jsonb,
  p_formas_pago jsonb,
  p_info_adicional jsonb,
  p_modifica uuid,
  p_motivo text,
  p_cliente_usuario uuid,
  p_transaccion_pago uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_comprador jsonb;
  v_linea jsonb;
  v_orden int := 0;
begin
  v_comprador := comun_facturacion.fac_fn_normalizar_comprador(p_comprador);

  insert into comun_facturacion.fac_comprobante (
    cmp_negocio, cmp_tipo, cmp_comprador, cmp_formas_pago, cmp_info_adicional,
    cmp_modifica_id, cmp_motivo, cmp_cliente_usuario_id, cmp_transaccion_pago_id, cmp_creado_por
  )
  values (
    p_negocio, p_tipo, v_comprador,
    case when p_tipo = '04' then '[]'::jsonb else coalesce(p_formas_pago, '[]'::jsonb) end,
    coalesce(p_info_adicional, '[]'::jsonb),
    p_modifica, nullif(btrim(p_motivo), ''),
    p_cliente_usuario, p_transaccion_pago, auth.uid()
  )
  returning cmp_id into v_id;

  for v_linea in select value from jsonb_array_elements(p_lineas) loop
    v_orden := v_orden + 1;
    insert into comun_facturacion.fac_comprobante_linea (
      lin_comprobante_id, lin_negocio, lin_orden, lin_codigo, lin_codigo_auxiliar,
      lin_descripcion, lin_cantidad, lin_precio_unitario, lin_descuento, lin_codigo_iva, lin_detalle_linea
    )
    values (
      v_id, p_negocio, v_orden,
      left(coalesce(nullif(btrim(v_linea ->> 'codigo'), ''), 'ITEM-' || v_orden::text), 25),
      nullif(left(btrim(coalesce(v_linea ->> 'codigo_auxiliar', '')), 25), ''),
      left(coalesce(nullif(btrim(regexp_replace(coalesce(v_linea ->> 'descripcion', ''), '\s+', ' ', 'g')), ''), ' Producto / Servicio'), 300),
      greatest(0.01, coalesce((v_linea ->> 'cantidad')::numeric, 1)),
      greatest(0, coalesce((v_linea ->> 'precio_unitario')::numeric, 0)),
      greatest(0, coalesce((v_linea ->> 'descuento')::numeric, 0)),
      coalesce(nullif(v_linea ->> 'codigo_iva', ''), '0'),
      coalesce(v_linea -> 'detalles_adicionales', '[]'::jsonb)
    );
  end loop;

  perform comun_facturacion.fac_fn_evento(v_id, p_negocio, 'creado',
    jsonb_build_object('transaccion_pago', p_transaccion_pago));
  return v_id;
end;
$$;

create or replace function comun_facturacion.fac_fn_emitir_interno(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cmp comun_facturacion.fac_comprobante%rowtype;
  v_emisor comun_facturacion.fac_emisor%rowtype;
  v_tiene_cert boolean := false;
  v_numero bigint;
  v_fecha date := (now() at time zone 'America/Guayaquil')::date;
  v_codigo text := lpad((floor(random() * 100000000))::bigint::text, 8, '0');
  v_clave text;
  v_numero_formato text;
  v_total_sin_imp numeric(12,2) := 0;
  v_sub_15 numeric(12,2) := 0;
  v_sub_0 numeric(12,2) := 0;
  v_total_desc numeric(12,2) := 0;
  v_total_iva numeric(12,2) := 0;
  v_importe_total numeric(12,2) := 0;
  v_estado_final text;
  v_rubro_principal text;
  v_lineas_snapshot jsonb := '[]'::jsonb;
begin
  select * into v_cmp from comun_facturacion.fac_comprobante where cmp_id = p_id for update;
  if not found then
    raise exception 'Comprobante no encontrado';
  end if;
  if v_cmp.cmp_estado <> 'BORRADOR' then
    return v_cmp.cmp_clave_acceso;
  end if;

  select * into v_emisor from comun_facturacion.fac_emisor where emi_negocio = v_cmp.cmp_negocio;
  if not found or not v_emisor.emi_activo then
    raise exception 'La facturacion electronica no esta activa para este negocio';
  end if;

  select exists (
    select 1 from comun_facturacion.fac_certificado
    where cer_id = v_emisor.emi_certificado_id
      and cer_activo = true
      and cer_valido_desde <= now()
      and cer_valido_hasta > now()
  ) into v_tiene_cert;

  if v_emisor.emi_ambiente = 2 and not v_tiene_cert then
    raise exception 'El emisor no tiene un certificado de firma vigente para produccion';
  end if;
  if v_emisor.emi_ambiente = 2 and not v_emisor.emi_produccion_habilitada then
    raise exception 'Produccion no habilitada para este negocio';
  end if;

  update comun_facturacion.fac_comprobante_linea
     set lin_base_imponible = round(lin_cantidad * lin_precio_unitario - lin_descuento, 2),
         lin_valor_iva = round(
           round(lin_cantidad * lin_precio_unitario - lin_descuento, 2) *
           (case lin_codigo_iva when '4' then 15 when '5' then 5 when '10' then 13 else 0 end) / 100.0,
           2
         ),
         lin_actualizado_en = now()
   where lin_comprobante_id = p_id;

  select
    coalesce(sum(lin_base_imponible), 0),
    coalesce(sum(case when lin_codigo_iva in ('4', '5', '10') then lin_base_imponible else 0 end), 0),
    coalesce(sum(case when lin_codigo_iva not in ('4', '5', '10') then lin_base_imponible else 0 end), 0),
    coalesce(sum(lin_descuento), 0),
    coalesce(sum(lin_valor_iva), 0),
    coalesce(min(lin_descripcion) filter (where lin_orden = 1), 'Pedido Facturado'),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'codigo', lin_codigo,
          'descripcion', lin_descripcion,
          'cantidad', round(lin_cantidad, 2),
          'precio_unitario', round(lin_precio_unitario, 2),
          'descuento', round(lin_descuento, 2),
          'tarifa_iva', case lin_codigo_iva when '4' then 15 when '5' then 5 when '10' then 13 else 0 end,
          'subtotal', lin_base_imponible,
          'valor_iva', lin_valor_iva
        )
        order by lin_orden asc
      ),
      '[]'::jsonb
    )
  into v_total_sin_imp, v_sub_15, v_sub_0, v_total_desc, v_total_iva, v_rubro_principal, v_lineas_snapshot
  from comun_facturacion.fac_comprobante_linea
  where lin_comprobante_id = p_id;

  v_importe_total := round(v_total_sin_imp + v_total_iva, 2);

  insert into comun_facturacion.fac_secuencial as s (
    sec_negocio, sec_ambiente, sec_tipo, sec_establecimiento, sec_punto_emision, sec_ultimo
  )
  values (
    v_cmp.cmp_negocio, v_emisor.emi_ambiente, v_cmp.cmp_tipo,
    v_emisor.emi_establecimiento, v_emisor.emi_punto_emision, 1
  )
  on conflict (sec_negocio, sec_ambiente, sec_tipo, sec_establecimiento, sec_punto_emision)
  do update set sec_ultimo = s.sec_ultimo + 1, sec_actualizado_en = now()
  returning sec_ultimo into v_numero;

  v_clave := comun_facturacion.fac_fn_clave_acceso(
    v_fecha, v_cmp.cmp_tipo, v_emisor.emi_ruc, v_emisor.emi_ambiente,
    v_emisor.emi_establecimiento, v_emisor.emi_punto_emision, v_numero, v_codigo
  );

  v_numero_formato := v_emisor.emi_establecimiento || '-' || v_emisor.emi_punto_emision || '-' || lpad(v_numero::text, 9, '0');
  v_estado_final := case when v_tiene_cert then 'PENDIENTE' else 'AUTORIZADO' end;

  update comun_facturacion.fac_comprobante
     set cmp_estado = v_estado_final,
         cmp_ambiente = v_emisor.emi_ambiente,
         cmp_establecimiento = v_emisor.emi_establecimiento,
         cmp_punto_emision = v_emisor.emi_punto_emision,
         cmp_numero = v_numero,
         cmp_clave_acceso = v_clave,
         cmp_fecha_emision = v_fecha,
         cmp_total_sin_impuestos = v_total_sin_imp,
         cmp_total_descuento = v_total_desc,
         cmp_total_iva = v_total_iva,
         cmp_importe_total = v_importe_total,
         cmp_numero_autorizacion = case when v_estado_final = 'AUTORIZADO' then v_clave else cmp_numero_autorizacion end,
         cmp_fecha_autorizacion = case when v_estado_final = 'AUTORIZADO' then now() else cmp_fecha_autorizacion end,
         cmp_emitido_en = now(),
         cmp_proximo_intento = case when v_tiene_cert then now() else null end,
         cmp_actualizado_en = now()
   where cmp_id = p_id;

  if v_cmp.cmp_transaccion_pago_id is not null then
    update comun_comercio.com_transaccion_pago
       set pag_detalle_transaccion = coalesce(pag_detalle_transaccion, '{}'::jsonb) || jsonb_build_object(
             'factura_electronica', jsonb_build_object(
               'comprobante_id', p_id,
               'numero_comprobante', v_numero_formato,
               'clave_acceso', v_clave,
               'estado', v_estado_final,
               'ambiente', v_emisor.emi_ambiente,
               'fecha_emision', v_fecha::text,
               'fecha_autorizacion', now(),
               'rubro_facturado', v_rubro_principal,
               'subtotal', v_total_sin_imp,
               'subtotal_15', v_sub_15,
               'subtotal_0', v_sub_0,
               'iva', v_total_iva,
               'total', v_importe_total,
               'lineas', v_lineas_snapshot,
               'comprador', v_cmp.cmp_comprador
             )
           )
     where pag_id = v_cmp.cmp_transaccion_pago_id;
  end if;

  perform comun_facturacion.fac_fn_evento(
    p_id, v_cmp.cmp_negocio, 'emitido',
    jsonb_build_object('numero', v_numero_formato, 'ambiente', v_emisor.emi_ambiente, 'estado', v_estado_final)
  );

  if v_tiene_cert then
    perform comun_facturacion.fac_fn_despertar_worker();
  end if;

  return v_clave;
end;
$$;

create or replace function comun_facturacion.fac_fn_facturar_pago()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emisor comun_facturacion.fac_emisor%rowtype;
  v_detalle jsonb := coalesce(new.pag_detalle_transaccion, '{}'::jsonb);
  v_datos jsonb := coalesce(v_detalle -> 'datos_facturacion', v_detalle -> 'pagador', '{}'::jsonb);
  v_variante comun_comercio.com_variante%rowtype;
  v_prf comun_comercio.com_proforma%rowtype;
  v_prf_id uuid;
  v_modalidad text;
  v_flete numeric(12,2) := 0;
  v_producto text;
  v_codigo_iva text;
  v_porcentaje numeric;
  v_descripcion text;
  v_codigo text;
  v_lineas jsonb := '[]'::jsonb;
  v_comprador jsonb;
  v_identificacion text;
  v_razon_social text;
  v_tipo_id text;
  v_forma text;
  v_info jsonb;
  v_id uuid;
  r_item record;
  v_idx int := 0;
begin
  if new.pag_estado <> 'APROBADO' or (tg_op = 'UPDATE' and old.pag_estado = 'APROBADO') then
    return new;
  end if;

  select * into v_emisor
  from comun_facturacion.fac_emisor
  where emi_negocio = new.pag_negocio
    and emi_activo = true
    and emi_emision_automatica = true;
  if not found then
    return new;
  end if;

  if exists (select 1 from comun_facturacion.fac_comprobante where cmp_transaccion_pago_id = new.pag_id) then
    return new;
  end if;

  begin
    -- 1. Si el pago liquida al 100% un pedido o proforma de tienda (com_proforma), extraer sus líneas reales + envío
    v_prf_id := coalesce(
      new.pag_referencia_id,
      case
        when (v_detalle ->> 'proforma_id') ~* '^[0-9a-f-]{36}$'
        then (v_detalle ->> 'proforma_id')::uuid
        else null
      end
    );
    v_modalidad := upper(coalesce(v_detalle ->> 'modalidad_cobro', 'TOTAL_100'));

    if v_prf_id is not null and v_modalidad = 'TOTAL_100' then
      select * into v_prf
      from comun_comercio.com_proforma
      where prf_id = v_prf_id and prf_negocio = new.pag_negocio;

      if found and abs(coalesce(v_prf.prf_total, 0) - new.pag_monto_total) <= 0.05 then
        for r_item in
          select pfi_descripcion, pfi_cantidad, pfi_precio_unitario, pfi_descuento, pfi_impuesto
          from comun_comercio.com_proforma_item
          where pfi_proforma_id = v_prf.prf_id and pfi_eliminado_en is null
          order by pfi_secuencial asc
        loop
          v_idx := v_idx + 1;
          v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
            'codigo', comun_comercio.com_fn_prefijo_negocio(new.pag_negocio) || '-' || lpad(v_idx::text, 3, '0'),
            'descripcion', r_item.pfi_descripcion,
            'cantidad', greatest(0.01, r_item.pfi_cantidad),
            'precio_unitario', round(r_item.pfi_precio_unitario, 2),
            'descuento', round(coalesce(r_item.pfi_descuento, 0), 2),
            'codigo_iva', case when upper(coalesce(r_item.pfi_impuesto, '')) in ('IVA_15', '15', '4') then '4' else '0' end
          ));
        end loop;

        select coalesce(max(dsp_costo_envio), coalesce((v_prf.prf_detalle_proforma ->> 'total_flete')::numeric, 0))
        into v_flete
        from comun_comercio.com_despacho_asignacion
        where dsp_orden_id = v_prf.prf_id;

        if coalesce(v_flete, 0) > 0 then
          v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
            'codigo', 'ENVIO-DOM',
            'descripcion', 'Envío a domicilio',
            'cantidad', 1,
            'precio_unitario', round(v_flete, 2),
            'descuento', 0,
            'codigo_iva', '0'
          ));
        end if;
      end if;
    end if;

    -- 2. Si no provino de líneas de pedido 100% (ej. abono 70%, suscripción o cargo puntual), construir líneas desde bases IVA
    if jsonb_array_length(v_lineas) = 0 then
      if (v_detalle ->> 'variante_id') ~* '^[0-9a-f-]{36}$' then
        select * into v_variante from comun_comercio.com_variante where var_id = (v_detalle ->> 'variante_id')::uuid;
        if found then
          select pro_nombre into v_producto from comun_comercio.com_producto where pro_id = v_variante.var_producto_id;
        end if;
      end if;

      v_codigo := coalesce(
        nullif(v_variante.var_sku, ''),
        nullif(v_detalle ->> 'codigo_orden', ''),
        nullif(v_detalle ->> 'codigo_rubro', ''),
        comun_comercio.com_fn_prefijo_negocio(new.pag_negocio) || '-001'
      );
      v_descripcion := coalesce(
        nullif(v_detalle ->> 'rubro_facturado', ''),
        nullif(v_detalle ->> 'nombre_servicio', ''),
        nullif(concat_ws(' - ', v_detalle ->> 'producto', v_detalle ->> 'variante'), ''),
        nullif(concat_ws(' - ', v_producto, v_variante.var_nombre), ''),
        'Compra ' || initcap(new.pag_negocio)
      );
      v_porcentaje := coalesce(
        v_variante.var_tarifa_iva_porcentaje,
        case when coalesce(new.pag_monto_iva, 0) > 0 then 15 else 0 end
      );
      v_codigo_iva := case
        when v_variante.var_codigo_impuesto_sri = 'NO_OBJETO' then '6'
        when v_variante.var_codigo_impuesto_sri = 'EXENTO' then '7'
        when v_variante.var_codigo_impuesto_sri = 'IVA_0' or v_porcentaje = 0 then '0'
        when v_porcentaje = 5 then '5'
        when v_porcentaje = 13 then '10'
        else '4'
      end;

      if coalesce(new.pag_monto_con_iva, 0) > 0 then
        v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
          'codigo', v_codigo, 'descripcion', v_descripcion, 'cantidad', 1,
          'precio_unitario', round(new.pag_monto_con_iva, 2), 'descuento', 0,
          'codigo_iva', case when v_codigo_iva in ('4', '5', '10') then v_codigo_iva else '4' end
        ));
      end if;
      if coalesce(new.pag_monto_sin_iva, 0) > 0 then
        v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
          'codigo', v_codigo, 'descripcion', v_descripcion, 'cantidad', 1,
          'precio_unitario', round(new.pag_monto_sin_iva, 2), 'descuento', 0,
          'codigo_iva', case when v_codigo_iva in ('6', '7') then v_codigo_iva else '0' end
        ));
      end if;
      if jsonb_array_length(v_lineas) = 0 then
        v_lineas := jsonb_build_array(jsonb_build_object(
          'codigo', v_codigo, 'descripcion', v_descripcion, 'cantidad', 1,
          'precio_unitario', case when v_codigo_iva in ('4', '5', '10')
                                  then round(new.pag_monto_total / (1 + v_porcentaje / 100), 2)
                                  else round(new.pag_monto_total, 2) end,
          'descuento', 0, 'codigo_iva', v_codigo_iva
        ));
      end if;
    end if;

    v_identificacion := btrim(coalesce(
      nullif(v_datos ->> 'identificacion', ''),
      nullif(new.pag_titular_identificacion, ''),
      nullif(v_prf.prf_cliente_contacto ->> 'identificacion', ''),
      ''
    ));
    v_razon_social := btrim(coalesce(
      nullif(v_datos ->> 'razon_social', ''),
      nullif(v_datos ->> 'nombre', ''),
      nullif(v_prf.prf_cliente_nombre, ''),
      nullif(v_detalle ->> 'titular', ''),
      nullif(split_part(coalesce(new.pag_titular_email, ''), '@', 1), ''),
      'CLIENTE'
    ));
    v_tipo_id := lower(coalesce(v_datos ->> 'tipo_identificacion', ''));

    if v_identificacion <> '' and v_identificacion <> '9999999999999' then
      v_comprador := jsonb_build_object(
        'tipo_identificacion', case
          when v_tipo_id in ('ruc', '04') or v_identificacion ~ '^[0-9]{10}001$' then '04'
          when v_tipo_id in ('cedula', '05') and comun_facturacion.fac_fn_cedula_valida(v_identificacion) then '05'
          when comun_facturacion.fac_fn_cedula_valida(v_identificacion) then '05'
          else '06'
        end,
        'identificacion', v_identificacion,
        'razon_social', v_razon_social,
        'direccion', coalesce(nullif(v_datos ->> 'direccion', ''), nullif(v_prf.prf_detalle_proforma -> 'logistica_entrega' ->> 'direccion_referencia', ''), 'Quito - Ecuador'),
        'correo', coalesce(nullif(v_datos ->> 'correo_facturacion', ''), nullif(v_datos ->> 'email', ''), new.pag_titular_email),
        'telefono', coalesce(nullif(v_datos ->> 'telefono', ''), new.pag_titular_telefono)
      );
    elsif new.pag_monto_total > 50 then
      v_comprador := jsonb_build_object(
        'tipo_identificacion', '06',
        'identificacion', '9999999999',
        'razon_social', v_razon_social,
        'direccion', 'Quito - Ecuador',
        'correo', new.pag_titular_email,
        'telefono', new.pag_titular_telefono
      );
    else
      v_comprador := jsonb_build_object(
        'tipo_identificacion', '07',
        'correo', new.pag_titular_email
      );
    end if;

    v_forma := case
      when new.pag_pasarela = 'EFECTIVO' then '01'
      when new.pag_pasarela in ('DEUNA', 'TRANSFERENCIA', 'DEPOSITO', 'CHEQUE') then '20'
      when new.pag_tarjeta_tipo = 'DEBITO' then '16'
      else '19'
    end;

    v_info := jsonb_build_array(
      jsonb_build_object('nombre', 'Referencia de pago', 'valor', new.pag_identificador_cliente),
      jsonb_build_object('nombre', 'Medio de pago', 'valor', new.pag_pasarela)
    );

    v_id := comun_facturacion.fac_fn_crear_comprobante_interno(
      new.pag_negocio, '01', v_comprador, v_lineas,
      jsonb_build_array(jsonb_build_object('forma_pago', v_forma, 'total', round(new.pag_monto_total, 2))),
      v_info, null, null, new.pag_cliente_id, new.pag_id
    );

    perform comun_facturacion.fac_fn_emitir_interno(v_id);
  exception when others then
    insert into comun_facturacion.fac_evento (evt_comprobante_id, evt_negocio, evt_tipo, evt_detalle_evento)
    values (null, new.pag_negocio, 'facturacion_pago_fallida',
            jsonb_build_object('pago', new.pag_id, 'error', sqlerrm));
  end;
  return new;
end;
$$;

drop trigger if exists trg_fac_facturar_pago on comun_comercio.com_transaccion_pago;
create trigger trg_fac_facturar_pago
  after insert or update of pag_estado on comun_comercio.com_transaccion_pago
  for each row execute function comun_facturacion.fac_fn_facturar_pago();

-- ==============================================================================
-- SECCIÓN D: RPCs DE PEDIDOS DE TIENDA, PROFORMAS DE EVENTOS Y CHECKOUT PLUX
-- ==============================================================================
create or replace function comun_comercio.com_fn_generar_proforma_evento(
  p_negocio text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_prefijo text := comun_comercio.com_fn_prefijo_negocio(v_negocio);
  v_usuario uuid := auth.uid();
  v_comprador jsonb := coalesce(p_payload->'comprador', '{}'::jsonb);
  v_items jsonb := coalesce(p_payload->'items', '[]'::jsonb);
  v_logistica jsonb := coalesce(p_payload->'logistica_entrega', '{}'::jsonb);
  v_vigencia int := greatest(1, least(90, coalesce((p_payload->>'vigencia_dias')::int, 15)));
  v_subtotal numeric(12,2) := greatest(0, coalesce((p_payload->>'subtotal_base_imponible')::numeric(12,2), 0));
  v_descuento numeric(12,2) := greatest(0, coalesce((p_payload->>'descuento_total')::numeric(12,2), 0));
  v_iva numeric(12,2) := greatest(0, coalesce((p_payload->>'total_iva')::numeric(12,2), 0));
  v_total numeric(12,2) := greatest(0, coalesce((p_payload->>'total_pagar')::numeric(12,2), 0));
  v_prf_id uuid;
  v_secuencial bigint;
  v_token text;
  v_codigo text;
  v_item jsonb;
  v_whatsapp text;
  v_autoriza_wa boolean;
begin
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'La proforma debe contener al menos un artículo de evento.');
  end if;

  insert into comun_comercio.com_proforma (
    prf_negocio, prf_cliente_id, prf_cliente_nombre, prf_cliente_contacto, prf_estado,
    prf_subtotal, prf_descuento, prf_iva, prf_total, prf_vigencia_dias, prf_observaciones, prf_detalle_proforma
  )
  values (
    v_negocio, v_usuario,
    coalesce(nullif(trim(v_comprador->>'nombreCompleto'), ''), 'Cliente Evento'),
    v_comprador, 'ENVIADA', v_subtotal, v_descuento, v_iva, v_total, v_vigencia,
    coalesce(p_payload->>'observaciones', ''),
    p_payload || jsonb_build_object(
      'tipo_origen', 'PROFORMA_EVENTO',
      'estado', 'ENVIADA',
      'porcentaje_reserva_sugerido', 70,
      'monto_reserva_70_usd', round((v_total * 0.70)::numeric, 2),
      'monto_abonado_usd', 0,
      'saldo_pendiente_usd', v_total
    )
  )
  returning prf_id, prf_secuencial, prf_token_aprobacion
  into v_prf_id, v_secuencial, v_token;

  v_codigo := v_prefijo || '-PRF-' || lpad(coalesce(v_secuencial, 1)::text, 4, '0');

  update comun_comercio.com_proforma
     set prf_detalle_proforma = prf_detalle_proforma || jsonb_build_object(
       'codigo_orden', v_codigo,
       'codigo_proforma', v_codigo,
       'codigo_base_proforma', v_codigo,
       'grupo_proforma_id', v_prf_id,
       'proforma_origen_id', v_prf_id,
       'version_numero', 1,
       'es_original', true,
       'etiqueta_version', coalesce(nullif(trim(p_payload->>'etiqueta_version'), ''), 'Original (Autoservicio)'),
       'creada_por_rol', 'CLIENTE'
     )
   where prf_id = v_prf_id;

  for v_item in select * from jsonb_array_elements(v_items) loop
    insert into comun_comercio.com_proforma_item (
      pfi_negocio, pfi_proforma_id, pfi_variante_id, pfi_es_item_libre,
      pfi_descripcion, pfi_cantidad, pfi_precio_unitario, pfi_descuento,
      pfi_impuesto, pfi_total_linea, pfi_detalle_item
    )
    values (
      v_negocio, v_prf_id, null, true,
      coalesce(v_item->>'descripcion', v_item->>'producto_nombre', 'Servicio de Evento'),
      greatest(0.01, coalesce((v_item->>'cantidad')::numeric(10,2), 1)),
      greatest(0, coalesce((v_item->>'precio_unitario')::numeric(12,2), 0)),
      greatest(0, coalesce((v_item->>'descuento')::numeric(12,2), 0)),
      coalesce(v_item->>'impuesto', 'IVA_0'),
      greatest(0, coalesce((v_item->>'total_linea')::numeric(12,2), 0)),
      v_item
    );
  end loop;

  if v_logistica <> '{}'::jsonb then
    insert into comun_comercio.com_despacho_asignacion (
      dsp_negocio, dsp_orden_id, dsp_modalidad, dsp_tracking_url, dsp_costo_envio,
      dsp_estado, dsp_observaciones_coordinacion, dsp_detalle_despacho
    )
    values (
      v_negocio, v_prf_id,
      case when coalesce((v_logistica->>'retiro_en_local')::boolean, false) then 'RETIRO_LOCAL' else 'PROPIO' end,
      v_logistica->>'enlace_mapa',
      greatest(0, coalesce((p_payload->>'total_flete')::numeric(12,2), 0)),
      'ASIGNADO',
      coalesce(v_logistica->>'formula_calculo_interno', p_payload->>'observaciones', ''),
      v_logistica
    );
  end if;

  v_whatsapp := nullif(trim(coalesce(v_comprador->>'whatsapp', v_comprador->>'telefono', '')), '');
  v_autoriza_wa := coalesce((v_comprador->>'autorizaWhatsapp')::boolean, false);
  if v_usuario is not null and v_autoriza_wa and v_whatsapp is not null then
    update comun_seguridad.seg_usuario
       set usu_whatsapp = coalesce(nullif(usu_whatsapp, ''), v_whatsapp),
           usu_autorizacion_whatsapp = true,
           usu_actualizado_en = now()
     where usu_id = v_usuario;
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_prf_id,
    'secuencial', v_secuencial,
    'codigo_proforma', v_codigo,
    'token_aprobacion', v_token
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_generar_proforma_evento(text, jsonb) from public;
grant execute on function comun_comercio.com_fn_generar_proforma_evento(text, jsonb) to anon, authenticated, service_role;

create or replace function comun_comercio.com_fn_registrar_pedido_tienda(
  p_negocio text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_prefijo text := comun_comercio.com_fn_prefijo_negocio(v_negocio);
  v_usuario uuid := auth.uid();
  v_comprador jsonb := coalesce(p_payload->'comprador', '{}'::jsonb);
  v_items jsonb := coalesce(p_payload->'items', '[]'::jsonb);
  v_logistica jsonb := coalesce(p_payload->'logistica_entrega', '{}'::jsonb);
  v_estado_inicial text := coalesce(nullif(trim(p_payload->>'estado'), ''), 'PENDIENTE_PAGO');
  v_subtotal numeric(12,2) := greatest(0, coalesce((p_payload->>'subtotal_base_imponible')::numeric(12,2), 0));
  v_iva numeric(12,2) := greatest(0, coalesce((p_payload->>'total_iva')::numeric(12,2), 0));
  v_total numeric(12,2) := greatest(0, coalesce((p_payload->>'total_pagar')::numeric(12,2), 0));
  v_prf_id uuid;
  v_secuencial bigint;
  v_token text;
  v_codigo text;
  v_item jsonb;
begin
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'El pedido debe incluir al menos un producto.');
  end if;

  if v_estado_inicial not in ('PENDIENTE_PAGO', 'APROBADA') then
    v_estado_inicial := 'PENDIENTE_PAGO';
  end if;

  insert into comun_comercio.com_proforma (
    prf_negocio, prf_cliente_id, prf_cliente_nombre, prf_cliente_contacto, prf_estado,
    prf_subtotal, prf_descuento, prf_iva, prf_total, prf_observaciones, prf_detalle_proforma
  )
  values (
    v_negocio, v_usuario,
    coalesce(nullif(trim(v_comprador->>'nombreCompleto'), ''), 'Cliente'),
    v_comprador, v_estado_inicial, v_subtotal, 0, v_iva, v_total,
    coalesce(p_payload->>'observaciones', ''),
    p_payload
  )
  returning prf_id, prf_secuencial, prf_token_aprobacion
  into v_prf_id, v_secuencial, v_token;

  v_codigo := v_prefijo || '-ORD-' || lpad(coalesce(v_secuencial, 1)::text, 4, '0');

  update comun_comercio.com_proforma
     set prf_detalle_proforma = prf_detalle_proforma || jsonb_build_object('codigo_orden', v_codigo)
   where prf_id = v_prf_id;

  for v_item in select * from jsonb_array_elements(v_items) loop
    insert into comun_comercio.com_proforma_item (
      pfi_negocio, pfi_proforma_id, pfi_variante_id, pfi_es_item_libre,
      pfi_descripcion, pfi_cantidad, pfi_precio_unitario, pfi_descuento,
      pfi_impuesto, pfi_total_linea, pfi_detalle_item
    )
    values (
      v_negocio, v_prf_id, null, true,
      coalesce(v_item->>'descripcion', v_item->>'producto_nombre', 'Producto'),
      greatest(0.01, coalesce((v_item->>'cantidad')::numeric(10,2), 1)),
      greatest(0, coalesce((v_item->>'precio_unitario')::numeric(12,2), 0)),
      0,
      coalesce(v_item->>'impuesto', 'IVA_0'),
      greatest(0, coalesce((v_item->>'total_linea')::numeric(12,2), 0)),
      v_item
    );
  end loop;

  insert into comun_comercio.com_despacho_asignacion (
    dsp_negocio, dsp_orden_id, dsp_modalidad, dsp_tracking_url, dsp_costo_envio,
    dsp_estado, dsp_observaciones_coordinacion, dsp_detalle_despacho
  )
  values (
    v_negocio, v_prf_id,
    case when coalesce((v_logistica->>'retiro_en_local')::boolean, false) then 'RETIRO_LOCAL' else 'PROPIO' end,
    v_logistica->>'enlace_mapa',
    greatest(0, coalesce((p_payload->>'total_flete')::numeric(12,2), 0)),
    'ASIGNADO',
    coalesce(v_logistica->>'formula_calculo_interno', p_payload->>'observaciones', ''),
    v_logistica
  );

  return jsonb_build_object(
    'ok', true,
    'id', v_prf_id,
    'codigo_orden', v_codigo,
    'token_aprobacion', v_token
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_registrar_pedido_tienda(text, jsonb) from public;
grant execute on function comun_comercio.com_fn_registrar_pedido_tienda(text, jsonb) to anon, authenticated, service_role;

create or replace function comun_comercio.com_fn_obtener_proforma_por_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_prf comun_comercio.com_proforma%rowtype;
  v_grupo_id text;
  v_items jsonb;
  v_variaciones jsonb;
  v_bloqueada boolean := false;
begin
  if p_token is null or length(trim(p_token)) < 8 then
    return jsonb_build_object('ok', false, 'error', 'Enlace de proforma no válido.');
  end if;

  select * into v_prf
  from comun_comercio.com_proforma
  where prf_token_aprobacion = trim(p_token)
    and prf_eliminado_en is null
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'La proforma solicitada no existe o fue retirada.');
  end if;

  v_grupo_id := coalesce(
    nullif(trim(v_prf.prf_detalle_proforma->>'grupo_proforma_id'), ''),
    v_prf.prf_id::text
  );

  select exists (
    select 1
    from comun_comercio.com_proforma g
    where g.prf_negocio = v_prf.prf_negocio
      and g.prf_eliminado_en is null
      and coalesce(nullif(trim(g.prf_detalle_proforma->>'grupo_proforma_id'), ''), g.prf_id::text) = v_grupo_id
      and (
        g.prf_estado in ('RESERVADA_70', 'APROBADA', 'ORDEN_CONFIRMADA', 'FACTURADA', 'PAGADO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO')
        or coalesce((g.prf_detalle_proforma->>'monto_abonado_usd')::numeric, 0) > 0
      )
  ) into v_bloqueada;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pfi_id, 'descripcion', pfi_descripcion, 'cantidad', pfi_cantidad,
        'precio_unitario', pfi_precio_unitario, 'descuento', pfi_descuento,
        'impuesto', pfi_impuesto, 'total_linea', pfi_total_linea, 'detalle', pfi_detalle_item
      )
      order by pfi_secuencial asc
    ),
    '[]'::jsonb
  )
  into v_items
  from comun_comercio.com_proforma_item
  where pfi_proforma_id = v_prf.prf_id and pfi_eliminado_en is null;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', vp.prf_id, 'secuencial', vp.prf_secuencial, 'negocio', vp.prf_negocio,
        'cliente_id', vp.prf_cliente_id, 'cliente_nombre', vp.prf_cliente_nombre,
        'cliente_contacto', vp.prf_cliente_contacto, 'estado', vp.prf_estado,
        'subtotal', vp.prf_subtotal, 'descuento', vp.prf_descuento, 'iva', vp.prf_iva,
        'total', vp.prf_total, 'vigencia_dias', vp.prf_vigencia_dias,
        'token_aprobacion', vp.prf_token_aprobacion, 'observaciones', vp.prf_observaciones,
        'detalle', vp.prf_detalle_proforma, 'creado_en', vp.prf_creado_en,
        'actualizado_en', vp.prf_actualizado_en,
        'items', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', i.pfi_id, 'descripcion', i.pfi_descripcion, 'cantidad', i.pfi_cantidad,
              'precio_unitario', i.pfi_precio_unitario, 'descuento', i.pfi_descuento,
              'impuesto', i.pfi_impuesto, 'total_linea', i.pfi_total_linea, 'detalle', i.pfi_detalle_item
            )
            order by i.pfi_secuencial asc
          )
          from comun_comercio.com_proforma_item i
          where i.pfi_proforma_id = vp.prf_id and i.pfi_eliminado_en is null
        ), '[]'::jsonb)
      )
      order by coalesce((vp.prf_detalle_proforma->>'version_numero')::int, 1) asc, vp.prf_creado_en asc
    ),
    '[]'::jsonb
  )
  into v_variaciones
  from comun_comercio.com_proforma vp
  where vp.prf_negocio = v_prf.prf_negocio
    and vp.prf_eliminado_en is null
    and coalesce(nullif(trim(vp.prf_detalle_proforma->>'grupo_proforma_id'), ''), vp.prf_id::text) = v_grupo_id;

  return jsonb_build_object(
    'ok', true,
    'bloqueada_por_pago_grupo', v_bloqueada,
    'proforma', jsonb_build_object(
      'id', v_prf.prf_id, 'secuencial', v_prf.prf_secuencial, 'negocio', v_prf.prf_negocio,
      'cliente_id', v_prf.prf_cliente_id, 'cliente_nombre', v_prf.prf_cliente_nombre,
      'cliente_contacto', v_prf.prf_cliente_contacto, 'estado', v_prf.prf_estado,
      'subtotal', v_prf.prf_subtotal, 'descuento', v_prf.prf_descuento, 'iva', v_prf.prf_iva,
      'total', v_prf.prf_total, 'vigencia_dias', v_prf.prf_vigencia_dias,
      'token_aprobacion', v_prf.prf_token_aprobacion, 'observaciones', v_prf.prf_observaciones,
      'detalle', v_prf.prf_detalle_proforma, 'creado_en', v_prf.prf_creado_en,
      'actualizado_en', v_prf.prf_actualizado_en, 'items', v_items
    ),
    'variaciones', v_variaciones
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_obtener_proforma_por_token(text) from public;
grant execute on function comun_comercio.com_fn_obtener_proforma_por_token(text) to anon, authenticated, service_role;

create or replace function comun_comercio.com_fn_listar_mis_proformas(p_negocio text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_lista jsonb;
begin
  if v_usuario is null then
    return jsonb_build_object('ok', false, 'error', 'Inicia sesión para consultar tus proformas.');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.prf_id,
        'secuencial', p.prf_secuencial,
        'codigo', coalesce(
          p.prf_detalle_proforma->>'codigo_proforma',
          p.prf_detalle_proforma->>'codigo_orden',
          comun_comercio.com_fn_prefijo_negocio(p.prf_negocio) || '-PRF-' || lpad(p.prf_secuencial::text, 4, '0')
        ),
        'tipo_origen', coalesce(p.prf_detalle_proforma->>'tipo_origen', 'PROFORMA_EVENTO'),
        'estado', p.prf_estado,
        'total', p.prf_total,
        'vigencia_dias', p.prf_vigencia_dias,
        'token_aprobacion', p.prf_token_aprobacion,
        'evento', p.prf_detalle_proforma->'evento',
        'monto_abonado_usd', coalesce((p.prf_detalle_proforma->>'monto_abonado_usd')::numeric, 0),
        'saldo_pendiente_usd', coalesce((p.prf_detalle_proforma->>'saldo_pendiente_usd')::numeric, p.prf_total),
        'creado_en', p.prf_creado_en
      )
      order by p.prf_creado_en desc
    ),
    '[]'::jsonb
  )
  into v_lista
  from comun_comercio.com_proforma p
  where p.prf_negocio = v_negocio
    and p.prf_cliente_id = v_usuario
    and p.prf_eliminado_en is null;

  return jsonb_build_object('ok', true, 'proformas', v_lista);
end;
$$;

revoke execute on function comun_comercio.com_fn_listar_mis_proformas(text) from public, anon;
grant execute on function comun_comercio.com_fn_listar_mis_proformas(text) to authenticated, service_role;

create or replace function comun_comercio.com_fn_confirmar_orden_transferencia_proforma(
  p_token text,
  p_modalidad_cobro text default 'RESERVA_70',
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prf comun_comercio.com_proforma%rowtype;
  v_grupo_id text;
  v_modalidad text := upper(trim(coalesce(p_modalidad_cobro, 'RESERVA_70')));
begin
  if p_token is null or length(trim(p_token)) < 8 then
    return jsonb_build_object('ok', false, 'error', 'Token de proforma inválido.');
  end if;

  select * into v_prf
  from comun_comercio.com_proforma
  where prf_token_aprobacion = trim(p_token) and prf_eliminado_en is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'La proforma no fue encontrada.');
  end if;

  v_grupo_id := coalesce(nullif(trim(v_prf.prf_detalle_proforma->>'grupo_proforma_id'), ''), v_prf.prf_id::text);

  update comun_comercio.com_proforma
     set prf_estado = 'ORDEN_CONFIRMADA',
         prf_detalle_proforma = coalesce(prf_detalle_proforma, '{}'::jsonb) || jsonb_build_object(
           'estado', 'ORDEN_CONFIRMADA',
           'metodo_pago', 'transferencia',
           'modalidad_comprometida', v_modalidad,
           'nota_transferencia', coalesce(p_nota, ''),
           'confirmada_transferencia_en', now(),
           'variacion_aceptada', true
         ),
         prf_actualizado_en = now()
   where prf_id = v_prf.prf_id;

  update comun_comercio.com_proforma
     set prf_estado = 'NO_ACEPTADA',
         prf_detalle_proforma = coalesce(prf_detalle_proforma, '{}'::jsonb) || jsonb_build_object(
           'estado', 'NO_ACEPTADA',
           'descartada_por_aceptacion_id', v_prf.prf_id
         ),
         prf_actualizado_en = now()
   where prf_negocio = v_prf.prf_negocio
     and prf_eliminado_en is null
     and prf_id <> v_prf.prf_id
     and prf_estado in ('ENVIADA', 'PENDIENTE_PAGO')
     and coalesce(nullif(trim(prf_detalle_proforma->>'grupo_proforma_id'), ''), prf_id::text) = v_grupo_id;

  return jsonb_build_object('ok', true, 'id', v_prf.prf_id, 'estado', 'ORDEN_CONFIRMADA');
end;
$$;

revoke execute on function comun_comercio.com_fn_confirmar_orden_transferencia_proforma(text, text, text) from public;
grant execute on function comun_comercio.com_fn_confirmar_orden_transferencia_proforma(text, text, text) to anon, authenticated, service_role;

create or replace function comun_comercio.com_fn_preparar_pago_plux_proforma(
  p_negocio text,
  p_proforma_id uuid,
  p_token text,
  p_pagador jsonb,
  p_modalidad_cobro text default 'TOTAL_100'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_prefijo text := comun_comercio.com_fn_prefijo_negocio(v_negocio);
  v_modalidad text := upper(trim(coalesce(p_modalidad_cobro, 'TOTAL_100')));
  v_pasarela comun_comercio.com_pasarela_configuracion%rowtype;
  v_prf comun_comercio.com_proforma%rowtype;
  v_total_orden_c bigint;
  v_iva_orden_c bigint;
  v_base_orden_c bigint;
  v_base_grav_orden_c bigint;
  v_base0_orden_c bigint;
  v_abonado_prev_c bigint;
  v_restante_c bigint;
  v_factor numeric;
  v_base0_c bigint;
  v_base_grav_c bigint;
  v_iva_c bigint;
  v_total_c bigint;
  v_codigo text;
  v_etiqueta_cobro text;
  v_identificador text;
begin
  if v_modalidad not in ('TOTAL_100', 'RESERVA_70', 'SALDO_30') then
    return jsonb_build_object('ok', false, 'error', 'Modalidad de cobro no válida.');
  end if;

  select * into v_pasarela
  from comun_comercio.com_pasarela_configuracion
  where psc_negocio = v_negocio
    and psc_pasarela = 'PLUX'
    and psc_activo = true
    and psc_eliminado_en is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'La pasarela PLUX no está activa para este comercio.');
  end if;

  select * into v_prf
  from comun_comercio.com_proforma
  where prf_id = p_proforma_id
    and prf_negocio = v_negocio
    and prf_eliminado_en is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'La orden o proforma no fue encontrada.');
  end if;

  if not (
    (p_token is not null and v_prf.prf_token_aprobacion = trim(p_token))
    or (v_usuario is not null and v_prf.prf_cliente_id = v_usuario)
  ) then
    return jsonb_build_object('ok', false, 'error', 'No autorizado para procesar el pago de esta proforma.');
  end if;

  if v_prf.prf_estado in ('CANCELADO', 'ENTREGADO') then
    return jsonb_build_object('ok', false, 'error', 'Esta orden ya no admite cobros en línea.');
  end if;

  v_total_orden_c := round(coalesce(v_prf.prf_total, 0) * 100);
  v_iva_orden_c := greatest(0, round(coalesce(v_prf.prf_iva, 0) * 100));
  v_base_orden_c := greatest(0, v_total_orden_c - v_iva_orden_c);

  if (v_prf.prf_detalle_proforma ? 'base_iva_gravada_centavos') and (v_prf.prf_detalle_proforma ? 'base_iva_0_centavos') then
    v_base_grav_orden_c := greatest(0, (v_prf.prf_detalle_proforma->>'base_iva_gravada_centavos')::bigint);
    v_base0_orden_c := greatest(0, v_base_orden_c - v_base_grav_orden_c);
  elsif v_iva_orden_c > 0 then
    v_base_grav_orden_c := least(v_base_orden_c, round(v_iva_orden_c * 100.0 / 15.0));
    v_base0_orden_c := greatest(0, v_base_orden_c - v_base_grav_orden_c);
  else
    v_base_grav_orden_c := 0;
    v_base0_orden_c := v_base_orden_c;
  end if;

  v_abonado_prev_c := greatest(0, round(coalesce((v_prf.prf_detalle_proforma->>'monto_abonado_usd')::numeric, 0) * 100));

  if v_prf.prf_estado = 'APROBADA' and v_abonado_prev_c >= v_total_orden_c then
    return jsonb_build_object('ok', false, 'error', 'Esta proforma ya se encuentra pagada al 100%.');
  end if;

  if v_modalidad = 'RESERVA_70' then
    if v_prf.prf_estado = 'RESERVADA_70' or v_abonado_prev_c > 0 then
      return jsonb_build_object('ok', false, 'error', 'La reserva del 70% ya fue registrada. Puedes abonar el saldo restante.');
    end if;
    v_base0_c := round(v_base0_orden_c * 0.70);
    v_base_grav_c := round(v_base_grav_orden_c * 0.70);
    v_iva_c := round(v_iva_orden_c * 0.70);
    v_total_c := v_base0_c + v_base_grav_c + v_iva_c;
    v_etiqueta_cobro := 'Reserva 70% Evento';
  elsif v_modalidad = 'SALDO_30' or v_abonado_prev_c > 0 then
    v_restante_c := greatest(0, v_total_orden_c - v_abonado_prev_c);
    if v_restante_c <= 0 then
      return jsonb_build_object('ok', false, 'error', 'No existe saldo pendiente por pagar.');
    end if;
    v_factor := v_restante_c::numeric / greatest(1, v_total_orden_c)::numeric;
    v_iva_c := round(v_iva_orden_c * v_factor);
    v_base_grav_c := round(v_base_grav_orden_c * v_factor);
    v_base0_c := greatest(0, v_restante_c - v_iva_c - v_base_grav_c);
    v_total_c := v_base0_c + v_base_grav_c + v_iva_c;
    v_modalidad := 'SALDO_30';
    v_etiqueta_cobro := 'Liquidación Saldo 30%';
  else
    v_base0_c := v_base0_orden_c;
    v_base_grav_c := v_base_grav_orden_c;
    v_iva_c := v_iva_orden_c;
    v_total_c := v_base0_c + v_base_grav_c + v_iva_c;
    v_etiqueta_cobro := 'Pago Total 100%';
  end if;

  if v_total_c <= 0 then
    return jsonb_build_object('ok', false, 'error', 'El importe a cobrar debe ser mayor a cero.');
  end if;

  v_codigo := coalesce(
    v_prf.prf_detalle_proforma->>'codigo_proforma',
    v_prf.prf_detalle_proforma->>'codigo_orden',
    v_prefijo || '-PRF-' || lpad(coalesce(v_prf.prf_secuencial, 1)::text, 4, '0')
  );
  v_identificador := v_prefijo || '-PLX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into comun_comercio.com_transaccion_pago (
    pag_negocio, pag_cliente_id, pag_pasarela, pag_identificador_cliente, pag_estado,
    pag_monto_total, pag_monto_con_iva, pag_monto_sin_iva, pag_monto_iva, pag_moneda,
    pag_referencia_id, pag_titular_email, pag_titular_telefono, pag_titular_identificacion,
    pag_detalle_transaccion
  )
  values (
    v_negocio, coalesce(v_usuario, v_prf.prf_cliente_id), 'PLUX', v_identificador, 'PENDIENTE',
    v_total_c / 100.0, v_base_grav_c / 100.0, v_base0_c / 100.0, v_iva_c / 100.0, 'USD',
    v_prf.prf_id, p_pagador->>'email', p_pagador->>'telefono', p_pagador->>'identificacion',
    jsonb_build_object(
      'proforma_id', v_prf.prf_id,
      'codigo_orden', v_codigo,
      'modalidad_cobro', v_modalidad,
      'producto', v_codigo || ' (' || v_etiqueta_cobro || ')',
      'base0_centavos', v_base0_c,
      'base_gravada_centavos', v_base_grav_c,
      'iva_centavos', v_iva_c,
      'ambiente', v_pasarela.psc_ambiente,
      'pagador', p_pagador
    )
  );

  return jsonb_build_object(
    'ok', true,
    'identificador', v_identificador,
    'ambiente', v_pasarela.psc_ambiente,
    'remail', coalesce(v_pasarela.psc_credenciales_publicas->>'remail', 'admin.operaciones@tranqi24.com'),
    'nombre_comercio', coalesce(v_pasarela.psc_credenciales_publicas->>'nombre_comercio', initcap(v_negocio)),
    'descripcion', v_codigo || ' - ' || v_etiqueta_cobro,
    'base_centavos', v_base0_c + v_base_grav_c,
    'base0_centavos', v_base0_c,
    'base_gravada_centavos', v_base_grav_c,
    'iva_centavos', v_iva_c,
    'total_centavos', v_total_c
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_preparar_pago_plux_proforma(text, uuid, text, jsonb, text) from public;
grant execute on function comun_comercio.com_fn_preparar_pago_plux_proforma(text, uuid, text, jsonb, text) to anon, authenticated, service_role;

create or replace function comun_comercio.com_fn_confirmar_pago_plux(p_negocio text, p_notificacion jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(coalesce(p_negocio, 'tranqi'));
  v_payload jsonb;
  v_pago comun_comercio.com_transaccion_pago%rowtype;
  v_variante comun_comercio.com_variante%rowtype;
  v_prf comun_comercio.com_proforma%rowtype;
  v_prf_id uuid;
  v_modalidad text;
  v_nuevo_abonado numeric(12,2);
  v_saldo numeric(12,2);
  v_nuevo_estado_prf text;
  v_estado_raw text;
  v_estado text;
  v_motivo text;
  v_monto numeric;
  v_frecuencia text;
  v_suscripcion uuid;
  v_autorizacion text;
  v_marca text;
  v_ultimos4 text;
  v_factura_snap jsonb;
begin
  v_payload := case
    when jsonb_typeof(p_notificacion->'detail') = 'object' then p_notificacion || (p_notificacion->'detail')
    else coalesce(p_notificacion, '{}'::jsonb)
  end;

  select * into v_pago
  from comun_comercio.com_transaccion_pago
  where pag_negocio = v_negocio
    and pag_identificador_cliente = v_payload->>'extras'
    and pag_pasarela = 'PLUX'
    and pag_eliminado_en is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'PAGO_DESCONOCIDO');
  end if;

  if v_pago.pag_estado <> 'PENDIENTE' then
    return jsonb_build_object(
      'ok', true,
      'repetido', true,
      'estado', v_pago.pag_estado,
      'factura_electronica', v_pago.pag_detalle_transaccion->'factura_electronica'
    );
  end if;

  v_monto := case
    when coalesce(v_payload->>'amount', '') ~ '^[0-9]+(\.[0-9]+)?$' then (v_payload->>'amount')::numeric
    else v_pago.pag_monto_total
  end;

  v_estado_raw := upper(trim(coalesce(v_payload->>'state', v_payload->>'estado', v_payload->>'status', '')));

  if v_estado_raw not in ('PAGADO', 'APROBADO', 'SUCCEEDED', 'SUCCEDED') then
    v_estado := 'RECHAZADO';
    v_motivo := coalesce(nullif(v_estado_raw, ''), 'SIN_ESTADO');
  elsif v_monto is null or abs(v_monto - v_pago.pag_monto_total) >= 0.005 then
    v_estado := 'RECHAZADO';
    v_motivo := 'MONTO_DISTINTO';
  else
    v_estado := 'APROBADO';
  end if;

  v_autorizacion := coalesce(v_payload->>'token', v_payload->>'id_transaccion');
  v_marca := upper(coalesce(v_payload->>'cardIssuer', 'TARJETA'));
  v_ultimos4 := right(regexp_replace(coalesce(v_payload->>'cardInfo', ''), '\s+', '', 'g'), 4);

  update comun_comercio.com_transaccion_pago
     set pag_estado = v_estado,
         pag_transaccion_pasarela_id = coalesce(v_payload->>'id_transaccion', v_payload->>'idTransaction', v_payload->>'token'),
         pag_autorizacion_codigo = v_autorizacion,
         pag_tarjeta_tipo = case lower(coalesce(v_payload->>'cardType', ''))
                              when 'debit' then 'DEBITO'
                              else 'CREDITO'
                            end,
         pag_tarjeta_marca = v_marca,
         pag_tarjeta_ultimos_digitos = v_ultimos4,
         pag_confirmado_en = case when v_estado = 'APROBADO' then now() end,
         pag_detalle_transaccion = pag_detalle_transaccion
           || jsonb_build_object('webhook', v_payload, 'motivo', v_motivo),
         pag_actualizado_en = now()
   where pag_id = v_pago.pag_id;

  if v_estado <> 'APROBADO' then
    return jsonb_build_object('ok', true, 'estado', v_estado, 'motivo', v_motivo);
  end if;

  -- A) Si corresponde a variante de suscripción
  if (v_pago.pag_detalle_transaccion ? 'variante_id') and (v_pago.pag_detalle_transaccion->>'variante_id') ~* '^[0-9a-f-]{36}$' then
    select * into v_variante
    from comun_comercio.com_variante
    where var_id = (v_pago.pag_detalle_transaccion->>'variante_id')::uuid;

    if found and v_pago.pag_cliente_id is not null
       and (v_variante.var_tipo_oferta like 'RECURRENTE%' or v_variante.var_frecuencia_recurrencia is not null) then
      v_frecuencia := coalesce(v_variante.var_frecuencia_recurrencia,
                               case when v_variante.var_tipo_oferta = 'RECURRENTE_ANUAL' then 'ANUAL' else 'MENSUAL' end);

      update comun_comercio.com_suscripcion
         set sub_estado = 'CANCELADA',
             sub_cancelado_en = now(),
             sub_actualizado_en = now()
       where sub_negocio = v_pago.pag_negocio
         and sub_cliente_id = v_pago.pag_cliente_id
         and sub_estado = 'ACTIVA'
         and sub_eliminado_en is null;

      insert into comun_comercio.com_suscripcion (
        sub_negocio, sub_cliente_id, sub_variante_id, sub_estado, sub_frecuencia,
        sub_monto_periodo, sub_proximo_cobro_en, sub_ultimo_cobro_en, sub_detalle_suscripcion
      )
      values (
        v_pago.pag_negocio, v_pago.pag_cliente_id, v_variante.var_id, 'ACTIVA', v_frecuencia,
        v_pago.pag_monto_total,
        now() + case v_frecuencia
                  when 'SEMANAL' then interval '7 days'
                  when 'QUINCENAL' then interval '15 days'
                  when 'ANUAL' then interval '1 year'
                  else interval '1 month'
                end,
        now(),
        jsonb_build_object('pago_id', v_pago.pag_id, 'pasarela', 'PLUX')
      )
      returning sub_id into v_suscripcion;

      update comun_comercio.com_transaccion_pago
         set pag_referencia_id = v_suscripcion
       where pag_id = v_pago.pag_id;
    end if;
  end if;

  -- B) Si corresponde a Pedido de Tienda o Proforma de Evento
  v_prf_id := coalesce(
    v_pago.pag_referencia_id,
    case
      when (v_pago.pag_detalle_transaccion->>'proforma_id') ~* '^[0-9a-f-]{36}$'
      then (v_pago.pag_detalle_transaccion->>'proforma_id')::uuid
      else null
    end
  );

  if v_prf_id is not null then
    select * into v_prf
    from comun_comercio.com_proforma
    where prf_id = v_prf_id and prf_negocio = v_pago.pag_negocio
    for update;

    if found then
      v_modalidad := upper(coalesce(v_pago.pag_detalle_transaccion->>'modalidad_cobro', 'TOTAL_100'));
      v_nuevo_abonado := round((coalesce((v_prf.prf_detalle_proforma->>'monto_abonado_usd')::numeric, 0) + v_pago.pag_monto_total)::numeric, 2);
      v_saldo := greatest(0, round((v_prf.prf_total - v_nuevo_abonado)::numeric, 2));
      v_nuevo_estado_prf := case
        when v_saldo > 0.02 and v_modalidad = 'RESERVA_70' then 'RESERVADA_70'
        else 'APROBADA'
      end;

      update comun_comercio.com_proforma
         set prf_estado = v_nuevo_estado_prf,
             prf_detalle_proforma = coalesce(prf_detalle_proforma, '{}'::jsonb) || jsonb_build_object(
               'estado', v_nuevo_estado_prf,
               'metodo_pago', 'plux',
               'modalidad_ultimo_cobro', v_modalidad,
               'monto_abonado_usd', v_nuevo_abonado,
               'saldo_pendiente_usd', v_saldo,
               'ultimo_pago_plux', jsonb_build_object(
                 'pago_id', v_pago.pag_id,
                 'identificador', v_pago.pag_identificador_cliente,
                 'autorizacion', v_autorizacion,
                 'marca', v_marca,
                 'ultimos_digitos', v_ultimos4,
                 'monto_usd', v_pago.pag_monto_total,
                 'confirmado_en', now()
               ),
               'variacion_aceptada', true
             ),
             prf_actualizado_en = now()
       where prf_id = v_prf.prf_id;

      if nullif(trim(v_prf.prf_detalle_proforma->>'grupo_proforma_id'), '') is not null then
        update comun_comercio.com_proforma
           set prf_estado = 'NO_ACEPTADA',
               prf_detalle_proforma = coalesce(prf_detalle_proforma, '{}'::jsonb) || jsonb_build_object(
                 'estado', 'NO_ACEPTADA',
                 'descartada_por_pago_id', v_prf.prf_id
               ),
               prf_actualizado_en = now()
         where prf_negocio = v_prf.prf_negocio
           and prf_eliminado_en is null
           and prf_id <> v_prf.prf_id
           and prf_estado in ('ENVIADA', 'PENDIENTE_PAGO')
           and coalesce(prf_detalle_proforma->>'grupo_proforma_id', '') = (v_prf.prf_detalle_proforma->>'grupo_proforma_id');
      end if;
    end if;
  end if;

  select pag_detalle_transaccion->'factura_electronica'
  into v_factura_snap
  from comun_comercio.com_transaccion_pago
  where pag_id = v_pago.pag_id;

  return jsonb_build_object(
    'ok', true,
    'estado', v_estado,
    'suscripcion_id', v_suscripcion,
    'proforma_id', v_prf_id,
    'factura_electronica', v_factura_snap
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_confirmar_pago_plux(text, jsonb) from public, anon, authenticated;
grant execute on function comun_comercio.com_fn_confirmar_pago_plux(text, jsonb) to service_role;

create or replace function comun_comercio.com_fn_confirmar_pago_plux_cliente(
  p_negocio text,
  p_identificador text,
  p_notificacion jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(coalesce(p_negocio, 'tranqi'));
  v_cliente_pago uuid;
begin
  select pag_cliente_id into v_cliente_pago
  from comun_comercio.com_transaccion_pago
  where pag_negocio = v_negocio
    and pag_identificador_cliente = p_identificador
    and pag_pasarela = 'PLUX'
    and pag_eliminado_en is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Pago no encontrado.');
  end if;

  if v_cliente_pago is not null and v_usuario is not null and v_cliente_pago is distinct from v_usuario then
    return jsonb_build_object('ok', false, 'error', 'Pago no autorizado para este usuario.');
  end if;

  return comun_comercio.com_fn_confirmar_pago_plux(
    v_negocio,
    coalesce(p_notificacion, '{}'::jsonb) || jsonb_build_object('extras', p_identificador)
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_confirmar_pago_plux_cliente(text, text, jsonb) from public;
grant execute on function comun_comercio.com_fn_confirmar_pago_plux_cliente(text, text, jsonb) to anon, authenticated, service_role;

create or replace function comun_comercio.com_fn_consultar_pago_plux_publico(p_identificador text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pago comun_comercio.com_transaccion_pago%rowtype;
begin
  if p_identificador is null or p_identificador !~ '^[A-Z]{3}-PLX-[0-9A-F]{12}$' then
    return jsonb_build_object('ok', false, 'error', 'Identificador inválido.');
  end if;

  select * into v_pago
  from comun_comercio.com_transaccion_pago
  where pag_identificador_cliente = p_identificador
    and pag_pasarela = 'PLUX'
    and pag_eliminado_en is null
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Pago desconocido.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'pago_id', v_pago.pag_id,
    'estado', v_pago.pag_estado,
    'motivo', v_pago.pag_detalle_transaccion->>'motivo',
    'autorizacion', v_pago.pag_autorizacion_codigo,
    'marca_tarjeta', v_pago.pag_tarjeta_marca,
    'ultimos_digitos', v_pago.pag_tarjeta_ultimos_digitos,
    'factura_electronica', v_pago.pag_detalle_transaccion->'factura_electronica'
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_consultar_pago_plux_publico(text) from public;
grant execute on function comun_comercio.com_fn_consultar_pago_plux_publico(text) to anon, authenticated, service_role;

-- Registro manual de pago (transferencia, efectivo, Deuna) + emisión automática de factura SRI
create or replace function comun_comercio.com_fn_registrar_pago_manual_y_facturar(
  p_negocio text,
  p_cliente_id uuid default null,
  p_medio_pago text default 'TRANSFERENCIA',
  p_referencia text default null,
  p_rubro_descripcion text default 'Pedido Floral',
  p_variante_id uuid default null,
  p_codigo_rubro text default 'PED-001',
  p_subtotal_con_iva numeric default 0,
  p_subtotal_sin_iva numeric default 0,
  p_monto_iva numeric default 0,
  p_monto_total numeric default 0,
  p_comprador jsonb default '{}'::jsonb,
  p_observaciones text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(p_negocio);
  v_pago_id uuid;
  v_identificador text;
  v_medio text := upper(btrim(coalesce(p_medio_pago, 'TRANSFERENCIA')));
  v_ref text := coalesce(nullif(btrim(p_referencia), ''), 'MAN-' || to_char(now(), 'YYYYMMDDHH24MISS'));
  v_cmp comun_facturacion.fac_comprobante%rowtype;
  v_numero_factura text;
begin
  if not (comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio) or comun_facturacion.fac_fn_es_admin(v_negocio)) then
    raise exception 'No autorizado: se requiere rol de Operador o Administrador';
  end if;

  if p_monto_total <= 0 then
    raise exception 'El monto total del pago debe ser mayor a cero';
  end if;

  v_identificador := comun_comercio.com_fn_prefijo_negocio(v_negocio) || '-MAN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into comun_comercio.com_transaccion_pago (
    pag_negocio, pag_cliente_id, pag_pasarela, pag_identificador_cliente,
    pag_transaccion_pasarela_id, pag_autorizacion_codigo, pag_estado,
    pag_monto_total, pag_monto_con_iva, pag_monto_sin_iva, pag_monto_iva,
    pag_moneda, pag_titular_email, pag_titular_identificacion, pag_titular_telefono,
    pag_confirmado_en, pag_detalle_transaccion
  )
  values (
    v_negocio, p_cliente_id, v_medio, v_identificador, v_ref, v_ref, 'APROBADO',
    round(p_monto_total, 2), round(p_subtotal_con_iva, 2), round(p_subtotal_sin_iva, 2), round(p_monto_iva, 2),
    'USD',
    nullif(btrim(coalesce(p_comprador ->> 'correo_facturacion', p_comprador ->> 'email', '')), ''),
    nullif(btrim(coalesce(p_comprador ->> 'identificacion', '')), ''),
    nullif(btrim(coalesce(p_comprador ->> 'telefono', '')), ''),
    now(),
    jsonb_build_object(
      'registro_manual', true,
      'registrado_por', auth.uid(),
      'medio_pago', v_medio,
      'referencia_pago', v_ref,
      'observaciones', p_observaciones,
      'variante_id', p_variante_id,
      'codigo_rubro', p_codigo_rubro,
      'rubro_facturado', p_rubro_descripcion,
      'nombre_servicio', p_rubro_descripcion,
      'datos_facturacion', p_comprador
    )
  )
  returning pag_id into v_pago_id;

  select * into v_cmp
  from comun_facturacion.fac_comprobante
  where cmp_transaccion_pago_id = v_pago_id;

  if found and v_cmp.cmp_numero is not null then
    v_numero_factura := v_cmp.cmp_establecimiento || '-' || v_cmp.cmp_punto_emision || '-' || lpad(v_cmp.cmp_numero::text, 9, '0');
  end if;

  return jsonb_build_object(
    'ok', true,
    'pago_id', v_pago_id,
    'identificador', v_identificador,
    'comprobante_id', v_cmp.cmp_id,
    'numero_comprobante', v_numero_factura,
    'clave_acceso', v_cmp.cmp_clave_acceso,
    'estado_factura', v_cmp.cmp_estado
  );
end;
$$;

grant execute on function comun_comercio.com_fn_registrar_pago_manual_y_facturar(
  text, uuid, text, text, text, uuid, text, numeric, numeric, numeric, numeric, jsonb, text
) to authenticated, service_role;

-- ==============================================================================
-- SECCIÓN E: RPCs PUENTE EN comun_comercio PARA PANTALLAS DE CONFIGURACIÓN SRI
--            Y CUSTODIA DE FIRMA ELECTRÓNICA (.p12) EN SUPABASE VAULT
-- ==============================================================================
create or replace function comun_comercio.com_fn_obtener_emisor_ride_publico(p_negocio text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(p_negocio);
  v_emisor comun_facturacion.fac_emisor%rowtype;
begin
  select * into v_emisor
  from comun_facturacion.fac_emisor
  where emi_negocio = v_negocio;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'emisor', jsonb_build_object(
      'emi_negocio', v_emisor.emi_negocio,
      'emi_ruc', v_emisor.emi_ruc,
      'emi_razon_social', v_emisor.emi_razon_social,
      'emi_nombre_comercial', v_emisor.emi_nombre_comercial,
      'emi_direccion_matriz', v_emisor.emi_direccion_matriz,
      'emi_direccion_establecimiento', v_emisor.emi_direccion_establecimiento,
      'emi_establecimiento', v_emisor.emi_establecimiento,
      'emi_punto_emision', v_emisor.emi_punto_emision,
      'emi_obligado_contabilidad', v_emisor.emi_obligado_contabilidad,
      'emi_contribuyente_especial', v_emisor.emi_contribuyente_especial,
      'emi_agente_retencion', v_emisor.emi_agente_retencion,
      'emi_regimen', v_emisor.emi_regimen,
      'emi_ambiente', v_emisor.emi_ambiente,
      'emi_produccion_habilitada', v_emisor.emi_produccion_habilitada,
      'emi_emision_automatica', v_emisor.emi_emision_automatica,
      'emi_activo', v_emisor.emi_activo,
      'emi_correo_copia', v_emisor.emi_correo_copia
    )
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_obtener_emisor_ride_publico(text) from public;
grant execute on function comun_comercio.com_fn_obtener_emisor_ride_publico(text) to anon, authenticated, service_role;

create or replace function comun_comercio.com_fn_obtener_configuracion_facturacion_sri(p_negocio text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(p_negocio);
  v_emisor comun_facturacion.fac_emisor%rowtype;
  v_secs jsonb;
  v_certs jsonb;
  v_es_super boolean := false;
begin
  if not (comun_facturacion.fac_fn_es_admin(v_negocio) or comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio)) then
    return jsonb_build_object('ok', false, 'error', 'No autorizado para consultar parámetros SRI.');
  end if;

  select coalesce(comun_seguridad.seg_fn_es_superadmin(), false) into v_es_super;
  select * into v_emisor from comun_facturacion.fac_emisor where emi_negocio = v_negocio;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'sec_ambiente', s.sec_ambiente,
        'sec_establecimiento', s.sec_establecimiento,
        'sec_punto_emision', s.sec_punto_emision,
        'sec_tipo_comprobante', s.sec_tipo,
        'sec_ultimo_numero', s.sec_ultimo
      )
      order by s.sec_ambiente asc, s.sec_tipo asc
    ),
    '[]'::jsonb
  )
  into v_secs
  from comun_facturacion.fac_secuencial s
  where s.sec_negocio = v_negocio;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'cer_id', c.cer_id,
        'cer_titular', c.cer_titular,
        'cer_identificacion_certificado', c.cer_identificacion,
        'cer_emisor_ca', c.cer_emisor,
        'cer_numero_serie', c.cer_serial,
        'cer_valido_desde', c.cer_valido_desde,
        'cer_valido_hasta', c.cer_valido_hasta,
        'cer_huella_sha1', c.cer_huella_sha1,
        'cer_activo', c.cer_activo,
        'cer_creado_en', c.cer_creado_en
      )
      order by c.cer_activo desc, c.cer_creado_en desc
    ),
    '[]'::jsonb
  )
  into v_certs
  from comun_facturacion.fac_certificado c
  where c.cer_negocio = v_negocio;

  return jsonb_build_object(
    'ok', true,
    'emisor', case when v_emisor.emi_id is not null then to_jsonb(v_emisor) else null end,
    'secuenciales', v_secs,
    'certificados', v_certs,
    'es_superadmin', v_es_super
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_obtener_configuracion_facturacion_sri(text) from public, anon;
grant execute on function comun_comercio.com_fn_obtener_configuracion_facturacion_sri(text) to authenticated, service_role;

create or replace function comun_comercio.com_fn_guardar_configuracion_facturacion_sri(
  p_negocio text,
  p_datos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(p_negocio);
  v_id uuid;
  v_ruc text := btrim(coalesce(p_datos ->> 'ruc', ''));
  v_razon text := btrim(coalesce(p_datos ->> 'razon_social', ''));
  v_comercial text := nullif(btrim(coalesce(p_datos ->> 'nombre_comercial', '')), '');
  v_matriz text := btrim(coalesce(p_datos ->> 'direccion_matriz', ''));
  v_estab_dir text := nullif(btrim(coalesce(p_datos ->> 'direccion_establecimiento', '')), '');
  v_estab text := coalesce(nullif(btrim(p_datos ->> 'establecimiento'), ''), '001');
  v_punto text := coalesce(nullif(btrim(p_datos ->> 'punto_emision'), ''), '001');
  v_regimen text := coalesce(nullif(btrim(p_datos ->> 'regimen'), ''), 'GENERAL');
begin
  if not comun_facturacion.fac_fn_es_admin(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Se requiere rol de Administrador para modificar el emisor SRI.');
  end if;

  if v_ruc !~ '^[0-9]{10}001$' then
    return jsonb_build_object('ok', false, 'error', 'El RUC debe tener 13 dígitos numéricos y terminar en 001.');
  end if;

  insert into comun_facturacion.fac_emisor as e (
    emi_negocio, emi_ruc, emi_razon_social, emi_nombre_comercial,
    emi_direccion_matriz, emi_direccion_establecimiento,
    emi_establecimiento, emi_punto_emision,
    emi_obligado_contabilidad, emi_contribuyente_especial, emi_agente_retencion,
    emi_regimen, emi_emision_automatica, emi_activo, emi_correo_copia
  )
  values (
    v_negocio, v_ruc, v_razon, v_comercial,
    v_matriz, coalesce(v_estab_dir, v_matriz),
    v_estab, v_punto,
    coalesce((p_datos ->> 'obligado_contabilidad')::boolean, false),
    nullif(btrim(coalesce(p_datos ->> 'contribuyente_especial', '')), ''),
    nullif(btrim(coalesce(p_datos ->> 'agente_retencion', '')), ''),
    v_regimen,
    coalesce((p_datos ->> 'emision_automatica')::boolean, true),
    coalesce((p_datos ->> 'activo')::boolean, true),
    nullif(lower(btrim(coalesce(p_datos ->> 'correo_copia', ''))), '')
  )
  on conflict (emi_negocio) do update set
    emi_ruc = excluded.emi_ruc,
    emi_razon_social = excluded.emi_razon_social,
    emi_nombre_comercial = excluded.emi_nombre_comercial,
    emi_direccion_matriz = excluded.emi_direccion_matriz,
    emi_direccion_establecimiento = excluded.emi_direccion_establecimiento,
    emi_establecimiento = excluded.emi_establecimiento,
    emi_punto_emision = excluded.emi_punto_emision,
    emi_obligado_contabilidad = excluded.emi_obligado_contabilidad,
    emi_contribuyente_especial = excluded.emi_contribuyente_especial,
    emi_agente_retencion = excluded.emi_agente_retencion,
    emi_regimen = excluded.emi_regimen,
    emi_emision_automatica = excluded.emi_emision_automatica,
    emi_activo = excluded.emi_activo,
    emi_correo_copia = excluded.emi_correo_copia,
    emi_actualizado_en = now()
  returning emi_id into v_id;

  insert into comun_facturacion.fac_secuencial (sec_negocio, sec_ambiente, sec_tipo, sec_establecimiento, sec_punto_emision, sec_ultimo)
  select v_negocio, a.amb, t.tipo, v_estab, v_punto, 0
  from (values (1::smallint), (2::smallint)) as a(amb)
  cross join (values ('01'), ('04')) as t(tipo)
  on conflict (sec_negocio, sec_ambiente, sec_tipo, sec_establecimiento, sec_punto_emision) do nothing;

  update comun_configuracion.cfg_negocio
     set cfg_identificacion = v_ruc,
         cfg_razon_social = v_razon,
         cfg_nombre_comercial = coalesce(v_comercial, v_razon),
         cfg_actualizado_en = now()
   where cfg_negocio = v_negocio;

  return jsonb_build_object('ok', true, 'emisor_id', v_id);
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

revoke execute on function comun_comercio.com_fn_guardar_configuracion_facturacion_sri(text, jsonb) from public, anon;
grant execute on function comun_comercio.com_fn_guardar_configuracion_facturacion_sri(text, jsonb) to authenticated, service_role;

create or replace function comun_comercio.com_fn_fijar_secuencial_sri(
  p_negocio text,
  p_ambiente int,
  p_tipo_comprobante text,
  p_ultimo_numero bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(p_negocio);
  v_emisor comun_facturacion.fac_emisor%rowtype;
  v_max_emitido bigint := 0;
begin
  if not comun_facturacion.fac_fn_es_admin(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No autorizado para modificar secuenciales SRI.');
  end if;

  select * into v_emisor from comun_facturacion.fac_emisor where emi_negocio = v_negocio;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Primero guarda los datos del emisor SRI.');
  end if;

  select coalesce(max(cmp_numero), 0) into v_max_emitido
  from comun_facturacion.fac_comprobante
  where cmp_negocio = v_negocio
    and cmp_ambiente = p_ambiente::smallint
    and cmp_tipo = p_tipo_comprobante
    and cmp_establecimiento = v_emisor.emi_establecimiento
    and cmp_punto_emision = v_emisor.emi_punto_emision;

  if p_ultimo_numero < v_max_emitido then
    return jsonb_build_object(
      'ok', false,
      'error', 'El secuencial no puede ser menor al último comprobante ya emitido (' || v_max_emitido || ').'
    );
  end if;

  insert into comun_facturacion.fac_secuencial as s (
    sec_negocio, sec_ambiente, sec_tipo, sec_establecimiento, sec_punto_emision, sec_ultimo
  )
  values (
    v_negocio, p_ambiente::smallint, p_tipo_comprobante,
    v_emisor.emi_establecimiento, v_emisor.emi_punto_emision, p_ultimo_numero
  )
  on conflict (sec_negocio, sec_ambiente, sec_tipo, sec_establecimiento, sec_punto_emision)
  do update set sec_ultimo = excluded.sec_ultimo, sec_actualizado_en = now();

  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

revoke execute on function comun_comercio.com_fn_fijar_secuencial_sri(text, int, text, bigint) from public, anon;
grant execute on function comun_comercio.com_fn_fijar_secuencial_sri(text, int, text, bigint) to authenticated, service_role;

create or replace function comun_comercio.com_fn_habilitar_produccion_sri(
  p_negocio text,
  p_habilitar boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(p_negocio);
begin
  if not comun_seguridad.seg_fn_es_superadmin() then
    return jsonb_build_object('ok', false, 'error', 'Solo un SuperAdmin puede habilitar o revocar Producción SRI.');
  end if;

  update comun_facturacion.fac_emisor
     set emi_produccion_habilitada = p_habilitar,
         emi_ambiente = case when p_habilitar then emi_ambiente else 1 end,
         emi_actualizado_en = now()
   where emi_negocio = v_negocio;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'El negocio aún no tiene emisor SRI registrado.');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function comun_comercio.com_fn_habilitar_produccion_sri(text, boolean) from public, anon;
grant execute on function comun_comercio.com_fn_habilitar_produccion_sri(text, boolean) to authenticated, service_role;

create or replace function comun_comercio.com_fn_cambiar_ambiente_sri(
  p_negocio text,
  p_ambiente int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(p_negocio);
  v_emisor comun_facturacion.fac_emisor%rowtype;
begin
  if not comun_facturacion.fac_fn_es_admin(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Se requiere rol de Administrador para cambiar el ambiente SRI.');
  end if;

  select * into v_emisor from comun_facturacion.fac_emisor where emi_negocio = v_negocio for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Configura primero los datos del emisor SRI.');
  end if;

  if p_ambiente = 2 then
    if not v_emisor.emi_produccion_habilitada then
      return jsonb_build_object('ok', false, 'error', 'Producción SRI aún no está habilitada para este negocio (requiere autorización SuperAdmin).');
    end if;
    if not exists (
      select 1 from comun_facturacion.fac_certificado
      where cer_id = v_emisor.emi_certificado_id
        and cer_activo = true
        and cer_valido_desde <= now()
        and cer_valido_hasta > now()
    ) then
      return jsonb_build_object('ok', false, 'error', 'Para pasar a Producción SRI (CEL) debes cargar primero un certificado de firma electrónica (.p12) vigente en Vault.');
    end if;
  elsif p_ambiente <> 1 then
    return jsonb_build_object('ok', false, 'error', 'Ambiente SRI inválido.');
  end if;

  update comun_facturacion.fac_emisor
     set emi_ambiente = p_ambiente::smallint,
         emi_actualizado_en = now()
   where emi_negocio = v_negocio;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function comun_comercio.com_fn_cambiar_ambiente_sri(text, int) from public, anon;
grant execute on function comun_comercio.com_fn_cambiar_ambiente_sri(text, int) to authenticated, service_role;

create or replace function comun_comercio.com_fn_registrar_certificado_sri(
  p_negocio text,
  p_p12_base64 text,
  p_clave_p12 text,
  p_metadatos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(p_negocio);
  v_usuario uuid := auth.uid();
  v_huella text := upper(btrim(coalesce(p_metadatos ->> 'huella_sha1', '')));
  v_valido_desde timestamptz := (p_metadatos ->> 'valido_desde')::timestamptz;
  v_valido_hasta timestamptz := (p_metadatos ->> 'valido_hasta')::timestamptz;
  v_id uuid;
  v_p12_secret uuid;
  v_clave_secret uuid;
  r_ant record;
begin
  if not comun_facturacion.fac_fn_es_admin(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No autorizado para registrar certificados de firma electrónica.');
  end if;

  if v_huella !~ '^[0-9A-F]{40}$' then
    return jsonb_build_object('ok', false, 'error', 'Huella SHA-1 del certificado inválida.');
  end if;

  if v_valido_hasta <= now() then
    return jsonb_build_object('ok', false, 'error', 'El certificado .p12 se encuentra caducado.');
  end if;

  -- Desactivar certificados activos previos de este negocio (distinta huella) y purgar sus secretos en Vault
  for r_ant in
    select cer_id, cer_p12_secreto_id, cer_clave_secreto_id
    from comun_facturacion.fac_certificado
    where cer_negocio = v_negocio and cer_activo = true and cer_huella_sha1 <> v_huella
    for update
  loop
    update comun_facturacion.fac_certificado
       set cer_activo = false,
           cer_p12_secreto_id = null,
           cer_clave_secreto_id = null,
           cer_actualizado_en = now()
     where cer_id = r_ant.cer_id;

    delete from vault.secrets where id in (r_ant.cer_p12_secreto_id, r_ant.cer_clave_secreto_id);
  end loop;

  select cer_id, cer_p12_secreto_id, cer_clave_secreto_id
  into v_id, v_p12_secret, v_clave_secret
  from comun_facturacion.fac_certificado
  where cer_negocio = v_negocio and cer_huella_sha1 = v_huella
  for update;

  if v_p12_secret is null then
    v_p12_secret := vault.create_secret(
      p_p12_base64,
      'fac_p12_' || v_negocio || '_' || v_huella,
      'Certificado .p12 SRI de ' || v_negocio
    );
  else
    perform vault.update_secret(v_p12_secret, p_p12_base64);
  end if;

  if v_clave_secret is null then
    v_clave_secret := vault.create_secret(
      p_clave_p12,
      'fac_clave_' || v_negocio || '_' || v_huella,
      'Clave del .p12 SRI de ' || v_negocio
    );
  else
    perform vault.update_secret(v_clave_secret, p_clave_p12);
  end if;

  insert into comun_facturacion.fac_certificado (
    cer_negocio, cer_titular, cer_identificacion, cer_emisor, cer_serial,
    cer_huella_sha1, cer_valido_desde, cer_valido_hasta, cer_cadena_verificada,
    cer_p12_secreto_id, cer_clave_secreto_id, cer_activo, cer_subido_por
  )
  values (
    v_negocio,
    coalesce(nullif(btrim(p_metadatos ->> 'titular'), ''), 'Titular Firma Electrónica'),
    nullif(btrim(coalesce(p_metadatos ->> 'identificacion', '')), ''),
    coalesce(nullif(btrim(p_metadatos ->> 'emisor_ca'), ''), 'Entidad Certificadora EC'),
    coalesce(nullif(btrim(p_metadatos ->> 'numero_serie'), ''), 'SN'),
    v_huella,
    v_valido_desde,
    v_valido_hasta,
    true,
    v_p12_secret,
    v_clave_secret,
    true,
    v_usuario
  )
  on conflict (cer_negocio, cer_huella_sha1) do update set
    cer_p12_secreto_id = excluded.cer_p12_secreto_id,
    cer_clave_secreto_id = excluded.cer_clave_secreto_id,
    cer_activo = true,
    cer_subido_por = excluded.cer_subido_por,
    cer_actualizado_en = now()
  returning cer_id into v_id;

  update comun_facturacion.fac_emisor
     set emi_certificado_id = v_id,
         emi_actualizado_en = now()
   where emi_negocio = v_negocio;

  return jsonb_build_object('ok', true, 'certificado_id', v_id);
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

revoke execute on function comun_comercio.com_fn_registrar_certificado_sri(text, text, text, jsonb) from public, anon;
grant execute on function comun_comercio.com_fn_registrar_certificado_sri(text, text, text, jsonb) to authenticated, service_role;

create or replace function comun_comercio.com_fn_desactivar_certificado_sri(
  p_negocio text,
  p_certificado_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(p_negocio);
  v_cer comun_facturacion.fac_certificado%rowtype;
begin
  if not comun_facturacion.fac_fn_es_admin(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No autorizado para revocar certificados SRI.');
  end if;

  select * into v_cer
  from comun_facturacion.fac_certificado
  where cer_id = p_certificado_id and cer_negocio = v_negocio
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Certificado no encontrado.');
  end if;

  update comun_facturacion.fac_emisor
     set emi_certificado_id = null,
         emi_ambiente = 1,
         emi_actualizado_en = now()
   where emi_negocio = v_negocio and emi_certificado_id = p_certificado_id;

  update comun_facturacion.fac_certificado
     set cer_activo = false,
         cer_p12_secreto_id = null,
         cer_clave_secreto_id = null,
         cer_actualizado_en = now()
   where cer_id = p_certificado_id;

  delete from vault.secrets where id in (v_cer.cer_p12_secreto_id, v_cer.cer_clave_secreto_id);

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function comun_comercio.com_fn_desactivar_certificado_sri(text, uuid) from public, anon;
grant execute on function comun_comercio.com_fn_desactivar_certificado_sri(text, uuid) to authenticated, service_role;

-- ==============================================================================
-- SECCIÓN F: REGISTRO Y PRE-CONFIGURACIÓN POR DEFECTO DE WIDGETS EN LOS 4 NEGOCIOS
--            (Regla 15 de AGENTS.md — widget-registration-enforcer)
-- ==============================================================================
insert into comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget)
values
  ('tranqi',     'configuracion_facturacion_sri', 'Parámetros de Facturación Electrónica SRI', true, '{"descripcion": "Configuración del emisor tributario (RUC, régimen RIMPE/General, serie 001-001, secuenciales, ambiente CELCER/CEL y firma electrónica .p12 en Vault)", "categoria": "Configuración", "ruta": "/panel/configuracion?widget=configuracion_facturacion_sri", "panel_defecto": "panel_configuracion", "icono": "FileCheck2"}'::jsonb),
  ('fastfix',    'configuracion_facturacion_sri', 'Parámetros de Facturación Electrónica SRI', true, '{"descripcion": "Configuración del emisor tributario (RUC, régimen RIMPE/General, serie 001-001, secuenciales, ambiente CELCER/CEL y firma electrónica .p12 en Vault)", "categoria": "Configuración", "ruta": "/panel/facturacion-sri", "panel_defecto": "panel_configuracion", "icono": "FileCheck2"}'::jsonb),
  ('tinkay',     'configuracion_facturacion_sri', 'Parámetros de Facturación Electrónica SRI', true, '{"descripcion": "Configuración del emisor tributario (RUC, régimen RIMPE/General, serie 001-001, secuenciales, ambiente CELCER/CEL y firma electrónica .p12 en Vault)", "categoria": "Configuración", "ruta": "/panel/facturacion-sri", "panel_defecto": "panel_configuracion", "icono": "FileCheck2"}'::jsonb),
  ('margaritas', 'configuracion_facturacion_sri', 'Parámetros de Facturación Electrónica SRI', true, '{"descripcion": "Configuración del emisor tributario (RUC, régimen RIMPE/General, serie 001-001, secuenciales, ambiente CELCER/CEL y firma electrónica .p12 en Vault)", "categoria": "Configuración", "ruta": "/panel/facturacion-sri", "panel_defecto": "panel_configuracion", "icono": "FileCheck2"}'::jsonb),

  ('tranqi',     'facturacion_electronica',       'Facturación Electrónica & Comprobantes SRI', true, '{"descripcion": "Emisión automática con tarjeta PLUX, liquidación de transferencias/pagos manuales y descarga de RIDE PDF", "categoria": "Comercio y Pagos", "ruta": "/panel/herramientas?widget=facturacion_electronica", "panel_defecto": "panel_herramientas", "icono": "Receipt"}'::jsonb),
  ('fastfix',    'facturacion_electronica',       'Facturación Electrónica & Comprobantes SRI', true, '{"descripcion": "Emisión automática con tarjeta PLUX, liquidación de transferencias/pagos manuales y descarga de RIDE PDF", "categoria": "Comercio y Pagos", "ruta": "/panel/facturacion", "panel_defecto": "panel_herramientas", "icono": "Receipt"}'::jsonb),
  ('tinkay',     'facturacion_electronica',       'Facturación Electrónica & Comprobantes SRI', true, '{"descripcion": "Emisión automática con tarjeta PLUX, liquidación de transferencias/pagos manuales y descarga de RIDE PDF", "categoria": "Comercio y Pagos", "ruta": "/panel/facturacion", "panel_defecto": "panel_herramientas", "icono": "Receipt"}'::jsonb),
  ('margaritas', 'facturacion_electronica',       'Facturación Electrónica & Comprobantes SRI', true, '{"descripcion": "Emisión automática con tarjeta PLUX, liquidación de transferencias/pagos manuales y descarga de RIDE PDF", "categoria": "Comercio y Pagos", "ruta": "/panel/facturacion", "panel_defecto": "panel_herramientas", "icono": "Receipt"}'::jsonb),

  ('tranqi',     'historial_pagos',               'Historial de Transacciones & Pagos',         true, '{"descripcion": "Consulta de pagos realizados, estado de liquidación y descarga de factura electrónica SRI", "categoria": "Comercio y Pagos", "ruta": "/panel/cuenta?widget=historial_pagos", "panel_defecto": "panel_cuenta", "icono": "CreditCard"}'::jsonb),
  ('fastfix',    'historial_pagos',               'Historial de Transacciones & Pagos',         true, '{"descripcion": "Consulta de pagos realizados, estado de liquidación y descarga de factura electrónica SRI", "categoria": "Comercio y Pagos", "ruta": "/panel/cuenta", "panel_defecto": "panel_cuenta", "icono": "CreditCard"}'::jsonb),
  ('tinkay',     'historial_pagos',               'Historial de Transacciones & Pagos',         true, '{"descripcion": "Consulta de pagos realizados, estado de liquidación y descarga de factura electrónica SRI", "categoria": "Comercio y Pagos", "ruta": "/panel/cuenta", "panel_defecto": "panel_cuenta", "icono": "CreditCard"}'::jsonb),
  ('margaritas', 'historial_pagos',               'Historial de Transacciones & Pagos',         true, '{"descripcion": "Consulta de pagos realizados, estado de liquidación y descarga de factura electrónica SRI", "categoria": "Comercio y Pagos", "ruta": "/panel/cuenta", "panel_defecto": "panel_cuenta", "icono": "CreditCard"}'::jsonb),

  ('tranqi',     'pasarela_payphone',             'Pasarela de Pagos (PLUX / Payphone)',        true, '{"descripcion": "Credenciales independientes de cobro con tarjeta (PLUX y Payphone), ambiente y webhook por negocio", "categoria": "Configuración", "ruta": "/panel/configuracion?widget=pasarela_payphone", "panel_defecto": "panel_configuracion", "icono": "CreditCard"}'::jsonb),
  ('fastfix',    'pasarela_payphone',             'Pasarela de Pagos (PLUX / Payphone)',        true, '{"descripcion": "Credenciales independientes de cobro con tarjeta (PLUX y Payphone), ambiente y webhook por negocio", "categoria": "Configuración", "ruta": "/panel/pasarelas", "panel_defecto": "panel_configuracion", "icono": "CreditCard"}'::jsonb),
  ('tinkay',     'pasarela_payphone',             'Pasarela de Pagos (PLUX / Payphone)',        true, '{"descripcion": "Credenciales independientes de cobro con tarjeta (PLUX y Payphone), ambiente y webhook por negocio", "categoria": "Configuración", "ruta": "/panel/pasarelas", "panel_defecto": "panel_configuracion", "icono": "CreditCard"}'::jsonb),
  ('margaritas', 'pasarela_payphone',             'Pasarela de Pagos (PLUX / Payphone)',        true, '{"descripcion": "Credenciales independientes de cobro con tarjeta (PLUX y Payphone), ambiente y webhook por negocio", "categoria": "Configuración", "ruta": "/panel/pasarelas", "panel_defecto": "panel_configuracion", "icono": "CreditCard"}'::jsonb)
on conflict (wdg_negocio, wdg_clave) do update set
  wdg_nombre = excluded.wdg_nombre,
  wdg_activo = true,
  wdg_detalle_widget = excluded.wdg_detalle_widget,
  wdg_actualizado_en = now();

-- Asignar configuracion_facturacion_sri y pasarela_payphone a ADMINISTRADOR y SUPERADMIN
insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
select w.wdg_negocio, r.rol, w.wdg_id, true
from comun_seguridad.seg_widget w
cross join (values ('ADMINISTRADOR'), ('SUPERADMIN')) as r(rol)
where w.wdg_clave in ('configuracion_facturacion_sri', 'pasarela_payphone')
on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set
  rlw_visible = true,
  rlw_actualizado_en = now();

-- Asignar facturacion_electronica e historial_pagos a roles operativos y clientes
insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
select w.wdg_negocio, r.rol, w.wdg_id, true
from comun_seguridad.seg_widget w
cross join (values ('CLIENTE'), ('VENDEDOR'), ('VENTAS'), ('ABOGADO'), ('OPERADOR'), ('ADMINISTRADOR'), ('SUPERADMIN')) as r(rol)
where w.wdg_clave in ('facturacion_electronica', 'historial_pagos')
on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set
  rlw_visible = true,
  rlw_actualizado_en = now();
