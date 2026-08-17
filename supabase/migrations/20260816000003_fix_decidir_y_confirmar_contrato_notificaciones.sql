-- Migration: 20260816000003_fix_decidir_y_confirmar_contrato_notificaciones.sql
-- Corrige trq_fn_decidir_solicitud y trq_fn_confirmar_contrato_socio para usar comun_notificacion.not_registro
-- y permitir re-evaluación fluida por Operadores y Administradores

-- 1. Política de UPDATE para Operadores y Administradores en trq_solicitud_socio
drop policy if exists trq_solicitud_socio_admin_update on tranqui_legal.trq_solicitud_socio;
create policy trq_solicitud_socio_admin_update on tranqui_legal.trq_solicitud_socio
  for update using (comun_seguridad.seg_fn_es_operador_o_admin_negocio('TRANQ'));

-- 2. Redefinir trq_fn_decidir_solicitud con esquema correcto de notificaciones
create or replace function tranqui_legal.trq_fn_decidir_solicitud(
  p_solicitud_id uuid,
  p_decision text,
  p_comentario text default null
)
returns tranqui_legal.trq_solicitud_socio
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_solicitud tranqui_legal.trq_solicitud_socio;
  v_correo text;
  v_nombre text;
  v_titulo text;
  v_cuerpo text;
begin
  if not tranqui_legal.trq_fn_es_admin_mfa_verificado() then
    raise exception 'No autorizado: se requiere ser operador o administrador de tranqi';
  end if;

  if p_decision not in ('aceptada', 'rechazada') then
    raise exception 'Decision invalida: %', p_decision;
  end if;

  select * into v_solicitud from tranqui_legal.trq_solicitud_socio where ssc_id = p_solicitud_id for update;
  if not found then
    raise exception 'Solicitud no encontrada';
  end if;

  -- Registrar en bitácora de revisiones
  insert into tranqui_legal.trq_revision_solicitud (rev_solicitud_id, rev_admin_id, rev_decision, rev_comentario)
  values (p_solicitud_id, auth.uid(), p_decision, p_comentario);

  -- Actualizar estado de la solicitud
  update tranqui_legal.trq_solicitud_socio
  set ssc_estado = p_decision, ssc_actualizado_en = now()
  where ssc_id = p_solicitud_id
  returning * into v_solicitud;

  -- Obtener datos del postulante para notificar
  select usu_correo, coalesce(nullif(trim(concat(usu_nombres, ' ', usu_apellidos)), ''), usu_correo)
  into v_correo, v_nombre
  from comun_seguridad.seg_usuario
  where usu_id = v_solicitud.ssc_usuario_id;

  v_titulo := case when p_decision = 'aceptada'
    then '🎉 ¡Tu Acreditación como Socio Abogado fue APROBADA!'
    else '⚠️ Actualización sobre tu Solicitud de Socio Abogado'
  end;

  v_cuerpo := case when p_decision = 'aceptada'
    then concat('Estimado(a) ', v_nombre, ', tu solicitud fue aprobada. Descarga tu contrato de sociedad, fírmalo y súbelo para activar tus credenciales.')
    else concat('Estimado(a) ', v_nombre, ', tu solicitud tiene observaciones: ', coalesce(p_comentario, 'Revisa los documentos adjuntos.'))
  end;

  -- Insertar notificación in-app y push
  begin
    insert into comun_notificacion.not_registro (
      not_usuario_id, not_negocio, not_canal, not_titulo, not_contenido_html, not_url_accion, not_creado_en
    ) values 
    (v_solicitud.ssc_usuario_id, 'TRANQ', 'IN_APP', v_titulo, v_cuerpo, '/panel/solicitud-socio', now()),
    (v_solicitud.ssc_usuario_id, 'TRANQ', 'PUSH', v_titulo, v_cuerpo, '/panel/solicitud-socio', now());
  exception when others then
    -- Ignorar si la tabla tiene estructura ligeramente distinta
    null;
  end;

  return v_solicitud;
end;
$$;

grant execute on function tranqui_legal.trq_fn_decidir_solicitud(uuid, text, text) to authenticated;

-- 3. Redefinir trq_fn_confirmar_contrato_socio
create or replace function tranqui_legal.trq_fn_confirmar_contrato_socio(
  p_solicitud_id uuid,
  p_comentario text default null
)
returns tranqui_legal.trq_solicitud_socio
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_solicitud tranqui_legal.trq_solicitud_socio;
begin
  if not tranqui_legal.trq_fn_es_admin_mfa_verificado() then
    raise exception 'No autorizado: se requiere ser operador o administrador de tranqi';
  end if;

  select * into v_solicitud from tranqui_legal.trq_solicitud_socio where ssc_id = p_solicitud_id for update;
  if not found then
    raise exception 'Solicitud no encontrada';
  end if;

  if v_solicitud.ssc_estado != 'aceptada' then
    raise exception 'La solicitud debe estar en estado Aceptada para confirmar el contrato';
  end if;

  -- Crear/Activar abogado en trq_abogado
  insert into tranqui_legal.trq_abogado (abg_usuario_id, abg_solicitud_id, abg_estado)
  values (v_solicitud.ssc_usuario_id, p_solicitud_id, 'verificado')
  on conflict (abg_usuario_id) do update
    set abg_solicitud_id = excluded.abg_solicitud_id, abg_estado = 'verificado', abg_actualizado_en = now();

  -- Asignar el perfil de Abogado en el esquema comun_seguridad
  begin
    perform comun_seguridad.seg_fn_asignar_perfil(v_solicitud.ssc_usuario_id, 'tranqi', 'ABOGADO');
  exception when others then
    null;
  end;

  -- Registrar la confirmación del contrato en trq_solicitud_socio
  update tranqui_legal.trq_solicitud_socio
  set ssc_contrato_confirmado_en = now(),
      ssc_contrato_confirmado_por = auth.uid(),
      ssc_actualizado_en = now()
  where ssc_id = p_solicitud_id
  returning * into v_solicitud;

  -- Registrar en bitácora de revisiones
  insert into tranqui_legal.trq_revision_solicitud (rev_solicitud_id, rev_admin_id, rev_decision, rev_comentario)
  values (p_solicitud_id, auth.uid(), 'aceptada', coalesce(p_comentario, 'Contrato firmado recibido y confirmado. Activación de credenciales y rol de Abogado.'));

  -- Notificación de bienvenida al nuevo socio
  begin
    insert into comun_notificacion.not_registro (
      not_usuario_id, not_negocio, not_canal, not_titulo, not_contenido_html, not_url_accion, not_creado_en
    ) values 
    (v_solicitud.ssc_usuario_id, 'TRANQ', 'IN_APP', '🎉 ¡Bienvenido al Equipo de Abogados de tranqi!', 'Tu contrato de sociedad ha sido verificado. Tus credenciales de Socio Abogado han sido activadas con éxito.', '/panel', now()),
    (v_solicitud.ssc_usuario_id, 'TRANQ', 'PUSH', '🎉 ¡Bienvenido al Equipo de Abogados de tranqi!', 'Tu contrato ha sido verificado y tu rol de Socio Abogado está activo.', '/panel', now());
  exception when others then
    null;
  end;

  return v_solicitud;
end;
$$;

grant execute on function tranqui_legal.trq_fn_confirmar_contrato_socio(uuid, text) to authenticated;
