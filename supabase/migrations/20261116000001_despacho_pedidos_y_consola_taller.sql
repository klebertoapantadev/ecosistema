-- ==============================================================================
-- Migración: 20261116000001_despacho_pedidos_y_consola_taller.sql
-- Requerimientos: PLT-009 / TNK-005 (Programación, Envío Diario a Taller, Consola Taller y Calendario)
-- Descripción:
--   1. Tabla comun_comercio.com_orden_taller (prefijo ota_, RLS + aud_fn_auditar_tabla + Realtime)
--      para centralizar todas las ventas (web/chat/proformas), pedidos manuales cargados por Admin
--      y pedidos urgentes de Exequiales vía llamada.
--   2. Sincronización idempotente de ventas de com_proforma y vínculo bidireccional con
--      com_entrega_evidencia para que al confirmar Exequiales solo se actualicen datos faltantes
--      o cambios puntuales de Sala.
--   3. RPCs SECURITY DEFINER para despacho diario del operador y actualización de estado en Taller
--      ('EN_PREPARACION' / 'LISTO_ENTREGA').
--   4. Pre-configuración de los widgets `envio_pedidos_taller` (/panel/envio-pedidos) y
--      `taller_floral` (/panel/taller) en comun_seguridad.seg_widget y seg_rol_widget (Regla 15).
-- ==============================================================================

-- 1. Columnas complementarias en com_entrega_evidencia (idempotente)
do $$
begin
  if to_regclass('comun_comercio.com_entrega_evidencia') is not null then
    alter table comun_comercio.com_entrega_evidencia
      add column if not exists ent_sala_servicio text,
      add column if not exists ent_hora_solicitada text,
      add column if not exists ent_orden_taller_id uuid;
  end if;
end $$;

-- 2. Tabla unificada de órdenes de elaboración y despacho a Taller
create table if not exists comun_comercio.com_orden_taller (
  ota_id uuid primary key default gen_random_uuid(),
  ota_secuencial bigint generated always as identity,
  ota_negocio text not null,
  ota_codigo text not null,
  ota_origen_tipo text not null default 'MANUAL_ADMIN'
    check (ota_origen_tipo in ('VENTA_TIENDA', 'PROFORMA_EVENTO', 'MANUAL_ADMIN', 'EXEQUIALES_LLAMADA')),
  ota_proforma_id uuid references comun_comercio.com_proforma(prf_id) on delete set null,
  ota_entrega_id uuid references comun_comercio.com_entrega_evidencia(ent_id) on delete set null,
  ota_estado_taller text not null default 'PENDIENTE_ENVIO'
    check (ota_estado_taller in ('PENDIENTE_ENVIO', 'ENVIADO_TALLER', 'EN_PREPARACION', 'LISTO_ENTREGA', 'ENTREGADO', 'ANULADO')),
  ota_estado_pago text not null default 'PENDIENTE_PAGO',
  ota_metodo_pago text,
  ota_fecha_pedido timestamptz not null default now(),
  ota_fecha_entrega date not null default ((now() at time zone 'America/Guayaquil')::date),
  ota_fecha_elaboracion date,
  ota_franja_horaria text,
  ota_hora_especifica text,
  ota_producto_resumen text not null default 'Arreglo floral',
  ota_items jsonb not null default '[]'::jsonb,
  ota_cliente_solicita text not null default 'Cliente',
  ota_cliente_telefono text,
  ota_destinatario_fallecido text not null default '',
  ota_sala_servicio text,
  ota_ubicacion_entrega text,
  ota_enlace_mapa text,
  ota_retiro_en_local boolean not null default false,
  ota_dedicatoria text,
  ota_observaciones text,
  ota_total_usd numeric(12,2) not null default 0,
  ota_enviado_taller_en timestamptz,
  ota_enviado_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  ota_enviado_nombre text,
  ota_preparacion_en timestamptz,
  ota_listo_en timestamptz,
  ota_entregado_en timestamptz,
  ota_actualizado_taller_nombre text,
  ota_detalle_orden jsonb not null default '{}'::jsonb,
  ota_creado_en timestamptz not null default now(),
  ota_actualizado_en timestamptz not null default now(),
  ota_eliminado_en timestamptz
);

create unique index if not exists uq_com_orden_taller_proforma_activa
  on comun_comercio.com_orden_taller (ota_proforma_id)
  where ota_proforma_id is not null and ota_eliminado_en is null;

create unique index if not exists uq_com_orden_taller_entrega_activa
  on comun_comercio.com_orden_taller (ota_entrega_id)
  where ota_entrega_id is not null and ota_eliminado_en is null;

create index if not exists idx_com_orden_taller_negocio_fecha_entrega
  on comun_comercio.com_orden_taller (ota_negocio, ota_fecha_entrega asc, ota_estado_taller)
  where ota_eliminado_en is null;

alter table comun_comercio.com_orden_taller enable row level security;

drop policy if exists com_orden_taller_lectura on comun_comercio.com_orden_taller;
create policy com_orden_taller_lectura on comun_comercio.com_orden_taller
  for select using (comun_seguridad.seg_fn_es_delivery_o_staff_negocio(ota_negocio));

drop policy if exists com_orden_taller_escritura on comun_comercio.com_orden_taller;
create policy com_orden_taller_escritura on comun_comercio.com_orden_taller
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(ota_negocio))
  with check (comun_seguridad.seg_fn_es_operador_o_admin_negocio(ota_negocio));

drop trigger if exists trg_auditoria_com_orden_taller on comun_comercio.com_orden_taller;
create trigger trg_auditoria_com_orden_taller
  after insert or update or delete on comun_comercio.com_orden_taller
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_comercio.com_orden_taller to authenticated;
grant all on comun_comercio.com_orden_taller to service_role;

do $$
begin
  alter publication supabase_realtime add table comun_comercio.com_orden_taller;
exception when others then
  null;
end $$;

-- 3. Función auxiliar de normalización de franja horaria comercial
create or replace function comun_comercio.com_fn_normalizar_franja_horaria(p_franja text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(btrim(p_franja), '') = '' then 'A) 09:00 - 13:00'
    when lower(btrim(p_franja)) in ('manana', 'mañana') or lower(btrim(p_franja)) like 'a)%' or p_franja like '%09:00%' then 'A) 09:00 - 13:00'
    when lower(btrim(p_franja)) = 'tarde' or lower(btrim(p_franja)) like 'b)%' or p_franja like '%13:00%' or p_franja like '%14:00%' then 'B) 13:00 - 17:00'
    when lower(btrim(p_franja)) = 'noche' or lower(btrim(p_franja)) like 'c)%' or p_franja like '%17:00%' then 'C) 17:00 - 20:00'
    else btrim(p_franja)
  end;
$$;

grant execute on function comun_comercio.com_fn_normalizar_franja_horaria(text) to anon, authenticated, service_role;

-- 4. Sincronizador idempotente de ventas de tienda / proformas aceptadas y OTs Exequiales previas
create or replace function comun_comercio.com_fn_sincronizar_ventas_a_ordenes_taller(p_negocio text default 'tinkay')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_prefijo text := case
    when v_negocio = 'tinkay' then 'TNK'
    when v_negocio = 'margaritas' then 'MRG'
    when v_negocio = 'fastfix' then 'FFH'
    else 'TRQ'
  end;
  r record;
  v_fecha_ent date;
  v_origen text;
  v_estado_inicial text;
  v_resumen text;
  v_dedicatoria text;
begin
  -- 4.1 Sincronizar ventas de com_proforma (todas las órdenes directas y proformas confirmadas/reservadas/aprobadas)
  for r in
    select p.*
    from comun_comercio.com_proforma p
    where lower(p.prf_negocio) = v_negocio
      and p.prf_eliminado_en is null
      and upper(coalesce(p.prf_estado, '')) not in ('CANCELADO', 'ANULADO', 'NO_ACEPTADA')
      and (
        coalesce(p.prf_detalle_proforma->>'tipo_origen', '') <> 'PROFORMA_EVENTO'
        or upper(coalesce(p.prf_estado, '')) in ('ORDEN_CONFIRMADA', 'RESERVADA_70', 'APROBADA', 'EN_PREPARACION', 'EN_PRODUCCION', 'EN_RUTA', 'ENTREGADO')
      )
      and not exists (
        select 1
        from comun_comercio.com_orden_taller o
        where o.ota_proforma_id = p.prf_id
          and o.ota_eliminado_en is null
      )
  loop
    begin
      v_fecha_ent := coalesce(
        nullif(btrim(coalesce(
          r.prf_detalle_proforma->'logistica_entrega'->>'fecha_entrega',
          r.prf_detalle_proforma->'logistica_entrega'->>'fechaEntrega',
          r.prf_detalle_proforma->'evento'->>'fechaEvento',
          ''
        )), '')::date,
        (r.prf_creado_en at time zone 'America/Guayaquil')::date
      );
    exception when others then
      v_fecha_ent := (r.prf_creado_en at time zone 'America/Guayaquil')::date;
    end;

    v_origen := case
      when coalesce(r.prf_detalle_proforma->>'tipo_origen', '') = 'PROFORMA_EVENTO' then 'PROFORMA_EVENTO'
      else 'VENTA_TIENDA'
    end;

    v_estado_inicial := case
      when upper(coalesce(r.prf_estado, '')) = 'ENTREGADO' or coalesce((r.prf_detalle_proforma->>'entrega_confirmada')::boolean, false) then 'ENTREGADO'
      when upper(coalesce(r.prf_estado, '')) in ('EN_RUTA', 'EN_CAMINO') then 'LISTO_ENTREGA'
      when upper(coalesce(r.prf_estado, '')) in ('EN_PREPARACION', 'EN_PRODUCCION') then 'EN_PREPARACION'
      else 'PENDIENTE_ENVIO'
    end;

    select coalesce(
      string_agg(
        coalesce(it->>'cantidad', '1') || 'x ' || coalesce(it->>'producto_nombre', it->>'descripcion', it->>'nombre', 'Arreglo'),
        ' + '
      ),
      'Pedido floral'
    ),
    string_agg(
      case
        when coalesce(it->'dedicatoria'->>'mensaje', '') <> '' then
          'Para: ' || coalesce(it->'dedicatoria'->>'para', '-') || ' | De: ' || coalesce(it->'dedicatoria'->>'de', '-') || ' — "' || (it->'dedicatoria'->>'mensaje') || '"'
        else null
      end,
      ' || '
    )
    into v_resumen, v_dedicatoria
    from jsonb_array_elements(
      case when jsonb_typeof(r.prf_detalle_proforma->'items') = 'array' then r.prf_detalle_proforma->'items' else '[]'::jsonb end
    ) it;

    insert into comun_comercio.com_orden_taller (
      ota_negocio,
      ota_codigo,
      ota_origen_tipo,
      ota_proforma_id,
      ota_estado_taller,
      ota_estado_pago,
      ota_metodo_pago,
      ota_fecha_pedido,
      ota_fecha_entrega,
      ota_franja_horaria,
      ota_hora_especifica,
      ota_producto_resumen,
      ota_items,
      ota_cliente_solicita,
      ota_cliente_telefono,
      ota_destinatario_fallecido,
      ota_ubicacion_entrega,
      ota_enlace_mapa,
      ota_retiro_en_local,
      ota_dedicatoria,
      ota_observaciones,
      ota_total_usd
    ) values (
      v_negocio,
      coalesce(
        r.prf_detalle_proforma->>'codigo_orden',
        r.prf_detalle_proforma->>'codigo_proforma',
        v_prefijo || '-ORD-' || lpad(r.prf_secuencial::text, 4, '0')
      ),
      v_origen,
      r.prf_id,
      v_estado_inicial,
      coalesce(r.prf_estado, 'PENDIENTE_PAGO'),
      coalesce(r.prf_detalle_proforma->>'metodo_pago', 'web'),
      r.prf_creado_en,
      v_fecha_ent,
      comun_comercio.com_fn_normalizar_franja_horaria(
        coalesce(
          r.prf_detalle_proforma->'logistica_entrega'->>'franja_horaria',
          r.prf_detalle_proforma->'logistica_entrega'->>'franjaHoraria',
          'A) 09:00 - 13:00'
        )
      ),
      nullif(btrim(coalesce(
        r.prf_detalle_proforma->'logistica_entrega'->>'hora_exacta',
        r.prf_detalle_proforma->'evento'->>'horaEvento',
        ''
      )), ''),
      coalesce(v_resumen, 'Pedido floral'),
      coalesce(r.prf_detalle_proforma->'items', '[]'::jsonb),
      coalesce(
        r.prf_detalle_proforma->'comprador'->>'nombreCompleto',
        r.prf_detalle_proforma->'comprador'->>'nombre',
        r.prf_cliente_contacto->>'nombre',
        'Cliente Tienda'
      ),
      coalesce(
        r.prf_detalle_proforma->'comprador'->>'whatsapp',
        r.prf_detalle_proforma->'comprador'->>'telefono',
        r.prf_cliente_contacto->>'telefono',
        ''
      ),
      coalesce(
        nullif(btrim(coalesce(
          r.prf_detalle_proforma->'logistica_entrega'->>'destinatario_nombre',
          r.prf_detalle_proforma->'logistica_entrega'->>'destinatarioNombre',
          ''
        )), ''),
        r.prf_detalle_proforma->'comprador'->>'nombreCompleto',
        'Destinatario'
      ),
      coalesce(
        r.prf_detalle_proforma->'logistica_entrega'->>'direccion',
        r.prf_detalle_proforma->'ubicacion'->>'direccion',
        ''
      ),
      coalesce(
        r.prf_detalle_proforma->'logistica_entrega'->>'enlace_mapa',
        r.prf_detalle_proforma->'logistica_entrega'->>'enlaceMapa'
      ),
      coalesce((r.prf_detalle_proforma->'logistica_entrega'->>'retiro_en_local')::boolean, false),
      v_dedicatoria,
      nullif(btrim(coalesce(r.prf_detalle_proforma->'evento'->>'notasEvento', '')), ''),
      coalesce(r.prf_total, 0)
    )
    on conflict do nothing;
  end loop;

  -- 4.2 Sincronizar OTs Exequiales previas registradas directamente en com_entrega_evidencia
  for r in
    select e.*
    from comun_comercio.com_entrega_evidencia e
    where e.ent_negocio = v_negocio
      and e.ent_eliminado_en is null
      and e.ent_tipo_origen = 'ORDEN_TRABAJO_CONVENIO'
      and e.ent_estado <> 'ANULADA'
      and not exists (
        select 1
        from comun_comercio.com_orden_taller o
        where o.ota_entrega_id = e.ent_id
          and o.ota_eliminado_en is null
      )
  loop
    insert into comun_comercio.com_orden_taller (
      ota_negocio,
      ota_codigo,
      ota_origen_tipo,
      ota_entrega_id,
      ota_estado_taller,
      ota_estado_pago,
      ota_metodo_pago,
      ota_fecha_pedido,
      ota_fecha_entrega,
      ota_fecha_elaboracion,
      ota_hora_especifica,
      ota_producto_resumen,
      ota_items,
      ota_cliente_solicita,
      ota_destinatario_fallecido,
      ota_sala_servicio,
      ota_ubicacion_entrega,
      ota_observaciones,
      ota_enviado_taller_en,
      ota_entregado_en
    ) values (
      v_negocio,
      coalesce(r.ent_codigo_ot, 'OT-' || lpad(r.ent_secuencial::text, 4, '0')),
      'EXEQUIALES_LLAMADA',
      r.ent_id,
      case when r.ent_estado = 'PROGRAMADA' then 'ENVIADO_TALLER' else 'ENTREGADO' end,
      'CONVENIO_IESS',
      'convenio',
      r.ent_creado_en,
      (r.ent_fecha_servicio at time zone 'America/Guayaquil')::date,
      (r.ent_fecha_servicio at time zone 'America/Guayaquil')::date,
      coalesce(r.ent_hora_solicitada, to_char(r.ent_fecha_servicio at time zone 'America/Guayaquil', 'HH24:MI')),
      coalesce(r.ent_descripcion_servicio, 'Set condolencias (3 arreglos)'),
      jsonb_build_array(jsonb_build_object(
        'descripcion', coalesce(r.ent_descripcion_servicio, 'Set condolencias (3 arreglos)'),
        'cantidad', 1
      )),
      coalesce(nullif(btrim(r.ent_coordinador_nombre), ''), 'Exequiales IESS'),
      coalesce(r.ent_fallecido_destinatario, ''),
      coalesce(r.ent_sala_servicio, r.ent_detalle_entrega->>'sala_servicio'),
      coalesce(r.ent_ubicacion_nombre, 'Exequiales del IESS'),
      r.ent_observaciones,
      r.ent_creado_en,
      case when r.ent_estado <> 'PROGRAMADA' then r.ent_capturado_en else null end
    )
    on conflict do nothing;
  end loop;
end;
$$;

grant execute on function comun_comercio.com_fn_sincronizar_ventas_a_ordenes_taller(text) to authenticated, service_role;

-- 5. RPC de lectura integral para Pantalla de Envío de Pedidos y Pantalla de Taller
create or replace function comun_comercio.com_fn_obtener_consola_taller_y_despacho(p_negocio text default 'tinkay')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_usu_nombre text;
  v_ordenes jsonb;
  v_productos jsonb;
begin
  if not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para acceder a Pedidos y Taller.');
  end if;

  perform comun_comercio.com_fn_sincronizar_ventas_a_ordenes_taller(v_negocio);

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Operador')
    into v_usu_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  select coalesce(jsonb_agg(sub.item), '[]'::jsonb)
  into v_ordenes
  from (
    select jsonb_build_object(
      'id', o.ota_id,
      'codigo', o.ota_codigo,
      'origenTipo', o.ota_origen_tipo,
      'proformaId', o.ota_proforma_id,
      'entregaId', o.ota_entrega_id,
      'estadoTaller', o.ota_estado_taller,
      'estadoPago', coalesce(p.prf_estado, o.ota_estado_pago),
      'metodoPago', o.ota_metodo_pago,
      'fechaPedido', o.ota_fecha_pedido,
      'fechaEntrega', to_char(o.ota_fecha_entrega, 'YYYY-MM-DD'),
      'fechaElaboracion', case when o.ota_fecha_elaboracion is not null then to_char(o.ota_fecha_elaboracion, 'YYYY-MM-DD') else null end,
      'franjaHoraria', o.ota_franja_horaria,
      'horaEspecifica', o.ota_hora_especifica,
      'productoResumen', o.ota_producto_resumen,
      'items', coalesce(o.ota_items, '[]'::jsonb),
      'clienteSolicita', o.ota_cliente_solicita,
      'clienteTelefono', o.ota_cliente_telefono,
      'destinatarioFallecido', o.ota_destinatario_fallecido,
      'salaServicio', o.ota_sala_servicio,
      'ubicacionEntrega', o.ota_ubicacion_entrega,
      'enlaceMapa', o.ota_enlace_mapa,
      'retiroEnLocal', o.ota_retiro_en_local,
      'dedicatoria', o.ota_dedicatoria,
      'observaciones', o.ota_observaciones,
      'totalUsd', o.ota_total_usd,
      'enviadoTallerEn', o.ota_enviado_taller_en,
      'enviadoNombre', o.ota_enviado_nombre,
      'preparacionEn', o.ota_preparacion_en,
      'listoEn', o.ota_listo_en,
      'entregadoEn', o.ota_entregado_en,
      'actualizadoTallerNombre', o.ota_actualizado_taller_nombre
    ) as item
    from comun_comercio.com_orden_taller o
    left join comun_comercio.com_proforma p on p.prf_id = o.ota_proforma_id
    where o.ota_negocio = v_negocio
      and o.ota_eliminado_en is null
    order by
      o.ota_fecha_entrega asc,
      (case when o.ota_origen_tipo = 'EXEQUIALES_LLAMADA' then 0 else 1 end) asc,
      o.ota_creado_en desc
    limit 500
  ) sub;

  select coalesce(jsonb_agg(sub.prod), '[]'::jsonb)
  into v_productos
  from (
    select jsonb_build_object(
      'productoId', pr.pro_id,
      'productoNombre', pr.pro_nombre,
      'varianteId', v.var_id,
      'sku', coalesce(v.var_sku, pr.pro_slug),
      'varianteNombre', coalesce(v.var_nombre, 'Estándar'),
      'pvp', coalesce(v.var_precio, 0),
      'portadaUrl', coalesce(v.var_detalle_variante->>'portada_url', pr.pro_detalle_producto->>'portada_url')
    ) as prod
    from comun_comercio.com_producto pr
    join comun_comercio.com_variante v
      on v.var_producto_id = pr.pro_id
     and v.var_activo = true
     and v.var_eliminado_en is null
    where lower(pr.pro_negocio) = v_negocio
      and pr.pro_activo = true
      and pr.pro_eliminado_en is null
    order by pr.pro_nombre asc, v.var_orden asc
    limit 250
  ) sub;

  return jsonb_build_object(
    'ok', true,
    'usuarioActualNombre', coalesce(v_usu_nombre, 'Operador'),
    'ordenes', v_ordenes,
    'productosCatalogo', v_productos
  );
end;
$$;

grant execute on function comun_comercio.com_fn_obtener_consola_taller_y_despacho(text) to authenticated, service_role;

-- 6. RPC para cargar/editar pedido (Manual Admin o Llamada Exequiales) y enviarlo opcionalmente a Taller
create or replace function comun_comercio.com_fn_crear_o_actualizar_pedido_operador(
  p_negocio text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_usu_nombre text;
  v_orden_id uuid;
  v_origen text;
  v_enviar boolean;
  v_fecha_entrega date;
  v_fecha_elab date;
  v_hora text;
  v_franja text;
  v_sala text;
  v_solicita text;
  v_destinatario text;
  v_resumen text;
  v_items jsonb;
  v_convenio_id uuid;
  v_entrega_id uuid;
  v_codigo text;
  v_fecha_serv_ts timestamptz;
  v_orden comun_comercio.com_orden_taller;
begin
  if not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para registrar o programar pedidos.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Operador')
    into v_usu_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  begin
    v_orden_id := nullif(btrim(coalesce(p_payload->>'ordenId', '')), '')::uuid;
  exception when others then
    v_orden_id := null;
  end;

  v_origen := case
    when upper(coalesce(p_payload->>'origenTipo', '')) = 'EXEQUIALES_LLAMADA' then 'EXEQUIALES_LLAMADA'
    when upper(coalesce(p_payload->>'origenTipo', '')) = 'VENTA_TIENDA' then 'VENTA_TIENDA'
    when upper(coalesce(p_payload->>'origenTipo', '')) = 'PROFORMA_EVENTO' then 'PROFORMA_EVENTO'
    else 'MANUAL_ADMIN'
  end;

  v_enviar := coalesce((p_payload->>'enviarATaller')::boolean, v_origen = 'EXEQUIALES_LLAMADA');

  begin
    v_fecha_entrega := coalesce(
      nullif(btrim(coalesce(p_payload->>'fechaEntrega', '')), '')::date,
      (now() at time zone 'America/Guayaquil')::date
    );
  exception when others then
    v_fecha_entrega := (now() at time zone 'America/Guayaquil')::date;
  end;

  begin
    v_fecha_elab := nullif(btrim(coalesce(p_payload->>'fechaElaboracion', '')), '')::date;
  exception when others then
    v_fecha_elab := null;
  end;

  if v_enviar and v_fecha_elab is null then
    v_fecha_elab := (now() at time zone 'America/Guayaquil')::date;
  end if;

  v_hora := nullif(btrim(coalesce(p_payload->>'horaEspecifica', '')), '');
  v_franja := case
    when v_origen = 'EXEQUIALES_LLAMADA' then null
    else comun_comercio.com_fn_normalizar_franja_horaria(p_payload->>'franjaHoraria')
  end;

  v_sala := nullif(btrim(coalesce(p_payload->>'salaServicio', '')), '');
  v_solicita := coalesce(nullif(btrim(coalesce(p_payload->>'clienteSolicita', '')), ''), 'Cliente Directo');
  v_destinatario := coalesce(
    nullif(btrim(coalesce(p_payload->>'destinatarioFallecido', '')), ''),
    case
      when v_origen = 'EXEQUIALES_LLAMADA' and v_sala is not null then 'Por confirmar (' || v_sala || ')'
      when v_origen = 'EXEQUIALES_LLAMADA' then 'Por confirmar'
      else v_solicita
    end
  );

  v_resumen := coalesce(
    nullif(btrim(coalesce(p_payload->>'productoResumen', '')), ''),
    case when v_origen = 'EXEQUIALES_LLAMADA' then 'Set condolencias (3 arreglos)' else 'Arreglo floral' end
  );

  v_items := case
    when jsonb_typeof(p_payload->'items') = 'array' and jsonb_array_length(p_payload->'items') > 0 then p_payload->'items'
    else jsonb_build_array(jsonb_build_object('descripcion', v_resumen, 'cantidad', 1))
  end;

  -- Si es edición de una orden ya existente
  if v_orden_id is not null then
    update comun_comercio.com_orden_taller
       set ota_fecha_entrega = v_fecha_entrega,
           ota_fecha_elaboracion = coalesce(v_fecha_elab, ota_fecha_elaboracion),
           ota_franja_horaria = coalesce(v_franja, ota_franja_horaria),
           ota_hora_especifica = coalesce(v_hora, ota_hora_especifica),
           ota_producto_resumen = v_resumen,
           ota_items = v_items,
           ota_cliente_solicita = v_solicita,
           ota_cliente_telefono = coalesce(nullif(btrim(p_payload->>'clienteTelefono'), ''), ota_cliente_telefono),
           ota_destinatario_fallecido = v_destinatario,
           ota_sala_servicio = coalesce(v_sala, ota_sala_servicio),
           ota_ubicacion_entrega = coalesce(nullif(btrim(p_payload->>'ubicacionEntrega'), ''), ota_ubicacion_entrega),
           ota_enlace_mapa = coalesce(nullif(btrim(p_payload->>'enlaceMapa'), ''), ota_enlace_mapa),
           ota_dedicatoria = coalesce(nullif(btrim(p_payload->>'dedicatoria'), ''), ota_dedicatoria),
           ota_observaciones = coalesce(nullif(btrim(p_payload->>'observaciones'), ''), ota_observaciones),
           ota_estado_taller = case
             when v_enviar and ota_estado_taller = 'PENDIENTE_ENVIO' then 'ENVIADO_TALLER'
             else ota_estado_taller
           end,
           ota_enviado_taller_en = case
             when v_enviar and ota_enviado_taller_en is null then now()
             else ota_enviado_taller_en
           end,
           ota_enviado_por = case when v_enviar then coalesce(ota_enviado_por, v_uid) else ota_enviado_por end,
           ota_enviado_nombre = case when v_enviar then coalesce(ota_enviado_nombre, v_usu_nombre) else ota_enviado_nombre end,
           ota_actualizado_en = now()
     where ota_id = v_orden_id
       and ota_negocio = v_negocio
     returning * into v_orden;

    if v_orden.ota_entrega_id is not null then
      update comun_comercio.com_entrega_evidencia
         set ent_fallecido_destinatario = v_destinatario,
             ent_descripcion_servicio = v_resumen,
             ent_sala_servicio = coalesce(v_sala, ent_sala_servicio),
             ent_coordinador_nombre = v_solicita,
             ent_hora_solicitada = coalesce(v_hora, ent_hora_solicitada),
             ent_ubicacion_nombre = coalesce(nullif(btrim(p_payload->>'ubicacionEntrega'), ''), ent_ubicacion_nombre),
             ent_actualizado_en = now()
       where ent_id = v_orden.ota_entrega_id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'ordenId', v_orden.ota_id,
      'codigo', v_orden.ota_codigo,
      'estadoTaller', v_orden.ota_estado_taller
    );
  end if;

  -- Si es Exequiales por llamada, crear de una vez la OT vinculada en com_entrega_evidencia (PROGRAMADA)
  if v_origen = 'EXEQUIALES_LLAMADA' then
    select cve_id into v_convenio_id
    from comun_comercio.com_convenio_entrega
    where cve_negocio = v_negocio and cve_eliminado_en is null
    order by cve_secuencial asc
    limit 1;

    begin
      if v_hora is not null and v_hora ~ '^\d{1,2}:\d{2}' then
        v_fecha_serv_ts := ((v_fecha_entrega::text || ' ' || substring(v_hora from '^\d{1,2}:\d{2}') || ':00')::timestamp at time zone 'America/Guayaquil');
      else
        v_fecha_serv_ts := ((v_fecha_entrega::text || ' 12:00:00')::timestamp at time zone 'America/Guayaquil');
      end if;
    exception when others then
      v_fecha_serv_ts := now();
    end;

    insert into comun_comercio.com_entrega_evidencia (
      ent_uuid_cliente,
      ent_negocio,
      ent_tipo_origen,
      ent_convenio_id,
      ent_entregador_nombre,
      ent_fallecido_destinatario,
      ent_fecha_servicio,
      ent_capturado_en,
      ent_descripcion_servicio,
      ent_sala_servicio,
      ent_hora_solicitada,
      ent_ubicacion_nombre,
      ent_coordinador_nombre,
      ent_recursos_utilizados,
      ent_observaciones,
      ent_detalle_entrega,
      ent_estado
    ) values (
      gen_random_uuid(),
      v_negocio,
      'ORDEN_TRABAJO_CONVENIO',
      v_convenio_id,
      'Por asignar',
      v_destinatario,
      v_fecha_serv_ts,
      now(),
      v_resumen,
      v_sala,
      v_hora,
      coalesce(nullif(btrim(p_payload->>'ubicacionEntrega'), ''), 'Exequiales del IESS'),
      v_solicita,
      'Flores, follaje, bases y oasis',
      nullif(btrim(coalesce(p_payload->>'observaciones', '')), ''),
      jsonb_strip_nulls(jsonb_build_object(
        'sala_servicio', v_sala,
        'hora_solicitada', v_hora,
        'quien_solicita', v_solicita
      )),
      'PROGRAMADA'
    )
    returning ent_id, coalesce(ent_codigo_ot, 'OT-' || lpad(ent_secuencial::text, 4, '0'))
    into v_entrega_id, v_codigo;

    update comun_comercio.com_entrega_evidencia
       set ent_codigo_ot = v_codigo
     where ent_id = v_entrega_id
       and ent_codigo_ot is null;
  else
    v_codigo := 'PED-' || to_char(now() at time zone 'America/Guayaquil', 'MMDD-HH24MI') || '-' || substr(md5(random()::text), 1, 3);
  end if;

  insert into comun_comercio.com_orden_taller (
    ota_negocio,
    ota_codigo,
    ota_origen_tipo,
    ota_entrega_id,
    ota_estado_taller,
    ota_estado_pago,
    ota_metodo_pago,
    ota_fecha_pedido,
    ota_fecha_entrega,
    ota_fecha_elaboracion,
    ota_franja_horaria,
    ota_hora_especifica,
    ota_producto_resumen,
    ota_items,
    ota_cliente_solicita,
    ota_cliente_telefono,
    ota_destinatario_fallecido,
    ota_sala_servicio,
    ota_ubicacion_entrega,
    ota_enlace_mapa,
    ota_retiro_en_local,
    ota_dedicatoria,
    ota_observaciones,
    ota_total_usd,
    ota_enviado_taller_en,
    ota_enviado_por,
    ota_enviado_nombre
  ) values (
    v_negocio,
    upper(v_codigo),
    v_origen,
    v_entrega_id,
    case when v_enviar then 'ENVIADO_TALLER' else 'PENDIENTE_ENVIO' end,
    coalesce(
      nullif(btrim(coalesce(p_payload->>'estadoPago', '')), ''),
      case when v_origen = 'EXEQUIALES_LLAMADA' then 'CONVENIO_IESS' else 'APROBADA' end
    ),
    coalesce(nullif(btrim(coalesce(p_payload->>'metodoPago', '')), ''), case when v_origen = 'EXEQUIALES_LLAMADA' then 'convenio' else 'manual' end),
    now(),
    v_fecha_entrega,
    v_fecha_elab,
    v_franja,
    v_hora,
    v_resumen,
    v_items,
    v_solicita,
    nullif(btrim(coalesce(p_payload->>'clienteTelefono', '')), ''),
    v_destinatario,
    v_sala,
    coalesce(nullif(btrim(coalesce(p_payload->>'ubicacionEntrega', '')), ''), case when v_origen = 'EXEQUIALES_LLAMADA' then 'Exequiales del IESS' else '' end),
    nullif(btrim(coalesce(p_payload->>'enlaceMapa', '')), ''),
    coalesce((p_payload->>'retiroEnLocal')::boolean, false),
    nullif(btrim(coalesce(p_payload->>'dedicatoria', '')), ''),
    nullif(btrim(coalesce(p_payload->>'observaciones', '')), ''),
    coalesce(nullif(btrim(coalesce(p_payload->>'totalUsd', '')), '')::numeric, 0),
    case when v_enviar then now() else null end,
    case when v_enviar then v_uid else null end,
    case when v_enviar then v_usu_nombre else null end
  )
  returning * into v_orden;

  if v_entrega_id is not null then
    update comun_comercio.com_entrega_evidencia
       set ent_orden_taller_id = v_orden.ota_id
     where ent_id = v_entrega_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'ordenId', v_orden.ota_id,
    'codigo', v_orden.ota_codigo,
    'entregaId', v_entrega_id,
    'estadoTaller', v_orden.ota_estado_taller
  );
end;
$$;

grant execute on function comun_comercio.com_fn_crear_o_actualizar_pedido_operador(text, jsonb) to authenticated, service_role;

-- 7. RPC para despacho diario individual o masivo de pedidos validados hacia Taller
create or replace function comun_comercio.com_fn_enviar_pedidos_a_taller(
  p_negocio text,
  p_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_usu_nombre text;
  v_total int := 0;
  v_codigos text[];
begin
  if not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para enviar pedidos a Taller.');
  end if;

  if p_ids is null or array_length(p_ids, 1) is null then
    return jsonb_build_object('ok', false, 'error', 'Selecciona al menos un pedido para enviar a Taller.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Operador')
    into v_usu_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  with actualizadas as (
    update comun_comercio.com_orden_taller
       set ota_estado_taller = case
             when ota_estado_taller = 'PENDIENTE_ENVIO' then 'ENVIADO_TALLER'
             else ota_estado_taller
           end,
           ota_fecha_elaboracion = coalesce(ota_fecha_elaboracion, (now() at time zone 'America/Guayaquil')::date),
           ota_enviado_taller_en = coalesce(ota_enviado_taller_en, now()),
           ota_enviado_por = coalesce(ota_enviado_por, v_uid),
           ota_enviado_nombre = coalesce(ota_enviado_nombre, v_usu_nombre),
           ota_actualizado_en = now()
     where ota_negocio = v_negocio
       and ota_id = any(p_ids)
       and ota_eliminado_en is null
     returning ota_id, ota_codigo, ota_proforma_id
  )
  select count(*), coalesce(array_agg(ota_codigo), array[]::text[])
    into v_total, v_codigos
    from actualizadas;

  update comun_comercio.com_proforma p
     set prf_detalle_proforma = coalesce(p.prf_detalle_proforma, '{}'::jsonb) || jsonb_build_object(
           'estado_taller', 'ENVIADO_TALLER',
           'enviado_taller_en', now()
         ),
         prf_actualizado_en = now()
    from comun_comercio.com_orden_taller o
   where o.ota_proforma_id = p.prf_id
     and o.ota_id = any(p_ids)
     and o.ota_negocio = v_negocio;

  return jsonb_build_object(
    'ok', true,
    'enviados', v_total,
    'codigos', to_jsonb(v_codigos)
  );
end;
$$;

grant execute on function comun_comercio.com_fn_enviar_pedidos_a_taller(text, uuid[]) to authenticated, service_role;

-- 8. RPC para que Taller actualice el estado ('EN_PREPARACION' / 'LISTO_ENTREGA' / 'ENTREGADO')
create or replace function comun_comercio.com_fn_actualizar_estado_taller(
  p_negocio text,
  p_orden_id uuid,
  p_nuevo_estado text,
  p_notas_taller text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_usu_nombre text;
  v_estado text := upper(btrim(coalesce(p_nuevo_estado, '')));
  v_orden comun_comercio.com_orden_taller;
begin
  if not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para actualizar el estado en Taller.');
  end if;

  if v_estado not in ('PENDIENTE_ENVIO', 'ENVIADO_TALLER', 'EN_PREPARACION', 'LISTO_ENTREGA', 'ENTREGADO', 'ANULADO') then
    return jsonb_build_object('ok', false, 'error', 'Estado de Taller no válido.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Taller')
    into v_usu_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  update comun_comercio.com_orden_taller
     set ota_estado_taller = v_estado,
         ota_preparacion_en = case when v_estado = 'EN_PREPARACION' then coalesce(ota_preparacion_en, now()) else ota_preparacion_en end,
         ota_listo_en = case when v_estado = 'LISTO_ENTREGA' then now() else ota_listo_en end,
         ota_entregado_en = case when v_estado = 'ENTREGADO' then now() else ota_entregado_en end,
         ota_actualizado_taller_nombre = v_usu_nombre,
         ota_observaciones = case
           when nullif(btrim(coalesce(p_notas_taller, '')), '') is not null then btrim(p_notas_taller)
           else ota_observaciones
         end,
         ota_actualizado_en = now()
   where ota_id = p_orden_id
     and ota_negocio = v_negocio
   returning * into v_orden;

  if v_orden.ota_id is null then
    return jsonb_build_object('ok', false, 'error', 'No se encontró la orden de taller.');
  end if;

  if v_orden.ota_proforma_id is not null then
    update comun_comercio.com_proforma
       set prf_estado = case
             when v_estado = 'EN_PREPARACION' then 'EN_PREPARACION'
             when v_estado = 'LISTO_ENTREGA' then 'EN_RUTA'
             when v_estado = 'ENTREGADO' then 'ENTREGADO'
             else prf_estado
           end,
           prf_detalle_proforma = coalesce(prf_detalle_proforma, '{}'::jsonb) || jsonb_build_object(
             'estado_taller', v_estado,
             'actualizado_taller_por', v_usu_nombre,
             'actualizado_taller_en', now()
           ),
           prf_actualizado_en = now()
     where prf_id = v_orden.ota_proforma_id;
  end if;

  if v_orden.ota_entrega_id is not null then
    update comun_comercio.com_entrega_evidencia
       set ent_detalle_entrega = coalesce(ent_detalle_entrega, '{}'::jsonb) || jsonb_build_object(
             'estado_taller', v_estado,
             'actualizado_taller_por', v_usu_nombre
           ),
           ent_actualizado_en = now()
     where ent_id = v_orden.ota_entrega_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'ordenId', v_orden.ota_id,
    'codigo', v_orden.ota_codigo,
    'estadoTaller', v_orden.ota_estado_taller,
    'productoResumen', v_orden.ota_producto_resumen,
    'salaServicio', v_orden.ota_sala_servicio,
    'destinatarioFallecido', v_orden.ota_destinatario_fallecido
  );
end;
$$;

grant execute on function comun_comercio.com_fn_actualizar_estado_taller(text, uuid, text, text) to authenticated, service_role;

-- 9. Actualizar com_fn_obtener_tablero_entregas y com_fn_registrar_o_sincronizar_entrega
--    para exponer el estado de Taller y sincronizar automáticamente al confirmar la entrega
create or replace function comun_comercio.com_fn_obtener_tablero_entregas(p_negocio text default 'tinkay')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_usu_nombre text;
  v_es_admin boolean;
  v_convenios jsonb;
  v_entregas jsonb;
  v_informes jsonb;
  v_pedidos_pendientes jsonb;
begin
  if not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para acceder al módulo de entregas.');
  end if;

  perform comun_comercio.com_fn_sincronizar_ventas_a_ordenes_taller(v_negocio);

  v_es_admin := comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio);

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Colaborador')
    into v_usu_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.cve_id,
      'codigo', c.cve_codigo,
      'nombre', c.cve_nombre,
      'prefijoInforme', c.cve_prefijo_informe,
      'siguienteNumero', c.cve_siguiente_numero,
      'datosProveedor', c.cve_datos_proveedor
    ) order by c.cve_secuencial asc
  ), '[]'::jsonb)
  into v_convenios
  from comun_comercio.com_convenio_entrega c
  where c.cve_negocio = v_negocio
    and c.cve_activo = true
    and c.cve_eliminado_en is null;

  select coalesce(jsonb_agg(sub.item), '[]'::jsonb)
  into v_entregas
  from (
    select jsonb_build_object(
      'id', e.ent_id,
      'secuencial', e.ent_secuencial,
      'uuidCliente', e.ent_uuid_cliente,
      'codigoOt', coalesce(e.ent_codigo_ot, 'OT-' || lpad(e.ent_secuencial::text, 4, '0')),
      'tipoOrigen', e.ent_tipo_origen,
      'convenioId', e.ent_convenio_id,
      'proformaId', e.ent_proforma_id,
      'ordenTallerId', coalesce(e.ent_orden_taller_id, ot.ota_id),
      'estadoTaller', coalesce(ot.ota_estado_taller, e.ent_detalle_entrega->>'estado_taller'),
      'horaSolicitada', coalesce(e.ent_hora_solicitada, ot.ota_hora_especifica, e.ent_detalle_entrega->>'hora_solicitada'),
      'entregadoPor', e.ent_entregado_por,
      'entregadorNombre', e.ent_entregador_nombre,
      'fallecidoDestinatario', e.ent_fallecido_destinatario,
      'fechaServicio', e.ent_fecha_servicio,
      'capturadoEn', e.ent_capturado_en,
      'sincronizadoEn', e.ent_sincronizado_en,
      'descripcionServicio', e.ent_descripcion_servicio,
      'salaServicio', coalesce(e.ent_sala_servicio, ot.ota_sala_servicio, e.ent_detalle_entrega->>'sala_servicio'),
      'ubicacionNombre', e.ent_ubicacion_nombre,
      'coordinadorNombre', coalesce(e.ent_coordinador_nombre, ot.ota_cliente_solicita),
      'recursosUtilizados', e.ent_recursos_utilizados,
      'latitud', e.ent_latitud,
      'longitud', e.ent_longitud,
      'precisionMetros', e.ent_precision_metros,
      'direccionGps', e.ent_direccion_gps,
      'fotoUrl', e.ent_foto_url,
      'mapaUrl', e.ent_mapa_url,
      'facturaReferencia', e.ent_factura_referencia,
      'documentosAdjuntos', e.ent_documentos_adjuntos,
      'observaciones', e.ent_observaciones,
      'informeId', e.ent_informe_id,
      'numeroInforme', i.ife_numero_informe,
      'estado', e.ent_estado
    ) as item
    from comun_comercio.com_entrega_evidencia e
    left join comun_comercio.com_informe_entregas i on i.ife_id = e.ent_informe_id
    left join comun_comercio.com_orden_taller ot
      on ot.ota_entrega_id = e.ent_id
     and ot.ota_eliminado_en is null
    where e.ent_negocio = v_negocio
      and e.ent_eliminado_en is null
    order by
      (case when e.ent_estado = 'PROGRAMADA' then 0 else 1 end) asc,
      (case when coalesce(ot.ota_estado_taller, '') = 'LISTO_ENTREGA' then 0 else 1 end) asc,
      e.ent_fecha_servicio desc,
      e.ent_creado_en desc
    limit 400
  ) sub;

  if v_es_admin then
    select coalesce(jsonb_agg(sub.item), '[]'::jsonb)
    into v_informes
    from (
      select jsonb_build_object(
        'id', i.ife_id,
        'secuencial', i.ife_secuencial,
        'convenioId', i.ife_convenio_id,
        'numeroInforme', i.ife_numero_informe,
        'fechaInforme', i.ife_fecha_informe,
        'fechaInicio', i.ife_fecha_inicio,
        'fechaFin', i.ife_fecha_fin,
        'totalEntregas', i.ife_total_entregas,
        'facturaReferencia', i.ife_factura_referencia,
        'documentosAdjuntos', i.ife_documentos_adjuntos,
        'estado', i.ife_estado,
        'pdfUrl', i.ife_pdf_url,
        'generadoNombre', i.ife_generado_nombre,
        'detalleInforme', i.ife_detalle_informe,
        'creadoEn', i.ife_creado_en
      ) as item
      from comun_comercio.com_informe_entregas i
      where i.ife_negocio = v_negocio
        and i.ife_eliminado_en is null
      order by i.ife_creado_en desc
      limit 120
    ) sub;
  else
    v_informes := '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(sub.item), '[]'::jsonb)
  into v_pedidos_pendientes
  from (
    select jsonb_build_object(
      'proformaId', coalesce(o.ota_proforma_id, o.ota_id),
      'ordenTallerId', o.ota_id,
      'codigoOrden', o.ota_codigo,
      'estadoPago', o.ota_estado_pago,
      'estadoTaller', o.ota_estado_taller,
      'fechaEntrega', to_char(o.ota_fecha_entrega, 'YYYY-MM-DD'),
      'franjaHoraria', o.ota_franja_horaria,
      'compradorNombre', o.ota_cliente_solicita,
      'destinatarioNombre', coalesce(nullif(o.ota_destinatario_fallecido, ''), o.ota_cliente_solicita),
      'destinatarioTelefono', coalesce(o.ota_cliente_telefono, ''),
      'direccionEntrega', coalesce(nullif(o.ota_ubicacion_entrega, ''), 'Retiro / Coordinar dirección'),
      'enlaceMapa', o.ota_enlace_mapa,
      'resumenItems', o.ota_producto_resumen,
      'creadoEn', o.ota_creado_en
    ) as item
    from comun_comercio.com_orden_taller o
    where o.ota_negocio = v_negocio
      and o.ota_eliminado_en is null
      and o.ota_origen_tipo <> 'EXEQUIALES_LLAMADA'
      and o.ota_estado_taller not in ('ENTREGADO', 'ANULADO')
    order by
      (case when o.ota_estado_taller = 'LISTO_ENTREGA' then 0 when o.ota_estado_taller = 'EN_PREPARACION' then 1 else 2 end) asc,
      o.ota_fecha_entrega asc,
      o.ota_creado_en desc
    limit 120
  ) sub;

  return jsonb_build_object(
    'ok', true,
    'usuarioActualId', v_uid,
    'usuarioActualNombre', coalesce(v_usu_nombre, 'Colaborador'),
    'esAdminOperador', v_es_admin,
    'convenios', v_convenios,
    'entregas', v_entregas,
    'informes', v_informes,
    'pedidosPendientesTienda', v_pedidos_pendientes
  );
end;
$$;

create or replace function comun_comercio.com_fn_registrar_o_sincronizar_entrega(
  p_negocio text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_usu_nombre text;
  v_uuid_cli uuid;
  v_entrega_id uuid;
  v_tipo_origen text;
  v_convenio_id uuid;
  v_proforma_id uuid;
  v_orden_taller_id uuid;
  v_estado text;
  v_fecha_serv timestamptz;
  v_capturado timestamptz;
  v_lat numeric(10,7);
  v_lng numeric(10,7);
  v_prec numeric(8,2);
  v_sala text;
  v_fallecido text;
  v_reg comun_comercio.com_entrega_evidencia;
begin
  if not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para registrar entregas.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Delivery')
    into v_usu_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  begin
    v_uuid_cli := coalesce(nullif(btrim(p_payload->>'uuidCliente'), '')::uuid, gen_random_uuid());
  exception when others then
    v_uuid_cli := gen_random_uuid();
  end;

  begin
    v_entrega_id := nullif(btrim(coalesce(p_payload->>'entregaId', '')), '')::uuid;
  exception when others then
    v_entrega_id := null;
  end;

  v_tipo_origen := case
    when upper(coalesce(p_payload->>'tipoOrigen', '')) = 'PEDIDO_TIENDA' then 'PEDIDO_TIENDA'
    else 'ORDEN_TRABAJO_CONVENIO'
  end;

  v_sala := nullif(btrim(coalesce(p_payload->>'salaServicio', p_payload->'detalleExtra'->>'sala_servicio', '')), '');
  v_fallecido := coalesce(
    nullif(btrim(coalesce(p_payload->>'fallecidoDestinatario', '')), ''),
    case
      when v_sala is not null then 'Por confirmar (' || v_sala || ')'
      else 'Destinatario'
    end
  );

  begin
    v_convenio_id := nullif(btrim(coalesce(p_payload->>'convenioId', '')), '')::uuid;
  exception when others then
    v_convenio_id := null;
  end;

  if v_tipo_origen = 'ORDEN_TRABAJO_CONVENIO' and v_convenio_id is null then
    select cve_id into v_convenio_id
    from comun_comercio.com_convenio_entrega
    where cve_negocio = v_negocio and cve_eliminado_en is null
    order by cve_secuencial asc
    limit 1;
  end if;

  begin
    v_proforma_id := nullif(btrim(coalesce(p_payload->>'proformaId', '')), '')::uuid;
  exception when others then
    v_proforma_id := null;
  end;

  -- Si proformaId apunta en realidad a una orden manual de taller sin proforma asociada
  if v_proforma_id is not null and not exists (select 1 from comun_comercio.com_proforma where prf_id = v_proforma_id) then
    v_orden_taller_id := v_proforma_id;
    v_proforma_id := null;
  end if;

  v_estado := coalesce(
    nullif(btrim(coalesce(p_payload->>'estado', '')), ''),
    case
      when v_tipo_origen = 'PEDIDO_TIENDA' then 'ENTREGADO_PEDIDO_REGULAR'
      when coalesce(btrim(p_payload->>'fotoUrl'), '') = '' and coalesce((p_payload->>'soloProgramarOt')::boolean, false) then 'PROGRAMADA'
      else 'ENTREGADA_PENDIENTE_INFORME'
    end
  );

  begin
    v_fecha_serv := coalesce(nullif(btrim(p_payload->>'fechaServicio'), '')::timestamptz, now());
  exception when others then
    v_fecha_serv := now();
  end;

  begin
    v_capturado := coalesce(nullif(btrim(p_payload->>'capturadoEn'), '')::timestamptz, now());
  exception when others then
    v_capturado := now();
  end;

  begin
    v_lat := nullif(btrim(coalesce(p_payload->>'latitud', '')), '')::numeric(10,7);
    v_lng := nullif(btrim(coalesce(p_payload->>'longitud', '')), '')::numeric(10,7);
    v_prec := nullif(btrim(coalesce(p_payload->>'precisionMetros', '')), '')::numeric(8,2);
  exception when others then
    v_lat := null;
    v_lng := null;
    v_prec := null;
  end;

  if v_entrega_id is not null then
    update comun_comercio.com_entrega_evidencia
       set ent_entregado_por = coalesce(v_uid, ent_entregado_por),
           ent_entregador_nombre = coalesce(nullif(btrim(p_payload->>'entregadorNombre'), ''), v_usu_nombre, ent_entregador_nombre),
           ent_fallecido_destinatario = coalesce(nullif(btrim(p_payload->>'fallecidoDestinatario'), ''), ent_fallecido_destinatario),
           ent_fecha_servicio = coalesce(v_fecha_serv, ent_fecha_servicio),
           ent_capturado_en = v_capturado,
           ent_sincronizado_en = now(),
           ent_descripcion_servicio = coalesce(nullif(btrim(p_payload->>'descripcionServicio'), ''), ent_descripcion_servicio),
           ent_sala_servicio = coalesce(v_sala, ent_sala_servicio),
           ent_ubicacion_nombre = coalesce(nullif(btrim(p_payload->>'ubicacionNombre'), ''), ent_ubicacion_nombre),
           ent_coordinador_nombre = coalesce(nullif(btrim(p_payload->>'coordinadorNombre'), ''), ent_coordinador_nombre),
           ent_recursos_utilizados = coalesce(nullif(btrim(p_payload->>'recursosUtilizados'), ''), ent_recursos_utilizados),
           ent_latitud = coalesce(v_lat, ent_latitud),
           ent_longitud = coalesce(v_lng, ent_longitud),
           ent_precision_metros = coalesce(v_prec, ent_precision_metros),
           ent_direccion_gps = coalesce(nullif(btrim(p_payload->>'direccionGps'), ''), ent_direccion_gps),
           ent_foto_url = coalesce(nullif(btrim(p_payload->>'fotoUrl'), ''), ent_foto_url),
           ent_mapa_url = coalesce(nullif(btrim(p_payload->>'mapaUrl'), ''), ent_mapa_url),
           ent_observaciones = coalesce(nullif(btrim(p_payload->>'observaciones'), ''), ent_observaciones),
           ent_detalle_entrega = coalesce(ent_detalle_entrega, '{}'::jsonb) || case when v_sala is not null then jsonb_build_object('sala_servicio', v_sala) else '{}'::jsonb end,
           ent_estado = case when ent_estado = 'INCLUIDA_EN_INFORME' then 'INCLUIDA_EN_INFORME' else 'ENTREGADA_PENDIENTE_INFORME' end,
           ent_actualizado_en = now()
     where ent_id = v_entrega_id
       and ent_negocio = v_negocio
     returning * into v_reg;
  else
    insert into comun_comercio.com_entrega_evidencia (
      ent_uuid_cliente,
      ent_negocio,
      ent_tipo_origen,
      ent_convenio_id,
      ent_proforma_id,
      ent_orden_taller_id,
      ent_entregado_por,
      ent_entregador_nombre,
      ent_fallecido_destinatario,
      ent_fecha_servicio,
      ent_capturado_en,
      ent_sincronizado_en,
      ent_descripcion_servicio,
      ent_sala_servicio,
      ent_ubicacion_nombre,
      ent_coordinador_nombre,
      ent_recursos_utilizados,
      ent_latitud,
      ent_longitud,
      ent_precision_metros,
      ent_direccion_gps,
      ent_foto_url,
      ent_mapa_url,
      ent_factura_referencia,
      ent_documentos_adjuntos,
      ent_observaciones,
      ent_detalle_entrega,
      ent_estado
    ) values (
      v_uuid_cli,
      v_negocio,
      v_tipo_origen,
      v_convenio_id,
      v_proforma_id,
      v_orden_taller_id,
      v_uid,
      coalesce(nullif(btrim(p_payload->>'entregadorNombre'), ''), v_usu_nombre, 'Delivery'),
      v_fallecido,
      v_fecha_serv,
      v_capturado,
      now(),
      coalesce(nullif(btrim(p_payload->>'descripcionServicio'), ''), 'Set condolencias (3 arreglos)'),
      v_sala,
      coalesce(p_payload->>'ubicacionNombre', ''),
      nullif(btrim(coalesce(p_payload->>'coordinadorNombre', '')), ''),
      coalesce(nullif(btrim(p_payload->>'recursosUtilizados'), ''), 'Flores, follaje, bases y oasis'),
      v_lat,
      v_lng,
      v_prec,
      nullif(btrim(coalesce(p_payload->>'direccionGps', '')), ''),
      nullif(btrim(coalesce(p_payload->>'fotoUrl', '')), ''),
      nullif(btrim(coalesce(p_payload->>'mapaUrl', '')), ''),
      nullif(btrim(coalesce(p_payload->>'facturaReferencia', '')), ''),
      nullif(btrim(coalesce(p_payload->>'documentosAdjuntos', '')), ''),
      nullif(btrim(coalesce(p_payload->>'observaciones', '')), ''),
      coalesce(p_payload->'detalleExtra', '{}'::jsonb) || case when v_sala is not null then jsonb_build_object('sala_servicio', v_sala) else '{}'::jsonb end,
      v_estado
    )
    on conflict (ent_uuid_cliente) do update set
      ent_foto_url = coalesce(excluded.ent_foto_url, comun_comercio.com_entrega_evidencia.ent_foto_url),
      ent_mapa_url = coalesce(excluded.ent_mapa_url, comun_comercio.com_entrega_evidencia.ent_mapa_url),
      ent_sala_servicio = coalesce(excluded.ent_sala_servicio, comun_comercio.com_entrega_evidencia.ent_sala_servicio),
      ent_latitud = coalesce(excluded.ent_latitud, comun_comercio.com_entrega_evidencia.ent_latitud),
      ent_longitud = coalesce(excluded.ent_longitud, comun_comercio.com_entrega_evidencia.ent_longitud),
      ent_sincronizado_en = now(),
      ent_actualizado_en = now()
    returning * into v_reg;

    if v_reg.ent_codigo_ot is null then
      update comun_comercio.com_entrega_evidencia
         set ent_codigo_ot = (case when v_tipo_origen = 'PEDIDO_TIENDA' then 'POD-' else 'OT-' end) || lpad(v_reg.ent_secuencial::text, 4, '0')
       where ent_id = v_reg.ent_id
       returning * into v_reg;
    end if;
  end if;

  -- Sincronizar com_orden_taller al confirmar entrega o programar OT
  if v_reg.ent_estado <> 'PROGRAMADA' then
    update comun_comercio.com_orden_taller
       set ota_estado_taller = 'ENTREGADO',
           ota_entregado_en = now(),
           ota_sala_servicio = coalesce(v_reg.ent_sala_servicio, ota_sala_servicio),
           ota_destinatario_fallecido = coalesce(nullif(v_reg.ent_fallecido_destinatario, ''), ota_destinatario_fallecido),
           ota_cliente_solicita = coalesce(nullif(v_reg.ent_coordinador_nombre, ''), ota_cliente_solicita),
           ota_actualizado_en = now()
     where ota_negocio = v_negocio
       and (
         ota_entrega_id = v_reg.ent_id
         or (v_proforma_id is not null and ota_proforma_id = v_proforma_id)
         or (v_orden_taller_id is not null and ota_id = v_orden_taller_id)
       );
  end if;

  if v_proforma_id is not null and v_reg.ent_estado <> 'PROGRAMADA' then
    update comun_comercio.com_proforma
       set prf_estado = 'ENTREGADO',
           prf_detalle_proforma = coalesce(prf_detalle_proforma, '{}'::jsonb) || jsonb_build_object(
             'entrega_confirmada', true,
             'entrega_evidencia_id', v_reg.ent_id,
             'entrega_foto_url', v_reg.ent_foto_url,
             'entrega_capturado_en', v_reg.ent_capturado_en,
             'estado_taller', 'ENTREGADO'
           ),
           prf_actualizado_en = now()
     where prf_id = v_proforma_id
       and lower(prf_negocio) = v_negocio;
  end if;

  return jsonb_build_object(
    'ok', true,
    'entregaId', v_reg.ent_id,
    'codigoOt', v_reg.ent_codigo_ot,
    'estado', v_reg.ent_estado
  );
end;
$$;

-- 10. Pre-configuración por defecto de los 2 nuevos widgets (Regla 15 / Point 1)
do $$
declare
  v_negocio text;
  v_w record;
  v_widget_id uuid;
begin
  for v_negocio in select unnest(array['tinkay', 'margaritas', 'fastfix', 'tranqi']) loop
    for v_w in
      select * from (values
        (
          'envio_pedidos_taller',
          'Enviar Pedidos a Taller',
          'Validación de ventas, calendario de entregas (Hoy/Semana/Mes), carga manual de pedidos y órdenes rápidas de Exequiales vía llamada para despacho diario al Taller.',
          '/panel/envio-pedidos',
          'Send',
          array['VENTAS', 'VENDEDOR', 'OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN']
        ),
        (
          'taller_floral',
          'Taller',
          'Consola de producción del taller con notificaciones en tiempo real, calendario de elaboración (Hoy/Semana/Mes), vista de hoy y futuros (históricos ocultos por defecto) y cambio de estado (En preparación / Listo para entrega).',
          '/panel/taller',
          'Hammer',
          array['OPERADOR', 'AUXILIAR', 'DELIVERY', 'ADMINISTRADOR', 'SUPERADMIN']
        )
      ) as t(clave, nombre, descripcion, ruta, icono, roles)
    loop
      insert into comun_seguridad.seg_widget (
        wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget
      ) values (
        v_negocio,
        v_w.clave,
        v_w.nombre,
        true,
        jsonb_build_object(
          'descripcion', v_w.descripcion,
          'categoria', 'Operación y Logística Floral',
          'ruta', v_w.ruta,
          'panel_defecto', 'panel_administrar',
          'icono', v_w.icono
        )
      )
      on conflict (wdg_negocio, wdg_clave) do update set
        wdg_nombre = excluded.wdg_nombre,
        wdg_activo = true,
        wdg_detalle_widget = excluded.wdg_detalle_widget,
        wdg_actualizado_en = now()
      returning wdg_id into v_widget_id;

      if v_widget_id is not null then
        insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
        select v_negocio, r, v_widget_id, true
        from unnest(v_w.roles) as r
        on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set
          rlw_visible = true,
          rlw_actualizado_en = now();
      end if;
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';
