-- Migration: 20260812000001_fix_admin_rls_business_normalization.sql
-- Normalizar resolucion de negocio y asegurar que SuperAdmin, Administradores y Operadores puedan consultar solicitudes de socios

create or replace function comun_seguridad.seg_fn_es_admin_negocio(p_negocio text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from comun_seguridad.seg_usuario u
    where u.usu_id = auth.uid() and u.usu_superadmin_plataforma
  ) or exists (
    select 1
    from comun_seguridad.seg_membresia m
    join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
    join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
    where m.mem_usuario_id = auth.uid()
      and (
        upper(m.mem_negocio) = upper(p_negocio)
        or (upper(p_negocio) in ('TRANQ', 'TRANQI', 'LEGAL') and upper(m.mem_negocio) in ('TRANQ', 'TRANQI', 'LEGAL'))
        or (upper(p_negocio) in ('FFH', 'FASTFIX') and upper(m.mem_negocio) in ('FFH', 'FASTFIX'))
        or (upper(p_negocio) in ('TNK', 'TINKAY') and upper(m.mem_negocio) in ('TNK', 'TINKAY'))
        or (upper(p_negocio) in ('MRG', 'MARGARITAS') and upper(m.mem_negocio) in ('MRG', 'MARGARITAS'))
      )
      and m.mem_estado = 'ACTIVO'
      and p.per_clave in ('OPERADOR', 'AUXILIAR', 'TECNICO', 'ADMINISTRADOR', 'SUPERADMIN')
  );
$$;

-- Asegurar politica de SELECT para administradores y operadores en trq_solicitud_socio
drop policy if exists trq_solicitud_socio_admin_select on tranqui_legal.trq_solicitud_socio;
create policy trq_solicitud_socio_admin_select on tranqui_legal.trq_solicitud_socio
  for select using (
    ssc_usuario_id = auth.uid()
    or comun_seguridad.seg_fn_es_admin_negocio('TRANQ')
    or comun_seguridad.seg_fn_es_admin_negocio('TRANQI')
  );
