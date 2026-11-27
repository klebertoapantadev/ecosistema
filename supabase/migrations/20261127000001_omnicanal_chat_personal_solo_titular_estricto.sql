-- Privacidad estricta para chats marcados como Personal (SOLO_TITULAR):
-- Ningún otro usuario del negocio (ni Ventas, ni Asesoras, ni otros Administradores) puede verlos.

create or replace function comun_agentes.agc_fn_puede_ver_conversacion(
  p_negocio text,
  p_visibilidad text,
  p_titular_privado_id uuid,
  p_usuario_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_vis text := upper(coalesce(nullif(btrim(p_visibilidad), ''), 'EQUIPO_VENTAS'));
begin
  if v_uid is null then
    return false;
  end if;

  -- SOLO_TITULAR: estrictamente privado al usuario propietario del chat (invisible para todos los demás usuarios)
  if v_vis = 'SOLO_TITULAR' then
    if p_titular_privado_id is not null then
      return (p_titular_privado_id = v_uid);
    end if;
    return comun_seguridad.seg_fn_es_superadmin();
  end if;

  -- Cliente propietario de un hilo comercial Web
  if p_usuario_id is not null and p_usuario_id = v_uid and v_vis = 'EQUIPO_VENTAS' then
    return true;
  end if;

  -- SuperAdmin de plataforma o propietario del negocio
  if comun_seguridad.seg_fn_es_superadmin() then
    return true;
  end if;

  if v_vis = 'SOLO_ADMIN' then
    return comun_seguridad.seg_fn_es_admin_negocio_omnicanal(p_negocio);
  end if;

  -- EQUIPO_VENTAS
  return comun_seguridad.seg_fn_es_equipo_ventas_negocio(p_negocio);
end;
$$;

create or replace function comun_comercio.com_fn_omnicanal_marcar_chat_privacidad(
  p_negocio text,
  p_conversacion_id uuid,
  p_accion text,
  p_politica_personal text default 'SOLO_TITULAR'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_es_admin boolean := false;
  v_accion text := upper(btrim(coalesce(p_accion, '')));
  v_pol text := upper(btrim(coalesce(p_politica_personal, 'SOLO_TITULAR')));
  v_cnv comun_agentes.agc_conversacion;
  v_e164 text;
  v_u9 text;
  v_cdo_id uuid;
  v_actor text;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para modificar la privacidad de este chat.');
  end if;

  v_es_admin := comun_seguridad.seg_fn_es_admin_negocio_omnicanal(v_negocio);

  select * into v_cnv
  from comun_agentes.agc_conversacion
  where cnv_id = p_conversacion_id
    and cnv_negocio = v_negocio
    and cnv_eliminado_en is null;

  if v_cnv.cnv_id is null then
    return jsonb_build_object('ok', false, 'error', 'Conversación no encontrada.');
  end if;

  if not comun_agentes.agc_fn_puede_ver_conversacion(v_negocio, v_cnv.cnv_visibilidad, v_cnv.cnv_titular_privado_id, null) then
    return jsonb_build_object('ok', false, 'error', 'No tienes acceso a esta conversación privada.');
  end if;

  if v_pol = 'SOLO_ADMIN' then
    v_pol := 'OCULTO_ADMIN';
  end if;
  if v_pol not in ('IGNORAR_TOTAL', 'OCULTO_ADMIN', 'SOLO_TITULAR') then
    v_pol := 'SOLO_TITULAR';
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Equipo')
    into v_actor
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  v_e164 := comun_agentes.agc_fn_normalizar_telefono_e164(coalesce(v_cnv.cnv_remitente_telefono, v_cnv.cnv_remitente_id));
  v_u9 := comun_agentes.agc_fn_ultimos9_telefono(v_e164);

  if v_accion = 'MARCAR_PERSONAL' then
    if not v_es_admin and v_cnv.cnv_titular_privado_id is distinct from v_uid then
      return jsonb_build_object('ok', false, 'error', 'Solo un Administrador o el titular de la línea puede marcar un chat como Personal.');
    end if;

    if v_e164 <> '' and length(v_u9) >= 8 then
      insert into comun_agentes.agc_contacto_directorio (
        cdo_negocio, cdo_telefono_e164, cdo_telefono_ultimos9,
        cdo_nombre_consolidado, cdo_correo,
        cdo_clasificacion, cdo_politica_ia, cdo_visibilidad,
        cdo_titular_usuario_id
      ) values (
        v_negocio, v_e164, v_u9,
        coalesce(nullif(btrim(v_cnv.cnv_remitente_nombre), ''), v_e164), v_cnv.cnv_remitente_correo,
        'PERSONAL', 'SIEMPRE_MANUAL', case when v_pol = 'OCULTO_ADMIN' then 'SOLO_ADMIN' else v_pol end,
        v_uid
      )
      on conflict (cdo_negocio, cdo_telefono_ultimos9) where cdo_eliminado_en is null
      do update set
        cdo_clasificacion = 'PERSONAL',
        cdo_politica_ia = 'SIEMPRE_MANUAL',
        cdo_visibilidad = case when v_pol = 'OCULTO_ADMIN' then 'SOLO_ADMIN' else v_pol end,
        cdo_titular_usuario_id = case when v_pol = 'SOLO_TITULAR' then v_uid else coalesce(comun_agentes.agc_contacto_directorio.cdo_titular_usuario_id, v_uid) end,
        cdo_actualizado_en = now()
      returning cdo_id into v_cdo_id;

      insert into comun_agentes.agc_contacto_fuente (
        cfu_negocio, cfu_contacto_id, cfu_propietario_usuario_id,
        cfu_linea_whatsapp_id, cfu_origen, cfu_nombre_original,
        cfu_clasificacion_origen, cfu_politica_personal
      ) values (
        v_negocio, v_cdo_id, v_uid,
        v_cnv.cnv_linea_whatsapp_id, 'MANUAL_CHAT',
        coalesce(nullif(btrim(v_cnv.cnv_remitente_nombre), ''), v_e164),
        'PERSONAL', v_pol
      )
      on conflict (
        cfu_contacto_id,
        coalesce(cfu_linea_whatsapp_id, '00000000-0000-0000-0000-000000000000'::uuid),
        coalesce(cfu_propietario_usuario_id, '00000000-0000-0000-0000-000000000000'::uuid)
      ) where cfu_eliminado_en is null
      do update set
        cfu_clasificacion_origen = 'PERSONAL',
        cfu_politica_personal = v_pol,
        cfu_actualizado_en = now();
    end if;

    if v_pol = 'IGNORAR_TOTAL' then
      update comun_agentes.agc_conversacion
         set cnv_contacto_directorio_id = coalesce(v_cdo_id, cnv_contacto_directorio_id),
             cnv_ia_bloqueada_permanente = true,
             cnv_estado_atencion = 'EN_ATENCION_ASESORA',
             cnv_asesora_asignada_id = null,
             cnv_visibilidad = 'SOLO_TITULAR',
             cnv_titular_privado_id = v_uid,
             cnv_eliminado_en = now(),
             cnv_actualizado_en = now()
       where cnv_id = p_conversacion_id;
    else
      update comun_agentes.agc_conversacion
         set cnv_contacto_directorio_id = coalesce(v_cdo_id, cnv_contacto_directorio_id),
             cnv_ia_bloqueada_permanente = true,
             cnv_estado_atencion = 'EN_ATENCION_ASESORA',
             cnv_asesora_asignada_id = null,
             cnv_visibilidad = case when v_pol = 'SOLO_TITULAR' then 'SOLO_TITULAR' else 'SOLO_ADMIN' end,
             cnv_titular_privado_id = case when v_pol = 'SOLO_TITULAR' then v_uid else coalesce(cnv_titular_privado_id, v_uid) end,
             cnv_actualizado_en = now()
       where cnv_id = p_conversacion_id;

      insert into comun_agentes.agc_mensaje (
        msg_negocio, msg_conversacion_id, msg_origen, msg_autor_usuario_id, msg_autor_nombre, msg_contenido, msg_tipo_contenido
      ) values (
        v_negocio, p_conversacion_id, 'SISTEMA', v_uid, v_actor,
        case
          when v_pol = 'SOLO_TITULAR'
            then v_actor || ' convirtió este chat en Personal (Solo yo · oculto a todos los demás usuarios e IA bloqueada).'
          else v_actor || ' marcó este contacto como Personal (oculto a Ventas · visible solo para Administradores).'
        end,
        'TEXTO'
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'accion', 'MARCAR_PERSONAL',
      'politicaPersonal', v_pol,
      'ocultoConsola', (v_pol = 'IGNORAR_TOTAL'),
      'visibilidad', case when v_pol = 'OCULTO_ADMIN' then 'SOLO_ADMIN' else 'SOLO_TITULAR' end,
      'titularPrivadoId', v_uid
    );

  elsif v_accion in ('PASAR_A_VENTAS', 'ACTIVAR_IA_CLIENTE') then
    if not v_es_admin
       and not (v_cnv.cnv_visibilidad = 'SOLO_TITULAR' and v_cnv.cnv_titular_privado_id = v_uid)
       and v_cnv.cnv_visibilidad <> 'EQUIPO_VENTAS' then
      return jsonb_build_object('ok', false, 'error', 'Solo el titular o un Administrador puede liberar un chat privado hacia Ventas.');
    end if;

    if v_e164 <> '' and length(v_u9) >= 8 then
      insert into comun_agentes.agc_contacto_directorio (
        cdo_negocio, cdo_telefono_e164, cdo_telefono_ultimos9,
        cdo_nombre_consolidado, cdo_correo,
        cdo_clasificacion, cdo_politica_ia, cdo_visibilidad,
        cdo_titular_usuario_id, cdo_cliente_id, cdo_usuario_id
      ) values (
        v_negocio, v_e164, v_u9,
        coalesce(nullif(btrim(v_cnv.cnv_remitente_nombre), ''), v_e164), v_cnv.cnv_remitente_correo,
        'CLIENTE',
        case when v_accion = 'ACTIVAR_IA_CLIENTE' then 'AUTO_IA' else 'SEGUN_LINEA' end,
        'EQUIPO_VENTAS',
        v_uid, v_cnv.cnv_cliente_id, v_cnv.cnv_usuario_id
      )
      on conflict (cdo_negocio, cdo_telefono_ultimos9) where cdo_eliminado_en is null
      do update set
        cdo_clasificacion = 'CLIENTE',
        cdo_politica_ia = case when v_accion = 'ACTIVAR_IA_CLIENTE' then 'AUTO_IA' else 'SEGUN_LINEA' end,
        cdo_visibilidad = 'EQUIPO_VENTAS',
        cdo_actualizado_en = now()
      returning cdo_id into v_cdo_id;
    end if;

    update comun_agentes.agc_conversacion
       set cnv_contacto_directorio_id = coalesce(v_cdo_id, cnv_contacto_directorio_id),
           cnv_ia_bloqueada_permanente = false,
           cnv_visibilidad = 'EQUIPO_VENTAS',
           cnv_estado_atencion = case when v_accion = 'ACTIVAR_IA_CLIENTE' then 'BOT_ACTIVO' else cnv_estado_atencion end,
           cnv_actualizado_en = now()
     where cnv_id = p_conversacion_id;

    insert into comun_agentes.agc_mensaje (
      msg_negocio, msg_conversacion_id, msg_origen, msg_autor_usuario_id, msg_autor_nombre, msg_contenido, msg_tipo_contenido
    ) values (
      v_negocio, p_conversacion_id, 'SISTEMA', v_uid, v_actor,
      case
        when v_accion = 'ACTIVAR_IA_CLIENTE'
          then v_actor || ' clasificó este contacto como Cliente y activó respuesta automática con ARIA.'
        else v_actor || ' clasificó este contacto como Cliente y lo habilitó para el equipo de Ventas.'
      end,
      'TEXTO'
    );

    return jsonb_build_object(
      'ok', true,
      'accion', v_accion,
      'visibilidad', 'EQUIPO_VENTAS',
      'estadoAtencion', case when v_accion = 'ACTIVAR_IA_CLIENTE' then 'BOT_ACTIVO' else v_cnv.cnv_estado_atencion end
    );
  end if;

  return jsonb_build_object('ok', false, 'error', 'Acción de privacidad no reconocida.');
end;
$$;
