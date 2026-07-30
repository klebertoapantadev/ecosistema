-- Primer precedente de "returns table(...)" en el proyecto -- no existia
-- ningun function paginado/filtrado antes de este. Unifica auditoria de
-- negocio (reg_esquema = p_esquema_negocio, ej. 'tranqui_legal') con
-- auditoria de identidad (comun_seguridad: alta de usuario, verificacion de
-- correo, reseteo de clave) acotada a usuarios con membresia ACTIVA en
-- p_negocio -- comun_seguridad es de plataforma, compartida por los 4
-- negocios, nunca se debe filtrar solo por reg_esquema a secas ahi.
--
-- security definer + chequeo de autorizacion propio: la politica RLS
-- existente (aud_registro_administrador_tranqi_select) NO cubre
-- comun_seguridad -- ver 20260728000009_auditoria_widget_top_level...sql,
-- comentario "esos siguen siendo solo-SuperAdmin". Sin este bypass explicito
-- un ADMINISTRADOR normal no podria leer la mitad de identidad aunque sea
-- sobre sus propios usuarios.
create or replace function comun_auditoria.aud_fn_listar_auditoria_negocio(
  p_negocio text,
  p_esquema_negocio text,
  p_desde timestamptz default null,
  p_hasta timestamptz default null,
  p_tabla text default null,
  p_operacion text default null,
  p_correo_actor text default null,
  p_limite int default 500
)
returns table (
  reg_id uuid,
  reg_esquema text,
  reg_tabla text,
  reg_operacion text,
  reg_datos_anteriores jsonb,
  reg_datos_nuevos jsonb,
  reg_creado_en timestamptz,
  actor_nombres text,
  actor_apellidos text,
  actor_correo text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not comun_seguridad.seg_fn_es_admin_negocio(p_negocio) then
    raise exception 'No autorizado: se requiere ser administrador de % con sesion activa', p_negocio;
  end if;

  return query
  select r.reg_id, r.reg_esquema, r.reg_tabla, r.reg_operacion,
         r.reg_datos_anteriores, r.reg_datos_nuevos, r.reg_creado_en,
         u.usu_nombres, u.usu_apellidos, u.usu_correo
  from comun_auditoria.aud_registro r
  left join comun_seguridad.seg_usuario u on u.usu_id = r.reg_usuario_id
  where r.reg_esquema = p_esquema_negocio
    and (p_desde is null or r.reg_creado_en >= p_desde)
    and (p_hasta is null or r.reg_creado_en <= p_hasta)
    and (p_tabla is null or r.reg_tabla = p_tabla)
    and (p_operacion is null or r.reg_operacion = p_operacion)
    and (p_correo_actor is null or u.usu_correo ilike '%' || p_correo_actor || '%')

  union all

  select r.reg_id, r.reg_esquema, r.reg_tabla, r.reg_operacion,
         r.reg_datos_anteriores, r.reg_datos_nuevos, r.reg_creado_en,
         u.usu_nombres, u.usu_apellidos, u.usu_correo
  from comun_auditoria.aud_registro r
  left join comun_seguridad.seg_usuario u on u.usu_id = r.reg_usuario_id
  where r.reg_esquema = 'comun_seguridad'
    and r.reg_tabla in ('seg_usuario', 'seg_membresia', 'seg_otp_correo', 'seg_recuperacion_correo')
    and (p_desde is null or r.reg_creado_en >= p_desde)
    and (p_hasta is null or r.reg_creado_en <= p_hasta)
    and (p_tabla is null or r.reg_tabla = p_tabla)
    and (p_operacion is null or r.reg_operacion = p_operacion)
    and (p_correo_actor is null or u.usu_correo ilike '%' || p_correo_actor || '%')
    and exists (
      select 1 from comun_seguridad.seg_membresia m
      where m.mem_negocio = p_negocio
        and m.mem_estado = 'ACTIVO'
        and m.mem_usuario_id = (
          case r.reg_tabla
            when 'seg_usuario' then coalesce(r.reg_datos_nuevos ->> 'usu_id', r.reg_datos_anteriores ->> 'usu_id')
            when 'seg_membresia' then coalesce(r.reg_datos_nuevos ->> 'mem_usuario_id', r.reg_datos_anteriores ->> 'mem_usuario_id')
            when 'seg_otp_correo' then coalesce(r.reg_datos_nuevos ->> 'otp_usuario_id', r.reg_datos_anteriores ->> 'otp_usuario_id')
            when 'seg_recuperacion_correo' then coalesce(r.reg_datos_nuevos ->> 'rec_usuario_id', r.reg_datos_anteriores ->> 'rec_usuario_id')
          end
        )::uuid
    )

  order by reg_creado_en desc
  limit p_limite;
end;
$$;

grant execute on function comun_auditoria.aud_fn_listar_auditoria_negocio(text, text, timestamptz, timestamptz, text, text, text, int) to authenticated;
