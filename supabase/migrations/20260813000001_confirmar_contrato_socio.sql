-- Migration 20260813000001: Flujo de aprobación de abogados en dos pasos y confirmación de contrato
-- Agrega columnas de confirmación de contrato, redefine trq_fn_decidir_solicitud y crea trq_fn_confirmar_contrato_socio

-- 1. Agregar columnas de auditoría de confirmación de contrato a trq_solicitud_socio
ALTER TABLE tranqui_legal.trq_solicitud_socio
ADD COLUMN IF NOT EXISTS ssc_contrato_confirmado_en timestamptz,
ADD COLUMN IF NOT EXISTS ssc_contrato_confirmado_por uuid REFERENCES comun_seguridad.seg_usuario(usu_id);

-- 2. Redefinir trq_fn_decidir_solicitud para remover la inserción del abogado y la asignación del rol
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
begin
  if not tranqui_legal.trq_fn_es_admin_mfa_verificado() then
    raise exception 'No autorizado: se requiere ser administrador de tranqi con verificacion MFA (aal2) activa';
  end if;

  if p_decision not in ('aceptada', 'rechazada') then
    raise exception 'Decision invalida: %', p_decision;
  end if;

  select * into v_solicitud from tranqui_legal.trq_solicitud_socio where ssc_id = p_solicitud_id for update;
  if not found then
    raise exception 'Solicitud no encontrada';
  end if;
  if v_solicitud.ssc_estado not in ('enviada', 'en_revision') then
    raise exception 'La solicitud ya fue decidida (estado actual: %)', v_solicitud.ssc_estado;
  end if;

  insert into tranqui_legal.trq_revision_solicitud (rev_solicitud_id, rev_admin_id, rev_decision, rev_comentario)
  values (p_solicitud_id, auth.uid(), p_decision, p_comentario);

  update tranqui_legal.trq_solicitud_socio
  set ssc_estado = p_decision, ssc_actualizado_en = now()
  where ssc_id = p_solicitud_id
  returning * into v_solicitud;

  -- NOTA: El rol de Abogado e inscripción en trq_abogado ya no se realiza automáticamente al aceptar.
  -- Se difiere al segundo paso: Confirmación de Contrato firmado.

  select usu_correo, usu_nombres into v_correo, v_nombre from comun_seguridad.seg_usuario where usu_id = v_solicitud.ssc_usuario_id;

  insert into comun_notificaciones.not_cola_correo (
    not_negocio, not_destinatario_usuario_id, not_destinatario_correo, not_plantilla, not_asunto, not_datos
  ) values (
    'tranqi', v_solicitud.ssc_usuario_id, v_correo,
    case when p_decision = 'aceptada' then 'socio_aceptado' else 'socio_rechazado' end,
    case when p_decision = 'aceptada' then 'Tu solicitud para ser socio abogado fue aceptada' else 'Sobre tu solicitud para ser socio abogado' end,
    jsonb_build_object('nombre', v_nombre, 'decision', p_decision, 'comentario', p_comentario)
  );

  return v_solicitud;
end;
$$;

-- 3. Crear la función trq_fn_confirmar_contrato_socio para el paso 2 de confirmación
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
  v_has_contract boolean;
begin
  if not tranqui_legal.trq_fn_es_admin_mfa_verificado() then
    raise exception 'No autorizado: se requiere ser administrador de tranqi con verificacion MFA (aal2) activa';
  end if;

  select * into v_solicitud from tranqui_legal.trq_solicitud_socio where ssc_id = p_solicitud_id for update;
  if not found then
    raise exception 'Solicitud no encontrada';
  end if;

  if v_solicitud.ssc_estado != 'aceptada' then
    raise exception 'La solicitud debe estar en estado Aceptada para confirmar el contrato';
  end if;

  if v_solicitud.ssc_contrato_confirmado_en is not null then
    raise exception 'El contrato para esta solicitud ya ha sido confirmado anteriormente';
  end if;

  -- Verificar si el postulante ya subió el contrato firmado
  select exists (
    select 1 
    from tranqui_legal.trq_documento_socio 
    where dcs_solicitud_id = p_solicitud_id and dcs_tipo = 'contrato_socio'
  ) into v_has_contract;

  if not v_has_contract then
    raise exception 'El postulante aún no ha cargado su contrato de sociedad firmado en formato PDF';
  end if;

  -- Crear/Activar abogado en trq_abogado
  insert into tranqui_legal.trq_abogado (abg_usuario_id, abg_solicitud_id, abg_estado)
  values (v_solicitud.ssc_usuario_id, p_solicitud_id, 'verificado')
  on conflict (abg_usuario_id) do update
    set abg_solicitud_id = excluded.abg_solicitud_id, abg_estado = 'verificado', abg_actualizado_en = now();

  -- Asignar el perfil de Abogado en el esquema comun_seguridad usando la función moderna de perfiles
  perform comun_seguridad.seg_fn_asignar_perfil(v_solicitud.ssc_usuario_id, 'tranqi', 'ABOGADO');

  -- Registrar la confirmación del contrato en trq_solicitud_socio
  update tranqui_legal.trq_solicitud_socio
  set ssc_contrato_confirmado_en = now(),
      ssc_contrato_confirmado_por = auth.uid(),
      ssc_actualizado_en = now()
  where ssc_id = p_solicitud_id
  returning * into v_solicitud;

  -- Registrar una entrada en el historial de revisiones para documentar la activación del socio
  insert into tranqui_legal.trq_revision_solicitud (rev_solicitud_id, rev_admin_id, rev_decision, rev_comentario)
  values (p_solicitud_id, auth.uid(), 'aceptada', coalesce(p_comentario, 'Contrato firmado recibido y confirmado. Activación de credenciales y rol de Abogado.'));

  return v_solicitud;
end;
$$;

-- 4. Otorgar permisos de ejecución a la nueva RPC
grant execute on function tranqui_legal.trq_fn_confirmar_contrato_socio(uuid, text) to authenticated;
