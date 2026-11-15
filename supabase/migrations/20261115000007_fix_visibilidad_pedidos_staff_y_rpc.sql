-- Migración: Corregir visibilidad de pedidos de tienda para staff/administradores/operadores
-- cuando no hay service_role en el servidor, incluyendo roles VENTAS/DELIVERY y mem_rol directo.

create or replace function comun_seguridad.seg_fn_es_operador_o_admin_negocio(p_negocio text)
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
          lower(trim(coalesce(p_negocio, ''))) in ('tinkay', 'tnk')
          and lower(trim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com'
        )
      )
  )
  or exists (
    select 1
    from comun_seguridad.seg_membresia m
    left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
    left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
    where m.mem_usuario_id = auth.uid()
      and (
        upper(m.mem_negocio) = upper(p_negocio)
        or (upper(p_negocio) in ('TRANQ', 'TRANQI', 'LEGAL') and upper(m.mem_negocio) in ('TRANQ', 'TRANQI', 'LEGAL'))
        or (upper(p_negocio) in ('FFH', 'FASTFIX') and upper(m.mem_negocio) in ('FFH', 'FASTFIX'))
        or (upper(p_negocio) in ('TNK', 'TINKAY') and upper(m.mem_negocio) in ('TNK', 'TINKAY'))
        or (upper(p_negocio) in ('MRG', 'MARGARITAS') and upper(m.mem_negocio) in ('MRG', 'MARGARITAS'))
      )
      and m.mem_estado = 'ACTIVO'
      and (
        upper(coalesce(p.per_clave, '')) in ('OPERADOR', 'AUXILIAR', 'TECNICO', 'ADMINISTRADOR', 'SUPERADMIN', 'VENTAS', 'DELIVERY')
        or upper(coalesce(m.mem_rol, '')) in ('OPERADOR', 'AUXILIAR', 'TECNICO', 'ADMINISTRADOR', 'SUPERADMIN', 'VENTAS', 'DELIVERY')
      )
  );
$$;

-- RPC dedicado para listar pedidos/proformas del negocio desde la bandeja de pedidos
create or replace function comun_comercio.com_fn_listar_pedidos_tienda(p_negocio text default 'tinkay')
returns setof comun_comercio.com_proforma
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := lower(trim(coalesce(p_negocio, 'tinkay')));
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para consultar los pedidos de la tienda.';
  end if;

  if not comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio) then
    raise exception 'No tienes permisos operativos para consultar los pedidos de este negocio.';
  end if;

  return query
  select *
  from comun_comercio.com_proforma
  where lower(prf_negocio) = v_negocio
    and prf_eliminado_en is null
  order by prf_creado_en desc
  limit 250;
end;
$$;

revoke execute on function comun_comercio.com_fn_listar_pedidos_tienda(text) from public;
grant execute on function comun_comercio.com_fn_listar_pedidos_tienda(text) to authenticated, service_role;

notify pgrst, 'reload schema';
