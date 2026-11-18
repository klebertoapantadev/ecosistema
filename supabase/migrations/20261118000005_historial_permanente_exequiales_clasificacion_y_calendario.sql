-- ==============================================================================
-- Migración: 20261118000005_historial_permanente_exequiales_clasificacion_y_calendario.sql
-- Requerimientos: PLT-009 / TNK-002 / TNK-005
-- Descripción:
--   1. Garantiza paridad total de almacenamiento en Supabase Storage (`comun-publico/evidencias-entregas/%`)
--      agregando política RLS `FOR UPDATE` autenticada para que las fotos de confirmación de Exequiales
--      (para informe IESS) y del resto de entregas se almacenen siempre de forma idéntica y permanente.
--   2. Incorpora clasificación operativa canónica de pedidos (`ota_clasificacion_pedido` y `ent_clasificacion_pedido`):
--      'DOMICILIO' | 'LOCAL' | 'EXEQUIALES' | 'EVENTOS' | 'MOBILIARIO'.
--   3. Incorpora columnas de evidencia de entrega sincronizadas en `comun_comercio.com_orden_taller`
--      (`ota_evidencia_foto_url`, `ota_evidencia_mapa_url`, `ota_evidencia_latitud`, `ota_evidencia_longitud`,
--      `ota_evidencia_direccion_gps`, `ota_entregado_por_nombre`) para historial permanente unificado.
--   4. Sincronización bidireccional permanente entre `com_proforma`, `com_orden_taller` y `com_entrega_evidencia`
--      (sala de entrega, quién solicitó, detalle del producto, nombre del fallecido, fecha/hora, dirección y foto).
--   5. RPC `com_fn_actualizar_clasificacion_pedido` para reclasificar cualquier pedido en 1 clic.
-- ==============================================================================

-- 0. Garantizar políticas INSERT + UPDATE + SELECT en storage.objects para evidencias e informes
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'comun-publico',
    'comun-publico',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'application/pdf']
  )
  on conflict (id) do update set
    public = true,
    file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), 10485760),
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'application/pdf'];

  drop policy if exists "operaciones_taller_y_entregas_insert_autenticado" on storage.objects;
  create policy "operaciones_taller_y_entregas_insert_autenticado"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'comun-publico'
      and (
        name like 'inventario-rosas/%'
        or name like 'entrega-inmediata/%'
        or name like 'evidencias-entregas/%'
        or name like 'informes-entregas/%'
        or name like 'omnicanal-media/%'
        or name like 'chat-equipo/%'
      )
    );

  drop policy if exists "operaciones_taller_y_entregas_update_autenticado" on storage.objects;
  create policy "operaciones_taller_y_entregas_update_autenticado"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'comun-publico'
      and (
        name like 'inventario-rosas/%'
        or name like 'entrega-inmediata/%'
        or name like 'evidencias-entregas/%'
        or name like 'informes-entregas/%'
        or name like 'omnicanal-media/%'
        or name like 'chat-equipo/%'
      )
    )
    with check (
      bucket_id = 'comun-publico'
      and (
        name like 'inventario-rosas/%'
        or name like 'entrega-inmediata/%'
        or name like 'evidencias-entregas/%'
        or name like 'informes-entregas/%'
        or name like 'omnicanal-media/%'
        or name like 'chat-equipo/%'
      )
    );

  drop policy if exists "operaciones_taller_y_entregas_select_publico" on storage.objects;
  create policy "operaciones_taller_y_entregas_select_publico"
    on storage.objects
    for select
    to anon, authenticated
    using (bucket_id = 'comun-publico');
exception when others then
  null;
end $$;

-- 1. Función pura para normalizar e inferir la clasificación operativa de un pedido
create or replace function comun_comercio.com_fn_inferir_clasificacion_pedido(
  p_clasificacion_explicita text default null,
  p_origen_tipo text default null,
  p_retiro_en_local boolean default false,
  p_sala_servicio text default null,
  p_producto_resumen text default null,
  p_ubicacion_entrega text default null,
  p_items jsonb default '[]'::jsonb
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_exp text := upper(btrim(coalesce(p_clasificacion_explicita, '')));
  v_orig text := upper(btrim(coalesce(p_origen_tipo, '')));
  v_prod text := lower(btrim(coalesce(p_producto_resumen, '')));
  v_ubic text := lower(btrim(coalesce(p_ubicacion_entrega, '')));
  v_items_txt text := lower(coalesce(p_items::text, ''));
begin
  if v_exp in ('DOMICILIO', 'LOCAL', 'EXEQUIALES', 'EVENTOS', 'MOBILIARIO') then
    return v_exp;
  elsif v_exp in ('EXEQUIAL', 'CONDOLENCIAS', 'FUNERARIO') then
    return 'EXEQUIALES';
  elsif v_exp in ('EVENTO', 'CEREMONIA') then
    return 'EVENTOS';
  elsif v_exp in ('RENTA', 'ALQUILER') then
    return 'MOBILIARIO';
  elsif v_exp in ('TIENDA', 'RETIRO', 'RETIRO_LOCAL') then
    return 'LOCAL';
  end if;

  if v_orig in ('EXEQUIALES_LLAMADA', 'ORDEN_TRABAJO_CONVENIO')
     or nullif(btrim(coalesce(p_sala_servicio, '')), '') is not null
     or v_ubic like '%exequial%'
     or v_ubic like '%camposanto%'
     or v_ubic like '%monteolivo%'
     or v_ubic like '%funeraria%' then
    return 'EXEQUIALES';
  end if;

  if v_prod like '%en renta%'
     or v_prod like '%alquiler%'
     or v_prod like '%mobiliario%'
     or v_prod like '%pedestal%'
     or v_prod like '%backing%'
     or v_prod like '%mampara%'
     or v_prod like '%cilindro%'
     or v_items_txt like '%"es_renta":true%'
     or v_items_txt like '%"esrenta":true%'
     or v_items_txt like '%"tipo_oferta":"renta"%' then
    return 'MOBILIARIO';
  end if;

  if v_orig = 'PROFORMA_EVENTO'
     or v_prod like '%arco floral%'
     or v_prod like '%montaje de evento%'
     or v_prod like '%decoracion de evento%'
     or v_prod like '%decoración de evento%' then
    return 'EVENTOS';
  end if;

  if coalesce(p_retiro_en_local, false)
     or v_ubic like '%retiro en tienda%'
     or v_ubic like '%retiro en local%'
     or v_ubic = 'local'
     or v_ubic = 'tienda' then
    return 'LOCAL';
  end if;

  return 'DOMICILIO';
end;
$$;

grant execute on function comun_comercio.com_fn_inferir_clasificacion_pedido(text, text, boolean, text, text, text, jsonb)
  to anon, authenticated, service_role;

-- 2. Nuevas columnas en com_orden_taller y com_entrega_evidencia (idempotente)
do $$
begin
  if to_regclass('comun_comercio.com_orden_taller') is not null then
    alter table comun_comercio.com_orden_taller
      add column if not exists ota_clasificacion_pedido text not null default 'DOMICILIO',
      add column if not exists ota_evidencia_foto_url text,
      add column if not exists ota_evidencia_mapa_url text,
      add column if not exists ota_evidencia_latitud numeric(10,7),
      add column if not exists ota_evidencia_longitud numeric(10,7),
      add column if not exists ota_evidencia_direccion_gps text,
      add column if not exists ota_entregado_por_nombre text;

    alter table comun_comercio.com_orden_taller
      drop constraint if exists com_orden_taller_ota_clasificacion_pedido_check;

    alter table comun_comercio.com_orden_taller
      add constraint com_orden_taller_ota_clasificacion_pedido_check
      check (ota_clasificacion_pedido in ('DOMICILIO', 'LOCAL', 'EXEQUIALES', 'EVENTOS', 'MOBILIARIO'));
  end if;

  if to_regclass('comun_comercio.com_entrega_evidencia') is not null then
    alter table comun_comercio.com_entrega_evidencia
      add column if not exists ent_clasificacion_pedido text;
  end if;
end $$;

create index if not exists idx_com_orden_taller_negocio_clasif_fecha
  on comun_comercio.com_orden_taller (ota_negocio, ota_clasificacion_pedido, ota_fecha_entrega desc)
  where ota_eliminado_en is null;

-- 3. Backfill idempotente de clasificación y evidencias fotográficas existentes
update comun_comercio.com_orden_taller o
   set ota_clasificacion_pedido = comun_comercio.com_fn_inferir_clasificacion_pedido(
         coalesce(p.prf_detalle_proforma->>'clasificacion_pedido', o.ota_detalle_orden->>'clasificacion_pedido'),
         o.ota_origen_tipo,
         o.ota_retiro_en_local,
         o.ota_sala_servicio,
         o.ota_producto_resumen,
         o.ota_ubicacion_entrega,
         o.ota_items
       )
  from (select o2.ota_id, o2.ota_proforma_id from comun_comercio.com_orden_taller o2) ref
  left join comun_comercio.com_proforma p on p.prf_id = ref.ota_proforma_id
 where o.ota_id = ref.ota_id;

update comun_comercio.com_orden_taller o
   set ota_entrega_id = coalesce(o.ota_entrega_id, e.ent_id),
       ota_evidencia_foto_url = coalesce(e.ent_foto_url, o.ota_evidencia_foto_url),
       ota_evidencia_mapa_url = coalesce(e.ent_mapa_url, o.ota_evidencia_mapa_url),
       ota_evidencia_latitud = coalesce(e.ent_latitud, o.ota_evidencia_latitud),
       ota_evidencia_longitud = coalesce(e.ent_longitud, o.ota_evidencia_longitud),
       ota_evidencia_direccion_gps = coalesce(e.ent_direccion_gps, o.ota_evidencia_direccion_gps),
       ota_entregado_por_nombre = coalesce(nullif(btrim(e.ent_entregador_nombre), ''), o.ota_entregado_por_nombre),
       ota_entregado_en = case
         when e.ent_estado <> 'PROGRAMADA' and e.ent_estado <> 'ANULADA' then coalesce(o.ota_entregado_en, e.ent_capturado_en)
         else o.ota_entregado_en
       end,
       ota_sala_servicio = coalesce(o.ota_sala_servicio, e.ent_sala_servicio)
  from comun_comercio.com_entrega_evidencia e
 where e.ent_eliminado_en is null
   and e.ent_estado <> 'ANULADA'
   and (
     o.ota_entrega_id = e.ent_id
     or e.ent_orden_taller_id = o.ota_id
     or (o.ota_proforma_id is not null and e.ent_proforma_id = o.ota_proforma_id)
   );

update comun_comercio.com_entrega_evidencia e
   set ent_clasificacion_pedido = coalesce(
         o.ota_clasificacion_pedido,
         case when e.ent_tipo_origen = 'ORDEN_TRABAJO_CONVENIO' then 'EXEQUIALES' else 'DOMICILIO' end
       ),
       ent_orden_taller_id = coalesce(e.ent_orden_taller_id, o.ota_id)
  from comun_comercio.com_orden_taller o
 where o.ota_eliminado_en is null
   and (o.ota_entrega_id = e.ent_id or e.ent_orden_taller_id = o.ota_id or (e.ent_proforma_id is not null and o.ota_proforma_id = e.ent_proforma_id));

-- 4. Sincronizador idempotente actualizado (incluye clasificación y fotos de entrega)
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
  v_retiro boolean;
  v_sala text;
  v_ubicacion text;
  v_clasificacion text;
  v_tiene_renta boolean;
  v_nueva_ota_id uuid;
begin
  -- 4.1 Sincronizar ventas y proformas confirmadas desde com_proforma
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

    -- Verificar si alguno de los productos del pedido es de RENTA / MOBILIARIO en catálogo
    select exists (
      select 1
      from jsonb_array_elements(
        case when jsonb_typeof(r.prf_detalle_proforma->'items') = 'array' then r.prf_detalle_proforma->'items' else '[]'::jsonb end
      ) it
      join comun_comercio.com_producto pr
        on (it->>'producto_id' is not null and pr.pro_id::text = (it->>'producto_id'))
        or (it->>'productoId' is not null and pr.pro_id::text = (it->>'productoId'))
      where upper(coalesce(pr.pro_tipo, '')) = 'RENTA'
         or coalesce((pr.pro_detalle_producto->>'es_renta')::boolean, false) = true
    ) into v_tiene_renta;

    v_retiro := coalesce((r.prf_detalle_proforma->'logistica_entrega'->>'retiro_en_local')::boolean, false);
    v_sala := nullif(btrim(coalesce(r.prf_detalle_proforma->'logistica_entrega'->>'sala_servicio', r.prf_detalle_proforma->>'sala_servicio', '')), '');
    v_ubicacion := coalesce(
      r.prf_detalle_proforma->'logistica_entrega'->>'direccion',
      r.prf_detalle_proforma->'ubicacion'->>'direccion',
      case when v_retiro then 'Retiro en Tienda' else '' end
    );

    v_clasificacion := comun_comercio.com_fn_inferir_clasificacion_pedido(
      coalesce(
        r.prf_detalle_proforma->>'clasificacion_pedido',
        case when v_tiene_renta then 'MOBILIARIO' else null end
      ),
      v_origen,
      v_retiro,
      v_sala,
      v_resumen,
      v_ubicacion,
      coalesce(r.prf_detalle_proforma->'items', '[]'::jsonb)
    );

    insert into comun_comercio.com_orden_taller (
      ota_negocio,
      ota_codigo,
      ota_origen_tipo,
      ota_clasificacion_pedido,
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
      ota_sala_servicio,
      ota_ubicacion_entrega,
      ota_enlace_mapa,
      ota_retiro_en_local,
      ota_dedicatoria,
      ota_tarjeta_token,
      ota_tarjeta_tipo,
      ota_observaciones,
      ota_total_usd,
      ota_evidencia_foto_url,
      ota_entregado_en
    ) values (
      v_negocio,
      coalesce(
        r.prf_detalle_proforma->>'codigo_orden',
        r.prf_detalle_proforma->>'codigo_proforma',
        v_prefijo || '-ORD-' || lpad(r.prf_secuencial::text, 4, '0')
      ),
      v_origen,
      v_clasificacion,
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
      v_sala,
      v_ubicacion,
      coalesce(
        r.prf_detalle_proforma->'logistica_entrega'->>'enlace_mapa',
        r.prf_detalle_proforma->'logistica_entrega'->>'enlaceMapa'
      ),
      v_retiro,
      v_dedicatoria,
      substr(replace(gen_random_uuid()::text, '-', ''), 1, 18),
      case when v_clasificacion = 'EXEQUIALES' then 'CONDOLENCIAS_PLANA' else 'DIPTICO' end,
      nullif(btrim(coalesce(r.prf_detalle_proforma->'evento'->>'notasEvento', '')), ''),
      coalesce(r.prf_total, 0),
      nullif(btrim(coalesce(r.prf_detalle_proforma->>'entrega_foto_url', '')), ''),
      case
        when v_estado_inicial = 'ENTREGADO' then coalesce(
          nullif(btrim(coalesce(r.prf_detalle_proforma->>'entrega_capturado_en', '')), '')::timestamptz,
          r.prf_actualizado_en
        )
        else null
      end
    )
    on conflict do nothing;
  end loop;

  -- 4.2 Sincronizar permanentemente TODAS las OTs Exequiales en com_entrega_evidencia hacia com_orden_taller
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
        where (o.ota_entrega_id = e.ent_id or e.ent_orden_taller_id = o.ota_id)
          and o.ota_eliminado_en is null
      )
  loop
    insert into comun_comercio.com_orden_taller (
      ota_negocio,
      ota_codigo,
      ota_origen_tipo,
      ota_clasificacion_pedido,
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
      ota_tarjeta_token,
      ota_tarjeta_tipo,
      ota_observaciones,
      ota_enviado_taller_en,
      ota_entregado_en,
      ota_entregado_por_nombre,
      ota_evidencia_foto_url,
      ota_evidencia_mapa_url,
      ota_evidencia_latitud,
      ota_evidencia_longitud,
      ota_evidencia_direccion_gps
    ) values (
      v_negocio,
      coalesce(r.ent_codigo_ot, 'OT-' || lpad(r.ent_secuencial::text, 4, '0')),
      'EXEQUIALES_LLAMADA',
      'EXEQUIALES',
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
      coalesce(nullif(btrim(r.ent_coordinador_nombre), ''), r.ent_detalle_entrega->>'quien_solicita', 'Exequiales IESS'),
      coalesce(r.ent_fallecido_destinatario, ''),
      coalesce(r.ent_sala_servicio, r.ent_detalle_entrega->>'sala_servicio'),
      coalesce(nullif(btrim(r.ent_ubicacion_nombre), ''), 'Exequiales del IESS'),
      substr(replace(gen_random_uuid()::text, '-', ''), 1, 18),
      'CONDOLENCIAS_PLANA',
      r.ent_observaciones,
      r.ent_creado_en,
      case when r.ent_estado <> 'PROGRAMADA' then r.ent_capturado_en else null end,
      r.ent_entregador_nombre,
      r.ent_foto_url,
      r.ent_mapa_url,
      r.ent_latitud,
      r.ent_longitud,
      r.ent_direccion_gps
    )
    on conflict do nothing
    returning ota_id into v_nueva_ota_id;

    if v_nueva_ota_id is not null then
      update comun_comercio.com_entrega_evidencia
         set ent_orden_taller_id = v_nueva_ota_id,
             ent_clasificacion_pedido = 'EXEQUIALES'
       where ent_id = r.ent_id;
    end if;
  end loop;
end;
$$;

grant execute on function comun_comercio.com_fn_sincronizar_ventas_a_ordenes_taller(text) to authenticated, service_role;

-- 5. RPC de lectura integral para Pantalla de Envío de Pedidos, Calendario y Pantalla de Taller
create or replace function comun_comercio.com_fn_obtener_consola_taller_y_despacho(p_negocio text default 'tinkay')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_rol text := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);
  v_es_solo_taller boolean := (v_rol = 'TALLER');
  v_usu_nombre text;
  v_ordenes jsonb;
  v_productos jsonb;
  v_repartidores jsonb := '[]'::jsonb;
begin
  if v_rol not in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS', 'TALLER') then
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
      'clasificacionPedido', coalesce(
        o.ota_clasificacion_pedido,
        comun_comercio.com_fn_inferir_clasificacion_pedido(
          null, o.ota_origen_tipo, o.ota_retiro_en_local, o.ota_sala_servicio, o.ota_producto_resumen, o.ota_ubicacion_entrega, o.ota_items
        )
      ),
      'proformaId', o.ota_proforma_id,
      'entregaId', coalesce(o.ota_entrega_id, ev.ent_id),
      'estadoTaller', o.ota_estado_taller,
      'estadoPago', case when v_es_solo_taller then 'VALIDADO' else coalesce(p.prf_estado, o.ota_estado_pago) end,
      'metodoPago', case when v_es_solo_taller then null else o.ota_metodo_pago end,
      'fechaPedido', o.ota_fecha_pedido,
      'fechaEntrega', to_char(o.ota_fecha_entrega, 'YYYY-MM-DD'),
      'fechaElaboracion', case when o.ota_fecha_elaboracion is not null then to_char(o.ota_fecha_elaboracion, 'YYYY-MM-DD') else null end,
      'franjaHoraria', o.ota_franja_horaria,
      'horaEspecifica', coalesce(o.ota_hora_especifica, ev.ent_hora_solicitada),
      'productoResumen', o.ota_producto_resumen,
      'items', coalesce(o.ota_items, '[]'::jsonb),
      'clienteSolicita', coalesce(nullif(btrim(o.ota_cliente_solicita), ''), ev.ent_coordinador_nombre, 'Cliente'),
      'clienteTelefono', case when v_es_solo_taller then null else o.ota_cliente_telefono end,
      'destinatarioFallecido', coalesce(nullif(btrim(o.ota_destinatario_fallecido), ''), ev.ent_fallecido_destinatario, ''),
      'salaServicio', coalesce(o.ota_sala_servicio, ev.ent_sala_servicio),
      'ubicacionEntrega', coalesce(nullif(btrim(o.ota_ubicacion_entrega), ''), ev.ent_ubicacion_nombre, ''),
      'enlaceMapa', o.ota_enlace_mapa,
      'retiroEnLocal', o.ota_retiro_en_local,
      'dedicatoria', o.ota_dedicatoria,
      'observaciones', o.ota_observaciones,
      'totalUsd', case when v_es_solo_taller then 0 else o.ota_total_usd end,
      'enviadoTallerEn', o.ota_enviado_taller_en,
      'enviadoNombre', o.ota_enviado_nombre,
      'preparacionEn', o.ota_preparacion_en,
      'listoEn', o.ota_listo_en,
      'entregadoEn', coalesce(o.ota_entregado_en, case when ev.ent_estado not in ('PROGRAMADA', 'ANULADA') then ev.ent_capturado_en else null end),
      'actualizadoTallerNombre', o.ota_actualizado_taller_nombre,
      'tarjetaToken', o.ota_tarjeta_token,
      'tarjetaTipo', coalesce(o.ota_tarjeta_tipo, 'DIPTICO'),
      'tarjetaMusicaUrl', o.ota_tarjeta_musica_url,
      'tarjetaMusicaTitulo', o.ota_tarjeta_musica_titulo,
      'tarjetaLyrics', coalesce(o.ota_tarjeta_lyrics, '[]'::jsonb),
      'tarjetaMetadata', coalesce(o.ota_tarjeta_metadata, '{}'::jsonb),
      'repartidorId', o.ota_repartidor_id,
      'repartidorNombre', o.ota_repartidor_nombre,
      'repartidorTipo', o.ota_repartidor_tipo,
      'enRuta', coalesce(o.ota_en_ruta, false),
      'enRutaDesde', o.ota_en_ruta_desde,
      'rutaLatitud', o.ota_ruta_latitud,
      'rutaLongitud', o.ota_ruta_longitud,
      'rutaActualizadaEn', o.ota_ruta_actualizada_en,
      'evidenciaFotoUrl', coalesce(ev.ent_foto_url, o.ota_evidencia_foto_url, p.prf_detalle_proforma->>'entrega_foto_url'),
      'evidenciaMapaUrl', coalesce(ev.ent_mapa_url, o.ota_evidencia_mapa_url),
      'evidenciaLatitud', coalesce(ev.ent_latitud, o.ota_evidencia_latitud),
      'evidenciaLongitud', coalesce(ev.ent_longitud, o.ota_evidencia_longitud),
      'evidenciaDireccionGps', coalesce(ev.ent_direccion_gps, o.ota_evidencia_direccion_gps),
      'entregadoPorNombre', coalesce(nullif(btrim(ev.ent_entregador_nombre), 'Por asignar'), o.ota_entregado_por_nombre),
      'estadoEvidencia', ev.ent_estado,
      'numeroInforme', inf.ife_numero_informe
    ) as item
    from comun_comercio.com_orden_taller o
    left join comun_comercio.com_proforma p on p.prf_id = o.ota_proforma_id
    left join lateral (
      select e.*
      from comun_comercio.com_entrega_evidencia e
      where e.ent_negocio = v_negocio
        and e.ent_eliminado_en is null
        and e.ent_estado <> 'ANULADA'
        and (
          e.ent_id = o.ota_entrega_id
          or e.ent_orden_taller_id = o.ota_id
          or (o.ota_proforma_id is not null and e.ent_proforma_id = o.ota_proforma_id)
        )
      order by
        (case when e.ent_foto_url is not null and btrim(e.ent_foto_url) <> '' then 0 else 1 end) asc,
        e.ent_actualizado_en desc
      limit 1
    ) ev on true
    left join comun_comercio.com_informe_entregas inf
      on inf.ife_id = ev.ent_informe_id
     and inf.ife_eliminado_en is null
    where o.ota_negocio = v_negocio
      and o.ota_eliminado_en is null
      and (not v_es_solo_taller or o.ota_estado_taller <> 'PENDIENTE_ENVIO')
    order by
      (case when o.ota_estado_taller not in ('ENTREGADO', 'ANULADO') then 0 else 1 end) asc,
      o.ota_fecha_entrega desc,
      (case when o.ota_clasificacion_pedido = 'EXEQUIALES' or o.ota_origen_tipo = 'EXEQUIALES_LLAMADA' then 0 else 1 end) asc,
      o.ota_creado_en desc
    limit 1500
  ) sub;

  if v_es_solo_taller then
    v_productos := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(sub.prod), '[]'::jsonb)
    into v_productos
    from (
      select jsonb_build_object(
        'productoId', pr.pro_id,
        'productoNombre', pr.pro_nombre,
        'tipoProducto', pr.pro_tipo,
        'esRenta', (upper(coalesce(pr.pro_tipo, '')) = 'RENTA' or coalesce((pr.pro_detalle_producto->>'es_renta')::boolean, false)),
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

    begin
      v_repartidores := comun_comercio.com_fn_listar_repartidores_negocio(v_negocio);
    exception when others then
      v_repartidores := '[]'::jsonb;
    end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'rolOperativo', v_rol,
    'usuarioActualNombre', coalesce(v_usu_nombre, 'Operador'),
    'ordenes', v_ordenes,
    'productosCatalogo', v_productos,
    'repartidoresNegocio', v_repartidores
  );
end;
$$;

grant execute on function comun_comercio.com_fn_obtener_consola_taller_y_despacho(text) to authenticated, service_role;

-- 6. RPC para crear o editar pedido (Manual Admin / Ventas / Llamada Exequiales) con clasificación canónica
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
  v_clasificacion text;
  v_enviar boolean;
  v_fecha_entrega date;
  v_fecha_elab date;
  v_hora text;
  v_franja text;
  v_sala text;
  v_solicita text;
  v_destinatario text;
  v_ubicacion text;
  v_retiro boolean;
  v_resumen text;
  v_items jsonb;
  v_convenio_id uuid;
  v_entrega_id uuid;
  v_codigo text;
  v_fecha_serv_ts timestamptz;
  v_orden comun_comercio.com_orden_taller;
  v_tarjeta_tipo text;
  v_tarjeta_musica_url text;
  v_tarjeta_musica_titulo text;
  v_dedicatoria_nueva text;
  v_meta jsonb;
  v_historial jsonb;
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

  v_retiro := coalesce((p_payload->>'retiroEnLocal')::boolean, false);
  v_sala := nullif(btrim(coalesce(p_payload->>'salaServicio', '')), '');
  v_solicita := coalesce(nullif(btrim(coalesce(p_payload->>'clienteSolicita', '')), ''), 'Cliente');
  v_resumen := coalesce(
    nullif(btrim(coalesce(p_payload->>'productoResumen', '')), ''),
    case when v_origen = 'EXEQUIALES_LLAMADA' then 'Set condolencias (3 arreglos)' else 'Arreglo floral' end
  );
  v_items := case
    when jsonb_typeof(p_payload->'items') = 'array' and jsonb_array_length(p_payload->'items') > 0 then p_payload->'items'
    else jsonb_build_array(jsonb_build_object('descripcion', v_resumen, 'cantidad', 1))
  end;

  v_ubicacion := coalesce(
    nullif(btrim(coalesce(p_payload->>'ubicacionEntrega', '')), ''),
    case
      when v_retiro then 'Retiro en Tienda'
      when v_origen = 'EXEQUIALES_LLAMADA' then 'Exequiales del IESS'
      else 'Por coordinar'
    end
  );

  v_clasificacion := comun_comercio.com_fn_inferir_clasificacion_pedido(
    p_payload->>'clasificacionPedido',
    v_origen,
    v_retiro,
    v_sala,
    v_resumen,
    v_ubicacion,
    v_items
  );

  if v_clasificacion = 'LOCAL' then
    v_retiro := true;
  end if;

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

  v_destinatario := coalesce(
    nullif(btrim(coalesce(p_payload->>'destinatarioFallecido', '')), ''),
    case
      when v_clasificacion = 'EXEQUIALES' and v_sala is not null then 'Por confirmar (' || v_sala || ')'
      when v_clasificacion = 'EXEQUIALES' then 'Por confirmar'
      else v_solicita
    end
  );

  v_tarjeta_tipo := case
    when p_payload->>'tarjetaTipo' in ('DIPTICO', 'CONDOLENCIAS_PLANA', 'SOLO_DIGITAL') then p_payload->>'tarjetaTipo'
    when v_clasificacion = 'EXEQUIALES' or lower(v_resumen) like '%condolen%' or lower(v_resumen) like '%funebr%' then 'CONDOLENCIAS_PLANA'
    else 'DIPTICO'
  end;

  v_tarjeta_musica_url := nullif(btrim(coalesce(p_payload->>'tarjetaMusicaUrl', '')), '');
  v_tarjeta_musica_titulo := nullif(btrim(coalesce(p_payload->>'tarjetaMusicaTitulo', '')), '');
  v_dedicatoria_nueva := nullif(btrim(coalesce(p_payload->>'dedicatoria', '')), '');

  -- Edición de una orden existente
  if v_orden_id is not null then
    select * into v_orden
      from comun_comercio.com_orden_taller
     where ota_id = v_orden_id and ota_negocio = v_negocio;

    if v_orden.ota_id is null then
      return jsonb_build_object('ok', false, 'error', 'No se encontró el pedido para actualizar.');
    end if;

    v_meta := coalesce(v_orden.ota_tarjeta_metadata, '{}'::jsonb);

    if v_dedicatoria_nueva is distinct from v_orden.ota_dedicatoria then
      v_historial := coalesce(v_meta->'historial_cambios', '[]'::jsonb);
      v_historial := v_historial || jsonb_build_array(jsonb_build_object(
        'autor', v_usu_nombre,
        'rol', 'STAFF_TINKAY',
        'fecha', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
        'dedicatoria_anterior', v_orden.ota_dedicatoria,
        'dedicatoria_nueva', v_dedicatoria_nueva
      ));
      v_meta := jsonb_set(v_meta, '{historial_cambios}', v_historial, true);
    end if;

    update comun_comercio.com_orden_taller
       set ota_clasificacion_pedido = coalesce(
             nullif(upper(btrim(coalesce(p_payload->>'clasificacionPedido', ''))), ''),
             v_clasificacion,
             ota_clasificacion_pedido
           ),
           ota_fecha_entrega = v_fecha_entrega,
           ota_fecha_elaboracion = coalesce(v_fecha_elab, ota_fecha_elaboracion),
           ota_franja_horaria = coalesce(v_franja, ota_franja_horaria),
           ota_hora_especifica = case when p_payload ? 'horaEspecifica' then v_hora else ota_hora_especifica end,
           ota_producto_resumen = v_resumen,
           ota_items = v_items,
           ota_cliente_solicita = v_solicita,
           ota_cliente_telefono = coalesce(nullif(btrim(p_payload->>'clienteTelefono'), ''), ota_cliente_telefono),
           ota_destinatario_fallecido = v_destinatario,
           ota_sala_servicio = case when p_payload ? 'salaServicio' then v_sala else ota_sala_servicio end,
           ota_ubicacion_entrega = coalesce(nullif(btrim(p_payload->>'ubicacionEntrega'), ''), ota_ubicacion_entrega),
           ota_enlace_mapa = case when p_payload ? 'enlaceMapa' then nullif(btrim(p_payload->>'enlaceMapa'), '') else ota_enlace_mapa end,
           ota_retiro_en_local = case when p_payload ? 'retiroEnLocal' then v_retiro else (v_clasificacion = 'LOCAL') end,
           ota_dedicatoria = case when p_payload ? 'dedicatoria' then v_dedicatoria_nueva else ota_dedicatoria end,
           ota_tarjeta_tipo = coalesce(v_tarjeta_tipo, ota_tarjeta_tipo),
           ota_tarjeta_musica_url = coalesce(v_tarjeta_musica_url, ota_tarjeta_musica_url),
           ota_tarjeta_musica_titulo = coalesce(v_tarjeta_musica_titulo, ota_tarjeta_musica_titulo),
           ota_tarjeta_metadata = v_meta,
           ota_observaciones = case when p_payload ? 'observaciones' then nullif(btrim(p_payload->>'observaciones'), '') else ota_observaciones end,
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
         set ent_fallecido_destinatario = v_orden.ota_destinatario_fallecido,
             ent_descripcion_servicio = v_orden.ota_producto_resumen,
             ent_sala_servicio = v_orden.ota_sala_servicio,
             ent_coordinador_nombre = v_orden.ota_cliente_solicita,
             ent_hora_solicitada = v_orden.ota_hora_especifica,
             ent_ubicacion_nombre = v_orden.ota_ubicacion_entrega,
             ent_clasificacion_pedido = v_orden.ota_clasificacion_pedido,
             ent_actualizado_en = now()
       where ent_id = v_orden.ota_entrega_id;
    end if;

    if v_orden.ota_proforma_id is not null then
      update comun_comercio.com_proforma
         set prf_detalle_proforma = jsonb_set(
               jsonb_set(
                 coalesce(prf_detalle_proforma, '{}'::jsonb),
                 '{clasificacion_pedido}',
                 to_jsonb(v_orden.ota_clasificacion_pedido),
                 true
               ),
               '{logistica_entrega}',
               coalesce(prf_detalle_proforma->'logistica_entrega', '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
                 'fecha_entrega', to_char(v_orden.ota_fecha_entrega, 'YYYY-MM-DD'),
                 'franja_horaria', v_orden.ota_franja_horaria,
                 'hora_exacta', v_orden.ota_hora_especifica,
                 'direccion', v_orden.ota_ubicacion_entrega,
                 'enlace_mapa', v_orden.ota_enlace_mapa,
                 'retiro_en_local', v_orden.ota_retiro_en_local,
                 'destinatario_nombre', v_orden.ota_destinatario_fallecido,
                 'sala_servicio', v_orden.ota_sala_servicio
               )),
               true
             ),
             prf_actualizado_en = now()
       where prf_id = v_orden.ota_proforma_id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'ordenId', v_orden.ota_id,
      'codigo', v_orden.ota_codigo,
      'clasificacionPedido', v_orden.ota_clasificacion_pedido,
      'estadoTaller', v_orden.ota_estado_taller,
      'tarjetaToken', v_orden.ota_tarjeta_token
    );
  end if;

  -- Si es Exequiales por llamada (convenio), crear de una vez la OT vinculada en com_entrega_evidencia
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
      ent_clasificacion_pedido,
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
      'EXEQUIALES',
      v_convenio_id,
      'Por asignar',
      v_destinatario,
      v_fecha_serv_ts,
      now(),
      v_resumen,
      v_sala,
      v_hora,
      v_ubicacion,
      v_solicita,
      'Flores, follaje, bases y oasis',
      nullif(btrim(coalesce(p_payload->>'observaciones', '')), ''),
      jsonb_strip_nulls(jsonb_build_object(
        'sala_servicio', v_sala,
        'hora_solicitada', v_hora,
        'quien_solicita', v_solicita,
        'clasificacion_pedido', 'EXEQUIALES'
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
    v_codigo := 'PED-' || to_char(v_fecha_entrega, 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
  end if;

  v_meta := jsonb_build_object(
    'origen', case when v_origen = 'MANUAL_ADMIN' then 'OPERADOR_TINKAY' else 'AUTOMATICO_SISTEMA' end,
    'creado_por', v_usu_nombre,
    'historial_cambios', jsonb_build_array(jsonb_build_object(
      'autor', v_usu_nombre,
      'rol', 'CREADOR',
      'fecha', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
      'dedicatoria', v_dedicatoria_nueva
    )),
    'vistas_cliente', 0,
    'impresiones', 0
  );

  insert into comun_comercio.com_orden_taller (
    ota_negocio,
    ota_codigo,
    ota_origen_tipo,
    ota_clasificacion_pedido,
    ota_entrega_id,
    ota_estado_taller,
    ota_estado_pago,
    ota_metodo_pago,
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
    ota_tarjeta_token,
    ota_tarjeta_tipo,
    ota_tarjeta_musica_url,
    ota_tarjeta_musica_titulo,
    ota_tarjeta_metadata,
    ota_observaciones,
    ota_total_usd,
    ota_enviado_taller_en,
    ota_enviado_por,
    ota_enviado_nombre
  ) values (
    v_negocio,
    v_codigo,
    v_origen,
    v_clasificacion,
    v_entrega_id,
    case when v_enviar then 'ENVIADO_TALLER' else 'PENDIENTE_ENVIO' end,
    coalesce(nullif(btrim(p_payload->>'estadoPago'), ''), case when v_origen = 'EXEQUIALES_LLAMADA' then 'CONVENIO_IESS' else 'PENDIENTE_PAGO' end),
    coalesce(nullif(btrim(p_payload->>'metodoPago'), ''), case when v_origen = 'EXEQUIALES_LLAMADA' then 'convenio' else 'manual' end),
    v_fecha_entrega,
    v_fecha_elab,
    v_franja,
    v_hora,
    v_resumen,
    v_items,
    v_solicita,
    nullif(btrim(p_payload->>'clienteTelefono'), ''),
    v_destinatario,
    v_sala,
    v_ubicacion,
    nullif(btrim(p_payload->>'enlaceMapa'), ''),
    v_retiro,
    v_dedicatoria_nueva,
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 18),
    v_tarjeta_tipo,
    v_tarjeta_musica_url,
    v_tarjeta_musica_titulo,
    v_meta,
    nullif(btrim(p_payload->>'observaciones'), ''),
    coalesce((p_payload->>'totalUsd')::numeric, 0),
    case when v_enviar then now() else null end,
    case when v_enviar then v_uid else null end,
    case when v_enviar then v_usu_nombre else null end
  ) returning * into v_orden;

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
    'clasificacionPedido', v_orden.ota_clasificacion_pedido,
    'estadoTaller', v_orden.ota_estado_taller,
    'tarjetaToken', v_orden.ota_tarjeta_token
  );
end;
$$;

grant execute on function comun_comercio.com_fn_crear_o_actualizar_pedido_operador(text, jsonb) to authenticated, service_role;

-- 7. RPC para actualizar/sincronizar entregas de campo garantizando historial permanente + foto en com_orden_taller
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
  v_filas_ota int := 0;
  v_nueva_ota_id uuid;
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
      ent_clasificacion_pedido,
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
      case when v_tipo_origen = 'ORDEN_TRABAJO_CONVENIO' then 'EXEQUIALES' else null end,
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
      coalesce(nullif(btrim(p_payload->>'ubicacionNombre'), ''), case when v_tipo_origen = 'ORDEN_TRABAJO_CONVENIO' then 'Exequiales del IESS' else '' end),
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
      ent_direccion_gps = coalesce(excluded.ent_direccion_gps, comun_comercio.com_entrega_evidencia.ent_direccion_gps),
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

  -- Sincronizar com_orden_taller con evidencia fotográfica, sala, solicitante, fallecido y hora
  update comun_comercio.com_orden_taller
     set ota_entrega_id = coalesce(ota_entrega_id, v_reg.ent_id),
         ota_estado_taller = case when v_reg.ent_estado <> 'PROGRAMADA' then 'ENTREGADO' else ota_estado_taller end,
         ota_entregado_en = case when v_reg.ent_estado <> 'PROGRAMADA' then coalesce(v_reg.ent_capturado_en, ota_entregado_en, now()) else ota_entregado_en end,
         ota_entregado_por_nombre = coalesce(nullif(btrim(v_reg.ent_entregador_nombre), 'Por asignar'), ota_entregado_por_nombre),
         ota_evidencia_foto_url = coalesce(v_reg.ent_foto_url, ota_evidencia_foto_url),
         ota_evidencia_mapa_url = coalesce(v_reg.ent_mapa_url, ota_evidencia_mapa_url),
         ota_evidencia_latitud = coalesce(v_reg.ent_latitud, ota_evidencia_latitud),
         ota_evidencia_longitud = coalesce(v_reg.ent_longitud, ota_evidencia_longitud),
         ota_evidencia_direccion_gps = coalesce(v_reg.ent_direccion_gps, ota_evidencia_direccion_gps),
         ota_sala_servicio = coalesce(v_reg.ent_sala_servicio, ota_sala_servicio),
         ota_destinatario_fallecido = coalesce(nullif(v_reg.ent_fallecido_destinatario, ''), ota_destinatario_fallecido),
         ota_cliente_solicita = coalesce(nullif(v_reg.ent_coordinador_nombre, ''), ota_cliente_solicita),
         ota_ubicacion_entrega = coalesce(nullif(btrim(v_reg.ent_ubicacion_nombre), ''), ota_ubicacion_entrega),
         ota_actualizado_en = now()
   where ota_negocio = v_negocio
     and ota_eliminado_en is null
     and (
       ota_entrega_id = v_reg.ent_id
       or (v_reg.ent_orden_taller_id is not null and ota_id = v_reg.ent_orden_taller_id)
       or (v_proforma_id is not null and ota_proforma_id = v_proforma_id)
       or (v_orden_taller_id is not null and ota_id = v_orden_taller_id)
     );

  get diagnostics v_filas_ota = row_count;

  -- Si se registró una entrega Exequiales directa en campo sin orden previa en com_orden_taller, crear su registro histórico permanente de inmediato
  if v_filas_ota = 0 and v_tipo_origen = 'ORDEN_TRABAJO_CONVENIO' then
    insert into comun_comercio.com_orden_taller (
      ota_negocio,
      ota_codigo,
      ota_origen_tipo,
      ota_clasificacion_pedido,
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
      ota_tarjeta_token,
      ota_tarjeta_tipo,
      ota_observaciones,
      ota_enviado_taller_en,
      ota_entregado_en,
      ota_entregado_por_nombre,
      ota_evidencia_foto_url,
      ota_evidencia_mapa_url,
      ota_evidencia_latitud,
      ota_evidencia_longitud,
      ota_evidencia_direccion_gps
    ) values (
      v_negocio,
      coalesce(v_reg.ent_codigo_ot, 'OT-' || lpad(v_reg.ent_secuencial::text, 4, '0')),
      'EXEQUIALES_LLAMADA',
      'EXEQUIALES',
      v_reg.ent_id,
      case when v_reg.ent_estado = 'PROGRAMADA' then 'ENVIADO_TALLER' else 'ENTREGADO' end,
      'CONVENIO_IESS',
      'convenio',
      v_reg.ent_creado_en,
      (v_reg.ent_fecha_servicio at time zone 'America/Guayaquil')::date,
      (v_reg.ent_fecha_servicio at time zone 'America/Guayaquil')::date,
      coalesce(v_reg.ent_hora_solicitada, to_char(v_reg.ent_fecha_servicio at time zone 'America/Guayaquil', 'HH24:MI')),
      coalesce(v_reg.ent_descripcion_servicio, 'Set condolencias (3 arreglos)'),
      jsonb_build_array(jsonb_build_object(
        'descripcion', coalesce(v_reg.ent_descripcion_servicio, 'Set condolencias (3 arreglos)'),
        'cantidad', 1
      )),
      coalesce(nullif(btrim(v_reg.ent_coordinador_nombre), ''), 'Exequiales IESS'),
      coalesce(v_reg.ent_fallecido_destinatario, ''),
      v_reg.ent_sala_servicio,
      coalesce(nullif(btrim(v_reg.ent_ubicacion_nombre), ''), 'Exequiales del IESS'),
      substr(replace(gen_random_uuid()::text, '-', ''), 1, 18),
      'CONDOLENCIAS_PLANA',
      v_reg.ent_observaciones,
      v_reg.ent_creado_en,
      case when v_reg.ent_estado <> 'PROGRAMADA' then v_reg.ent_capturado_en else null end,
      v_reg.ent_entregador_nombre,
      v_reg.ent_foto_url,
      v_reg.ent_mapa_url,
      v_reg.ent_latitud,
      v_reg.ent_longitud,
      v_reg.ent_direccion_gps
    )
    on conflict do nothing
    returning ota_id into v_nueva_ota_id;

    if v_nueva_ota_id is not null then
      update comun_comercio.com_entrega_evidencia
         set ent_orden_taller_id = v_nueva_ota_id
       where ent_id = v_reg.ent_id;
    end if;
  end if;

  if v_proforma_id is not null and v_reg.ent_estado <> 'PROGRAMADA' then
    update comun_comercio.com_proforma
       set prf_estado = 'ENTREGADO',
           prf_detalle_proforma = coalesce(prf_detalle_proforma, '{}'::jsonb) || jsonb_build_object(
             'entrega_confirmada', true,
             'entrega_evidencia_id', v_reg.ent_id,
             'entrega_foto_url', v_reg.ent_foto_url,
             'entrega_mapa_url', v_reg.ent_mapa_url,
             'entrega_latitud', v_reg.ent_latitud,
             'entrega_longitud', v_reg.ent_longitud,
             'entrega_direccion_gps', v_reg.ent_direccion_gps,
             'entrega_entregador_nombre', v_reg.ent_entregador_nombre,
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
    'fotoUrl', v_reg.ent_foto_url,
    'estado', v_reg.ent_estado
  );
end;
$$;

grant execute on function comun_comercio.com_fn_registrar_o_sincronizar_entrega(text, jsonb) to authenticated, service_role;

-- 8. Actualizar com_fn_actualizar_entrega_evidencia para propagar ediciones (sala, fallecido, solicitante, foto) al historial permanente
create or replace function comun_comercio.com_fn_actualizar_entrega_evidencia(
  p_negocio text,
  p_entrega_id uuid,
  p_cambios jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_sala text := nullif(btrim(coalesce(p_cambios->>'salaServicio', '')), '');
  v_reg comun_comercio.com_entrega_evidencia;
begin
  if not comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Solo administración u operaciones pueden editar registros antes del informe.');
  end if;

  update comun_comercio.com_entrega_evidencia
     set ent_fallecido_destinatario = coalesce(nullif(btrim(p_cambios->>'fallecidoDestinatario'), ''), ent_fallecido_destinatario),
         ent_fecha_servicio = coalesce(nullif(btrim(p_cambios->>'fechaServicio'), '')::timestamptz, ent_fecha_servicio),
         ent_descripcion_servicio = coalesce(nullif(btrim(p_cambios->>'descripcionServicio'), ''), ent_descripcion_servicio),
         ent_sala_servicio = case when p_cambios ? 'salaServicio' then v_sala else ent_sala_servicio end,
         ent_ubicacion_nombre = coalesce(p_cambios->>'ubicacionNombre', ent_ubicacion_nombre),
         ent_coordinador_nombre = coalesce(p_cambios->>'coordinadorNombre', ent_coordinador_nombre),
         ent_recursos_utilizados = coalesce(nullif(btrim(p_cambios->>'recursosUtilizados'), ''), ent_recursos_utilizados),
         ent_entregador_nombre = coalesce(nullif(btrim(p_cambios->>'entregadorNombre'), ''), ent_entregador_nombre),
         ent_factura_referencia = coalesce(p_cambios->>'facturaReferencia', ent_factura_referencia),
         ent_documentos_adjuntos = coalesce(p_cambios->>'documentosAdjuntos', ent_documentos_adjuntos),
         ent_foto_url = coalesce(nullif(btrim(p_cambios->>'fotoUrl'), ''), ent_foto_url),
         ent_mapa_url = coalesce(nullif(btrim(p_cambios->>'mapaUrl'), ''), ent_mapa_url),
         ent_detalle_entrega = coalesce(ent_detalle_entrega, '{}'::jsonb) || case when v_sala is not null then jsonb_build_object('sala_servicio', v_sala) else '{}'::jsonb end,
         ent_estado = case
           when coalesce((p_cambios->>'anular')::boolean, false) then 'ANULADA'
           else ent_estado
         end,
         ent_actualizado_en = now()
   where ent_id = p_entrega_id
     and ent_negocio = v_negocio
   returning * into v_reg;

  if v_reg.ent_id is not null then
    update comun_comercio.com_orden_taller
       set ota_destinatario_fallecido = coalesce(nullif(btrim(v_reg.ent_fallecido_destinatario), ''), ota_destinatario_fallecido),
           ota_producto_resumen = coalesce(nullif(btrim(v_reg.ent_descripcion_servicio), ''), ota_producto_resumen),
           ota_sala_servicio = v_reg.ent_sala_servicio,
           ota_cliente_solicita = coalesce(nullif(btrim(v_reg.ent_coordinador_nombre), ''), ota_cliente_solicita),
           ota_ubicacion_entrega = coalesce(nullif(btrim(v_reg.ent_ubicacion_nombre), ''), ota_ubicacion_entrega),
           ota_evidencia_foto_url = coalesce(v_reg.ent_foto_url, ota_evidencia_foto_url),
           ota_evidencia_mapa_url = coalesce(v_reg.ent_mapa_url, ota_evidencia_mapa_url),
           ota_entregado_por_nombre = coalesce(nullif(btrim(v_reg.ent_entregador_nombre), 'Por asignar'), ota_entregado_por_nombre),
           ota_estado_taller = case when v_reg.ent_estado = 'ANULADA' then 'ANULADO' else ota_estado_taller end,
           ota_actualizado_en = now()
     where ota_negocio = v_negocio
       and (ota_entrega_id = v_reg.ent_id or ota_id = v_reg.ent_orden_taller_id);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function comun_comercio.com_fn_actualizar_entrega_evidencia(text, uuid, jsonb) to authenticated, service_role;

-- 9. RPC para reclasificar cualquier pedido en 1 clic ('DOMICILIO' | 'LOCAL' | 'EXEQUIALES' | 'EVENTOS' | 'MOBILIARIO')
create or replace function comun_comercio.com_fn_actualizar_clasificacion_pedido(
  p_negocio text,
  p_pedido_id uuid,
  p_clasificacion text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_clasif text := comun_comercio.com_fn_inferir_clasificacion_pedido(p_clasificacion);
  v_prf_id uuid;
  v_ent_id uuid;
  v_afectados int := 0;
begin
  if not comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para clasificar pedidos.');
  end if;

  update comun_comercio.com_orden_taller
     set ota_clasificacion_pedido = v_clasif,
         ota_retiro_en_local = case when v_clasif = 'LOCAL' then true else ota_retiro_en_local end,
         ota_actualizado_en = now()
   where ota_negocio = v_negocio
     and (ota_id = p_pedido_id or ota_proforma_id = p_pedido_id or ota_entrega_id = p_pedido_id)
   returning ota_proforma_id, ota_entrega_id into v_prf_id, v_ent_id;

  get diagnostics v_afectados = row_count;

  update comun_comercio.com_proforma
     set prf_detalle_proforma = jsonb_set(
           coalesce(prf_detalle_proforma, '{}'::jsonb),
           '{clasificacion_pedido}',
           to_jsonb(v_clasif),
           true
         ),
         prf_actualizado_en = now()
   where lower(prf_negocio) = v_negocio
     and (prf_id = p_pedido_id or (v_prf_id is not null and prf_id = v_prf_id));

  update comun_comercio.com_entrega_evidencia
     set ent_clasificacion_pedido = v_clasif,
         ent_actualizado_en = now()
   where ent_negocio = v_negocio
     and (ent_id = p_pedido_id or (v_ent_id is not null and ent_id = v_ent_id));

  return jsonb_build_object(
    'ok', true,
    'clasificacionPedido', v_clasif,
    'sincronizadosTaller', v_afectados
  );
end;
$$;

grant execute on function comun_comercio.com_fn_actualizar_clasificacion_pedido(text, uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
