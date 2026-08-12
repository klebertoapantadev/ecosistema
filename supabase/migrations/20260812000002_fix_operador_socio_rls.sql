-- Migration: 20260812000002_fix_operador_socio_rls.sql
-- Habilitar visibilidad y evaluacion de solicitudes de socios abogados a Operadores, Auxiliares, Administradores y SuperAdmins

create or replace function comun_seguridad.seg_fn_es_operador_o_admin_negocio(p_negocio text)
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

-- Permitir ejecucion de la evaluacion trq_fn_decidir_solicitud a Operadores y Administradores
create or replace function tranqui_legal.trq_fn_es_admin_mfa_verificado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select comun_seguridad.seg_fn_es_operador_o_admin_negocio('TRANQ');
$$;

-- Actualizar politica de SELECT para trq_solicitud_socio
drop policy if exists trq_solicitud_socio_admin_select on tranqui_legal.trq_solicitud_socio;
create policy trq_solicitud_socio_admin_select on tranqui_legal.trq_solicitud_socio
  for select using (
    ssc_usuario_id = auth.uid()
    or comun_seguridad.seg_fn_es_operador_o_admin_negocio('TRANQ')
  );

-- Actualizar politica de SELECT para trq_experiencia_laboral
drop policy if exists trq_experiencia_laboral_select on tranqui_legal.trq_experiencia_laboral;
create policy trq_experiencia_laboral_select on tranqui_legal.trq_experiencia_laboral
  for select using (
    exists (
      select 1 from tranqui_legal.trq_solicitud_socio s
      where s.ssc_id = exp_solicitud_id
        and (s.ssc_usuario_id = auth.uid() or comun_seguridad.seg_fn_es_operador_o_admin_negocio('TRANQ'))
    )
  );

-- Actualizar politica de SELECT para trq_documento_socio
drop policy if exists trq_documento_socio_select on tranqui_legal.trq_documento_socio;
create policy trq_documento_socio_select on tranqui_legal.trq_documento_socio
  for select using (
    exists (
      select 1 from tranqui_legal.trq_solicitud_socio s
      where s.ssc_id = dcs_solicitud_id
        and (s.ssc_usuario_id = auth.uid() or comun_seguridad.seg_fn_es_operador_o_admin_negocio('TRANQ'))
    )
  );

-- Actualizar politica de SELECT para trq_solicitud_materia
drop policy if exists trq_solicitud_materia_select on tranqui_legal.trq_solicitud_materia;
create policy trq_solicitud_materia_select on tranqui_legal.trq_solicitud_materia
  for select using (
    exists (
      select 1 from tranqui_legal.trq_solicitud_socio s
      where s.ssc_id = sma_solicitud_id
        and (s.ssc_usuario_id = auth.uid() or comun_seguridad.seg_fn_es_operador_o_admin_negocio('TRANQ'))
    )
  );

-- Actualizar politica de SELECT para trq_solicitud_provincia
drop policy if exists trq_solicitud_provincia_select on tranqui_legal.trq_solicitud_provincia;
create policy trq_solicitud_provincia_select on tranqui_legal.trq_solicitud_provincia
  for select using (
    exists (
      select 1 from tranqui_legal.trq_solicitud_socio s
      where s.ssc_id = spr_solicitud_id
        and (s.ssc_usuario_id = auth.uid() or comun_seguridad.seg_fn_es_operador_o_admin_negocio('TRANQ'))
    )
  );

-- Actualizar politica de SELECT/INSERT para trq_revision_solicitud
drop policy if exists trq_revision_solicitud_admin_all on tranqui_legal.trq_revision_solicitud;
create policy trq_revision_solicitud_admin_all on tranqui_legal.trq_revision_solicitud
  for all using (
    comun_seguridad.seg_fn_es_operador_o_admin_negocio('TRANQ')
  )
  with check (
    comun_seguridad.seg_fn_es_operador_o_admin_negocio('TRANQ')
  );
