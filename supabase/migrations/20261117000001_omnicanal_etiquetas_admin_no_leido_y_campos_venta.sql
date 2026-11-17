-- ==============================================================================
-- Migración: 20261117000001_omnicanal_etiquetas_admin_no_leido_y_campos_venta.sql
-- Requerimientos: PLT-010 / TNK-004 (Reemplazo integral de ManyChat: Administración de etiquetas
--   por Admin/Operador, acción Marcar como No Leído y Campos Personalizados de Venta depurados)
-- ==============================================================================

-- 1. Desactivar etiquetas redundantes de canal (`origen-whatsapp`, `origen-web`) ya que el canal
--    es nativo (`cnv_canal`) y se filtra en la barra superior con íconos dedicados.
update comun_agentes.agc_etiqueta
   set etq_activo = false,
       etq_actualizado_en = now()
 where etq_slug in ('origen-whatsapp', 'origen-web')
   and etq_activo = true;

-- 2. Autorización específica para administrar el catálogo maestro de etiquetas (SuperAdmin, Administrador, Operador)
create or replace function comun_seguridad.seg_fn_es_admin_u_operador_etiquetas(p_negocio text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from comun_seguridad.seg_usuario u
    where u.usu_id = auth.uid()
      and (
        u.usu_superadmin_plataforma
        or (
          lower(btrim(coalesce(p_negocio, ''))) in ('tinkay', 'tnk')
          and lower(btrim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com'
        )
      )
  )
  or exists (
    select 1
    from comun_seguridad.seg_membresia m
    left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
    left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id and p.per_activo = true
    where m.mem_usuario_id = auth.uid()
      and m.mem_estado = 'ACTIVO'
      and (
        upper(m.mem_negocio) = upper(p_negocio)
        or (upper(p_negocio) in ('TRANQ', 'TRANQI', 'LEGAL') and upper(m.mem_negocio) in ('TRANQ', 'TRANQI', 'LEGAL'))
        or (upper(p_negocio) in ('FFH', 'FASTFIX') and upper(m.mem_negocio) in ('FFH', 'FASTFIX'))
        or (upper(p_negocio) in ('TNK', 'TINKAY') and upper(m.mem_negocio) in ('TNK', 'TINKAY'))
        or (upper(p_negocio) in ('MRG', 'MARGARITAS') and upper(m.mem_negocio) in ('MRG', 'MARGARITAS'))
      )
      and (
        upper(coalesce(p.per_clave, '')) in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN', 'OPERADOR', 'AUXILIAR')
        or upper(coalesce(m.mem_rol, '')) in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN', 'OPERADOR', 'AUXILIAR')
      )
  );
$$;

grant execute on function comun_seguridad.seg_fn_es_admin_u_operador_etiquetas(text) to authenticated, service_role;

-- 3. Crear o Editar etiqueta (restringido a Administrador / Operador)
drop function if exists comun_comercio.com_fn_omnicanal_guardar_etiqueta(text, text, text, text);

create or replace function comun_comercio.com_fn_omnicanal_guardar_etiqueta(
  p_negocio text,
  p_nombre text,
  p_color text default '#2563EB',
  p_icono text default '🏷️',
  p_etiqueta_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_color text := coalesce(nullif(btrim(p_color), ''), '#2563EB');
  v_icono text := coalesce(nullif(btrim(p_icono), ''), '🏷️');
  v_slug text := lower(regexp_replace(translate(v_nombre, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'), '[^a-zA-Z0-9]+', '-', 'g'));
  v_etq comun_agentes.agc_etiqueta;
begin
  if not comun_seguridad.seg_fn_es_admin_u_operador_etiquetas(v_negocio) then
    return jsonb_build_object(
      'ok', false,
      'error', 'Solo el Administrador u Operador de la tienda puede crear o modificar etiquetas.'
    );
  end if;

  if length(v_nombre) < 2 then
    return jsonb_build_object('ok', false, 'error', 'El nombre de la etiqueta debe tener al menos 2 caracteres.');
  end if;

  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');
  if v_slug = '' then
    v_slug := 'etq-' || substr(md5(v_nombre), 1, 8);
  end if;

  if p_etiqueta_id is not null then
    update comun_agentes.agc_etiqueta
       set etq_nombre = v_nombre,
           etq_color = v_color,
           etq_icono = v_icono,
           etq_activo = true,
           etq_eliminado_en = null,
           etq_actualizado_en = now()
     where etq_id = p_etiqueta_id
       and etq_negocio = v_negocio
     returning * into v_etq;
  end if;

  if v_etq.etq_id is null then
    insert into comun_agentes.agc_etiqueta (
      etq_negocio, etq_slug, etq_nombre, etq_color, etq_icono, etq_orden, etq_activo
    )
    values (v_negocio, v_slug, v_nombre, v_color, v_icono, 50, true)
    on conflict (etq_negocio, etq_slug) where etq_eliminado_en is null
    do update set
      etq_nombre = excluded.etq_nombre,
      etq_color = excluded.etq_color,
      etq_icono = excluded.etq_icono,
      etq_activo = true,
      etq_actualizado_en = now()
    returning * into v_etq;
  end if;

  return jsonb_build_object(
    'ok', true,
    'etiqueta', jsonb_build_object(
      'id', v_etq.etq_id,
      'slug', v_etq.etq_slug,
      'nombre', v_etq.etq_nombre,
      'color', v_etq.etq_color,
      'icono', v_etq.etq_icono,
      'orden', v_etq.etq_orden
    )
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_guardar_etiqueta(text, text, text, text, uuid) from public;
grant execute on function comun_comercio.com_fn_omnicanal_guardar_etiqueta(text, text, text, text, uuid) to authenticated, service_role;

-- 4. Eliminar etiqueta (borrado lógico auditable, exclusivo de Administrador / Operador)
create or replace function comun_comercio.com_fn_omnicanal_eliminar_etiqueta(
  p_negocio text,
  p_etiqueta_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
begin
  if not comun_seguridad.seg_fn_es_admin_u_operador_etiquetas(v_negocio) then
    return jsonb_build_object(
      'ok', false,
      'error', 'Solo el Administrador u Operador de la tienda puede eliminar etiquetas.'
    );
  end if;

  update comun_agentes.agc_etiqueta
     set etq_activo = false,
         etq_eliminado_en = now(),
         etq_actualizado_en = now()
   where etq_id = p_etiqueta_id
     and etq_negocio = v_negocio;

  update comun_agentes.agc_conversacion_etiqueta
     set cet_eliminado_en = now(),
         cet_actualizado_en = now()
   where cet_etiqueta_id = p_etiqueta_id
     and cet_negocio = v_negocio;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_eliminar_etiqueta(text, uuid) from public;
grant execute on function comun_comercio.com_fn_omnicanal_eliminar_etiqueta(text, uuid) to authenticated, service_role;

-- 5. Actualizar com_fn_omnicanal_actualizar_conversacion para soportar "Marcar como No Leído"
drop function if exists comun_comercio.com_fn_omnicanal_actualizar_conversacion(text, uuid, text, uuid, boolean, timestamptz, text, boolean);

create or replace function comun_comercio.com_fn_omnicanal_actualizar_conversacion(
  p_negocio text,
  p_conversacion_id uuid,
  p_nuevo_estado text default null,
  p_asesora_id uuid default null,
  p_desasignar boolean default false,
  p_recordatorio_en timestamptz default null,
  p_recordatorio_nota text default null,
  p_limpiar_recordatorio boolean default false,
  p_marcar_no_leido boolean default false
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
           when p_limpiar_recordatorio then null
           when p_recordatorio_en is not null then p_recordatorio_en
           else cnv_recordatorio_en
         end,
         cnv_recordatorio_nota = case
           when p_limpiar_recordatorio then null
           when p_recordatorio_nota is not null then btrim(p_recordatorio_nota)
           else cnv_recordatorio_nota
         end,
         cnv_no_leidos_asesora = case
           when coalesce(p_marcar_no_leido, false) then greatest(cnv_no_leidos_asesora, 1)
           else cnv_no_leidos_asesora
         end,
         cnv_actualizado_en = now()
   where cnv_id = p_conversacion_id
     and cnv_negocio = v_negocio
   returning * into v_cnv;

  if p_nuevo_estado is not null and p_nuevo_estado <> v_prev.cnv_estado_atencion then
    v_evento_texto := case p_nuevo_estado
      when 'EN_ATENCION_ASESORA' then v_actor || ' pausó a ARIA y tomó el control humano.'
      when 'BOT_ACTIVO' then v_actor || ' reactivó la atención automática con IA ARIA.'
      when 'ESCALADO_HUMANO' then v_actor || ' marcó el chat como Escalado a Humano.'
      when 'EN_ESPERA_CLIENTE' then v_actor || ' puso la conversación en espera del cliente.'
      when 'CERRADO' then v_actor || ' cerró la conversación.'
      else v_actor || ' cambió el estado a ' || p_nuevo_estado
    end;

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
    'noLeidosAsesora', v_cnv.cnv_no_leidos_asesora
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_actualizar_conversacion(text, uuid, text, uuid, boolean, timestamptz, text, boolean, boolean) from public;
grant execute on function comun_comercio.com_fn_omnicanal_actualizar_conversacion(text, uuid, text, uuid, boolean, timestamptz, text, boolean, boolean) to authenticated, service_role;

-- 6. Guardar Campos Personalizados de Venta en la Conversación (manual por asesora)
create or replace function comun_comercio.com_fn_omnicanal_guardar_datos_venta(
  p_negocio text,
  p_conversacion_id uuid,
  p_datos_venta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_nombre_cli text := nullif(btrim(coalesce(p_datos_venta->>'nombreCliente', '')), '');
  v_cnv comun_agentes.agc_conversacion;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para editar los campos de venta.');
  end if;

  update comun_agentes.agc_conversacion
     set cnv_detalle_conversacion = jsonb_set(
           coalesce(cnv_detalle_conversacion, '{}'::jsonb),
           '{datos_venta}',
           coalesce(p_datos_venta, '{}'::jsonb),
           true
         ),
         cnv_remitente_nombre = case
           when v_nombre_cli is not null
                and (cnv_remitente_nombre like 'WhatsApp +%' or cnv_remitente_nombre like 'Visitante Web%')
           then v_nombre_cli
           else cnv_remitente_nombre
         end,
         cnv_actualizado_en = now()
   where cnv_id = p_conversacion_id
     and cnv_negocio = v_negocio
   returning * into v_cnv;

  if v_cnv.cnv_id is null then
    return jsonb_build_object('ok', false, 'error', 'Conversación no encontrada.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'datosVenta', coalesce(v_cnv.cnv_detalle_conversacion->'datos_venta', '{}'::jsonb),
    'remitenteNombre', v_cnv.cnv_remitente_nombre
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_guardar_datos_venta(text, uuid, jsonb) from public;
grant execute on function comun_comercio.com_fn_omnicanal_guardar_datos_venta(text, uuid, jsonb) to authenticated, service_role;

-- 7. Fusión automática no destructiva de campos detectados desde Webhook YCloud (Ubicación GPS, Sector, Costo de Envío)
create or replace function comun_comercio.com_fn_omnicanal_fusionar_datos_venta_webhook(
  p_token text,
  p_conversacion_id uuid,
  p_parcial jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aria comun_configuracion.cfg_aria;
  v_actual jsonb;
  v_fusionado jsonb;
begin
  select * into v_aria
  from comun_configuracion.cfg_aria a
  where a.ari_eliminado_en is null
    and btrim(coalesce(a.ari_detalle_aria->>'ycloud_webhook_token', '')) = btrim(coalesce(p_token, ''))
  limit 1;

  if v_aria.ari_id is null or p_conversacion_id is null then
    return jsonb_build_object('ok', false);
  end if;

  select coalesce(cnv_detalle_conversacion->'datos_venta', '{}'::jsonb)
    into v_actual
    from comun_agentes.agc_conversacion
   where cnv_id = p_conversacion_id
     and cnv_negocio = v_aria.ari_negocio;

  if v_actual is null then
    return jsonb_build_object('ok', false);
  end if;

  -- Fusionar actualizando ubicación/envío/sector detectados sin borrar producto, dedicatoria ni notas previas
  v_fusionado := v_actual || jsonb_strip_nulls(coalesce(p_parcial, '{}'::jsonb));

  update comun_agentes.agc_conversacion
     set cnv_detalle_conversacion = jsonb_set(
           coalesce(cnv_detalle_conversacion, '{}'::jsonb),
           '{datos_venta}',
           v_fusionado,
           true
         ),
         cnv_actualizado_en = now()
   where cnv_id = p_conversacion_id
     and cnv_negocio = v_aria.ari_negocio;

  return jsonb_build_object('ok', true, 'datosVenta', v_fusionado);
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_fusionar_datos_venta_webhook(text, uuid, jsonb) from public;
grant execute on function comun_comercio.com_fn_omnicanal_fusionar_datos_venta_webhook(text, uuid, jsonb) to anon, authenticated, service_role;

-- 8. Actualizar com_fn_omnicanal_obtener_tablero para retornar `esAdminEtiquetas` y `datosVenta` por conversación
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
  v_conversaciones jsonb;
  v_etiquetas jsonb;
  v_respuestas jsonb;
  v_equipo jsonb;
  v_usuarios_web jsonb;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos de ventas u operación en este negocio.');
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
