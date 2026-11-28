-- Sincronización de fotos reales de Google Contacts (People API `photos`) hacia el Directorio y
-- exposición de `remitenteFotoUrl` en `com_fn_omnicanal_obtener_tablero`.

create or replace function comun_comercio.com_fn_omnicanal_sincronizar_fotos_directorio(
  p_negocio text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_item jsonb;
  v_u9 text;
  v_foto text;
  v_nombre text;
  v_dir_act integer := 0;
  v_chat_act integer := 0;
  v_tmp integer := 0;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para sincronizar fotos de contactos.');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return jsonb_build_object('ok', true, 'directorioActualizados', 0, 'chatsActualizados', 0);
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_u9 := comun_agentes.agc_fn_ultimos9_telefono(coalesce(v_item->>'telefono', ''));
    v_foto := btrim(coalesce(v_item->>'fotoUrl', ''));
    v_nombre := nullif(left(btrim(coalesce(v_item->>'nombre', '')), 160), '');

    if length(v_u9) < 8 or v_foto !~* '^https?://' then
      continue;
    end if;

    update comun_agentes.agc_contacto_directorio
       set cdo_detalle_contacto = jsonb_set(
             coalesce(cdo_detalle_contacto, '{}'::jsonb),
             '{fotoUrl}',
             to_jsonb(v_foto),
             true
           ),
           cdo_actualizado_en = now()
     where cdo_negocio = v_negocio
       and cdo_eliminado_en is null
       and cdo_telefono_ultimos9 = v_u9;
    get diagnostics v_tmp = row_count;
    v_dir_act := v_dir_act + v_tmp;

    update comun_agentes.agc_conversacion cv
       set cnv_detalle_conversacion = jsonb_set(
             coalesce(cv.cnv_detalle_conversacion, '{}'::jsonb),
             '{foto_contacto_url}',
             to_jsonb(v_foto),
             true
           ),
           cnv_remitente_nombre = case
             when v_nombre is not null
               and (cv.cnv_remitente_nombre like 'WhatsApp +%' or cv.cnv_remitente_nombre like '+%')
               then v_nombre
             else cv.cnv_remitente_nombre
           end,
           cnv_actualizado_en = now()
     where cv.cnv_negocio = v_negocio
       and cv.cnv_canal = 'whatsapp'
       and cv.cnv_eliminado_en is null
       and comun_agentes.agc_fn_ultimos9_telefono(coalesce(cv.cnv_remitente_telefono, cv.cnv_remitente_id)) = v_u9;
    get diagnostics v_tmp = row_count;
    v_chat_act := v_chat_act + v_tmp;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'directorioActualizados', v_dir_act,
    'chatsActualizados', v_chat_act
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_sincronizar_fotos_directorio(text, jsonb) from public;
grant execute on function comun_comercio.com_fn_omnicanal_sincronizar_fotos_directorio(text, jsonb) to authenticated, service_role;

-- Actualizar com_fn_omnicanal_obtener_tablero para proyectar `remitenteFotoUrl` desde Directorio / Google / Usuario
create or replace function comun_comercio.com_fn_omnicanal_obtener_tablero(p_negocio text)
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
  v_lineas jsonb;
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

  select coalesce(jsonb_agg(to_jsonb(lw) order by lw."esPrincipal" desc, lw."nombre" asc), '[]'::jsonb)
  into v_lineas
  from (
    select
      l.lwa_id as "id",
      l.lwa_codigo as "codigo",
      l.lwa_nombre as "nombre",
      l.lwa_rol_linea as "rolLinea",
      l.lwa_numero_e164 as "numeroE164",
      l.lwa_titular_usuario_id as "titularUsuarioId",
      l.lwa_es_principal as "esPrincipal",
      l.lwa_habilitado as "habilitado",
      l.lwa_ia_desconocidos_activa as "iaDesconocidosActiva",
      l.lwa_ia_clientes_activa as "iaClientesActiva",
      l.lwa_politica_personales as "politicaPersonales",
      l.lwa_visibilidad_clientes as "visibilidadClientes",
      l.lwa_color_badge as "colorBadge"
    from comun_agentes.agc_linea_whatsapp l
    where l.lwa_negocio = v_negocio
      and l.lwa_eliminado_en is null
  ) lw;

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
            and comun_agentes.agc_fn_puede_ver_conversacion(ca.cnv_negocio, ca.cnv_visibilidad, ca.cnv_titular_privado_id, null)
        )
      ) as miembro
    from comun_seguridad.seg_membresia m
    join comun_seguridad.seg_usuario u on u.usu_id = m.mem_usuario_id
    left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
    left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
    where m.mem_estado = 'ACTIVO'
      and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_negocio
      and (
        u.usu_superadmin_plataforma
        or (v_negocio = 'tinkay' and lower(btrim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com')
        or upper(coalesce(p.per_clave, '')) in ('VENTAS', 'VENDEDOR', 'ASESOR', 'OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN')
        or upper(coalesce(m.mem_rol, '')) in ('VENTAS', 'VENDEDOR', 'ASESOR', 'OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN')
      )
  ) sub;

  select coalesce(jsonb_agg(
    to_jsonb(sub) order by
      case when sub."estadoAtencion" = 'ESCALADO_HUMANO' then 0 else 1 end asc,
      sub."ultimoMensajeEn" desc
  ), '[]'::jsonb)
  into v_conversaciones
  from (
    select
      c.cnv_id as "id",
      c.cnv_secuencial as "secuencial",
      c.cnv_negocio as "negocio",
      c.cnv_canal as "canal",
      c.cnv_clave_hilo as "claveHilo",
      c.cnv_remitente_id as "remitenteId",
      c.cnv_remitente_nombre as "remitenteNombre",
      c.cnv_remitente_correo as "remitenteCorreo",
      c.cnv_remitente_telefono as "remitenteTelefono",
      coalesce(
        nullif(btrim(coalesce(cd.cdo_detalle_contacto->>'fotoUrl', '')), ''),
        nullif(btrim(coalesce(c.cnv_detalle_conversacion->>'foto_contacto_url', '')), ''),
        nullif(btrim(coalesce(u_rem.usu_detalle_usuario->>'foto', '')), '')
      ) as "remitenteFotoUrl",
      c.cnv_usuario_id as "usuarioId",
      c.cnv_cliente_id as "clienteId",
      c.cnv_estado_atencion as "estadoAtencion",
      c.cnv_asesora_asignada_id as "asesoraAsignadaId",
      (
        select btrim(coalesce(ua.usu_nombres, '') || ' ' || coalesce(ua.usu_apellidos, ''))
        from comun_seguridad.seg_usuario ua
        where ua.usu_id = c.cnv_asesora_asignada_id
      ) as "asesoraNombre",
      c.cnv_ultimo_mensaje_texto as "ultimoMensajeTexto",
      c.cnv_ultimo_mensaje_origen as "ultimoMensajeOrigen",
      c.cnv_ultimo_mensaje_en as "ultimoMensajeEn",
      c.cnv_no_leidos_asesora as "noLeidosAsesora",
      c.cnv_mensajes_cliente_conteo as "mensajesClienteConteo",
      c.cnv_mensajes_ia_conteo as "mensajesIaConteo",
      c.cnv_mensajes_humano_conteo as "mensajesHumanoConteo",
      c.cnv_motivo_escalamiento as "motivoEscalamiento",
      c.cnv_recordatorio_en as "recordatorioEn",
      c.cnv_recordatorio_nota as "recordatorioNota",
      c.cnv_ventana_24h_expira_en as "ventana24hExpiraEn",
      c.cnv_creado_en as "creadoEn",
      c.cnv_linea_whatsapp_id as "lineaWhatsappId",
      lw.lwa_codigo as "lineaWhatsappCodigo",
      lw.lwa_nombre as "lineaWhatsappNombre",
      lw.lwa_rol_linea as "lineaWhatsappRol",
      lw.lwa_color_badge as "lineaWhatsappColor",
      lw.lwa_numero_e164 as "lineaWhatsappNumero",
      c.cnv_visibilidad as "visibilidad",
      c.cnv_titular_privado_id as "titularPrivadoId",
      c.cnv_ia_bloqueada_permanente as "iaBloqueadaPermanente",
      cd.cdo_clasificacion as "contactoClasificacion",
      cd.cdo_politica_ia as "contactoPoliticaIa",
      coalesce(c.cnv_detalle_conversacion->'datos_venta', '{}'::jsonb) as "datosVenta",
      coalesce(c.cnv_detalle_conversacion->'cierre', 'null'::jsonb) as "cierre",
      coalesce(c.cnv_detalle_conversacion->'ficha_cliente', 'null'::jsonb) as "fichaCliente",
      coalesce(c.cnv_detalle_conversacion->'puente_omnicanal', 'null'::jsonb) as "puenteOmnicanal",
      coalesce((
        select jsonb_agg(ce.cet_etiqueta_id)
        from comun_agentes.agc_conversacion_etiqueta ce
        join comun_agentes.agc_etiqueta et on et.etq_id = ce.cet_etiqueta_id
        where ce.cet_conversacion_id = c.cnv_id
          and ce.cet_eliminado_en is null
          and et.etq_activo = true
          and et.etq_eliminado_en is null
          and et.etq_slug not in ('origen-whatsapp', 'origen-web')
      ), '[]'::jsonb) as "etiquetasIds"
    from (
      select *
      from comun_agentes.agc_conversacion
      where cnv_negocio = v_negocio
        and cnv_canal <> 'interno'
        and cnv_eliminado_en is null
        and comun_agentes.agc_fn_puede_ver_conversacion(cnv_negocio, cnv_visibilidad, cnv_titular_privado_id, null)
      order by
        case when cnv_estado_atencion = 'ESCALADO_HUMANO' then 0 else 1 end asc,
        cnv_ultimo_mensaje_en desc
      limit 250
    ) c
    left join comun_agentes.agc_linea_whatsapp lw on lw.lwa_id = c.cnv_linea_whatsapp_id
    left join lateral (
      select d.*
      from comun_agentes.agc_contacto_directorio d
      where d.cdo_negocio = c.cnv_negocio
        and d.cdo_eliminado_en is null
        and (
          (c.cnv_contacto_directorio_id is not null and d.cdo_id = c.cnv_contacto_directorio_id)
          or (
            c.cnv_canal = 'whatsapp'
            and length(comun_agentes.agc_fn_ultimos9_telefono(coalesce(c.cnv_remitente_telefono, c.cnv_remitente_id))) >= 8
            and d.cdo_telefono_ultimos9 = comun_agentes.agc_fn_ultimos9_telefono(coalesce(c.cnv_remitente_telefono, c.cnv_remitente_id))
          )
        )
      order by case when d.cdo_id = c.cnv_contacto_directorio_id then 0 else 1 end asc
      limit 1
    ) cd on true
    left join comun_seguridad.seg_usuario u_rem on u_rem.usu_id = c.cnv_usuario_id
  ) sub;

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
      and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_negocio

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
          and comun_seguridad.seg_fn_normalizar_negocio(m2.mem_negocio) = v_negocio
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
    'lineasWhatsapp', v_lineas,
    'usuariosYClientes', v_usuarios_web
  );
end;
$$;
