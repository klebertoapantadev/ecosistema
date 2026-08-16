-- Migration: 20260816000002_eliminar_solicitud_socio_propia.sql
-- Permite al usuario eliminar su propia solicitud activa de socio abogado (si no ha sido aceptada)
-- y autoriza la operacion mediante un Stored Procedure seguro (SECURITY DEFINER)

create or replace function tranqui_legal.trq_fn_eliminar_solicitud_propia(
  p_solicitud_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_solicitud tranqui_legal.trq_solicitud_socio;
begin
  if v_usuario_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_solicitud_id is not null then
    select * into v_solicitud 
    from tranqui_legal.trq_solicitud_socio 
    where ssc_id = p_solicitud_id and ssc_usuario_id = v_usuario_id;
  else
    select * into v_solicitud 
    from tranqui_legal.trq_solicitud_socio 
    where ssc_usuario_id = v_usuario_id
    order by ssc_creado_en desc
    limit 1;
  end if;

  if not found then
    return true;
  end if;

  if v_solicitud.ssc_estado = 'aceptada' then
    raise exception 'No es posible eliminar una solicitud que ya ha sido aprobada';
  end if;

  -- Eliminar la solicitud (las tablas hijas tienen ON DELETE CASCADE)
  delete from tranqui_legal.trq_solicitud_socio
  where ssc_id = v_solicitud.ssc_id;

  return true;
end;
$$;

grant execute on function tranqui_legal.trq_fn_eliminar_solicitud_propia(uuid) to authenticated;
