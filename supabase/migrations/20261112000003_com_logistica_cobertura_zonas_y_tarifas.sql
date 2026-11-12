-- ==============================================================================
-- MIGRACIÓN: Motor de Logística, Zonas de Cobertura en Pichincha y Tarifación
--            por Zona / Kilómetro (PLT-008 / PLT-009 / TNK-002 / TNK-005)
-- ==============================================================================
-- Cumple reglas no negociables de gobernanza:
--   1. RLS habilitado al 100% en tablas nuevas.
--   2. Trigger comun_auditoria.aud_fn_auditar_tabla() en ambas tablas.
--   3. Nomenclatura de 3 letras: log_ (com_logistica_negocio), zon_ (com_zona_cobertura).
--   4. Escritura transaccional mediante RPC SECURITY DEFINER validando admin/superadmin.
--   5. Pre-configuración automática del widget común `configuracion_logistica` (/panel/logistica).

-- 1. Tabla de parámetros logísticos por negocio
create table if not exists comun_comercio.com_logistica_negocio (
  log_id uuid primary key default gen_random_uuid(),
  log_secuencial bigint generated always as identity,
  log_negocio text not null unique,
  log_activo boolean not null default true,
  log_origen_nombre text not null default 'Taller Matriz',
  log_origen_direccion text,
  log_origen_mapa_url text,
  log_origen_lat numeric(10,7) not null default -0.1648075,
  log_origen_lng numeric(10,7) not null default -78.4661750,
  log_zona_gratis_nombre text not null default 'Centro-Norte de Quito',
  log_etiqueta_envio_gratis text not null default '🌸 Envío Gratis en Centro-Norte de Quito',
  log_tarifa_por_km numeric(12,2) not null default 0.50,
  log_subsidio_base_usd numeric(12,2) not null default 3.00,
  log_recargo_minimo_extra numeric(12,2) not null default 1.00,
  log_tarifa_base_no_incluido numeric(12,2) not null default 3.00,
  log_recargo_hora_exacta numeric(12,2) not null default 10.00,
  log_radio_maximo_km numeric(12,2) not null default 45.00,
  log_factor_vial_respaldo numeric(6,2) not null default 1.32,
  log_permitir_retiro_local boolean not null default true,
  log_detalle_logistica jsonb not null default '{}'::jsonb,
  log_creado_en timestamptz not null default now(),
  log_actualizado_en timestamptz not null default now()
);

alter table comun_comercio.com_logistica_negocio enable row level security;

drop policy if exists com_logistica_negocio_select_publico on comun_comercio.com_logistica_negocio;
create policy com_logistica_negocio_select_publico
  on comun_comercio.com_logistica_negocio
  for select
  using (true);

drop policy if exists com_logistica_negocio_escritura_admin on comun_comercio.com_logistica_negocio;
create policy com_logistica_negocio_escritura_admin
  on comun_comercio.com_logistica_negocio
  for all
  to authenticated
  using (
    comun_seguridad.seg_fn_es_admin_negocio(log_negocio)
    or comun_seguridad.seg_fn_es_admin_negocio(upper(log_negocio))
    or comun_seguridad.seg_fn_es_superadmin()
  )
  with check (
    comun_seguridad.seg_fn_es_admin_negocio(log_negocio)
    or comun_seguridad.seg_fn_es_admin_negocio(upper(log_negocio))
    or comun_seguridad.seg_fn_es_superadmin()
  );

drop trigger if exists trg_auditoria_com_logistica_negocio on comun_comercio.com_logistica_negocio;
create trigger trg_auditoria_com_logistica_negocio
  after insert or update or delete on comun_comercio.com_logistica_negocio
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

-- 2. Tabla de zonas geográficas de cobertura (polígonos y modo tarifario)
create table if not exists comun_comercio.com_zona_cobertura (
  zon_id uuid primary key default gen_random_uuid(),
  zon_secuencial bigint generated always as identity,
  zon_negocio text not null,
  zon_codigo text not null,
  zon_nombre text not null,
  zon_provincia text not null default 'Pichincha',
  zon_modo_cobro text not null default 'POR_KM'
    check (zon_modo_cobro in ('GRATIS', 'TARIFA_FIJA', 'POR_KM')),
  zon_tarifa_fija numeric(12,2) not null default 0.00,
  zon_prioridad integer not null default 10,
  zon_activo boolean not null default true,
  zon_poligono jsonb not null default '[]'::jsonb,
  zon_detalle_zona jsonb not null default '{}'::jsonb,
  zon_creado_en timestamptz not null default now(),
  zon_actualizado_en timestamptz not null default now(),
  zon_eliminado_en timestamptz,
  constraint uq_com_zona_negocio_codigo unique (zon_negocio, zon_codigo)
);

create index if not exists idx_com_zona_cobertura_negocio
  on comun_comercio.com_zona_cobertura (zon_negocio, zon_activo, zon_prioridad);

alter table comun_comercio.com_zona_cobertura enable row level security;

drop policy if exists com_zona_cobertura_select_publico on comun_comercio.com_zona_cobertura;
create policy com_zona_cobertura_select_publico
  on comun_comercio.com_zona_cobertura
  for select
  using (zon_eliminado_en is null);

drop policy if exists com_zona_cobertura_escritura_admin on comun_comercio.com_zona_cobertura;
create policy com_zona_cobertura_escritura_admin
  on comun_comercio.com_zona_cobertura
  for all
  to authenticated
  using (
    comun_seguridad.seg_fn_es_admin_negocio(zon_negocio)
    or comun_seguridad.seg_fn_es_admin_negocio(upper(zon_negocio))
    or comun_seguridad.seg_fn_es_superadmin()
  )
  with check (
    comun_seguridad.seg_fn_es_admin_negocio(zon_negocio)
    or comun_seguridad.seg_fn_es_admin_negocio(upper(zon_negocio))
    or comun_seguridad.seg_fn_es_superadmin()
  );

drop trigger if exists trg_auditoria_com_zona_cobertura on comun_comercio.com_zona_cobertura;
create trigger trg_auditoria_com_zona_cobertura
  after insert or update or delete on comun_comercio.com_zona_cobertura
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant usage on schema comun_comercio to anon, authenticated, service_role;
grant select on comun_comercio.com_logistica_negocio to anon, authenticated, service_role;
grant select on comun_comercio.com_zona_cobertura to anon, authenticated, service_role;
grant insert, update on comun_comercio.com_logistica_negocio to authenticated, service_role;
grant insert, update on comun_comercio.com_zona_cobertura to authenticated, service_role;

-- 3. RPC transaccional de guardado de política logística y zonas
create or replace function comun_comercio.com_fn_guardar_logistica_negocio(
  p_negocio text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := lower(trim(coalesce(p_negocio, '')));
  v_zona jsonb;
  v_codigos_recibidos text[] := array[]::text[];
  v_codigo text;
  v_modo text;
begin
  if v_negocio = '' then
    raise exception 'Identificador de negocio inválido';
  end if;

  if not (
    comun_seguridad.seg_fn_es_admin_negocio(v_negocio)
    or comun_seguridad.seg_fn_es_admin_negocio(upper(v_negocio))
    or comun_seguridad.seg_fn_es_superadmin()
  ) then
    raise exception 'No autorizado para modificar la logística de este negocio';
  end if;

  insert into comun_comercio.com_logistica_negocio as l (
    log_negocio,
    log_activo,
    log_origen_nombre,
    log_origen_direccion,
    log_origen_mapa_url,
    log_origen_lat,
    log_origen_lng,
    log_zona_gratis_nombre,
    log_etiqueta_envio_gratis,
    log_tarifa_por_km,
    log_subsidio_base_usd,
    log_recargo_minimo_extra,
    log_tarifa_base_no_incluido,
    log_recargo_hora_exacta,
    log_radio_maximo_km,
    log_factor_vial_respaldo,
    log_permitir_retiro_local,
    log_actualizado_en
  )
  values (
    v_negocio,
    coalesce((p_payload->>'activo')::boolean, true),
    coalesce(nullif(trim(p_payload->>'origenNombre'), ''), 'Taller Matriz'),
    nullif(trim(p_payload->>'origenDireccion'), ''),
    nullif(trim(p_payload->>'origenMapaUrl'), ''),
    coalesce((p_payload->>'origenLat')::numeric(10,7), -0.1648075),
    coalesce((p_payload->>'origenLng')::numeric(10,7), -78.4661750),
    coalesce(nullif(trim(p_payload->>'zonaGratisNombre'), ''), 'Centro-Norte de Quito'),
    coalesce(nullif(trim(p_payload->>'etiquetaEnvioGratis'), ''), '🌸 Envío Gratis en Centro-Norte de Quito'),
    greatest(0, coalesce((p_payload->>'tarifaPorKm')::numeric(12,2), 0.50)),
    greatest(0, coalesce((p_payload->>'subsidioBaseUsd')::numeric(12,2), 3.00)),
    greatest(0, coalesce((p_payload->>'recargoMinimoExtra')::numeric(12,2), 1.00)),
    greatest(0, coalesce((p_payload->>'tarifaBaseNoIncluido')::numeric(12,2), 3.00)),
    greatest(0, coalesce((p_payload->>'recargoHoraExacta')::numeric(12,2), 10.00)),
    greatest(1, coalesce((p_payload->>'radioMaximoKm')::numeric(12,2), 45.00)),
    greatest(1, coalesce((p_payload->>'factorVialRespaldo')::numeric(6,2), 1.32)),
    coalesce((p_payload->>'permitirRetiroLocal')::boolean, true),
    now()
  )
  on conflict (log_negocio) do update set
    log_activo = excluded.log_activo,
    log_origen_nombre = excluded.log_origen_nombre,
    log_origen_direccion = excluded.log_origen_direccion,
    log_origen_mapa_url = excluded.log_origen_mapa_url,
    log_origen_lat = excluded.log_origen_lat,
    log_origen_lng = excluded.log_origen_lng,
    log_zona_gratis_nombre = excluded.log_zona_gratis_nombre,
    log_etiqueta_envio_gratis = excluded.log_etiqueta_envio_gratis,
    log_tarifa_por_km = excluded.log_tarifa_por_km,
    log_subsidio_base_usd = excluded.log_subsidio_base_usd,
    log_recargo_minimo_extra = excluded.log_recargo_minimo_extra,
    log_tarifa_base_no_incluido = excluded.log_tarifa_base_no_incluido,
    log_recargo_hora_exacta = excluded.log_recargo_hora_exacta,
    log_radio_maximo_km = excluded.log_radio_maximo_km,
    log_factor_vial_respaldo = excluded.log_factor_vial_respaldo,
    log_permitir_retiro_local = excluded.log_permitir_retiro_local,
    log_actualizado_en = now();

  if jsonb_typeof(p_payload->'zonas') = 'array' then
    for v_zona in select * from jsonb_array_elements(p_payload->'zonas') loop
      v_codigo := lower(regexp_replace(coalesce(nullif(trim(v_zona->>'codigo'), ''), trim(v_zona->>'nombre'), 'zona'), '[^a-zA-Z0-9_]+', '_', 'g'));
      v_modo := upper(coalesce(v_zona->>'modoCobro', 'POR_KM'));
      if v_modo not in ('GRATIS', 'TARIFA_FIJA', 'POR_KM') then
        v_modo := 'POR_KM';
      end if;

      v_codigos_recibidos := array_append(v_codigos_recibidos, v_codigo);

      insert into comun_comercio.com_zona_cobertura (
        zon_negocio,
        zon_codigo,
        zon_nombre,
        zon_provincia,
        zon_modo_cobro,
        zon_tarifa_fija,
        zon_prioridad,
        zon_activo,
        zon_poligono,
        zon_detalle_zona,
        zon_actualizado_en,
        zon_eliminado_en
      )
      values (
        v_negocio,
        v_codigo,
        coalesce(nullif(trim(v_zona->>'nombre'), ''), initcap(replace(v_codigo, '_', ' '))),
        coalesce(nullif(trim(v_zona->>'provincia'), ''), 'Pichincha'),
        v_modo,
        greatest(0, coalesce((v_zona->>'tarifaFija')::numeric(12,2), 0.00)),
        coalesce((v_zona->>'prioridad')::integer, 10),
        coalesce((v_zona->>'activo')::boolean, true),
        coalesce(v_zona->'poligono', '[]'::jsonb),
        jsonb_build_object(
          'color', coalesce(v_zona->>'color', '#0284C7'),
          'sectores_referencia', coalesce(v_zona->'sectoresReferencia', '[]'::jsonb)
        ),
        now(),
        null
      )
      on conflict (zon_negocio, zon_codigo) do update set
        zon_nombre = excluded.zon_nombre,
        zon_provincia = excluded.zon_provincia,
        zon_modo_cobro = excluded.zon_modo_cobro,
        zon_tarifa_fija = excluded.zon_tarifa_fija,
        zon_prioridad = excluded.zon_prioridad,
        zon_activo = excluded.zon_activo,
        zon_poligono = excluded.zon_poligono,
        zon_detalle_zona = excluded.zon_detalle_zona,
        zon_actualizado_en = now(),
        zon_eliminado_en = null;
    end loop;

    -- Borrado lógico de zonas retiradas por el administrador
    update comun_comercio.com_zona_cobertura
    set zon_eliminado_en = now(),
        zon_activo = false,
        zon_actualizado_en = now()
    where zon_negocio = v_negocio
      and zon_eliminado_en is null
      and not (zon_codigo = any(v_codigos_recibidos));
  end if;

  -- Espejo sincronizado en cfg_negocio para lectura unificada instantánea
  insert into comun_configuracion.cfg_negocio (cfg_negocio, cfg_nombre_comercial, cfg_detalle_configuracion)
  values (v_negocio, initcap(v_negocio), jsonb_build_object('logistica', p_payload))
  on conflict (cfg_negocio) do update set
    cfg_detalle_configuracion = coalesce(comun_configuracion.cfg_negocio.cfg_detalle_configuracion, '{}'::jsonb)
      || jsonb_build_object('logistica', p_payload),
    cfg_actualizado_en = now();

  return jsonb_build_object('ok', true, 'negocio', v_negocio);
end;
$$;

revoke execute on function comun_comercio.com_fn_guardar_logistica_negocio(text, jsonb) from public, anon;
grant execute on function comun_comercio.com_fn_guardar_logistica_negocio(text, jsonb) to authenticated, service_role;

-- 4. Semillas iniciales para Tinkay y registro del widget `configuracion_logistica`
do $$
declare
  v_negocio text;
begin
  insert into comun_comercio.com_logistica_negocio (
    log_negocio,
    log_origen_nombre,
    log_origen_direccion,
    log_origen_mapa_url,
    log_origen_lat,
    log_origen_lng,
    log_zona_gratis_nombre,
    log_etiqueta_envio_gratis,
    log_tarifa_por_km,
    log_subsidio_base_usd,
    log_recargo_minimo_extra,
    log_tarifa_base_no_incluido,
    log_recargo_hora_exacta,
    log_radio_maximo_km,
    log_permitir_retiro_local
  )
  values (
    'tinkay',
    'Taller Tinkay Floristería',
    'El Batán Alto / Monteserrín, Quito, Pichincha',
    'https://maps.app.goo.gl/D56gQohzuwha4sLf8',
    -0.1648075,
    -78.4661750,
    'Centro-Norte de Quito',
    '🌸 Envío Gratis en Centro-Norte de Quito',
    0.50,
    3.00,
    1.00,
    3.00,
    10.00,
    45.00,
    true
  )
  on conflict (log_negocio) do nothing;

  insert into comun_comercio.com_zona_cobertura (
    zon_negocio, zon_codigo, zon_nombre, zon_provincia, zon_modo_cobro, zon_tarifa_fija, zon_prioridad, zon_activo, zon_poligono, zon_detalle_zona
  )
  values
    (
      'tinkay',
      'centro_norte_quito',
      'Centro-Norte de Quito',
      'Pichincha',
      'GRATIS',
      0.00,
      1,
      true,
      '[[-0.222,-78.52],[-0.225,-78.492],[-0.203,-78.472],[-0.168,-78.455],[-0.135,-78.453],[-0.095,-78.462],[-0.096,-78.503],[-0.145,-78.506],[-0.188,-78.514]]'::jsonb,
      '{"color":"#16A34A","sectores_referencia":["La Carolina","González Suárez","Iñaquito","La Mariscal","Centro Histórico","El Bosque","El Inca","Ponceano"]}'::jsonb
    ),
    (
      'tinkay',
      'cumbaya_nayon',
      'Cumbayá, Nayón y Lumbisí',
      'Pichincha',
      'TARIFA_FIJA',
      3.50,
      2,
      true,
      '[[-0.235,-78.454],[-0.235,-78.405],[-0.145,-78.405],[-0.145,-78.453],[-0.168,-78.455],[-0.203,-78.471]]'::jsonb,
      '{"color":"#0284C7","sectores_referencia":["Parque Cumbayá","USFQ","Nayón","Tanda","Lumbisí"]}'::jsonb
    ),
    (
      'tinkay',
      'tumbaco_puembo',
      'Tumbaco, Puembo y Ruta Viva',
      'Pichincha',
      'TARIFA_FIJA',
      6.00,
      3,
      true,
      '[[-0.255,-78.405],[-0.255,-78.32],[-0.15,-78.32],[-0.15,-78.405]]'::jsonb,
      '{"color":"#4F46E5","sectores_referencia":["Tumbaco Centro","La Morita","Hilacril","Puembo"]}'::jsonb
    ),
    (
      'tinkay',
      'valle_los_chillos',
      'Valle de los Chillos (Conocoto, San Rafael, Sangolquí)',
      'Pichincha',
      'TARIFA_FIJA',
      6.00,
      4,
      true,
      '[[-0.37,-78.49],[-0.37,-78.41],[-0.245,-78.41],[-0.245,-78.49]]'::jsonb,
      '{"color":"#7C3AED","sectores_referencia":["Conocoto","La Armenia","San Rafael","Capelo","Sangolquí"]}'::jsonb
    ),
    (
      'tinkay',
      'sur_quito',
      'Sur de Quito',
      'Pichincha',
      'POR_KM',
      4.00,
      5,
      true,
      '[[-0.355,-78.58],[-0.355,-78.49],[-0.225,-78.492],[-0.222,-78.52],[-0.24,-78.565]]'::jsonb,
      '{"color":"#D97706","sectores_referencia":["Villaflora","El Recreo","Solanda","Quitumbe","Chillogallo"]}'::jsonb
    ),
    (
      'tinkay',
      'calderon_carapungo',
      'Calderón y Carapungo',
      'Pichincha',
      'POR_KM',
      4.00,
      6,
      true,
      '[[-0.134,-78.462],[-0.134,-78.395],[-0.04,-78.395],[-0.04,-78.462]]'::jsonb,
      '{"color":"#EA580C","sectores_referencia":["Carapungo","Calderón Centro","Marianitas","Llano Grande"]}'::jsonb
    ),
    (
      'tinkay',
      'pomasqui_mitad_mundo',
      'Pomasqui y Mitad del Mundo',
      'Pichincha',
      'POR_KM',
      5.00,
      7,
      true,
      '[[-0.095,-78.503],[-0.095,-78.435],[0.025,-78.435],[0.025,-78.503]]'::jsonb,
      '{"color":"#0D9488","sectores_referencia":["Pomasqui","San Antonio","Ciudad Mitad del Mundo"]}'::jsonb
    )
  on conflict (zon_negocio, zon_codigo) do nothing;

  foreach v_negocio in array array['tranqi', 'TRANQ', 'fastfix', 'FFH', 'tinkay', 'TNK', 'margaritas', 'MRG'] loop
    insert into comun_seguridad.seg_widget (
      wdg_negocio,
      wdg_clave,
      wdg_nombre,
      wdg_activo,
      wdg_detalle_widget,
      wdg_creado_en
    )
    values (
      v_negocio,
      'configuracion_logistica',
      'Logística, Zonas y Envíos',
      true,
      jsonb_build_object(
        'descripcion', 'Zonas de cobertura en Pichincha, polígono de envío gratis, tarifa por km adicional y simulador GPS.',
        'categoria', 'Configuración',
        'ruta', '/panel/logistica',
        'panel_defecto', 'panel_configuracion',
        'icono', 'Truck'
      ),
      now()
    )
    on conflict (wdg_negocio, wdg_clave) do update set
      wdg_nombre = excluded.wdg_nombre,
      wdg_activo = true,
      wdg_detalle_widget = excluded.wdg_detalle_widget,
      wdg_actualizado_en = now();

    insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
    select v_negocio, r.rol, w.wdg_id, true
    from comun_seguridad.seg_widget w
    cross join (values ('ADMINISTRADOR'), ('SUPERADMIN')) as r(rol)
    where w.wdg_negocio = v_negocio
      and w.wdg_clave = 'configuracion_logistica'
    on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set rlw_visible = true;
  end loop;
end $$;

