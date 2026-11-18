-- ==============================================================================
-- Migración: 20261118000004_tarjetas_dedicatoria_hibridas_qr_musica_y_taller.sql
-- Requerimientos: PLT-009 / TNK-005 (Módulo de Tarjetas Híbridas: Física + Digital con QR, Música y Taller)
-- Descripción:
--   1. Columnas en comun_comercio.com_orden_taller:
--      - ota_tarjeta_token: token único aleatorio para acceso público a la tarjeta digital y QR.
--      - ota_tarjeta_tipo: 'DIPTICO' (plegable con marca exterior) | 'CONDOLENCIAS_PLANA' (esquina con arte) | 'SOLO_DIGITAL'.
--      - ota_tarjeta_musica_url: enlace de YouTube o MP3.
--      - ota_tarjeta_musica_titulo: título de la canción y artista.
--      - ota_tarjeta_lyrics: JSONB con letra sincronizada [ { "tiempo": float, "texto": string } ] o texto.
--      - ota_tarjeta_metadata: JSONB para auditoría estricta (origen, historial de ediciones, vistas, impresiones).
--   2. RPC pública com_fn_obtener_tarjeta_publica(token): permite a cualquier destinatario abrir su tarjeta y reproducir música.
--   3. RPC pública com_fn_editar_tarjeta_cliente(token, ...): autoservicio del cliente antes de impresión en taller.
--   4. RPC com_fn_registrar_impresion_tarjeta(orden_id, tipo): auditoría de impresión en taller (Canon G3110).
--   5. Actualización de com_fn_obtener_consola_taller_y_despacho y com_fn_crear_o_actualizar_pedido_operador.
-- ==============================================================================

-- 1. Columnas en comun_comercio.com_orden_taller
alter table comun_comercio.com_orden_taller
  add column if not exists ota_tarjeta_token text,
  add column if not exists ota_tarjeta_tipo text not null default 'DIPTICO'
    check (ota_tarjeta_tipo in ('DIPTICO', 'CONDOLENCIAS_PLANA', 'SOLO_DIGITAL')),
  add column if not exists ota_tarjeta_musica_url text,
  add column if not exists ota_tarjeta_musica_titulo text,
  add column if not exists ota_tarjeta_lyrics jsonb not null default '[]'::jsonb,
  add column if not exists ota_tarjeta_metadata jsonb not null default '{"origen": "AUTOMATICO", "historial_cambios": [], "vistas_cliente": 0, "impresiones": 0}'::jsonb;

-- Llenar retroactivamente tokens faltantes y asignar unicidad
update comun_comercio.com_orden_taller
   set ota_tarjeta_token = encode(gen_random_bytes(9), 'hex')
 where ota_tarjeta_token is null or btrim(ota_tarjeta_token) = '';

create unique index if not exists uq_com_orden_taller_tarjeta_token
  on comun_comercio.com_orden_taller (ota_tarjeta_token);

-- Inferencia inicial del tipo de tarjeta según el producto o tipo de orden
update comun_comercio.com_orden_taller
   set ota_tarjeta_tipo = 'CONDOLENCIAS_PLANA'
 where ota_tarjeta_tipo = 'DIPTICO'
   and (
     ota_origen_tipo = 'EXEQUIALES_LLAMADA'
     or lower(ota_producto_resumen) like '%condolen%'
     or lower(ota_producto_resumen) like '%funebr%'
     or lower(ota_producto_resumen) like '%exequial%'
   );

-- 2. RPC Pública para Lectura de Tarjeta Digital vía Token / QR
create or replace function comun_comercio.com_fn_obtener_tarjeta_publica(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := nullif(btrim(coalesce(p_token, '')), '');
  v_orden comun_comercio.com_orden_taller;
  v_vistas int;
  v_meta jsonb;
begin
  if v_token is null then
    return jsonb_build_object('ok', false, 'error', 'Token de tarjeta no proporcionado.');
  end if;

  select * into v_orden
    from comun_comercio.com_orden_taller
   where ota_tarjeta_token = v_token
     and ota_eliminado_en is null
   limit 1;

  if v_orden.ota_id is null then
    return jsonb_build_object('ok', false, 'error', 'La tarjeta solicitada no existe o ya no está disponible.');
  end if;

  -- Incrementar contador de vistas discretamente
  v_meta := coalesce(v_orden.ota_tarjeta_metadata, '{}'::jsonb);
  v_vistas := coalesce((v_meta->>'vistas_cliente')::int, 0) + 1;
  v_meta := jsonb_set(v_meta, '{vistas_cliente}', to_jsonb(v_vistas), true);
  v_meta := jsonb_set(v_meta, '{ultima_vista_en}', to_jsonb(to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')), true);

  update comun_comercio.com_orden_taller
     set ota_tarjeta_metadata = v_meta
   where ota_id = v_orden.ota_id;

  return jsonb_build_object(
    'ok', true,
    'ordenId', v_orden.ota_id,
    'codigo', v_orden.ota_codigo,
    'negocio', v_orden.ota_negocio,
    'destinatario', coalesce(nullif(v_orden.ota_destinatario_fallecido, ''), 'Para ti'),
    'remitente', coalesce(nullif(v_orden.ota_cliente_solicita, ''), 'Alguien especial'),
    'dedicatoria', coalesce(v_orden.ota_dedicatoria, ''),
    'tipo', coalesce(v_orden.ota_tarjeta_tipo, 'DIPTICO'),
    'musicaUrl', v_orden.ota_tarjeta_musica_url,
    'musicaTitulo', v_orden.ota_tarjeta_musica_titulo,
    'lyrics', coalesce(v_orden.ota_tarjeta_lyrics, '[]'::jsonb),
    'fechaEntrega', to_char(v_orden.ota_fecha_entrega, 'YYYY-MM-DD'),
    'estadoTaller', v_orden.ota_estado_taller,
    'bloqueadoEdicion', (v_orden.ota_estado_taller in ('EN_PREPARACION', 'LISTO_ENTREGA', 'ENTREGADO')),
    'vistas', v_vistas
  );
end;
$$;

grant execute on function comun_comercio.com_fn_obtener_tarjeta_publica(text) to anon, authenticated, service_role;

-- 3. RPC Pública para Edición de la Tarjeta por el Cliente (Autoservicio antes de Taller)
create or replace function comun_comercio.com_fn_editar_tarjeta_cliente(
  p_token text,
  p_dedicatoria text,
  p_musica_url text default null,
  p_musica_titulo text default null,
  p_lyrics jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := nullif(btrim(coalesce(p_token, '')), '');
  v_dedicatoria text := btrim(coalesce(p_dedicatoria, ''));
  v_musica_url text := nullif(btrim(coalesce(p_musica_url, '')), '');
  v_musica_titulo text := nullif(btrim(coalesce(p_musica_titulo, '')), '');
  v_orden comun_comercio.com_orden_taller;
  v_meta jsonb;
  v_historial jsonb;
  v_entrada_historial jsonb;
begin
  if v_token is null then
    return jsonb_build_object('ok', false, 'error', 'Token de tarjeta no proporcionado.');
  end if;

  select * into v_orden
    from comun_comercio.com_orden_taller
   where ota_tarjeta_token = v_token
     and ota_eliminado_en is null
   limit 1;

  if v_orden.ota_id is null then
    return jsonb_build_object('ok', false, 'error', 'No se encontró la orden asociada.');
  end if;

  -- Regla de Taller: si ya está en preparación o posterior, se bloquea la edición
  if v_orden.ota_estado_taller in ('EN_PREPARACION', 'LISTO_ENTREGA', 'ENTREGADO') then
    return jsonb_build_object(
      'ok', false,
      'bloqueado', true,
      'error', 'Tu tarjeta ya se encuentra impresa y el pedido está en elaboración en el taller. No es posible realizar más cambios.'
    );
  end if;

  v_meta := coalesce(v_orden.ota_tarjeta_metadata, '{}'::jsonb);
  v_historial := coalesce(v_meta->'historial_cambios', '[]'::jsonb);

  v_entrada_historial := jsonb_build_object(
    'autor', 'Cliente (Web)',
    'rol', 'CLIENTE',
    'fecha', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
    'dedicatoria_anterior', v_orden.ota_dedicatoria,
    'dedicatoria_nueva', v_dedicatoria,
    'musica_url_anterior', v_orden.ota_tarjeta_musica_url,
    'musica_url_nueva', v_musica_url
  );

  v_historial := v_historial || jsonb_build_array(v_entrada_historial);
  v_meta := jsonb_set(v_meta, '{historial_cambios}', v_historial, true);
  v_meta := jsonb_set(v_meta, '{editado_por_cliente}', 'true'::jsonb, true);
  v_meta := jsonb_set(v_meta, '{ultima_edicion_cliente_en}', to_jsonb(to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')), true);

  update comun_comercio.com_orden_taller
     set ota_dedicatoria = v_dedicatoria,
         ota_tarjeta_musica_url = v_musica_url,
         ota_tarjeta_musica_titulo = coalesce(v_musica_titulo, ota_tarjeta_musica_titulo),
         ota_tarjeta_lyrics = coalesce(p_lyrics, ota_tarjeta_lyrics),
         ota_tarjeta_metadata = v_meta,
         ota_actualizado_en = now()
   where ota_id = v_orden.ota_id;

  return jsonb_build_object(
    'ok', true,
    'mensaje', 'Tarjeta actualizada correctamente.',
    'dedicatoria', v_dedicatoria,
    'musicaUrl', v_musica_url
  );
end;
$$;

grant execute on function comun_comercio.com_fn_editar_tarjeta_cliente(text, text, text, text, jsonb) to anon, authenticated, service_role;

-- 4. RPC para Auditoría de Impresión en Taller
create or replace function comun_comercio.com_fn_registrar_impresion_tarjeta(
  p_orden_id uuid,
  p_tipo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_usu_nombre text;
  v_orden comun_comercio.com_orden_taller;
  v_meta jsonb;
  v_impresiones int;
begin
  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Operador Taller')
    into v_usu_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  select * into v_orden
    from comun_comercio.com_orden_taller
   where ota_id = p_orden_id
     and ota_eliminado_en is null;

  if v_orden.ota_id is null then
    return jsonb_build_object('ok', false, 'error', 'Orden de trabajo no encontrada.');
  end if;

  v_meta := coalesce(v_orden.ota_tarjeta_metadata, '{}'::jsonb);
  v_impresiones := coalesce((v_meta->>'impresiones')::int, 0) + 1;
  v_meta := jsonb_set(v_meta, '{impresiones}', to_jsonb(v_impresiones), true);
  v_meta := jsonb_set(v_meta, '{ultima_impresion_en}', to_jsonb(to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')), true);
  v_meta := jsonb_set(v_meta, '{ultimo_impreso_por}', to_jsonb(coalesce(v_usu_nombre, 'Taller')), true);

  update comun_comercio.com_orden_taller
     set ota_tarjeta_tipo = case
           when p_tipo in ('DIPTICO', 'CONDOLENCIAS_PLANA', 'SOLO_DIGITAL') then p_tipo
           else ota_tarjeta_tipo
         end,
         ota_tarjeta_metadata = v_meta,
         ota_actualizado_en = now()
   where ota_id = v_orden.ota_id;

  return jsonb_build_object(
    'ok', true,
    'impresiones', v_impresiones,
    'ultimoImpresoPor', v_usu_nombre,
    'ultimaImpresionEn', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')
  );
end;
$$;

grant execute on function comun_comercio.com_fn_registrar_impresion_tarjeta(uuid, text) to authenticated, service_role;

-- 5. Actualización de com_fn_obtener_consola_taller_y_despacho para incluir campos de tarjeta
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
      'actualizadoTallerNombre', o.ota_actualizado_taller_nombre,
      'tarjetaToken', o.ota_tarjeta_token,
      'tarjetaTipo', coalesce(o.ota_tarjeta_tipo, 'DIPTICO'),
      'tarjetaMusicaUrl', o.ota_tarjeta_musica_url,
      'tarjetaMusicaTitulo', o.ota_tarjeta_musica_titulo,
      'tarjetaLyrics', coalesce(o.ota_tarjeta_lyrics, '[]'::jsonb),
      'tarjetaMetadata', coalesce(o.ota_tarjeta_metadata, '{}'::jsonb)
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
    'productosCatalogo', v_productos,
    'rolOperativo', case
      when comun_seguridad.seg_fn_es_superadmin() then 'SUPERADMIN'
      when comun_seguridad.seg_fn_tiene_rol(v_negocio, 'ADMINISTRADOR') then 'ADMINISTRADOR'
      when comun_seguridad.seg_fn_tiene_rol(v_negocio, 'OPERADOR') then 'OPERADOR'
      when comun_seguridad.seg_fn_tiene_rol(v_negocio, 'TALLER') then 'TALLER'
      when comun_seguridad.seg_fn_tiene_rol(v_negocio, 'DELIVERY') then 'DELIVERY'
      else 'STAFF'
    end
  );
end;
$$;

-- 6. Actualización de com_fn_crear_o_actualizar_pedido_operador para recibir y auditar campos de tarjeta
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
  v_franja := comun_comercio.com_fn_normalizar_franja_horaria(p_payload->>'franjaHoraria');
  v_sala := nullif(btrim(coalesce(p_payload->>'salaServicio', '')), '');
  v_solicita := coalesce(nullif(btrim(coalesce(p_payload->>'clienteSolicita', '')), ''), 'Cliente');
  v_destinatario := coalesce(nullif(btrim(coalesce(p_payload->>'destinatarioFallecido', '')), ''), 'Por coordinar');

  v_resumen := coalesce(
    nullif(btrim(coalesce(p_payload->>'productoResumen', '')), ''),
    case when v_origen = 'EXEQUIALES_LLAMADA' then 'Set condolencias (3 arreglos)' else 'Arreglo floral' end
  );

  v_items := case
    when jsonb_typeof(p_payload->'items') = 'array' and jsonb_array_length(p_payload->'items') > 0 then p_payload->'items'
    else jsonb_build_array(jsonb_build_object('descripcion', v_resumen, 'cantidad', 1))
  end;

  v_tarjeta_tipo := case
    when p_payload->>'tarjetaTipo' in ('DIPTICO', 'CONDOLENCIAS_PLANA', 'SOLO_DIGITAL') then p_payload->>'tarjetaTipo'
    when v_origen = 'EXEQUIALES_LLAMADA' or lower(v_resumen) like '%condolen%' or lower(v_resumen) like '%funebr%' then 'CONDOLENCIAS_PLANA'
    else 'DIPTICO'
  end;

  v_tarjeta_musica_url := nullif(btrim(coalesce(p_payload->>'tarjetaMusicaUrl', '')), '');
  v_tarjeta_musica_titulo := nullif(btrim(coalesce(p_payload->>'tarjetaMusicaTitulo', '')), '');
  v_dedicatoria_nueva := nullif(btrim(coalesce(p_payload->>'dedicatoria', '')), '');

  -- Si es edición de una orden ya existente
  if v_orden_id is not null then
    select * into v_orden
      from comun_comercio.com_orden_taller
     where ota_id = v_orden_id and ota_negocio = v_negocio;

    v_meta := coalesce(v_orden.ota_tarjeta_metadata, '{}'::jsonb);

    -- Si cambió la dedicatoria, auditar el cambio
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
           ota_dedicatoria = v_dedicatoria_nueva,
           ota_tarjeta_tipo = coalesce(v_tarjeta_tipo, ota_tarjeta_tipo),
           ota_tarjeta_musica_url = coalesce(v_tarjeta_musica_url, ota_tarjeta_musica_url),
           ota_tarjeta_musica_titulo = coalesce(v_tarjeta_musica_titulo, ota_tarjeta_musica_titulo),
           ota_tarjeta_metadata = v_meta,
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
      'estadoTaller', v_orden.ota_estado_taller,
      'tarjetaToken', v_orden.ota_tarjeta_token
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
      v_fecha_serv_ts := (v_fecha_entrega::text || ' ' || coalesce(v_hora, '10:00') || ':00')::timestamptz;
    exception when others then
      v_fecha_serv_ts := (v_fecha_entrega::text || ' 10:00:00')::timestamptz;
    end;

    insert into comun_comercio.com_entrega_evidencia (
      ent_negocio,
      ent_convenio_id,
      ent_coordinador_nombre,
      ent_coordinador_telefono,
      ent_fallecido_destinatario,
      ent_sala_servicio,
      ent_hora_solicitada,
      ent_ubicacion_nombre,
      ent_fecha_servicio,
      ent_estado_proceso,
      ent_descripcion_servicio,
      ent_observaciones
    ) values (
      v_negocio,
      v_convenio_id,
      v_solicita,
      nullif(btrim(p_payload->>'clienteTelefono'), ''),
      v_destinatario,
      v_sala,
      v_hora,
      coalesce(nullif(btrim(p_payload->>'ubicacionEntrega'), ''), 'Sala por coordinar'),
      v_fecha_serv_ts,
      'PROGRAMADA',
      v_resumen,
      nullif(btrim(p_payload->>'observaciones'), '')
    ) returning ent_id into v_entrega_id;
  end if;

  -- Código secuencial de orden
  v_codigo := 'OT-' || to_char(v_fecha_entrega, 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(2), 'hex'), 1, 4));

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
    ota_entrega_id,
    ota_estado_taller,
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
    v_entrega_id,
    case when v_enviar then 'ENVIADO_TALLER' else 'PENDIENTE_ENVIO' end,
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
    coalesce(nullif(btrim(p_payload->>'ubicacionEntrega'), ''), 'Por coordinar'),
    nullif(btrim(p_payload->>'enlaceMapa'), ''),
    coalesce((p_payload->>'retiroEnLocal')::boolean, false),
    v_dedicatoria_nueva,
    encode(gen_random_bytes(9), 'hex'),
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
    'estadoTaller', v_orden.ota_estado_taller,
    'tarjetaToken', v_orden.ota_tarjeta_token
  );
end;
$$;
