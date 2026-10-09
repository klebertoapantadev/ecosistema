-- ==============================================================================
-- Migración: 20261009000001_tranqi_b2b_compliance_legal_hr_y_administradores.sql
-- Módulos: comun_comercio, comun_seguridad, tranqui_legal
-- Requerimientos: TRQ-B2B-003, TRQ-B2B-004, TRQ-B2B-005
-- Propósito:
--   1. Gestión de Administradores y Gestores de Empresa B2B (Roles RBAC y Secreto Profesional).
--   2. Invitaciones con Magic Link para administradores de empresas clientes.
--   3. Catálogo y Matriz de Cumplimiento Normativo (Compliance) con Legal Health Score.
--   4. Registro y Gestión Legal Laboral (Legal HR) para Onboarding y Offboarding.
--   5. RPCs transaccionales SECURITY DEFINER para persistencia resiliente en BDD.
--   6. Triggers de auditoría y RLS en el 100% de las tablas nuevas.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLA: comun_comercio.com_convenio_administrador (TRQ-B2B-003)
-- ------------------------------------------------------------------------------
create table if not exists comun_comercio.com_convenio_administrador (
  cva_id uuid primary key default gen_random_uuid(),
  cva_secuencial bigint generated always as identity,
  cva_convenio_id uuid not null references comun_comercio.com_convenio_empresa(cve_id) on delete cascade,
  cva_usuario_id uuid not null references comun_seguridad.seg_usuario(usu_id) on delete cascade,
  cva_rol text not null default 'ADMIN_EMPRESA' 
    check (cva_rol in ('ADMIN_EMPRESA', 'GESTOR_TALENTO_HUMANO', 'GESTOR_LEGAL')),
  cva_activo boolean not null default true,
  cva_permisos jsonb not null default '{"todos_los_expedientes": true, "expedientes_asignados": []}'::jsonb,
  cva_creado_en timestamptz not null default now(),
  cva_actualizado_en timestamptz not null default now(),
  cva_eliminado_en timestamptz,
  constraint uq_com_convenio_admin unique(cva_convenio_id, cva_usuario_id)
);

create index if not exists idx_com_convenio_admin_convenio on comun_comercio.com_convenio_administrador(cva_convenio_id) where cva_eliminado_en is null;
create index if not exists idx_com_convenio_admin_usuario on comun_comercio.com_convenio_administrador(cva_usuario_id) where cva_eliminado_en is null;

alter table comun_comercio.com_convenio_administrador enable row level security;

-- ------------------------------------------------------------------------------
-- 2. TABLA: comun_comercio.com_convenio_admin_invitacion (TRQ-B2B-003)
-- ------------------------------------------------------------------------------
create table if not exists comun_comercio.com_convenio_admin_invitacion (
  cai_id uuid primary key default gen_random_uuid(),
  cai_secuencial bigint generated always as identity,
  cai_convenio_id uuid not null references comun_comercio.com_convenio_empresa(cve_id) on delete cascade,
  cai_correo text not null,
  cai_rol text not null default 'ADMIN_EMPRESA'
    check (cai_rol in ('ADMIN_EMPRESA', 'GESTOR_TALENTO_HUMANO', 'GESTOR_LEGAL')),
  cai_token text not null unique,
  cai_invitado_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  cai_estado text not null default 'PENDIENTE'
    check (cai_estado in ('PENDIENTE', 'ACEPTADA', 'EXPIRADA', 'REVOCADA')),
  cai_expira_en timestamptz not null default (now() + interval '7 days'),
  cai_creado_en timestamptz not null default now(),
  cai_actualizado_en timestamptz not null default now()
);

create index if not exists idx_com_convenio_inv_token on comun_comercio.com_convenio_admin_invitacion(cai_token);
create index if not exists idx_com_convenio_inv_correo on comun_comercio.com_convenio_admin_invitacion(cai_correo);

alter table comun_comercio.com_convenio_admin_invitacion enable row level security;

-- ------------------------------------------------------------------------------
-- 3. TABLA: comun_comercio.com_compliance_catalogo (TRQ-B2B-005)
-- ------------------------------------------------------------------------------
create table if not exists comun_comercio.com_compliance_catalogo (
  cpc_id uuid primary key default gen_random_uuid(),
  cpc_secuencial bigint generated always as identity,
  cpc_clave text not null unique,
  cpc_nombre text not null,
  cpc_entidad text not null, -- 'SRI', 'SUPERCIAS', 'IESS', 'MUNICIPIO', 'BOMBEROS', 'MDT', 'SPDP', 'SECTORIAL'
  cpc_periodicidad text not null, -- 'ANUAL', 'SEMESTRAL', 'MENSUAL', 'PERMANENTE', 'PLAZO_FIJO'
  cpc_criticidad text not null default 'ALTA'
    check (cpc_criticidad in ('CRITICA', 'ALTA', 'MEDIA')),
  cpc_peso_score numeric(4,2) not null default 1.0,
  cpc_descripcion text,
  cpc_activo boolean not null default true,
  cpc_creado_en timestamptz not null default now()
);

alter table comun_comercio.com_compliance_catalogo enable row level security;

-- ------------------------------------------------------------------------------
-- 4. TABLA: comun_comercio.com_compliance_empresa_item (TRQ-B2B-005)
-- ------------------------------------------------------------------------------
create table if not exists comun_comercio.com_compliance_empresa_item (
  cei_id uuid primary key default gen_random_uuid(),
  cei_secuencial bigint generated always as identity,
  cei_convenio_id uuid not null references comun_comercio.com_convenio_empresa(cve_id) on delete cascade,
  cei_catalogo_id uuid references comun_comercio.com_compliance_catalogo(cpc_id) on delete set null,
  cei_titulo_personalizado text,
  cei_entidad text,
  cei_criticidad text not null default 'ALTA'
    check (cei_criticidad in ('CRITICA', 'ALTA', 'MEDIA')),
  cei_estado text not null default 'PENDIENTE'
    check (cei_estado in ('PENDIENTE', 'VIGENTE', 'POR_VENCER', 'VENCIDO', 'EXENTO')),
  cei_fecha_emision date,
  cei_fecha_caducidad date,
  cei_documento_url text,
  cei_aria_metadata jsonb not null default '{}'::jsonb,
  cei_observaciones text,
  cei_validado_por_abogado boolean not null default false,
  cei_creado_en timestamptz not null default now(),
  cei_actualizado_en timestamptz not null default now(),
  cei_eliminado_en timestamptz
);

create index if not exists idx_com_compliance_empresa on comun_comercio.com_compliance_empresa_item(cei_convenio_id) where cei_eliminado_en is null;
create index if not exists idx_com_compliance_estado on comun_comercio.com_compliance_empresa_item(cei_estado) where cei_eliminado_en is null;

alter table comun_comercio.com_compliance_empresa_item enable row level security;

-- ------------------------------------------------------------------------------
-- 5. TABLA: comun_comercio.com_compliance_score_historico (TRQ-B2B-005)
-- ------------------------------------------------------------------------------
create table if not exists comun_comercio.com_compliance_score_historico (
  csh_id uuid primary key default gen_random_uuid(),
  csh_convenio_id uuid not null references comun_comercio.com_convenio_empresa(cve_id) on delete cascade,
  csh_score numeric(5,2) not null,
  csh_items_totales int not null default 0,
  csh_items_al_dia int not null default 0,
  csh_items_por_vencer int not null default 0,
  csh_items_vencidos int not null default 0,
  csh_calculado_en timestamptz not null default now()
);

create index if not exists idx_com_compliance_score_hist on comun_comercio.com_compliance_score_historico(csh_convenio_id, csh_calculado_en desc);

alter table comun_comercio.com_compliance_score_historico enable row level security;

-- ------------------------------------------------------------------------------
-- 6. TABLA: tranqui_legal.trq_empleado_laboral (TRQ-B2B-004)
-- ------------------------------------------------------------------------------
create table if not exists tranqui_legal.trq_empleado_laboral (
  elab_id uuid primary key default gen_random_uuid(),
  elab_secuencial bigint generated always as identity,
  elab_convenio_id uuid not null references comun_comercio.com_convenio_empresa(cve_id) on delete cascade,
  elab_usuario_id uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  elab_identificacion text not null,
  elab_nombres text not null,
  elab_apellidos text not null,
  elab_cargo text,
  elab_departamento text,
  elab_tipo_contrato text not null default 'INDEFINIDO',
  elab_fecha_ingreso date,
  elab_fecha_salida date,
  elab_estado text not null default 'ACTIVO'
    check (elab_estado in ('ACTIVO', 'EN_PROCESO_SALIDA', 'FINIQUITADO', 'SUSPENDIDO')),
  elab_sut_registrado boolean not null default false,
  elab_iess_aviso_entrada boolean not null default false,
  elab_iess_aviso_salida boolean not null default false,
  elab_detalle_laboral jsonb not null default '{}'::jsonb,
  elab_creado_en timestamptz not null default now(),
  elab_actualizado_en timestamptz not null default now(),
  elab_eliminado_en timestamptz,
  constraint uq_trq_empleado_laboral unique(elab_convenio_id, elab_identificacion)
);

create index if not exists idx_trq_empleado_convenio on tranqui_legal.trq_empleado_laboral(elab_convenio_id) where elab_eliminado_en is null;
create index if not exists idx_trq_empleado_identificacion on tranqui_legal.trq_empleado_laboral(elab_identificacion);

alter table tranqui_legal.trq_empleado_laboral enable row level security;

-- ------------------------------------------------------------------------------
-- 7. POLÍTICAS RLS (Seguridad y Privacidad Estricta)
-- ------------------------------------------------------------------------------

-- comun_comercio.com_compliance_catalogo (Lectura pública / autenticada, gestión solo superadmin)
drop policy if exists pol_compliance_catalogo_select on comun_comercio.com_compliance_catalogo;
create policy pol_compliance_catalogo_select on comun_comercio.com_compliance_catalogo
  for select using (true);

-- com_convenio_administrador (Lectura para miembros de la empresa o staff Tranqi)
drop policy if exists pol_convenio_admin_select on comun_comercio.com_convenio_administrador;
create policy pol_convenio_admin_select on comun_comercio.com_convenio_administrador
  for select using (
    cva_usuario_id = auth.uid() or
    exists (
      select 1 from comun_comercio.com_convenio_administrador ca
      where ca.cva_convenio_id = com_convenio_administrador.cva_convenio_id
        and ca.cva_usuario_id = auth.uid()
        and ca.cva_activo = true
    ) or
    comun_seguridad.seg_fn_es_operador_o_admin_negocio('tranqi')
  );

-- com_compliance_empresa_item (Lectura y gestión para admins de la empresa o staff)
drop policy if exists pol_compliance_item_select on comun_comercio.com_compliance_empresa_item;
create policy pol_compliance_item_select on comun_comercio.com_compliance_empresa_item
  for select using (
    exists (
      select 1 from comun_comercio.com_convenio_administrador ca
      where ca.cva_convenio_id = com_compliance_empresa_item.cei_convenio_id
        and ca.cva_usuario_id = auth.uid()
        and ca.cva_activo = true
    ) or
    comun_seguridad.seg_fn_es_operador_o_admin_negocio('tranqi')
  );

-- com_compliance_score_historico
drop policy if exists pol_compliance_score_select on comun_comercio.com_compliance_score_historico;
create policy pol_compliance_score_select on comun_comercio.com_compliance_score_historico
  for select using (
    exists (
      select 1 from comun_comercio.com_convenio_administrador ca
      where ca.cva_convenio_id = com_compliance_score_historico.csh_convenio_id
        and ca.cva_usuario_id = auth.uid()
        and ca.cva_activo = true
    ) or
    comun_seguridad.seg_fn_es_operador_o_admin_negocio('tranqi')
  );

-- tranqui_legal.trq_empleado_laboral
drop policy if exists pol_empleado_laboral_select on tranqui_legal.trq_empleado_laboral;
create policy pol_empleado_laboral_select on tranqui_legal.trq_empleado_laboral
  for select using (
    elab_usuario_id = auth.uid() or
    exists (
      select 1 from comun_comercio.com_convenio_administrador ca
      where ca.cva_convenio_id = trq_empleado_laboral.elab_convenio_id
        and ca.cva_usuario_id = auth.uid()
        and ca.cva_activo = true
    ) or
    comun_seguridad.seg_fn_es_operador_o_admin_negocio('tranqi')
  );

-- ------------------------------------------------------------------------------
-- 8. TRIGGERS DE AUDITORÍA TRANSVERSAL (Regla 2 de AGENTS.md)
-- ------------------------------------------------------------------------------
drop trigger if exists trg_aud_com_convenio_admin on comun_comercio.com_convenio_administrador;
create trigger trg_aud_com_convenio_admin 
  after insert or update or delete on comun_comercio.com_convenio_administrador 
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

drop trigger if exists trg_aud_com_convenio_admin_inv on comun_comercio.com_convenio_admin_invitacion;
create trigger trg_aud_com_convenio_admin_inv 
  after insert or update or delete on comun_comercio.com_convenio_admin_invitacion 
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

drop trigger if exists trg_aud_com_compliance_cat on comun_comercio.com_compliance_catalogo;
create trigger trg_aud_com_compliance_cat 
  after insert or update or delete on comun_comercio.com_compliance_catalogo 
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

drop trigger if exists trg_aud_com_compliance_item on comun_comercio.com_compliance_empresa_item;
create trigger trg_aud_com_compliance_item 
  after insert or update or delete on comun_comercio.com_compliance_empresa_item 
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

drop trigger if exists trg_aud_trq_empleado_laboral on tranqui_legal.trq_empleado_laboral;
create trigger trg_aud_trq_empleado_laboral 
  after insert or update or delete on tranqui_legal.trq_empleado_laboral 
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

-- ------------------------------------------------------------------------------
-- 9. SEMILLA DEL CATÁLOGO DE COMPLIANCE BASE PARA EMPRESAS EN ECUADOR
-- ------------------------------------------------------------------------------
insert into comun_comercio.com_compliance_catalogo (
  cpc_clave, cpc_nombre, cpc_entidad, cpc_periodicidad, cpc_criticidad, cpc_peso_score, cpc_descripcion
) values
  ('SRI_RUC', 'RUC Activo y Actualizado', 'SRI', 'PERMANENTE', 'CRITICA', 1.5, 'Registro Único de Contribuyentes con establecimientos y actividad económica vigentes.'),
  ('SRI_CUMPLIMIENTO', 'Certificado de Cumplimiento Tributario', 'SRI', 'SEMESTRAL', 'ALTA', 1.0, 'Certificado de no registrar deudas firmes con el Servicio de Rentas Internas.'),
  ('SUP_NOMBRAMIENTO', 'Nombramiento de Representante Legal Inscrito', 'SUPERCIAS', 'PLAZO_FIJO', 'CRITICA', 1.5, 'Nombramiento vigente debidamente inscrito en el Registro Mercantil.'),
  ('SUP_BALANCES', 'Presentación de Estados Financieros Anuales', 'SUPERCIAS', 'ANUAL', 'ALTA', 1.0, 'Envío obligatorio de balances generales y nómina de socios o accionistas (Abril).'),
  ('IESS_PATRONAL', 'Certificado de Cumplimiento de Obligaciones Patronales', 'IESS', 'MENSUAL', 'CRITICA', 1.5, 'Certificado de encontrarse al día en el pago de aportes y fondos de reserva.'),
  ('MUN_LUAE', 'Licencia Metropolitana Única (LUAE) / Habilitación', 'MUNICIPIO', 'ANUAL', 'CRITICA', 1.5, 'Permiso de operación comercial emitido por el Gobierno Autónomo Descentralizado.'),
  ('MUN_PATENTE', 'Declaración de Patente Municipal y 1.5 por Mil', 'MUNICIPIO', 'ANUAL', 'ALTA', 1.0, 'Pago del impuesto de patente municipal sobre el patrimonio.'),
  ('BOM_PERMISO', 'Permiso de Funcionamiento y Prevención de Incendios', 'BOMBEROS', 'ANUAL', 'ALTA', 1.0, 'Inspección de seguridad contra incendios en instalaciones y oficinas.'),
  ('MDT_CONTRATOS', 'Registro de Contratos Laborales en SUT', 'MDT', 'PERMANENTE', 'ALTA', 1.0, 'Registro de contratos dentro del plazo legal de 15 días desde el ingreso.'),
  ('MDT_REGLAMENTO', 'Reglamento Interno de Trabajo Aprobado', 'MDT', 'PLAZO_FIJO', 'MEDIA', 0.8, 'Reglamento aprobado por la Dirección Regional del Trabajo (empresas > 10 trabajadores).'),
  ('MDT_SEGURIDAD', 'Comité / Responsable de Seguridad y Salud', 'MDT', 'ANUAL', 'MEDIA', 0.8, 'Registro y actas de seguridad ocupacional en el sistema SUT.'),
  ('SPDP_RAT', 'Registro de Actividades de Tratamiento (RAT) y Política LOPD', 'SPDP', 'PERMANENTE', 'MEDIA', 0.8, 'Cumplimiento de la Ley Orgánica de Protección de Datos Personales de Ecuador.')
on conflict (cpc_clave) do update set
  cpc_nombre = excluded.cpc_nombre,
  cpc_entidad = excluded.cpc_entidad,
  cpc_criticidad = excluded.cpc_criticidad,
  cpc_peso_score = excluded.cpc_peso_score,
  cpc_descripcion = excluded.cpc_descripcion;

-- ------------------------------------------------------------------------------
-- 10. RPCs TRANSACCIONALES (Persistencia Resiliente y Cero Supresión de Errores)
-- ------------------------------------------------------------------------------

-- A. Inicializar matriz de compliance para una empresa desde el catálogo
create or replace function comun_comercio.com_fn_inicializar_compliance_empresa(p_convenio_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int := 0;
  v_item record;
begin
  if p_convenio_id is null or not exists (select 1 from comun_comercio.com_convenio_empresa where cve_id = p_convenio_id) then
    return jsonb_build_object('ok', false, 'error', 'El convenio o empresa especificada no existe.');
  end if;

  for v_item in 
    select cpc_id, cpc_nombre, cpc_entidad, cpc_criticidad
    from comun_comercio.com_compliance_catalogo
    where cpc_activo = true
  loop
    if not exists (
      select 1 from comun_comercio.com_compliance_empresa_item 
      where cei_convenio_id = p_convenio_id 
        and cei_catalogo_id = v_item.cpc_id 
        and cei_eliminado_en is null
    ) then
      insert into comun_comercio.com_compliance_empresa_item (
        cei_convenio_id, cei_catalogo_id, cei_titulo_personalizado,
        cei_entidad, cei_criticidad, cei_estado
      ) values (
        p_convenio_id, v_item.cpc_id, v_item.cpc_nombre,
        v_item.cpc_entidad, v_item.cpc_criticidad, 'PENDIENTE'
      );
      v_count := v_count + 1;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'inicializados', v_count);
end;
$$;

-- B. Guardar o actualizar ítem de compliance (In-situ search & update)
create or replace function comun_comercio.com_fn_guardar_compliance_item(p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_convenio_id uuid;
  v_titulo text;
  v_entidad text;
  v_criticidad text;
  v_estado text;
  v_emision date;
  v_caducidad date;
  v_doc_url text;
  v_metadata jsonb;
  v_observaciones text;
  v_catalogo_id uuid;
begin
  v_convenio_id := (p_datos->>'cei_convenio_id')::uuid;
  if v_convenio_id is null then
    return jsonb_build_object('ok', false, 'error', 'cei_convenio_id es obligatorio');
  end if;

  if p_datos->>'cei_id' is not null and (p_datos->>'cei_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_id := (p_datos->>'cei_id')::uuid;
  else
    v_id := null;
  end if;

  v_titulo := trim(p_datos->>'cei_titulo_personalizado');
  v_entidad := trim(p_datos->>'cei_entidad');
  v_criticidad := coalesce(p_datos->>'cei_criticidad', 'ALTA');
  v_estado := coalesce(p_datos->>'cei_estado', 'PENDIENTE');
  v_emision := (p_datos->>'cei_fecha_emision')::date;
  v_caducidad := (p_datos->>'cei_fecha_caducidad')::date;
  v_doc_url := p_datos->>'cei_documento_url';
  v_metadata := coalesce(p_datos->'cei_aria_metadata', '{}'::jsonb);
  v_observaciones := p_datos->>'cei_observaciones';
  
  if p_datos->>'cei_catalogo_id' is not null and (p_datos->>'cei_catalogo_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_catalogo_id := (p_datos->>'cei_catalogo_id')::uuid;
  else
    v_catalogo_id := null;
  end if;

  -- Auto-cálculo de estado según fecha de caducidad si está informada
  if v_caducidad is not null then
    if v_caducidad < current_date then
      v_estado := 'VENCIDO';
    elsif v_caducidad <= (current_date + interval '30 days')::date then
      v_estado := 'POR_VENCER';
    else
      v_estado := 'VIGENTE';
    end if;
  end if;

  if v_id is not null and exists (select 1 from comun_comercio.com_compliance_empresa_item where cei_id = v_id) then
    update comun_comercio.com_compliance_empresa_item
    set
      cei_titulo_personalizado = coalesce(v_titulo, cei_titulo_personalizado),
      cei_entidad = coalesce(v_entidad, cei_entidad),
      cei_criticidad = v_criticidad,
      cei_estado = v_estado,
      cei_fecha_emision = v_emision,
      cei_fecha_caducidad = v_caducidad,
      cei_documento_url = coalesce(v_doc_url, cei_documento_url),
      cei_aria_metadata = case when v_metadata <> '{}'::jsonb then v_metadata else cei_aria_metadata end,
      cei_observaciones = coalesce(v_observaciones, cei_observaciones),
      cei_actualizado_en = now()
    where cei_id = v_id;
  else
    insert into comun_comercio.com_compliance_empresa_item (
      cei_convenio_id, cei_catalogo_id, cei_titulo_personalizado,
      cei_entidad, cei_criticidad, cei_estado,
      cei_fecha_emision, cei_fecha_caducidad, cei_documento_url,
      cei_aria_metadata, cei_observaciones
    ) values (
      v_convenio_id, v_catalogo_id, v_titulo,
      v_entidad, v_criticidad, v_estado,
      v_emision, v_caducidad, v_doc_url,
      v_metadata, v_observaciones
    )
    returning cei_id into v_id;
  end if;

  -- Recalcular score legal automáticamente
  perform comun_comercio.com_fn_calcular_legal_health_score(v_convenio_id);

  return jsonb_build_object('ok', true, 'cei_id', v_id, 'estado', v_estado);
end;
$$;

-- C. Cálculo ponderado de Legal Health Score
create or replace function comun_comercio.com_fn_calcular_legal_health_score(p_convenio_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_score numeric(5,2) := 0.00;
  v_suma_puntos numeric(10,4) := 0;
  v_suma_pesos numeric(10,4) := 0;
  v_item record;
  v_peso numeric(4,2);
  v_totales int := 0;
  v_al_dia int := 0;
  v_por_vencer int := 0;
  v_vencidos int := 0;
begin
  for v_item in
    select cei_id, cei_estado, cei_criticidad
    from comun_comercio.com_compliance_empresa_item
    where cei_convenio_id = p_convenio_id
      and cei_eliminado_en is null
      and cei_estado <> 'EXENTO'
  loop
    v_totales := v_totales + 1;
    v_peso := case v_item.cei_criticidad
      when 'CRITICA' then 1.5
      when 'ALTA' then 1.0
      else 0.8
    end;

    v_suma_pesos := v_suma_pesos + v_peso;

    if v_item.cei_estado = 'VIGENTE' then
      v_suma_puntos := v_suma_puntos + (v_peso * 1.0);
      v_al_dia := v_al_dia + 1;
    elsif v_item.cei_estado = 'POR_VENCER' then
      v_suma_puntos := v_suma_puntos + (v_peso * 0.6);
      v_por_vencer := v_por_vencer + 1;
    else
      v_vencidos := v_vencidos + 1;
    end if;
  end loop;

  if v_suma_pesos > 0 then
    v_score := round((v_suma_puntos / v_suma_pesos) * 100, 2);
  else
    v_score := 100.00;
  end if;

  -- Guardar en histórico de scores
  insert into comun_comercio.com_compliance_score_historico (
    csh_convenio_id, csh_score, csh_items_totales,
    csh_items_al_dia, csh_items_por_vencer, csh_items_vencidos
  ) values (
    p_convenio_id, v_score, v_totales,
    v_al_dia, v_por_vencer, v_vencidos
  );

  return jsonb_build_object(
    'ok', true,
    'score', v_score,
    'totales', v_totales,
    'al_dia', v_al_dia,
    'por_vencer', v_por_vencer,
    'vencidos', v_vencidos
  );
end;
$$;

-- D. Asignar administrador existente a una empresa
create or replace function comun_comercio.com_fn_asignar_administrador_empresa(
  p_convenio_id uuid,
  p_usuario_id uuid,
  p_rol text default 'ADMIN_EMPRESA',
  p_permisos jsonb default '{"todos_los_expedientes": true, "expedientes_asignados": []}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_convenio_id is null or p_usuario_id is null then
    return jsonb_build_object('ok', false, 'error', 'Parámetros requeridos incompletos');
  end if;

  insert into comun_comercio.com_convenio_administrador (
    cva_convenio_id, cva_usuario_id, cva_rol, cva_activo, cva_permisos
  ) values (
    p_convenio_id, p_usuario_id, p_rol, true, p_permisos
  )
  on conflict (cva_convenio_id, cva_usuario_id) do update set
    cva_rol = excluded.cva_rol,
    cva_activo = true,
    cva_permisos = excluded.cva_permisos,
    cva_actualizado_en = now(),
    cva_eliminado_en = null
  returning cva_id into v_id;

  return jsonb_build_object('ok', true, 'cva_id', v_id);
end;
$$;

-- E. Listar administradores de una empresa
create or replace function comun_comercio.com_fn_listar_administradores_empresa(p_convenio_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admins jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'cva_id', a.cva_id,
      'cva_usuario_id', a.cva_usuario_id,
      'cva_rol', a.cva_rol,
      'cva_activo', a.cva_activo,
      'cva_permisos', a.cva_permisos,
      'nombres', u.usu_nombres,
      'apellidos', u.usu_apellidos,
      'correo', u.usu_correo,
      'creado_en', a.cva_creado_en
    ) order by a.cva_creado_en asc
  ), '[]'::jsonb)
  into v_admins
  from comun_comercio.com_convenio_administrador a
  join comun_seguridad.seg_usuario u on u.usu_id = a.cva_usuario_id
  where a.cva_convenio_id = p_convenio_id
    and a.cva_eliminado_en is null;

  return jsonb_build_object('ok', true, 'administradores', v_admins);
end;
$$;

-- ------------------------------------------------------------------------------
-- 11. WRAPPERS PÚBLICOS Y PERMISOS DE EJECUCIÓN (GRANT EXECUTE)
-- ------------------------------------------------------------------------------
grant execute on function comun_comercio.com_fn_inicializar_compliance_empresa(uuid) to anon, authenticated, service_role;
grant execute on function comun_comercio.com_fn_guardar_compliance_item(jsonb) to anon, authenticated, service_role;
grant execute on function comun_comercio.com_fn_calcular_legal_health_score(uuid) to anon, authenticated, service_role;
grant execute on function comun_comercio.com_fn_asignar_administrador_empresa(uuid, uuid, text, jsonb) to anon, authenticated, service_role;
grant execute on function comun_comercio.com_fn_listar_administradores_empresa(uuid) to anon, authenticated, service_role;

create or replace function public.com_fn_inicializar_compliance_empresa(p_convenio_id uuid)
returns jsonb language sql security definer as $$
  select comun_comercio.com_fn_inicializar_compliance_empresa(p_convenio_id);
$$;

create or replace function public.com_fn_guardar_compliance_item(p_datos jsonb)
returns jsonb language sql security definer as $$
  select comun_comercio.com_fn_guardar_compliance_item(p_datos);
$$;

create or replace function public.com_fn_calcular_legal_health_score(p_convenio_id uuid)
returns jsonb language sql security definer as $$
  select comun_comercio.com_fn_calcular_legal_health_score(p_convenio_id);
$$;

create or replace function public.com_fn_asignar_administrador_empresa(p_convenio_id uuid, p_usuario_id uuid, p_rol text, p_permisos jsonb)
returns jsonb language sql security definer as $$
  select comun_comercio.com_fn_asignar_administrador_empresa(p_convenio_id, p_usuario_id, p_rol, p_permisos);
$$;

create or replace function public.com_fn_listar_administradores_empresa(p_convenio_id uuid)
returns jsonb language sql security definer as $$
  select comun_comercio.com_fn_listar_administradores_empresa(p_convenio_id);
$$;

grant execute on function public.com_fn_inicializar_compliance_empresa(uuid) to anon, authenticated, service_role;
grant execute on function public.com_fn_guardar_compliance_item(jsonb) to anon, authenticated, service_role;
grant execute on function public.com_fn_calcular_legal_health_score(uuid) to anon, authenticated, service_role;
grant execute on function public.com_fn_asignar_administrador_empresa(uuid, uuid, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.com_fn_listar_administradores_empresa(uuid) to anon, authenticated, service_role;
