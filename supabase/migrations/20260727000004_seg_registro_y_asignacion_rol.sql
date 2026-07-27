-- Permite que un usuario cree su propia membresia CLIENTE al registrarse en
-- un negocio (PLT-003 regla 1: rol CLIENTE automatico). No puede auto-asignarse
-- ningun otro rol -- eso solo lo hace un admin via seg_fn_asignar_rol().
create policy seg_membresia_propia_insert_cliente on comun_seguridad.seg_membresia
  for insert
  with check (mem_usuario_id = auth.uid() and mem_rol = 'CLIENTE');

-- Asignacion de rol como RPC transaccional (regla 5 de AGENTS.md: transiciones
-- de estado sensibles no son UPDATE directo desde el cliente).
create or replace function comun_seguridad.seg_fn_asignar_rol(
  p_usuario_id uuid,
  p_negocio text,
  p_rol text
)
returns comun_seguridad.seg_membresia
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resultado comun_seguridad.seg_membresia;
begin
  if not comun_seguridad.seg_fn_es_admin_negocio(p_negocio) then
    raise exception 'No autorizado para asignar roles en este negocio';
  end if;

  if p_rol = 'SUPERADMIN' then
    raise exception 'SUPERADMIN es un flag de plataforma (usu_superadmin_plataforma), no un mem_rol de negocio';
  end if;

  if p_rol is null or length(trim(p_rol)) = 0 then
    raise exception 'Rol invalido';
  end if;

  insert into comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
  values (p_usuario_id, p_negocio, p_rol, 'ACTIVO')
  on conflict (mem_usuario_id, mem_negocio)
  do update set mem_rol = excluded.mem_rol, mem_actualizado_en = now()
  returning * into v_resultado;

  return v_resultado;
end;
$$;

grant execute on function comun_seguridad.seg_fn_asignar_rol(uuid, text, text) to authenticated;
