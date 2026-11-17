-- =============================================================================
-- Migración: Motivo de cierre de conversaciones, recordatorios rápidos de seguimiento
--            y metadatos de retorno desde Chat Grupal hacia el chat del cliente
-- Fecha: 2026-11-17
-- =============================================================================

-- 1. Asegurar helper de permisos de administración de etiquetas (idempotente)
create or replace function comun_seguridad.seg_fn_es_admin_u_operador_etiquetas(
  p_negocio text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_neg text := lower(btrim(coalesce(p_negocio, '')));
begin
  if v_uid is null or v_neg = '' then
    return false;
  end if;

  if exists (
    select 1
    from comun_seguridad.seg_usuario u
    where u.usu_id = v_uid
      and (
        u.usu_superadmin_plataforma = true
        or (v_neg in ('tinkay', 'tnk') and lower(btrim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com')
      )
  ) then
    return true;
  end if;

  return exists (
    select 1
    from comun_seguridad.seg_membresia m
    left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
    left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
    where m.mem_usuario_id = v_uid
      and m.mem_estado = 'ACTIVO'
      and (
        lower(m.mem_negocio) = v_neg
        or (v_neg = 'tinkay' and lower(m.mem_negocio) in ('tinkay', 'tnk'))
        or (v_neg = 'tranqi' and lower(m.mem_negocio) in ('tranqi', 'tranq', 'legal'))
        or (v_neg = 'fastfix' and lower(m.mem_negocio) in ('fastfix', 'ffh'))
        or (v_neg = 'margaritas' and lower(m.mem_negocio) in ('margaritas', 'mrg'))
      )
      and (
        upper(coalesce(p.per_clave, '')) in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN', 'OPERADOR')
        or upper(coalesce(m.mem_rol, '')) in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN', 'OPERADOR')
      )
  );
end;
$$;

revoke execute on function comun_seguridad.seg_fn_es_admin_u_operador_etiquetas(text) from public;
grant execute on function comun_seguridad.seg_fn_es_admin_u_operador_etiquetas(text) to authenticated, service_role;

-- 2. Actualizar com_fn_omnicanal_actualizar_conversacion con soporte de:
--    - p_motivo_cierre / p_nota_cierre al cerrar conversación (Venta completada, No responde, etc.)
--    - Reapertura limpia ("Conversación Abierta")
--    - Marcar como No Leído / Leído
--    - Recordatorios de seguimiento en X tiempo
drop function if exists comun_comercio.com_fn_omnicanal_actualizar_conversacion(text, uuid, text, uuid, boolean, timestamptz, text, boolean);
drop function if exists comun_comercio.com_fn_omnicanal_actualizar_conversacion(text, uuid, text, uuid, boolean, timestamptz, text, boolean, boolean);
drop function if exists comun_comercio.com_fn_omnicanal_actualizar_conversacion(text, uuid, text, uuid, boolean, timestamptz, text, boolean, boolean, text, text);

create or replace function comun_comercio.com_fn_omnicanal_actualizar_conversacion(
  p_negocio text,
  p_conversacion_id uuid,
  p_nuevo_estado text default null,
  p_asesora_id uuid default null,
  p_desasignar boolean default false,
  p_recordatorio_en timestamptz default null,
  p_recordatorio_nota text default null,
  p_limpiar_recordatorio boolean default false,
  p_marcar_no_leido boolean default false,
  p_motivo_cierre text default null,
  p_nota_cierre text default null
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
  v_prev record;
  v_cnv record;
  v_evento_texto text;
  v_motivo_codigo text := nullif(upper(btrim(coalesce(p_motivo_cierre, ''))), '');
  v_motivo_etiqueta text;
  v_nota_cierre text := nullif(btrim(coalesce(p_nota_cierre, '')), '');
  v_detalle_actualizado jsonb;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para gestionar esta conversación.');
  end if;

  select * into v_prev
  from comun_agentes.agc_conversacion
  where cnv_id = p_conversacion_id and cnv_negocio = v_negocio;

  if v_prev is null then
    return jsonb_build_object('ok', false, 'error', 'Conversación no encontrada.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Equipo')
    into v_actor
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  v_motivo_etiqueta := case v_motivo_codigo
    when 'VENTA_COMPLETADA' then '✅ Venta completada'
    when 'COTIZACION_ENVIADA' then '📄 Cotización / Proforma enviada'
    when 'CONSULTA_RESUELTA' then 'ℹ️ Consulta informativa resuelta'
    when 'NO_RESPONDE' then '⏳ No responde'
    when 'NO_DESEA_CONTINUAR' then '❌ No desea continuar'
    when 'SIN_DISPONIBILIDAD_COBERTURA' then '🚫 Sin stock o fuera de cobertura'
    when 'SPAM_EQUIVOCADO' then '🗑️ Spam / Número equivocado'
    else coalesce(nullif(btrim(coalesce(p_motivo_cierre, '')), ''), 'Cerrado')
  end;

  v_detalle_actualizado := coalesce(v_prev.cnv_detalle_conversacion, '{}'::jsonb);

  if p_nuevo_estado = 'CERRADO' then
    v_detalle_actualizado := jsonb_set(
      v_detalle_actualizado,
      '{cierre}',
      jsonb_build_object(
        'motivoCodigo', coalesce(v_motivo_codigo, 'CONSULTA_RESUELTA'),
        'motivoEtiqueta', v_motivo_etiqueta,
        'nota', v_nota_cierre,
        'cerradoEn', now(),
        'cerradoPor', v_actor
      ),
      true
    );
  elsif p_nuevo_estado is not null and p_nuevo_estado <> 'CERRADO' then
    v_detalle_actualizado := v_detalle_actualizado - 'cierre';
  end if;

  update comun_agentes.agc_conversacion
     set cnv_estado_atencion = coalesce(p_nuevo_estado, cnv_estado_atencion),
         cnv_asesora_asignada_id = case
           when p_desasignar then null
           when p_asesora_id is not null then p_asesora_id
           when p_nuevo_estado = 'EN_ATENCION_ASESORA' and cnv_asesora_asignada_id is null then v_uid
           else cnv_asesora_asignada_id
         end,
         cnv_atribuido_por = case
           when p_asesora_id is not null or p_nuevo_estado = 'EN_ATENCION_ASESORA' then 'MANUAL'
           else cnv_atribuido_por
         end,
         cnv_recordatorio_en = case
           when p_limpiar_recordatorio or p_nuevo_estado = 'CERRADO' then null
           when p_recordatorio_en is not null then p_recordatorio_en
           else cnv_recordatorio_en
         end,
         cnv_recordatorio_nota = case
           when p_limpiar_recordatorio or p_nuevo_estado = 'CERRADO' then null
           when p_recordatorio_nota is not null then btrim(p_recordatorio_nota)
           else cnv_recordatorio_nota
         end,
         cnv_no_leidos_asesora = case
           when coalesce(p_marcar_no_leido, false) then greatest(cnv_no_leidos_asesora, 1)
           when p_nuevo_estado = 'CERRADO' then 0
           else cnv_no_leidos_asesora
         end,
         cnv_detalle_conversacion = v_detalle_actualizado,
         cnv_actualizado_en = now()
   where cnv_id = p_conversacion_id
     and cnv_negocio = v_negocio
   returning * into v_cnv;

  if p_nuevo_estado is not null and p_nuevo_estado <> v_prev.cnv_estado_atencion then
    if p_nuevo_estado = 'CERRADO' then
      v_evento_texto := v_actor || ' cerró la conversación · Motivo: ' || v_motivo_etiqueta
        || case when v_nota_cierre is not null then ' (' || v_nota_cierre || ')' else '' end;
    elsif v_prev.cnv_estado_atencion = 'CERRADO' then
      v_evento_texto := v_actor || ' reabrió el hilo (Conversación Abierta).';
    else
      v_evento_texto := case p_nuevo_estado
        when 'EN_ATENCION_ASESORA' then v_actor || ' pausó a ARIA y tomó el control humano.'
        when 'BOT_ACTIVO' then v_actor || ' reactivó la atención automática con IA ARIA.'
        when 'ESCALADO_HUMANO' then v_actor || ' marcó el chat como Escalado a Humano.'
        when 'EN_ESPERA_CLIENTE' then v_actor || ' puso la conversación en espera del cliente.'
        else v_actor || ' cambió el estado a ' || p_nuevo_estado
      end;
    end if;

    insert into comun_agentes.agc_mensaje (
      msg_negocio, msg_conversacion_id, msg_origen, msg_autor_usuario_id, msg_autor_nombre, msg_contenido, msg_tipo_contenido
    ) values (
      v_negocio, p_conversacion_id, 'SISTEMA', v_uid, v_actor, v_evento_texto, 'TEXTO'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'estadoAtencion', v_cnv.cnv_estado_atencion,
    'asesoraAsignadaId', v_cnv.cnv_asesora_asignada_id,
    'recordatorioEn', v_cnv.cnv_recordatorio_en,
    'recordatorioNota', v_cnv.cnv_recordatorio_nota,
    'noLeidosAsesora', v_cnv.cnv_no_leidos_asesora,
    'cierre', coalesce(v_cnv.cnv_detalle_conversacion->'cierre', 'null'::jsonb)
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_actualizar_conversacion(text, uuid, text, uuid, boolean, timestamptz, text, boolean, boolean, text, text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_actualizar_conversacion(text, uuid, text, uuid, boolean, timestamptz, text, boolean, boolean, text, text) to authenticated, service_role;

-- 3. Actualizar com_fn_omnicanal_obtener_tablero para retornar `cierre` en cada conversación
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
          nullif(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'nombres', u.usu_nombres, '') || ' ' || coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'apellidos', u.usu_apellidos, '')), ''),
          u.usu_correo
        ),
        'correo', u.usu_correo,
        'telefono', coalesce(
          nullif(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'whatsapp', '')), ''),
          nullif(btrim(coalesce(u.usu_whatsapp, '')), '')
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
        'nombre', c.cli_nombre,
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
