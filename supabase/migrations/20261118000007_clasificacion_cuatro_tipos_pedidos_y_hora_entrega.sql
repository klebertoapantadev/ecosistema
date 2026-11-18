-- ==============================================================================
-- Migración: 20261118000007_clasificacion_cuatro_tipos_pedidos_y_hora_entrega.sql
-- Requerimientos: PLT-009 / TNK-002 / TNK-005 / MRG
-- Descripción:
--   1. Estandariza la clasificación de pedidos en Tinkay y Margaritas en los 4 tipos
--      de negocio canónicos:
--      'FLORISTERIA_OCASIONES' | 'CONDOLENCIAS' | 'EVENTOS' | 'EXEQUIALES'.
--   2. Distingue estrictamente 'CONDOLENCIAS' (arreglos fúnebres particulares con
--      comprador, teléfono, dirección y tarjeta de condolencias) de 'EXEQUIALES'
--      (convenio Exequiales donde NO se requiere teléfono/WhatsApp, NO se requiere
--      tarjeta de condolencias, NO se requiere dirección callejera/mapa/retiro en tienda,
--      y el Destinatario = Persona Fallecida es obligatorio).
--   3. Habilita Hora de Entrega universal (Rango A/B/C o Hora Exacta HH:MM / Lo antes posible)
--      sincronizada entre com_orden_taller, com_proforma y com_entrega_evidencia.
-- ==============================================================================

-- 1. Función pura actualizada para inferir las 4 clasificaciones operativas canónicas
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
  if v_exp in ('FLORISTERIA_OCASIONES', 'CONDOLENCIAS', 'EVENTOS', 'EXEQUIALES') then
    return v_exp;
  elsif v_exp in ('FLORISTERIA', 'OCASIONES', 'FLORISTERIA_OCACION', 'FLORISTERIAOCACIONES') then
    return 'FLORISTERIA_OCASIONES';
  elsif v_exp in ('CONDOLENCIA', 'FUNERARIO', 'FUNEBRE', 'FÚNEBRE') then
    return 'CONDOLENCIAS';
  elsif v_exp = 'EXEQUIAL' then
    return 'EXEQUIALES';
  elsif v_exp in ('EVENTO', 'CEREMONIA', 'MOBILIARIO', 'RENTA', 'ALQUILER') then
    return 'EVENTOS';
  end if;

  -- 1. Exequiales (convenio Exequiales / llamada / sala asignada)
  if v_orig in ('EXEQUIALES_LLAMADA', 'ORDEN_TRABAJO_CONVENIO')
     or nullif(btrim(coalesce(p_sala_servicio, '')), '') is not null
     or v_ubic like '%exequial%'
     or v_ubic like '%iess%' then
    return 'EXEQUIALES';
  end if;

  -- 2. Condolencias particulares (coronas, pedestales fúnebres, funerarias privadas)
  if v_prod like '%condolencia%'
     or v_prod like '%corona%'
     or v_prod like '%fúnebre%'
     or v_prod like '%funebre%'
     or v_prod like '%cubre cofre%'
     or v_prod like '%cubrecofre%'
     or v_prod like '%trípode%'
     or v_prod like '%tripode%'
     or v_prod like '%luto%'
     or v_prod like '%sepelio%'
     or v_items_txt like '%condolencia%'
     or v_items_txt like '%corona%'
     or v_items_txt like '%funebre%'
     or v_items_txt like '%fúnebre%'
     or v_ubic like '%camposanto%'
     or v_ubic like '%monteolivo%'
     or v_ubic like '%funeraria%'
     or v_ubic like '%sala de velacion%'
     or v_ubic like '%sala de velación%'
     or v_ubic like '%tanatorio%'
     or v_ubic like '%cementerio%'
     or v_ubic like '%jardines del valle%'
     or v_ubic like '%memorial%' then
    return 'CONDOLENCIAS';
  end if;

  -- 3. Eventos (proforma evento, ceremonias, montajes y renta de mobiliario)
  if v_orig = 'PROFORMA_EVENTO'
     or v_prod like '%en renta%'
     or v_prod like '%alquiler%'
     or v_prod like '%mobiliario%'
     or v_prod like '%arco floral%'
     or v_prod like '%montaje de evento%'
     or v_prod like '%decoracion de evento%'
     or v_prod like '%decoración de evento%'
     or v_prod like '%backing%'
     or v_prod like '%mampara%'
     or v_prod like '%cilindro%'
     or v_items_txt like '%"es_renta":true%'
     or v_items_txt like '%"esrenta":true%'
     or v_items_txt like '%"tipo_oferta":"renta"%' then
    return 'EVENTOS';
  end if;

  -- 4. Floristería / Ocasiones (incluye valores heredados DOMICILIO / LOCAL)
  return 'FLORISTERIA_OCASIONES';
end;
$$;

grant execute on function comun_comercio.com_fn_inferir_clasificacion_pedido(text, text, boolean, text, text, text, jsonb)
  to anon, authenticated, service_role;

-- 2. Migrar restricción CHECK y datos existentes en com_orden_taller, com_entrega_evidencia y com_proforma
do $$
begin
  if to_regclass('comun_comercio.com_orden_taller') is not null then
    alter table comun_comercio.com_orden_taller
      drop constraint if exists com_orden_taller_ota_clasificacion_pedido_check;

    alter table comun_comercio.com_orden_taller
      alter column ota_clasificacion_pedido set default 'FLORISTERIA_OCASIONES';

    update comun_comercio.com_orden_taller o
       set ota_clasificacion_pedido = comun_comercio.com_fn_inferir_clasificacion_pedido(
             case
               when o.ota_clasificacion_pedido in ('DOMICILIO', 'LOCAL') then null
               when o.ota_clasificacion_pedido = 'MOBILIARIO' then 'EVENTOS'
               when o.ota_clasificacion_pedido = 'EXEQUIALES'
                    and o.ota_origen_tipo = 'VENTA_TIENDA'
                    and coalesce(o.ota_metodo_pago, '') not ilike '%convenio%'
                    and nullif(btrim(coalesce(o.ota_sala_servicio, '')), '') is null
                    and coalesce(o.ota_ubicacion_entrega, '') not ilike '%exequial%'
                 then null
               else o.ota_clasificacion_pedido
             end,
             o.ota_origen_tipo,
             o.ota_retiro_en_local,
             o.ota_sala_servicio,
             o.ota_producto_resumen,
             o.ota_ubicacion_entrega,
             o.ota_items
           );

    alter table comun_comercio.com_orden_taller
      add constraint com_orden_taller_ota_clasificacion_pedido_check
      check (ota_clasificacion_pedido in ('FLORISTERIA_OCASIONES', 'CONDOLENCIAS', 'EVENTOS', 'EXEQUIALES'));
  end if;

  if to_regclass('comun_comercio.com_entrega_evidencia') is not null then
    update comun_comercio.com_entrega_evidencia e
       set ent_clasificacion_pedido = case
             when e.ent_tipo_origen = 'ORDEN_TRABAJO_CONVENIO' then 'EXEQUIALES'
             when e.ent_clasificacion_pedido in ('DOMICILIO', 'LOCAL') or e.ent_clasificacion_pedido is null then
               coalesce(
                 (select o.ota_clasificacion_pedido from comun_comercio.com_orden_taller o where o.ota_entrega_id = e.ent_id and o.ota_eliminado_en is null limit 1),
                 'FLORISTERIA_OCASIONES'
               )
             when e.ent_clasificacion_pedido = 'MOBILIARIO' then 'EVENTOS'
             else e.ent_clasificacion_pedido
           end;
  end if;

  if to_regclass('comun_comercio.com_proforma') is not null then
    update comun_comercio.com_proforma p
       set prf_detalle_proforma = jsonb_set(
             coalesce(p.prf_detalle_proforma, '{}'::jsonb),
             '{clasificacion_pedido}',
             to_jsonb(
               case
                 when p.prf_detalle_proforma->>'clasificacion_pedido' in ('DOMICILIO', 'LOCAL') then 'FLORISTERIA_OCASIONES'::text
                 when p.prf_detalle_proforma->>'clasificacion_pedido' = 'MOBILIARIO' then 'EVENTOS'::text
                 else p.prf_detalle_proforma->>'clasificacion_pedido'
               end
             ),
             true
           )
     where p.prf_detalle_proforma ? 'clasificacion_pedido'
       and p.prf_detalle_proforma->>'clasificacion_pedido' in ('DOMICILIO', 'LOCAL', 'MOBILIARIO');
  end if;
end $$;

-- 3. Sincronizador idempotente actualizado a las 4 clasificaciones canónicas
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
        case when v_tiene_renta then 'EVENTOS' else null end
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
      case
        when v_clasificacion = 'EXEQUIALES' then null
        else coalesce(
          r.prf_detalle_proforma->'comprador'->>'whatsapp',
          r.prf_detalle_proforma->'comprador'->>'telefono',
          r.prf_cliente_contacto->>'telefono',
          ''
        )
      end,
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
      case when v_clasificacion = 'EXEQUIALES' then 'Exequiales' else v_ubicacion end,
      case
        when v_clasificacion = 'EXEQUIALES' then null
        else coalesce(
          r.prf_detalle_proforma->'logistica_entrega'->>'enlace_mapa',
          r.prf_detalle_proforma->'logistica_entrega'->>'enlaceMapa'
        )
      end,
      case when v_clasificacion = 'EXEQUIALES' then false else v_retiro end,
      case when v_clasificacion = 'EXEQUIALES' then null else v_dedicatoria end,
      substr(replace(gen_random_uuid()::text, '-', ''), 1, 18),
      case when v_clasificacion in ('CONDOLENCIAS', 'EXEQUIALES') then 'CONDOLENCIAS_PLANA' else 'DIPTICO' end,
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
      'Exequiales',
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

-- 4. RPC para crear o editar pedido con soporte de los 4 tipos, Hora de Entrega (Rango o Exacta) y reglas Exequiales
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
  v_es_exequiales boolean;
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
      when v_origen = 'EXEQUIALES_LLAMADA' then 'Exequiales'
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

  v_es_exequiales := (v_clasificacion = 'EXEQUIALES');

  if v_es_exequiales then
    v_retiro := false;
    v_ubicacion := 'Exequiales';
  end if;

  v_destinatario := nullif(btrim(coalesce(p_payload->>'destinatarioFallecido', '')), '');

  if v_es_exequiales and (
    v_destinatario is null
    or lower(v_destinatario) in ('por coordinar', 'por confirmar', 'destinatario')
    or lower(v_destinatario) like 'por confirmar (%'
    or lower(v_destinatario) like 'por coordinar (%'
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'En pedidos de Exequiales, el nombre de la Persona Fallecida (Destinatario) es obligatorio.'
    );
  end if;

  if v_destinatario is null then
    v_destinatario := v_solicita;
  end if;

  v_enviar := coalesce((p_payload->>'enviarATaller')::boolean, v_es_exequiales);

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
    when nullif(btrim(coalesce(p_payload->>'franjaHoraria', '')), '') is not null
      then comun_comercio.com_fn_normalizar_franja_horaria(p_payload->>'franjaHoraria')
    when v_es_exequiales then null
    else 'A) 09:00 - 13:00'
  end;

  v_tarjeta_tipo := case
    when p_payload->>'tarjetaTipo' in ('DIPTICO', 'CONDOLENCIAS_PLANA', 'SOLO_DIGITAL') then p_payload->>'tarjetaTipo'
    when v_clasificacion in ('CONDOLENCIAS', 'EXEQUIALES') then 'CONDOLENCIAS_PLANA'
    else 'DIPTICO'
  end;

  v_tarjeta_musica_url := case
    when v_es_exequiales then null
    else nullif(btrim(coalesce(p_payload->>'tarjetaMusicaUrl', '')), '')
  end;
  v_tarjeta_musica_titulo := case
    when v_es_exequiales then null
    else nullif(btrim(coalesce(p_payload->>'tarjetaMusicaTitulo', '')), '')
  end;
  v_dedicatoria_nueva := case
    when v_es_exequiales then null
    else nullif(btrim(coalesce(p_payload->>'dedicatoria', '')), '')
  end;

  -- Edición de una orden existente
  if v_orden_id is not null then
    select * into v_orden
      from comun_comercio.com_orden_taller
     where ota_id = v_orden_id and ota_negocio = v_negocio;

    if v_orden.ota_id is null then
      return jsonb_build_object('ok', false, 'error', 'No se encontró el pedido para actualizar.');
    end if;

    v_meta := coalesce(v_orden.ota_tarjeta_metadata, '{}'::jsonb);

    if not v_es_exequiales and v_dedicatoria_nueva is distinct from v_orden.ota_dedicatoria then
      v_historial := coalesce(v_meta->'historial_cambios', '[]'::jsonb);
      v_historial := v_historial || jsonb_build_array(jsonb_build_object(
        'autor', v_usu_nombre,
        'rol', 'STAFF_FLORISTERIA',
        'fecha', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
        'dedicatoria_anterior', v_orden.ota_dedicatoria,
        'dedicatoria_nueva', v_dedicatoria_nueva
      ));
      v_meta := jsonb_set(v_meta, '{historial_cambios}', v_historial, true);
    end if;

    update comun_comercio.com_orden_taller
       set ota_clasificacion_pedido = v_clasificacion,
           ota_fecha_entrega = v_fecha_entrega,
           ota_fecha_elaboracion = coalesce(v_fecha_elab, ota_fecha_elaboracion),
           ota_franja_horaria = case
             when p_payload ? 'franjaHoraria' then v_franja
             else coalesce(v_franja, ota_franja_horaria)
           end,
           ota_hora_especifica = case
             when p_payload ? 'horaEspecifica' then v_hora
             else ota_hora_especifica
           end,
           ota_producto_resumen = v_resumen,
           ota_items = v_items,
           ota_cliente_solicita = v_solicita,
           ota_cliente_telefono = case
             when v_es_exequiales then null
             when p_payload ? 'clienteTelefono' then nullif(btrim(p_payload->>'clienteTelefono'), '')
             else ota_cliente_telefono
           end,
           ota_destinatario_fallecido = v_destinatario,
           ota_sala_servicio = case
             when not v_es_exequiales then null
             when p_payload ? 'salaServicio' then v_sala
             else ota_sala_servicio
           end,
           ota_ubicacion_entrega = case
             when v_es_exequiales then 'Exequiales'
             when p_payload ? 'ubicacionEntrega' then coalesce(nullif(btrim(p_payload->>'ubicacionEntrega'), ''), ota_ubicacion_entrega)
             else ota_ubicacion_entrega
           end,
           ota_enlace_mapa = case
             when v_es_exequiales then null
             when p_payload ? 'enlaceMapa' then nullif(btrim(p_payload->>'enlaceMapa'), '')
             else ota_enlace_mapa
           end,
           ota_retiro_en_local = case
             when v_es_exequiales then false
             when p_payload ? 'retiroEnLocal' then v_retiro
             else ota_retiro_en_local
           end,
           ota_dedicatoria = case
             when v_es_exequiales then null
             when p_payload ? 'dedicatoria' then v_dedicatoria_nueva
             else ota_dedicatoria
           end,
           ota_tarjeta_tipo = coalesce(v_tarjeta_tipo, ota_tarjeta_tipo),
           ota_tarjeta_musica_url = case when v_es_exequiales then null else coalesce(v_tarjeta_musica_url, ota_tarjeta_musica_url) end,
           ota_tarjeta_musica_titulo = case when v_es_exequiales then null else coalesce(v_tarjeta_musica_titulo, ota_tarjeta_musica_titulo) end,
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
             ent_hora_solicitada = coalesce(v_orden.ota_hora_especifica, v_orden.ota_franja_horaria),
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
               (coalesce(prf_detalle_proforma->'logistica_entrega', '{}'::jsonb) - 'hora_exacta') || jsonb_build_object(
                 'fecha_entrega', to_char(v_orden.ota_fecha_entrega, 'YYYY-MM-DD'),
                 'franja_horaria', coalesce(v_orden.ota_franja_horaria, ''),
                 'hora_exacta', v_orden.ota_hora_especifica,
                 'direccion', coalesce(v_orden.ota_ubicacion_entrega, ''),
                 'enlace_mapa', coalesce(v_orden.ota_enlace_mapa, ''),
                 'retiro_en_local', v_orden.ota_retiro_en_local,
                 'destinatario_nombre', v_orden.ota_destinatario_fallecido,
                 'sala_servicio', v_orden.ota_sala_servicio
               ),
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

  -- Creación de orden nueva (si es Exequiales crear OT vinculada en com_entrega_evidencia)
  if v_es_exequiales or v_origen = 'EXEQUIALES_LLAMADA' then
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
      coalesce(v_hora, v_franja),
      'Exequiales',
      v_solicita,
      'Flores, follaje, bases y oasis',
      nullif(btrim(coalesce(p_payload->>'observaciones', '')), ''),
      jsonb_strip_nulls(jsonb_build_object(
        'sala_servicio', v_sala,
        'hora_solicitada', coalesce(v_hora, v_franja),
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
    'origen', case when v_origen = 'MANUAL_ADMIN' then 'OPERADOR_FLORISTERIA' else 'AUTOMATICO_SISTEMA' end,
    'creado_por', v_usu_nombre,
    'historial_cambios', case
      when v_es_exequiales then '[]'::jsonb
      else jsonb_build_array(jsonb_build_object(
        'autor', v_usu_nombre,
        'rol', 'CREADOR',
        'fecha', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
        'dedicatoria', v_dedicatoria_nueva
      ))
    end,
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
    case when v_es_exequiales then 'EXEQUIALES_LLAMADA' else v_origen end,
    v_clasificacion,
    v_entrega_id,
    case when v_enviar then 'ENVIADO_TALLER' else 'PENDIENTE_ENVIO' end,
    coalesce(nullif(btrim(p_payload->>'estadoPago'), ''), case when v_es_exequiales then 'CONVENIO_IESS' else 'PENDIENTE_PAGO' end),
    coalesce(nullif(btrim(p_payload->>'metodoPago'), ''), case when v_es_exequiales then 'convenio' else 'manual' end),
    v_fecha_entrega,
    v_fecha_elab,
    v_franja,
    v_hora,
    v_resumen,
    v_items,
    v_solicita,
    case when v_es_exequiales then null else nullif(btrim(p_payload->>'clienteTelefono'), '') end,
    v_destinatario,
    case when v_es_exequiales then v_sala else null end,
    v_ubicacion,
    case when v_es_exequiales then null else nullif(btrim(p_payload->>'enlaceMapa'), '') end,
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

-- 5. RPC para reclasificar cualquier pedido en 1 clic ('FLORISTERIA_OCASIONES' | 'CONDOLENCIAS' | 'EVENTOS' | 'EXEQUIALES')
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
         ota_retiro_en_local = case when v_clasif = 'EXEQUIALES' then false else ota_retiro_en_local end,
         ota_tarjeta_tipo = case when v_clasif = 'CONDOLENCIAS' then 'CONDOLENCIAS_PLANA' else ota_tarjeta_tipo end,
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
