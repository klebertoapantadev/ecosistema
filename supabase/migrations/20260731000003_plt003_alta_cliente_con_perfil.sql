-- PLT-003 regla 2: el alta automatica como CLIENTE tiene que crear tambien la
-- fila de perfil, no solo la membresia. Antes el cliente hacia un upsert
-- directo sobre seg_membresia amparado por la politica
-- seg_membresia_propia_insert_cliente; con el modelo nuevo eso dejaria al
-- usuario con membresia y CERO perfiles -- sin widgets y sin nivel jerarquico.
--
-- No se puede resolver dando politica de INSERT sobre seg_membresia_perfil:
-- esa tabla no tiene escritura a proposito, porque es donde se aplica el techo
-- jerarquico de la regla 5. Un RPC security definer es la unica via que crea
-- ambas filas sin abrir la tabla.

create or replace function comun_seguridad.seg_fn_asegurar_membresia_cliente(p_negocio text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membresia_id uuid;
  v_perfil_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sin sesion';
  end if;

  -- Solo se ocupa de la propia membresia del llamante: no recibe usuario_id,
  -- asi que no puede usarse para dar de alta a terceros.
  insert into comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
  values (auth.uid(), p_negocio, 'CLIENTE', 'ACTIVO')
  on conflict (mem_usuario_id, mem_negocio) do update set mem_actualizado_en = now()
  returning mem_id into v_membresia_id;

  select per_id into v_perfil_id from comun_seguridad.seg_perfil where per_clave = 'CLIENTE';

  insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
  values (v_membresia_id, v_perfil_id)
  on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
end;
$$;

revoke execute on function comun_seguridad.seg_fn_asegurar_membresia_cliente(text) from public;
grant execute on function comun_seguridad.seg_fn_asegurar_membresia_cliente(text) to authenticated;
