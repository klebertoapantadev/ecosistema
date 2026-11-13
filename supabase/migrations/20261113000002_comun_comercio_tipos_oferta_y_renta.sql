-- ==============================================================================
-- Migración: 20261113000002_comun_comercio_tipos_oferta_y_renta.sql
-- Módulo: comun_comercio (Catálogo Comercial Unificado - PLT-009 / ADR-0003)
-- Propósito:
--   1. Crear el catálogo administrable por negocio `comun_comercio.com_tipo_oferta`
--      (prefijo `tof_`) con RLS al 100% y trigger `aud_fn_auditar_tabla()`.
--   2. Sembrar por defecto los tipos de oferta oficiales por negocio, incorporando
--      `RENTA` ("Renta de Mobiliario / Alquiler para Eventos") con condiciones de
--      alquiler y devolución.
--   3. Proveer RPCs transaccionales con validación de integridad anti-orfandad:
--      - `com_fn_obtener_tipos_oferta_con_uso(p_negocio)`
--      - `com_fn_guardar_tipo_oferta(p_datos)`
--      - `com_fn_eliminar_tipo_oferta(p_negocio, p_identificador)`
-- ==============================================================================

-- 1. Tabla de Tipos de Oferta Comercial por Negocio
create table if not exists comun_comercio.com_tipo_oferta (
  tof_id uuid primary key default gen_random_uuid(),
  tof_secuencial bigint generated always as identity,
  tof_negocio text not null,
  tof_codigo text not null,
  tof_nombre text not null,
  tof_descripcion text,
  tof_orden integer not null default 1,
  tof_es_sistema boolean not null default false,
  tof_activo boolean not null default true,
  tof_detalle_tipo_oferta jsonb not null default '{}'::jsonb,
  tof_creado_en timestamptz not null default now(),
  tof_actualizado_en timestamptz not null default now(),
  unique(tof_negocio, tof_codigo)
);

create index if not exists idx_com_tof_negocio
  on comun_comercio.com_tipo_oferta(tof_negocio, tof_activo, tof_orden);

-- 2. Seguridad por fila (RLS obligatorio al 100%)
alter table comun_comercio.com_tipo_oferta enable row level security;

drop policy if exists com_tipo_oferta_lectura_publica on comun_comercio.com_tipo_oferta;
create policy com_tipo_oferta_lectura_publica
  on comun_comercio.com_tipo_oferta
  for select
  using (true);

drop policy if exists com_tipo_oferta_staff on comun_comercio.com_tipo_oferta;
create policy com_tipo_oferta_staff
  on comun_comercio.com_tipo_oferta
  for all
  using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(tof_negocio))
  with check (comun_seguridad.seg_fn_es_operador_o_admin_negocio(tof_negocio));

-- 3. Trigger de auditoría obligatorio
drop trigger if exists trg_auditoria_com_tipo_oferta on comun_comercio.com_tipo_oferta;
create trigger trg_auditoria_com_tipo_oferta
  after insert or update or delete on comun_comercio.com_tipo_oferta
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

-- 4. Permisos sobre tabla y secuencia
grant select on comun_comercio.com_tipo_oferta to anon, authenticated, service_role;
grant insert, update, delete on comun_comercio.com_tipo_oferta to authenticated, service_role;
grant usage, select on sequence comun_comercio.com_tipo_oferta_tof_secuencial_seq to authenticated, service_role;

-- 5. Semilla idempotente de Tipos de Oferta por Negocio (incluye RENTA de mobiliario)
insert into comun_comercio.com_tipo_oferta (
  tof_negocio, tof_codigo, tof_nombre, tof_descripcion, tof_orden, tof_es_sistema, tof_activo, tof_detalle_tipo_oferta
)
values
  -- Tinkay Floristería & Eventos
  ('tinkay', 'FISICO', 'Producto Físico / Entrega Floral a Domicilio', 'Arreglos florales, cajas y regalos entregados en propiedad al destinatario.', 1, true, true, '{"es_renta": false, "etiqueta_corta": "Entrega Floral", "icono": "🌸"}'::jsonb),
  ('tinkay', 'SERVICIO', 'Servicio de Decoración / Eventos', 'Montaje floral, ambientación y servicios profesionales para eventos y ceremonias.', 2, true, true, '{"es_renta": false, "etiqueta_corta": "Servicio Eventos", "icono": "✨"}'::jsonb),
  ('tinkay', 'RENTA', 'Renta de Mobiliario / Alquiler para Eventos', 'Alquiler temporal de pedestales, arcos, backings, bases y mobiliario para eventos con retiro posterior.', 3, true, true, '{"es_renta": true, "etiqueta_corta": "🪑 En Renta", "icono": "🪑", "periodo_defecto": "Por evento (24h)", "incluye_retiro_defecto": true, "nota_condiciones_defecto": "Mobiliario en calidad de renta para el evento. Coordinamos entrega y retiro al finalizar."}'::jsonb),
  ('tinkay', 'SUSCRIPCION', 'Suscripción Floral (Semanal / Mensual)', 'Plan recurrente de entregas florales periódicas para hogares u oficinas.', 4, true, true, '{"es_renta": false, "etiqueta_corta": "Suscripción", "icono": "🔄"}'::jsonb),
  ('tinkay', 'DIGITAL', 'Tarjeta Dedicatoria Digital / Gift Card', 'Bono de regalo o tarjeta digital entregada por medios electrónicos.', 5, true, true, '{"es_renta": false, "etiqueta_corta": "Digital", "icono": "💌"}'::jsonb),

  -- Margaritas Floristería
  ('margaritas', 'FISICO', 'Producto Físico / Entrega Floral a Domicilio', 'Arreglos florales y detalles entregados a domicilio.', 1, true, true, '{"es_renta": false, "etiqueta_corta": "Entrega Floral", "icono": "🌼"}'::jsonb),
  ('margaritas', 'SERVICIO', 'Servicio de Decoración / Eventos', 'Ambientación floral y montaje de eventos.', 2, true, true, '{"es_renta": false, "etiqueta_corta": "Servicio Eventos", "icono": "✨"}'::jsonb),
  ('margaritas', 'RENTA', 'Renta de Mobiliario / Alquiler para Eventos', 'Alquiler temporal de bases, estructuras y mobiliario decorativo con retiro posterior.', 3, true, true, '{"es_renta": true, "etiqueta_corta": "🪑 En Renta", "icono": "🪑", "periodo_defecto": "Por evento (24h)", "incluye_retiro_defecto": true}'::jsonb),
  ('margaritas', 'SUSCRIPCION', 'Suscripción Floral (Semanal / Mensual)', 'Plan recurrente de flores frescas.', 4, true, true, '{"es_renta": false, "etiqueta_corta": "Suscripción", "icono": "🔄"}'::jsonb),
  ('margaritas', 'DIGITAL', 'Tarjeta Dedicatoria Digital / Gift Card', 'Gift card o detalle digital.', 5, true, true, '{"es_renta": false, "etiqueta_corta": "Digital", "icono": "💌"}'::jsonb),

  -- FastFix Home
  ('fastfix', 'SERVICIO', 'Servicio Técnico / Reparación', 'Intervención técnica a domicilio con respaldo garantizado.', 1, true, true, '{"es_renta": false, "etiqueta_corta": "Servicio Técnico", "icono": "🛠️"}'::jsonb),
  ('fastfix', 'FISICO', 'Producto Físico / Repuesto', 'Suministro o repuesto físico instalable.', 2, true, true, '{"es_renta": false, "etiqueta_corta": "Repuesto", "icono": "📦"}'::jsonb),
  ('fastfix', 'RENTA', 'Alquiler de Herramienta / Equipo', 'Renta temporal de maquinaria o equipamiento técnico con devolución.', 3, true, true, '{"es_renta": true, "etiqueta_corta": "🪑 En Renta", "icono": "🧰", "periodo_defecto": "Por día (24h)", "incluye_retiro_defecto": false}'::jsonb),
  ('fastfix', 'SUSCRIPCION', 'Suscripción / Plan Periódico', 'Plan preventivo de mantenimiento residencial o corporativo.', 4, true, true, '{"es_renta": false, "etiqueta_corta": "Plan", "icono": "🛡️"}'::jsonb),
  ('fastfix', 'DIGITAL', 'Producto Digital / Informe Técnico', 'Diagnóstico o guía digital.', 5, true, true, '{"es_renta": false, "etiqueta_corta": "Digital", "icono": "📄"}'::jsonb),

  -- Tranqi Legal
  ('tranqi', 'SERVICIO', 'Servicio / Trámite Puntual', 'Patrocinio, consulta o trámite jurídico específico.', 1, true, true, '{"es_renta": false, "etiqueta_corta": "Servicio Legal", "icono": "⚖️"}'::jsonb),
  ('tranqi', 'SUSCRIPCION', 'Suscripción / Plan Periódico', 'Cobertura jurídica recurrente familiar o corporativa.', 2, true, true, '{"es_renta": false, "etiqueta_corta": "Plan Legal", "icono": "🛡️"}'::jsonb),
  ('tranqi', 'FISICO', 'Físico / Entrega Notarial', 'Gestión con entrega física de escrituras o expedientes.', 3, true, true, '{"es_renta": false, "etiqueta_corta": "Entrega Física", "icono": "🏛️"}'::jsonb),
  ('tranqi', 'DIGITAL', 'Producto Digital / Formato', ' Minuta, contrato o dictamen digital.', 4, true, true, '{"es_renta": false, "etiqueta_corta": "Digital", "icono": "📄"}'::jsonb)
on conflict (tof_negocio, tof_codigo) do nothing;

-- 6. RPC: Listar Tipos de Oferta con conteo de productos activos que los usan
create or replace function comun_comercio.com_fn_obtener_tipos_oferta_con_uso(
  p_negocio text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := lower(trim(coalesce(p_negocio, 'tinkay')));
  v_resultado jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'tof_id', t.tof_id,
        'tof_negocio', t.tof_negocio,
        'tof_codigo', t.tof_codigo,
        'tof_nombre', t.tof_nombre,
        'tof_descripcion', t.tof_descripcion,
        'tof_orden', t.tof_orden,
        'tof_es_sistema', t.tof_es_sistema,
        'tof_activo', t.tof_activo,
        'tof_detalle_tipo_oferta', coalesce(t.tof_detalle_tipo_oferta, '{}'::jsonb),
        'productos_conteo', coalesce(uso.conteo, 0),
        'en_uso', coalesce(uso.conteo, 0) > 0,
        'productos_ejemplo', coalesce(uso.ejemplos, '[]'::jsonb)
      )
      order by t.tof_orden asc, t.tof_creado_en asc
    ),
    '[]'::jsonb
  )
  into v_resultado
  from comun_comercio.com_tipo_oferta t
  left join lateral (
    select
      count(*)::int as conteo,
      coalesce(jsonb_agg(sub.pro_nombre), '[]'::jsonb) as ejemplos
    from (
      select p.pro_nombre
      from comun_comercio.com_producto p
      where lower(p.pro_negocio) = v_negocio
        and upper(trim(coalesce(p.pro_tipo, 'FISICO'))) = upper(trim(t.tof_codigo))
        and coalesce(p.pro_activo, true) = true
      order by p.pro_nombre asc
      limit 5
    ) sub
  ) uso on true
  where lower(t.tof_negocio) = v_negocio
    and t.tof_activo = true;

  return v_resultado;
end;
$$;

grant execute on function comun_comercio.com_fn_obtener_tipos_oferta_con_uso(text)
  to anon, authenticated, service_role;

create or replace function public.com_fn_obtener_tipos_oferta_con_uso(p_negocio text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select comun_comercio.com_fn_obtener_tipos_oferta_con_uso(p_negocio);
$$;

grant execute on function public.com_fn_obtener_tipos_oferta_con_uso(text)
  to anon, authenticated, service_role;

-- 7. RPC: Crear o Actualizar un Tipo de Oferta Comercial
create or replace function comun_comercio.com_fn_guardar_tipo_oferta(
  p_datos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_negocio text := lower(trim(coalesce(p_datos->>'negocio', 'tinkay')));
  v_codigo text := upper(regexp_replace(trim(coalesce(p_datos->>'codigo', '')), '[^A-Za-z0-9_]+', '_', 'g'));
  v_nombre text := trim(coalesce(p_datos->>'nombre', ''));
  v_descripcion text := nullif(trim(coalesce(p_datos->>'descripcion', '')), '');
  v_orden integer := coalesce((p_datos->>'orden')::integer, 10);
  v_detalle jsonb := coalesce(p_datos->'detalle', '{}'::jsonb);
  v_fila comun_comercio.com_tipo_oferta%rowtype;
begin
  if v_nombre = '' then
    return jsonb_build_object('ok', false, 'error', 'El nombre del tipo de oferta es obligatorio.');
  end if;

  if v_codigo = '' then
    v_codigo := upper(regexp_replace(v_nombre, '[^A-Za-z0-9]+', '_', 'g'));
    v_codigo := trim(both '_' from substring(v_codigo from 1 for 28));
  end if;

  begin
    if (p_datos->>'tof_id') is not null and length(trim(p_datos->>'tof_id')) = 36 then
      v_id := (p_datos->>'tof_id')::uuid;
    end if;
  exception when others then
    v_id := null;
  end;

  if v_id is not null then
    update comun_comercio.com_tipo_oferta
    set
      tof_nombre = v_nombre,
      tof_descripcion = v_descripcion,
      tof_orden = v_orden,
      tof_activo = true,
      tof_detalle_tipo_oferta = coalesce(tof_detalle_tipo_oferta, '{}'::jsonb) || v_detalle,
      tof_actualizado_en = now()
    where tof_id = v_id
      and lower(tof_negocio) = v_negocio
    returning * into v_fila;
  end if;

  if v_fila.tof_id is null then
    insert into comun_comercio.com_tipo_oferta (
      tof_negocio, tof_codigo, tof_nombre, tof_descripcion, tof_orden, tof_es_sistema, tof_activo, tof_detalle_tipo_oferta
    )
    values (
      v_negocio, v_codigo, v_nombre, v_descripcion, v_orden, false, true, v_detalle
    )
    on conflict (tof_negocio, tof_codigo) do update set
      tof_nombre = excluded.tof_nombre,
      tof_descripcion = coalesce(excluded.tof_descripcion, comun_comercio.com_tipo_oferta.tof_descripcion),
      tof_orden = excluded.tof_orden,
      tof_activo = true,
      tof_detalle_tipo_oferta = coalesce(comun_comercio.com_tipo_oferta.tof_detalle_tipo_oferta, '{}'::jsonb) || excluded.tof_detalle_tipo_oferta,
      tof_actualizado_en = now()
    returning * into v_fila;
  end if;

  return jsonb_build_object(
    'ok', true,
    'tipo_oferta', jsonb_build_object(
      'tof_id', v_fila.tof_id,
      'tof_negocio', v_fila.tof_negocio,
      'tof_codigo', v_fila.tof_codigo,
      'tof_nombre', v_fila.tof_nombre,
      'tof_descripcion', v_fila.tof_descripcion,
      'tof_orden', v_fila.tof_orden,
      'tof_es_sistema', v_fila.tof_es_sistema,
      'tof_activo', v_fila.tof_activo,
      'tof_detalle_tipo_oferta', v_fila.tof_detalle_tipo_oferta
    )
  );
end;
$$;

grant execute on function comun_comercio.com_fn_guardar_tipo_oferta(jsonb)
  to authenticated, service_role;

create or replace function public.com_fn_guardar_tipo_oferta(p_datos jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select comun_comercio.com_fn_guardar_tipo_oferta(p_datos);
$$;

grant execute on function public.com_fn_guardar_tipo_oferta(jsonb)
  to authenticated, service_role;

-- 8. RPC: Eliminar un Tipo de Oferta Comercial (bloqueo estricto si está en uso)
create or replace function comun_comercio.com_fn_eliminar_tipo_oferta(
  p_negocio text,
  p_identificador text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := lower(trim(coalesce(p_negocio, 'tinkay')));
  v_ident text := trim(coalesce(p_identificador, ''));
  v_fila comun_comercio.com_tipo_oferta%rowtype;
  v_conteo integer := 0;
  v_ejemplos jsonb := '[]'::jsonb;
begin
  if v_ident = '' then
    return jsonb_build_object('ok', false, 'error', 'Identificador de tipo de oferta requerido.');
  end if;

  select *
  into v_fila
  from comun_comercio.com_tipo_oferta t
  where lower(t.tof_negocio) = v_negocio
    and (
      t.tof_id::text = v_ident
      or upper(t.tof_codigo) = upper(v_ident)
    )
  limit 1;

  if v_fila.tof_id is null then
    return jsonb_build_object('ok', false, 'error', 'No se encontró el tipo de oferta indicado.');
  end if;

  select
    count(*)::int,
    coalesce(jsonb_agg(sub.pro_nombre), '[]'::jsonb)
  into v_conteo, v_ejemplos
  from (
    select p.pro_nombre
    from comun_comercio.com_producto p
    where lower(p.pro_negocio) = v_negocio
      and upper(trim(coalesce(p.pro_tipo, 'FISICO'))) = upper(trim(v_fila.tof_codigo))
      and coalesce(p.pro_activo, true) = true
    order by p.pro_nombre asc
    limit 5
  ) sub;

  if v_conteo > 0 then
    return jsonb_build_object(
      'ok', false,
      'en_uso', true,
      'conteo', v_conteo,
      'ejemplos', v_ejemplos,
      'error', format(
        'No se puede eliminar "%s" porque está asignado a %s producto(s) activo(s). Cambia primero su tipo de oferta.',
        v_fila.tof_nombre,
        v_conteo
      )
    );
  end if;

  delete from comun_comercio.com_tipo_oferta
  where tof_id = v_fila.tof_id;

  return jsonb_build_object(
    'ok', true,
    'eliminado_codigo', v_fila.tof_codigo,
    'eliminado_id', v_fila.tof_id
  );
end;
$$;

grant execute on function comun_comercio.com_fn_eliminar_tipo_oferta(text, text)
  to authenticated, service_role;

create or replace function public.com_fn_eliminar_tipo_oferta(p_negocio text, p_identificador text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select comun_comercio.com_fn_eliminar_tipo_oferta(p_negocio, p_identificador);
$$;

grant execute on function public.com_fn_eliminar_tipo_oferta(text, text)
  to authenticated, service_role;

