-- ==============================================================================
-- Migración: 20261119000003_detalle_completo_pedido_tv_taller.sql
-- Descripción: Amplía com_fn_obtener_tablero_tv_taller para devolver el detalle
--              completo del pedido al hacer clic en una tarjeta en la Smart TV
--              (fecha/hora entrega, ítems, colores, extras, valor USD, dedicatoria,
--              destinatario, ubicación, notas y estado de pago).
-- ==============================================================================

create or replace function comun_comercio.com_fn_obtener_tablero_tv_taller(
  p_negocio text,
  p_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_rol text := case when v_uid is not null then comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio) else '' end;
  v_autenticado boolean := (v_rol in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS', 'TALLER'));
  v_cfg_tv jsonb := '{}'::jsonb;
  v_token_guardado text;
  v_kiosco_activo boolean;
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
  v_ordenes jsonb := '[]'::jsonb;
  v_productos_eventos jsonb := '[]'::jsonb;
begin
  select coalesce(c.cfg_detalle_configuracion->'pantalla_tv_taller', '{}'::jsonb)
    into v_cfg_tv
    from comun_configuracion.cfg_negocio c
   where lower(c.cfg_negocio) = v_negocio
   limit 1;

  v_token_guardado := nullif(btrim(coalesce(v_cfg_tv->>'tokenKiosco', '')), '');
  v_kiosco_activo := coalesce((v_cfg_tv->>'kioscoActivo')::boolean, true);

  if not v_autenticado then
    if not (v_kiosco_activo and v_token_guardado is not null and nullif(btrim(coalesce(p_token, '')), '') = v_token_guardado) then
      return jsonb_build_object(
        'ok', false,
        'error', 'Acceso no autorizado a Pantalla TV. Inicia sesión o usa un enlace Kiosco válido.'
      );
    end if;
  end if;

  if v_autenticado then
    perform comun_comercio.com_fn_sincronizar_ventas_a_ordenes_taller(v_negocio);
  end if;

  select coalesce(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
  into v_ordenes
  from (
    select
      o.ota_id as "id",
      o.ota_codigo as "codigo",
      o.ota_origen_tipo as "origenTipo",
      coalesce(
        o.ota_clasificacion_pedido,
        comun_comercio.com_fn_inferir_clasificacion_pedido(
          null, o.ota_origen_tipo, o.ota_retiro_en_local, o.ota_sala_servicio, o.ota_producto_resumen, o.ota_ubicacion_entrega, o.ota_items
        )
      ) as "clasificacionPedido",
      o.ota_estado_taller as "estadoTaller",
      coalesce(p.prf_estado, o.ota_estado_pago) as "estadoPago",
      o.ota_metodo_pago as "metodoPago",
      to_char(o.ota_fecha_entrega, 'YYYY-MM-DD') as "fechaEntrega",
      (case when o.ota_fecha_elaboracion is not null then to_char(o.ota_fecha_elaboracion, 'YYYY-MM-DD') else null::text end) as "fechaElaboracion",
      o.ota_franja_horaria as "franjaHoraria",
      o.ota_hora_especifica as "horaEspecifica",
      o.ota_producto_resumen as "productoResumen",
      coalesce(o.ota_items, '[]'::jsonb) as "items",
      o.ota_colores as "colores",
      o.ota_extras as "extras",
      o.ota_observaciones as "observaciones",
      o.ota_dedicatoria as "dedicatoria",
      o.ota_cliente_solicita as "clienteSolicita",
      o.ota_destinatario_fallecido as "destinatarioFallecido",
      o.ota_sala_servicio as "salaServicio",
      o.ota_ubicacion_entrega as "ubicacionEntrega",
      o.ota_retiro_en_local as "retiroEnLocal",
      coalesce(o.ota_total_usd, p.prf_total, 0) as "totalUsd",
      o.ota_prioridad_orden as "prioridadOrden",
      o.ota_enviado_taller_en as "enviadoTallerEn",
      o.ota_preparacion_en as "preparacionEn",
      o.ota_listo_en as "listoEn",
      o.ota_entregado_en as "entregadoEn",
      o.ota_actualizado_taller_nombre as "actualizadoTallerNombre"
    from comun_comercio.com_orden_taller o
    left join comun_comercio.com_proforma p on p.prf_id = o.ota_proforma_id
    where o.ota_negocio = v_negocio
      and o.ota_eliminado_en is null
      and o.ota_estado_taller in ('ENVIADO_TALLER', 'EN_PREPARACION', 'LISTO_ENTREGA', 'ENTREGADO')
      and (
        (
          o.ota_estado_taller in ('ENVIADO_TALLER', 'EN_PREPARACION')
          and (
            o.ota_fecha_entrega <= v_hoy
            or o.ota_fecha_elaboracion = v_hoy
          )
        )
        or (
          o.ota_estado_taller in ('LISTO_ENTREGA', 'ENTREGADO')
          and (
            o.ota_fecha_entrega = v_hoy
            or o.ota_fecha_elaboracion = v_hoy
            or (o.ota_listo_en is not null and (o.ota_listo_en at time zone 'America/Guayaquil')::date = v_hoy)
            or (o.ota_entregado_en is not null and (o.ota_entregado_en at time zone 'America/Guayaquil')::date = v_hoy)
          )
        )
      )
    order by
      coalesce(o.ota_prioridad_orden, 999999) asc,
      (case when o.ota_clasificacion_pedido = 'EXEQUIALES' or o.ota_origen_tipo = 'EXEQUIALES_LLAMADA' then 0 else 1 end) asc,
      o.ota_fecha_entrega asc,
      o.ota_creado_en asc
    limit 200
  ) sub;

  select coalesce(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
  into v_productos_eventos
  from (
    select
      pr.pro_id as "productoId",
      pr.pro_nombre as "nombre",
      coalesce(pr.pro_descripcion, ''::text) as "descripcion",
      pr.pro_slug as "slug",
      pr.pro_tipo as "tipo",
      coalesce(
        (select m.med_url
           from comun_comercio.com_media m
          where m.med_producto_id = pr.pro_id
          order by m.med_es_portada desc, m.med_orden asc, m.med_secuencial asc limit 1),
        pr.pro_detalle_producto->>'portada_url',
        (select v2.var_detalle_variante->>'portada_url'
           from comun_comercio.com_variante v2
          where v2.var_producto_id = pr.pro_id and v2.var_activo = true
          order by v2.var_secuencial asc limit 1),
        ''::text
      ) as "imagenUrl",
      coalesce(
        (select min(v3.var_precio)
           from comun_comercio.com_variante v3
          where v3.var_producto_id = pr.pro_id and v3.var_activo = true),
        0::numeric
      ) as "precioDesde",
      coalesce(ctg.ctg_nombre, 'Eventos'::text) as "categoriaNombre"
    from comun_comercio.com_producto pr
    left join comun_comercio.com_categoria ctg on ctg.ctg_id = pr.pro_categoria_principal_id
    where lower(pr.pro_negocio) = v_negocio
      and pr.pro_activo = true
      and (
        upper(coalesce(pr.pro_tipo, '')) = 'RENTA'
        or coalesce((pr.pro_detalle_producto->>'es_renta')::boolean, false) = true
        or upper(coalesce(ctg.ctg_tipo, '')) = 'EVENTO'
        or exists (
          select 1
          from comun_comercio.com_producto_categoria pct
          join comun_comercio.com_categoria c2 on c2.ctg_id = pct.pct_categoria_id
          where pct.pct_producto_id = pr.pro_id
            and (
              upper(coalesce(c2.ctg_tipo, '')) = 'EVENTO'
              or lower(coalesce(c2.ctg_nombre, '')) like '%evento%'
              or lower(coalesce(c2.ctg_nombre, '')) like '%boda%'
              or lower(coalesce(c2.ctg_nombre, '')) like '%mobiliario%'
              or lower(coalesce(c2.ctg_slug, '')) like '%evento%'
            )
        )
        or lower(coalesce(ctg.ctg_nombre, '')) like '%evento%'
        or lower(coalesce(ctg.ctg_nombre, '')) like '%boda%'
        or lower(coalesce(ctg.ctg_nombre, '')) like '%matrimon%'
        or lower(coalesce(ctg.ctg_nombre, '')) like '%decorac%'
        or lower(coalesce(ctg.ctg_nombre, '')) like '%mobiliario%'
        or lower(coalesce(ctg.ctg_nombre, '')) like '%ceremonia%'
        or lower(coalesce(ctg.ctg_slug, '')) like '%evento%'
        or lower(coalesce(pr.pro_nombre, '')) like '%evento%'
        or lower(coalesce(pr.pro_nombre, '')) like '%boda%'
        or lower(coalesce(pr.pro_nombre, '')) like '%arco%'
        or lower(coalesce(pr.pro_nombre, '')) like '%mesa%'
        or lower(coalesce(pr.pro_nombre, '')) like '%backing%'
      )
    order by pr.pro_destacado desc nulls last, pr.pro_nombre asc
    limit 80
  ) sub;

  return jsonb_build_object(
    'ok', true,
    'modoAcceso', case when v_autenticado then 'AUTENTICADO' else 'KIOSCO' end,
    'puedeInteractuar', (v_autenticado or coalesce((v_cfg_tv->>'permitirCambiarEstadoKiosco')::boolean, true)),
    'hoyYmd', to_char(v_hoy, 'YYYY-MM-DD'),
    'ordenes', v_ordenes,
    'productosEventos', v_productos_eventos,
    'configTv', case when v_autenticado then v_cfg_tv else (v_cfg_tv - 'tokenKiosco') end
  );
end;
$$;

grant execute on function comun_comercio.com_fn_obtener_tablero_tv_taller(text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
