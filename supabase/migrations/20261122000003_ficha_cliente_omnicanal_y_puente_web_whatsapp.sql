-- =============================================================================
-- Migración: Ficha Unificada de Cliente Omnicanal (Nombre Editable, Estrellas 1-5,
--            Notas Operativas) y Puente Bidireccional Web <-> WhatsApp
-- Fecha: 2026-11-22
-- Descripción:
--   1. RPC transaccional `comun_comercio.com_fn_omnicanal_guardar_ficha_cliente`
--      que permite al equipo comercial/administrativo editar el nombre interno del
--      cliente, teléfono/WhatsApp, correo, calificación de 1 a 5 estrellas y notas
--      operativas, sincronizando la ficha entre todos los canales asociados al
--      mismo cliente (teléfono normalizado, correo, usuario_id o refWeb).
--   2. Actualización de `comun_comercio.com_fn_omnicanal_obtener_tablero` para
--      proyectar `fichaCliente` y `puenteOmnicanal` en cada conversación.
-- =============================================================================

drop function if exists comun_comercio.com_fn_omnicanal_guardar_ficha_cliente(text, uuid, text, text, text, integer, text);

create or replace function comun_comercio.com_fn_omnicanal_guardar_ficha_cliente(
  p_negocio text,
  p_conversacion_id uuid,
  p_nombre text,
  p_telefono text default null,
  p_correo text default null,
  p_calificacion_estrellas integer default null,
  p_notas_cliente text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_actor text;
  v_nombre text := left(btrim(coalesce(p_nombre, '')), 140);
  v_telefono text := nullif(left(btrim(coalesce(p_telefono, '')), 40), '');
  v_correo text := nullif(lower(left(btrim(coalesce(p_correo, '')), 160)), '');
  v_estrellas integer := case
    when p_calificacion_estrellas between 1 and 5 then p_calificacion_estrellas
    else null
  end;
  v_notas text := nullif(left(btrim(coalesce(p_notas_cliente, '')), 2000), '');
  v_conv record;
  v_tel_semilla text;
  v_correo_semilla text;
  v_ref_web text;
  v_ahora timestamptz := now();
  v_ficha jsonb;
  v_ids_actualizados jsonb := '[]'::jsonb;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object(
      'ok', false,
      'error', 'Acceso restringido al equipo de ventas y administración.'
    );
  end if;

  if v_nombre = '' then
    return jsonb_build_object(
      'ok', false,
      'error', 'Ingresa un nombre válido para el registro del cliente.'
    );
  end if;

  select *
    into v_conv
    from comun_agentes.agc_conversacion
   where cnv_id = p_conversacion_id
     and cnv_negocio = v_negocio
     and cnv_canal <> 'interno'
     and cnv_eliminado_en is null;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'La conversación indicada no existe o fue eliminada.'
    );
  end if;

  select coalesce(
           nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''),
           u.usu_correo,
           'Equipo'
         )
    into v_actor
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  v_ficha := jsonb_build_object(
    'nombrePersonalizado', v_nombre,
    'calificacionEstrellas', v_estrellas,
    'notasCliente', v_notas,
    'actualizadoEn', v_ahora,
    'actualizadoPorNombre', coalesce(v_actor, 'Equipo')
  );

  v_tel_semilla := right(regexp_replace(coalesce(v_telefono, v_conv.cnv_remitente_telefono, ''), '\D', '', 'g'), 9);
  v_correo_semilla := coalesce(v_correo, lower(nullif(btrim(coalesce(v_conv.cnv_remitente_correo, '')), '')));
  v_ref_web := nullif(btrim(coalesce(v_conv.cnv_detalle_conversacion->'puente_omnicanal'->>'refWeb', '')), '');

  with actualizadas as (
    update comun_agentes.agc_conversacion c
       set cnv_remitente_nombre = v_nombre,
           cnv_remitente_telefono = case
             when c.cnv_id = p_conversacion_id then v_telefono
             else coalesce(c.cnv_remitente_telefono, v_telefono)
           end,
           cnv_remitente_correo = case
             when c.cnv_id = p_conversacion_id then v_correo
             else coalesce(c.cnv_remitente_correo, v_correo)
           end,
           cnv_actualizado_en = v_ahora,
           cnv_detalle_conversacion = jsonb_set(
             jsonb_set(
               coalesce(c.cnv_detalle_conversacion, '{}'::jsonb),
               '{ficha_cliente}',
               v_ficha,
               true
             ),
             '{datos_venta,nombreCliente}',
             to_jsonb(v_nombre),
             true
           )
     where c.cnv_negocio = v_negocio
       and c.cnv_canal <> 'interno'
       and c.cnv_eliminado_en is null
       and (
         c.cnv_id = p_conversacion_id
         or (length(v_tel_semilla) >= 8 and right(regexp_replace(coalesce(c.cnv_remitente_telefono, ''), '\D', '', 'g'), 9) = v_tel_semilla)
         or (v_correo_semilla is not null and lower(btrim(coalesce(c.cnv_remitente_correo, ''))) = v_correo_semilla)
         or (v_conv.cnv_usuario_id is not null and c.cnv_usuario_id = v_conv.cnv_usuario_id)
         or (v_conv.cnv_cliente_id is not null and c.cnv_cliente_id = v_conv.cnv_cliente_id)
         or (v_ref_web is not null and c.cnv_detalle_conversacion->'puente_omnicanal'->>'refWeb' = v_ref_web)
       )
    returning c.cnv_id
  )
  select coalesce(jsonb_agg(cnv_id), '[]'::jsonb)
    into v_ids_actualizados
    from actualizadas;

  if v_conv.cnv_cliente_id is not null then
    update comun_comercio.com_cliente cl
       set cli_nombre = v_nombre,
           cli_telefono = coalesce(v_telefono, cl.cli_telefono),
           cli_correo = coalesce(v_correo, cl.cli_correo),
           cli_detalle_cliente = coalesce(cl.cli_detalle_cliente, '{}'::jsonb) || jsonb_build_object('ficha_cliente', v_ficha),
           cli_actualizado_en = v_ahora
     where cl.cli_id = v_conv.cnv_cliente_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'fichaCliente', v_ficha,
    'remitenteNombre', v_nombre,
    'remitenteTelefono', v_telefono,
    'remitenteCorreo', v_correo,
    'conversacionesActualizadasIds', v_ids_actualizados
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_guardar_ficha_cliente(text, uuid, text, text, text, integer, text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_guardar_ficha_cliente(text, uuid, text, text, text, integer, text) to authenticated, service_role;

-- 2. Actualizar com_fn_omnicanal_obtener_tablero proyectando fichaCliente y puenteOmnicanal
create or replace function comun_comercio.com_fn_omnicanal_obtener_tablero(
  p_negocio text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_es_admin_etiquetas boolean := false;
  v_es_admin_aplicacion boolean := false;
  v_etiquetas jsonb;
  v_respuestas jsonb;
  v_equipo jsonb;
  v_conversaciones jsonb;
  v_usuarios_web jsonb;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Acceso restringido al equipo de ventas y administración.');
  end if;

  v_es_admin_etiquetas := comun_seguridad.seg_fn_es_admin_u_operador_etiquetas(v_negocio);
  v_es_admin_aplicacion := comun_seguridad.seg_fn_es_admin_negocio_omnicanal(v_negocio);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.etq_id,
      'slug', e.etq_slug,
      'nombre', e.etq_nombre,
      'color', e.etq_color,
      'icono', e.etq_icono,
      'orden', e.etq_orden
    ) order by e.etq_orden asc, e.etq_nombre asc
  ), '[]'::jsonb)
  into v_etiquetas
  from comun_agentes.agc_etiqueta e
  where e.etq_negocio = v_negocio
    and e.etq_activo = true
    and e.etq_eliminado_en is null
    and e.etq_slug not in ('origen-whatsapp', 'origen-web');

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.rrp_id,
      'atajo', r.rrp_atajo,
      'titulo', r.rrp_titulo,
      'categoria', r.rrp_categoria,
      'contenido', r.rrp_contenido,
      'usoConteo', r.rrp_uso_conteo
    ) order by r.rrp_categoria asc, r.rrp_atajo asc
  ), '[]'::jsonb)
  into v_respuestas
  from comun_agentes.agc_respuesta_rapida r
  where r.rrp_negocio = v_negocio
    and r.rrp_activo = true
    and r.rrp_eliminado_en is null;

  select coalesce(jsonb_agg(sub.miembro order by sub.nombre asc), '[]'::jsonb)
  into v_equipo
  from (
    select distinct on (u.usu_id)
      u.usu_id,
      coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo) as nombre,
      jsonb_build_object(
        'usuarioId', u.usu_id,
        'nombre', coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo),
        'correo', u.usu_correo,
        'avatarUrl', u.usu_detalle_usuario->>'foto',
        'rol', case
          when u.usu_superadmin_plataforma or (v_negocio = 'tinkay' and lower(btrim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com') then 'SUPERADMIN'
          else coalesce(p.per_clave, m.mem_rol, 'VENTAS')
        end,
        'chatsActivos', (
          select count(*)
          from comun_agentes.agc_conversacion ca
          where ca.cnv_negocio = v_negocio
            and ca.cnv_canal <> 'interno'
            and ca.cnv_asesora_asignada_id = u.usu_id
            and ca.cnv_estado_atencion <> 'CERRADO'
            and ca.cnv_eliminado_en is null
        )
      ) as miembro
    from comun_seguridad.seg_membresia m
    join comun_seguridad.seg_usuario u on u.usu_id = m.mem_usuario_id
    left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
    left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
    where m.mem_estado = 'ACTIVO'
      and (
        lower(m.mem_negocio) = v_negocio
        or (v_negocio = 'tinkay' and lower(m.mem_negocio) in ('tinkay', 'tnk'))
        or (v_negocio = 'tranqi' and lower(m.mem_negocio) in ('tranqi', 'tranq', 'legal'))
        or (v_negocio = 'fastfix' and lower(m.mem_negocio) in ('fastfix', 'ffh'))
        or (v_negocio = 'margaritas' and lower(m.mem_negocio) in ('margaritas', 'mrg'))
      )
      and (
        u.usu_superadmin_plataforma
        or (v_negocio = 'tinkay' and lower(btrim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com')
        or upper(coalesce(p.per_clave, '')) in ('VENTAS', 'VENDEDOR', 'ASESOR', 'OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN')
        or upper(coalesce(m.mem_rol, '')) in ('VENTAS', 'VENDEDOR', 'ASESOR', 'OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN')
      )
  ) sub;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.cnv_id,
      'secuencial', c.cnv_secuencial,
      'negocio', c.cnv_negocio,
      'canal', c.cnv_canal,
      'claveHilo', c.cnv_clave_hilo,
      'remitenteId', c.cnv_remitente_id,
      'remitenteNombre', c.cnv_remitente_nombre,
      'remitenteCorreo', c.cnv_remitente_correo,
      'remitenteTelefono', c.cnv_remitente_telefono,
      'usuarioId', c.cnv_usuario_id,
      'clienteId', c.cnv_cliente_id,
      'estadoAtencion', c.cnv_estado_atencion,
      'asesoraAsignadaId', c.cnv_asesora_asignada_id,
      'asesoraNombre', (
        select btrim(coalesce(ua.usu_nombres, '') || ' ' || coalesce(ua.usu_apellidos, ''))
        from comun_seguridad.seg_usuario ua
        where ua.usu_id = c.cnv_asesora_asignada_id
      ),
      'ultimoMensajeTexto', c.cnv_ultimo_mensaje_texto,
      'ultimoMensajeOrigen', c.cnv_ultimo_mensaje_origen,
      'ultimoMensajeEn', c.cnv_ultimo_mensaje_en,
      'noLeidosAsesora', c.cnv_no_leidos_asesora,
      'mensajesClienteConteo', c.cnv_mensajes_cliente_conteo,
      'mensajesIaConteo', c.cnv_mensajes_ia_conteo,
      'mensajesHumanoConteo', c.cnv_mensajes_humano_conteo,
      'motivoEscalamiento', c.cnv_motivo_escalamiento,
      'recordatorioEn', c.cnv_recordatorio_en,
      'recordatorioNota', c.cnv_recordatorio_nota,
      'ventana24hExpiraEn', c.cnv_ventana_24h_expira_en,
      'creadoEn', c.cnv_creado_en,
      'datosVenta', coalesce(c.cnv_detalle_conversacion->'datos_venta', '{}'::jsonb),
      'cierre', coalesce(c.cnv_detalle_conversacion->'cierre', 'null'::jsonb),
      'fichaCliente', coalesce(c.cnv_detalle_conversacion->'ficha_cliente', 'null'::jsonb),
      'puenteOmnicanal', coalesce(c.cnv_detalle_conversacion->'puente_omnicanal', 'null'::jsonb),
      'etiquetasIds', coalesce((
        select jsonb_agg(ce.cet_etiqueta_id)
        from comun_agentes.agc_conversacion_etiqueta ce
        join comun_agentes.agc_etiqueta et on et.etq_id = ce.cet_etiqueta_id
        where ce.cet_conversacion_id = c.cnv_id
          and ce.cet_eliminado_en is null
          and et.etq_activo = true
          and et.etq_eliminado_en is null
          and et.etq_slug not in ('origen-whatsapp', 'origen-web')
      ), '[]'::jsonb)
    ) order by
      case when c.cnv_estado_atencion = 'ESCALADO_HUMANO' then 0 else 1 end asc,
      c.cnv_ultimo_mensaje_en desc
  ), '[]'::jsonb)
  into v_conversaciones
  from (
    select *
    from comun_agentes.agc_conversacion
    where cnv_negocio = v_negocio
      and cnv_canal <> 'interno'
      and cnv_eliminado_en is null
    order by
      case when cnv_estado_atencion = 'ESCALADO_HUMANO' then 0 else 1 end asc,
      cnv_ultimo_mensaje_en desc
    limit 250
  ) c;

  select coalesce(jsonb_agg(item order by creado_en desc), '[]'::jsonb)
  into v_usuarios_web
  from (
    select
      u.usu_creado_en as creado_en,
      jsonb_build_object(
        'claveUnica', 'usu:' || u.usu_id::text,
        'usuarioId', u.usu_id,
        'clienteId', cl.cli_id,
        'tipoCuenta', 'USUARIO_REGISTRADO',
        'nombre', coalesce(
          nullif(btrim(coalesce(cl.cli_detalle_cliente->'ficha_cliente'->>'nombrePersonalizado', '')), ''),
          nullif(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'nombres', u.usu_nombres, '') || ' ' || coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'apellidos', u.usu_apellidos, '')), ''),
          u.usu_correo
        ),
        'correo', u.usu_correo,
        'telefono', coalesce(
          nullif(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'whatsapp', '')), ''),
          nullif(btrim(coalesce(u.usu_whatsapp, '')), ''),
          cl.cli_telefono
        ),
        'identificacion', coalesce(cl.cli_identificacion, u.usu_cedula),
        'autorizaWhatsapp', coalesce(
          case
            when lower(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'autorizacion_whatsapp', ''))) in ('true', 't', '1', 'si', 'yes') then true
            when lower(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'autorizacion_whatsapp', ''))) in ('false', 'f', '0', 'no') then false
            else null
          end,
          u.usu_autorizacion_whatsapp,
          false
        ),
        'rolNegocio', coalesce(m.mem_rol, 'CLIENTE'),
        'totalCompras', coalesce(cl.cli_total_compras, 0),
        'montoAcumulado', coalesce(cl.cli_monto_acumulado, 0),
        'ultimaCompraEn', cl.cli_ultima_compra_en,
        'creadoEn', coalesce(m.mem_creado_en, u.usu_creado_en),
        'calificacionEstrellas', (cl.cli_detalle_cliente->'ficha_cliente'->>'calificacionEstrellas')::integer,
        'notasCliente', cl.cli_detalle_cliente->'ficha_cliente'->>'notasCliente',
        'etiquetasIds', coalesce((
          select jsonb_agg(cle.cle_etiqueta_id)
          from comun_comercio.com_cliente_etiqueta cle
          where cl.cli_id is not null and cle.cle_cliente_id = cl.cli_id and cle.cle_eliminado_en is null
        ), '[]'::jsonb)
      ) as item
    from comun_seguridad.seg_membresia m
    join comun_seguridad.seg_usuario u on u.usu_id = m.mem_usuario_id
    left join lateral (
      select c.*
      from comun_comercio.com_cliente c
      where c.cli_negocio = v_negocio
        and c.cli_eliminado_en is null
        and (c.cli_usuario_id = u.usu_id or (u.usu_correo is not null and lower(c.cli_correo) = lower(u.usu_correo)))
      order by c.cli_actualizado_en desc
      limit 1
    ) cl on true
    where m.mem_estado = 'ACTIVO'
      and (
        lower(m.mem_negocio) = v_negocio
        or (v_negocio = 'tinkay' and lower(m.mem_negocio) in ('tinkay', 'tnk'))
        or (v_negocio = 'tranqi' and lower(m.mem_negocio) in ('tranqi', 'tranq', 'legal'))
        or (v_negocio = 'fastfix' and lower(m.mem_negocio) in ('fastfix', 'ffh'))
        or (v_negocio = 'margaritas' and lower(m.mem_negocio) in ('margaritas', 'mrg'))
      )

    union all

    select
      c.cli_creado_en as creado_en,
      jsonb_build_object(
        'claveUnica', 'cli:' || c.cli_id::text,
        'usuarioId', null,
        'clienteId', c.cli_id,
        'tipoCuenta', 'INVITADO_NO_REGISTRADO',
        'nombre', coalesce(nullif(btrim(coalesce(c.cli_detalle_cliente->'ficha_cliente'->>'nombrePersonalizado', '')), ''), c.cli_nombre),
        'correo', c.cli_correo,
        'telefono', c.cli_telefono,
        'identificacion', c.cli_identificacion,
        'autorizaWhatsapp', (
          lower(btrim(coalesce(c.cli_detalle_cliente->'datos_capturados'->>'autorizaWhatsapp', ''))) in ('true', 't', '1', 'si', 'yes')
        ),
        'rolNegocio', 'INVITADO',
        'totalCompras', c.cli_total_compras,
        'montoAcumulado', c.cli_monto_acumulado,
        'ultimaCompraEn', c.cli_ultima_compra_en,
        'creadoEn', c.cli_creado_en,
        'calificacionEstrellas', (c.cli_detalle_cliente->'ficha_cliente'->>'calificacionEstrellas')::integer,
        'notasCliente', c.cli_detalle_cliente->'ficha_cliente'->>'notasCliente',
        'etiquetasIds', coalesce((
          select jsonb_agg(cle.cle_etiqueta_id)
          from comun_comercio.com_cliente_etiqueta cle
          where cle.cle_cliente_id = c.cli_id and cle.cle_eliminado_en is null
        ), '[]'::jsonb)
      ) as item
    from comun_comercio.com_cliente c
    where c.cli_negocio = v_negocio
      and c.cli_eliminado_en is null
      and c.cli_usuario_id is null
      and not exists (
        select 1
        from comun_seguridad.seg_usuario u2
        join comun_seguridad.seg_membresia m2 on m2.mem_usuario_id = u2.usu_id
        where c.cli_correo is not null
          and lower(u2.usu_correo) = lower(c.cli_correo)
          and lower(m2.mem_negocio) = v_negocio
          and m2.mem_estado = 'ACTIVO'
      )
  ) directorio;

  return jsonb_build_object(
    'ok', true,
    'esAdminEtiquetas', v_es_admin_etiquetas,
    'esAdminAplicacion', v_es_admin_aplicacion,
    'conversaciones', v_conversaciones,
    'etiquetas', v_etiquetas,
    'respuestasRapidas', v_respuestas,
    'equipo', v_equipo,
    'usuariosYClientes', v_usuarios_web
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_obtener_tablero(text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_obtener_tablero(text) to authenticated, service_role;

notify pgrst, 'reload schema';
