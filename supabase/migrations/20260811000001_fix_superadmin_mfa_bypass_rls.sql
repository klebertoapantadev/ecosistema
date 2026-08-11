-- Migration 20260811000001: Permitir acceso completo de RLS a SuperAdmin y Administradores de Plataforma sin bloqueo de claim AAL2 en trq_fn_es_admin_mfa_verificado + RPC de consulta admin

create or replace function tranqui_legal.trq_fn_es_admin_mfa_verificado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select comun_seguridad.seg_fn_es_superadmin()
      or comun_seguridad.seg_fn_es_admin_negocio('tranqi');
$$;

grant execute on function tranqui_legal.trq_fn_es_admin_mfa_verificado() to authenticated;

-- RPC SECURITY DEFINER para consultar todas las solicitudes sin bloqueo de RLS en consola administrativa
create or replace function tranqui_legal.trq_fn_listar_solicitudes_admin()
returns setof tranqui_legal.trq_solicitud_socio
language sql
stable
security definer
set search_path = ''
as $$
  select * from tranqui_legal.trq_solicitud_socio order by ssc_creado_en desc;
$$;

grant execute on function tranqui_legal.trq_fn_listar_solicitudes_admin() to authenticated;
