-- ==============================================================================
-- Migración: 20260906000001_tranqui_legal_expedientes_y_archivo.sql
-- Módulo: Gestión de Clientes (CRM Legal), Expediente Digital Unificado (Matter Management),
--         Equipos Legales Multirrol, DMS con Carpetas Procesales, Bitácora y
--         Digitalización Masiva del Archivo Físico Histórico con Agentes IA.
-- Cumple: TRQ-CRM-001, TRQ-CAS-001, TRQ-CAS-002, TRQ-DOC-001, TRQ-CAS-003, TRQ-DIG-001.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CRM LEGAL: PERFIL DE CLIENTE (PERSONAS NATURALES Y JURÍDICAS)
-- ------------------------------------------------------------------------------

create table if not exists tranqui_legal.trq_cliente_perfil (
  clp_id uuid primary key default gen_random_uuid(),
  clp_secuencial bigint generated always as identity,
  clp_usuario_id uuid not null references comun_seguridad.seg_usuario(usu_id) on delete restrict,
  clp_tipo_personeria text not null default 'natural'
    check (clp_tipo_personeria in ('natural', 'juridica')),
  -- Identificación y Datos Personales / Corporativos
  clp_tipo_identificacion text not null default 'cedula'
    check (clp_tipo_identificacion in ('cedula', 'ruc', 'pasaporte')),
  clp_identificacion text not null,
  clp_nombres text,
  clp_apellidos text,
  clp_razon_social text,
  clp_nombre_comercial text,
  clp_representante_legal_id uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  -- Datos de contacto y domicilio judicial
  clp_correo text,
  clp_telefono text,
  clp_celular text,
  clp_direccion text,
  clp_provincia_id uuid references comun_catalogo.cat_provincia(cat_id) on delete set null,
  clp_canton_id uuid references comun_catalogo.cat_canton(cat_id) on delete set null,
  clp_casillero_judicial text,
  clp_casillero_electronico text,
  -- Gestión de origen y estado
  clp_origen_registro text not null default 'web'
    check (clp_origen_registro in ('web', 'manual_operador', 'manual_abogado', 'whatsapp_aria', 'archivo_historico')),
  clp_creado_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  clp_activo boolean not null default true,
  clp_detalle_cliente jsonb not null default '{}'::jsonb,
  clp_creado_en timestamptz not null default now(),
  clp_actualizado_en timestamptz not null default now(),
  clp_eliminado_en timestamptz,
  unique(clp_usuario_id),
  unique(clp_tipo_identificacion, clp_identificacion)
);

create index idx_trq_cliente_perfil_identificacion on tranqui_legal.trq_cliente_perfil(clp_identificacion) where clp_eliminado_en is null;
create index idx_trq_cliente_perfil_usuario on tranqui_legal.trq_cliente_perfil(clp_usuario_id) where clp_eliminado_en is null;
create index idx_trq_cliente_perfil_razon_social on tranqui_legal.trq_cliente_perfil(clp_razon_social) where clp_eliminado_en is null;

alter table tranqui_legal.trq_cliente_perfil enable row level security;

create policy trq_cliente_perfil_titular_select on tranqui_legal.trq_cliente_perfil
  for select using (clp_usuario_id = auth.uid());

create policy trq_cliente_perfil_staff_select on tranqui_legal.trq_cliente_perfil
  for select using (
    comun_seguridad.seg_fn_es_admin_negocio('tranqi')
    or tranqui_legal.trq_fn_abogado_actual() is not null
  );

create policy trq_cliente_perfil_staff_insert on tranqui_legal.trq_cliente_perfil
  for insert with check (
    comun_seguridad.seg_fn_es_admin_negocio('tranqi')
    or tranqui_legal.trq_fn_abogado_actual() is not null
    or clp_usuario_id = auth.uid()
  );

create policy trq_cliente_perfil_staff_update on tranqui_legal.trq_cliente_perfil
  for update using (
    comun_seguridad.seg_fn_es_admin_negocio('tranqi')
    or clp_usuario_id = auth.uid()
  );

create trigger trg_auditoria_trq_cliente_perfil
  after insert or update or delete on tranqui_legal.trq_cliente_perfil
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select, insert, update on tranqui_legal.trq_cliente_perfil to authenticated;

-- ------------------------------------------------------------------------------
-- 2. AMPLIACIÓN DEL EXPEDIENTE DIGITAL UNIFICADO (trq_caso_judicial)
-- ------------------------------------------------------------------------------

-- Adición de campos para LPMS, Trámites Extrajudiciales, SATJE y Archivo Histórico
alter table tranqui_legal.trq_caso_judicial
  add column if not exists cas_codigo_expediente text unique,
  add column if not exists cas_tipo_tramite text not null default 'judicial'
    check (cas_tipo_tramite in ('judicial', 'extrajudicial', 'notarial', 'societario', 'mediacion', 'propiedad_intelectual', 'administrativo', 'otro')),
  add column if not exists cas_etapa_procesal text not null default 'intake'
    check (cas_etapa_procesal in ('intake', 'preparacion', 'presentado', 'calificado', 'citacion', 'audiencia', 'resolucion', 'impugnacion', 'ejecucion', 'cerrado', 'archivado')),
  add column if not exists cas_judicatura text,
  add column if not exists cas_juez text,
  add column if not exists cas_secretario text,
  add column if not exists cas_sala text,
  add column if not exists cas_cuantia numeric(12,2),
  add column if not exists cas_contraparte_nombres text,
  add column if not exists cas_contraparte_identificacion text,
  add column if not exists cas_contraparte_abogado text,
  add column if not exists cas_origen text not null default 'web'
    check (cas_origen in ('web', 'operador', 'abogado', 'aria_front', 'archivo_historico')),
  add column if not exists cas_es_historico_digitalizado boolean not null default false,
  add column if not exists cas_lote_digitalizacion_id uuid;

create index if not exists idx_trq_caso_codigo on tranqui_legal.trq_caso_judicial(cas_codigo_expediente);
create index if not exists idx_trq_caso_tipo_tramite on tranqui_legal.trq_caso_judicial(cas_tipo_tramite, cas_estado);
create index if not exists idx_trq_caso_contraparte on tranqui_legal.trq_caso_judicial(cas_contraparte_identificacion);

-- ------------------------------------------------------------------------------
-- 3. EQUIPOS LEGALES MULTIRROL POR EXPEDIENTE (trq_caso_abogado_equipo)
-- ------------------------------------------------------------------------------

create table if not exists tranqui_legal.trq_caso_abogado_equipo (
  cae_id uuid primary key default gen_random_uuid(),
  cae_secuencial bigint generated always as identity,
  cae_caso_id uuid not null references tranqui_legal.trq_caso_judicial(cas_id) on delete cascade,
  cae_abogado_id uuid not null references tranqui_legal.trq_abogado(abg_id) on delete cascade,
  cae_rol text not null default 'co_patrocinador'
    check (cae_rol in ('titular', 'co_patrocinador', 'paralegal', 'consultor')),
  cae_asignado_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  cae_activo boolean not null default true,
  cae_detalle_asignacion jsonb not null default '{}'::jsonb,
  cae_creado_en timestamptz not null default now(),
  cae_actualizado_en timestamptz not null default now(),
  cae_eliminado_en timestamptz,
  unique(cae_caso_id, cae_abogado_id)
);

create index idx_trq_caso_abogado_equipo_abg on tranqui_legal.trq_caso_abogado_equipo(cae_abogado_id, cae_activo) where cae_eliminado_en is null;
create index idx_trq_caso_abogado_equipo_cas on tranqui_legal.trq_caso_abogado_equipo(cae_caso_id, cae_activo) where cae_eliminado_en is null;

alter table tranqui_legal.trq_caso_abogado_equipo enable row level security;

create policy trq_caso_abogado_equipo_select on tranqui_legal.trq_caso_abogado_equipo
  for select using (
    cae_abogado_id = tranqui_legal.trq_fn_abogado_actual()
    or comun_seguridad.seg_fn_es_admin_negocio('tranqi')
    or exists (
      select 1 from tranqui_legal.trq_caso_judicial c
      where c.cas_id = cae_caso_id and c.cas_cliente_id = auth.uid()
    )
  );

create policy trq_caso_abogado_equipo_admin on tranqui_legal.trq_caso_abogado_equipo
  for all using (comun_seguridad.seg_fn_es_admin_negocio('tranqi'));

create trigger trg_auditoria_trq_caso_abogado_equipo
  after insert or update or delete on tranqui_legal.trq_caso_abogado_equipo
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select, insert, update on tranqui_legal.trq_caso_abogado_equipo to authenticated;

-- Actualizar política de SELECT del caso judicial para permitir acceso a cualquier abogado del equipo
create or replace policy trq_caso_judicial_abogado_select on tranqui_legal.trq_caso_judicial
  for select using (
    cas_abogado_id = tranqui_legal.trq_fn_abogado_actual()
    or exists (
      select 1 from tranqui_legal.trq_caso_abogado_equipo e
      where e.cae_caso_id = cas_id
        and e.cae_abogado_id = tranqui_legal.trq_fn_abogado_actual()
        and e.cae_activo = true
        and e.cae_eliminado_en is null
    )
  );

-- ------------------------------------------------------------------------------
-- 4. CARPETAS PROCESALES DEL EXPEDIENTE (trq_caso_carpeta)
-- ------------------------------------------------------------------------------

create table if not exists tranqui_legal.trq_caso_carpeta (
  ccr_id uuid primary key default gen_random_uuid(),
  ccr_secuencial bigint generated always as identity,
  ccr_caso_id uuid not null references tranqui_legal.trq_caso_judicial(cas_id) on delete cascade,
  ccr_codigo text not null, -- '01_poderes', '02_pruebas', '03_escritos', '04_providencias', '05_facturacion', 'personalizada'
  ccr_nombre text not null,
  ccr_descripcion text,
  ccr_orden int not null default 0,
  ccr_es_sistema boolean not null default true,
  ccr_creado_en timestamptz not null default now(),
  ccr_actualizado_en timestamptz not null default now(),
  unique(ccr_caso_id, ccr_codigo)
);

create index idx_trq_caso_carpeta_caso on tranqui_legal.trq_caso_carpeta(ccr_caso_id, ccr_orden);

alter table tranqui_legal.trq_caso_carpeta enable row level security;

create policy trq_caso_carpeta_select on tranqui_legal.trq_caso_carpeta
  for select using (
    exists (
      select 1 from tranqui_legal.trq_caso_judicial c
      where c.cas_id = ccr_caso_id
        and (
          c.cas_cliente_id = auth.uid()
          or c.cas_abogado_id = tranqui_legal.trq_fn_abogado_actual()
          or comun_seguridad.seg_fn_es_admin_negocio('tranqi')
          or exists (
            select 1 from tranqui_legal.trq_caso_abogado_equipo e
            where e.cae_caso_id = c.cas_id and e.cae_abogado_id = tranqui_legal.trq_fn_abogado_actual() and e.cae_activo = true
          )
        )
    )
  );

create trigger trg_auditoria_trq_caso_carpeta
  after insert or update or delete on tranqui_legal.trq_caso_carpeta
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select, insert, update on tranqui_legal.trq_caso_carpeta to authenticated;

-- Ampliación de trq_documento_caso para soportar carpetas, versiones y origen billetera
alter table tranqui_legal.trq_documento_caso
  add column if not exists dcc_carpeta_id uuid references tranqui_legal.trq_caso_carpeta(ccr_id) on delete set null,
  add column if not exists dcc_version int not null default 1,
  add column if not exists dcc_es_version_actual boolean not null default true,
  add column if not exists dcc_documento_origen_billetera_id uuid references tranqui_legal.trq_documento(doc_id) on delete set null,
  add column if not exists dcc_es_historico_escaneado boolean not null default false,
  add column if not exists dcc_pagina_inicio int,
  add column if not exists dcc_pagina_fin int;

create index if not exists idx_trq_documento_caso_carpeta on tranqui_legal.trq_documento_caso(dcc_carpeta_id);

-- ------------------------------------------------------------------------------
-- 5. BITÁCORA PROCESAL Y PLAZOS COGEP (trq_caso_actuacion)
-- ------------------------------------------------------------------------------

create table if not exists tranqui_legal.trq_caso_actuacion (
  act_id uuid primary key default gen_random_uuid(),
  act_secuencial bigint generated always as identity,
  act_caso_id uuid not null references tranqui_legal.trq_caso_judicial(cas_id) on delete cascade,
  act_autor_id uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  act_tipo text not null default 'actuacion_judicial'
    check (act_tipo in ('actuacion_judicial', 'escrito_presentado', 'providencia_notificada', 'audiencia_diligencia', 'reunion_cliente', 'nota_estrategica', 'hito_publico', 'plazo_vencimiento')),
  act_titulo text not null,
  act_descripcion text,
  act_es_publica_cliente boolean not null default false,
  act_fecha_actuacion timestamptz not null default now(),
  -- Control de términos y plazos COGEP
  act_fecha_termino timestamptz,
  act_termino_dias_habiles int,
  act_termino_cumplido boolean not null default false,
  act_termino_cumplido_en timestamptz,
  -- Metadatos y adjuntos
  act_documento_id uuid references tranqui_legal.trq_documento_caso(dcc_id) on delete set null,
  act_detalle_actuacion jsonb not null default '{}'::jsonb,
  act_creado_en timestamptz not null default now(),
  act_actualizado_en timestamptz not null default now(),
  act_eliminado_en timestamptz
);

create index idx_trq_caso_actuacion_caso on tranqui_legal.trq_caso_actuacion(act_caso_id, act_fecha_actuacion desc) where act_eliminado_en is null;
create index idx_trq_caso_actuacion_terminos on tranqui_legal.trq_caso_actuacion(act_fecha_termino) where act_termino_cumplido = false and act_eliminado_en is null;

alter table tranqui_legal.trq_caso_actuacion enable row level security;

create policy trq_caso_actuacion_cliente_select on tranqui_legal.trq_caso_actuacion
  for select using (
    act_es_publica_cliente = true
    and exists (
      select 1 from tranqui_legal.trq_caso_judicial c
      where c.cas_id = act_caso_id and c.cas_cliente_id = auth.uid()
    )
  );

create policy trq_caso_actuacion_abogado_select on tranqui_legal.trq_caso_actuacion
  for select using (
    exists (
      select 1 from tranqui_legal.trq_caso_judicial c
      where c.cas_id = act_caso_id
        and (
          c.cas_abogado_id = tranqui_legal.trq_fn_abogado_actual()
          or exists (
            select 1 from tranqui_legal.trq_caso_abogado_equipo e
            where e.cae_caso_id = c.cas_id and e.cae_abogado_id = tranqui_legal.trq_fn_abogado_actual() and e.cae_activo = true
          )
        )
    )
  );

create policy trq_caso_actuacion_admin_select on tranqui_legal.trq_caso_actuacion
  for select using (comun_seguridad.seg_fn_es_admin_negocio('tranqi'));

create policy trq_caso_actuacion_insert on tranqui_legal.trq_caso_actuacion
  for insert with check (
    comun_seguridad.seg_fn_es_admin_negocio('tranqi')
    or exists (
      select 1 from tranqui_legal.trq_caso_judicial c
      where c.cas_id = act_caso_id
        and (
          c.cas_abogado_id = tranqui_legal.trq_fn_abogado_actual()
          or exists (
            select 1 from tranqui_legal.trq_caso_abogado_equipo e
            where e.cae_caso_id = c.cas_id and e.cae_abogado_id = tranqui_legal.trq_fn_abogado_actual() and e.cae_activo = true
          )
        )
    )
  );

create trigger trg_auditoria_trq_caso_actuacion
  after insert or update or delete on tranqui_legal.trq_caso_actuacion
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select, insert, update on tranqui_legal.trq_caso_actuacion to authenticated;

-- ------------------------------------------------------------------------------
-- 6. DIGITALIZACIÓN MASIVA DEL ARCHIVO FÍSICO HISTÓRICO (trq_archivo_digitalizacion_lote)
-- ------------------------------------------------------------------------------

create table if not exists tranqui_legal.trq_archivo_digitalizacion_lote (
  adl_id uuid primary key default gen_random_uuid(),
  adl_secuencial bigint generated always as identity,
  adl_codigo_lote text not null unique,
  adl_nombre_lote text not null,
  adl_descripcion text,
  adl_creado_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  adl_estado text not null default 'cargado'
    check (adl_estado in ('cargado', 'procesando_ocr', 'segmentado', 'revisado', 'completado', 'error')),
  adl_total_documentos int not null default 0,
  adl_total_paginas int not null default 0,
  adl_ruta_storage_origen text,
  adl_resumen_ia jsonb not null default '{}'::jsonb,
  adl_detalle_lote jsonb not null default '{}'::jsonb,
  adl_creado_en timestamptz not null default now(),
  adl_actualizado_en timestamptz not null default now(),
  adl_eliminado_en timestamptz
);

create index idx_trq_archivo_lote_estado on tranqui_legal.trq_archivo_digitalizacion_lote(adl_estado) where adl_eliminado_en is null;

alter table tranqui_legal.trq_archivo_digitalizacion_lote enable row level security;

create policy trq_archivo_digitalizacion_lote_staff on tranqui_legal.trq_archivo_digitalizacion_lote
  for all using (
    comun_seguridad.seg_fn_es_admin_negocio('tranqi')
    or tranqui_legal.trq_fn_abogado_actual() is not null
  );

create trigger trg_auditoria_trq_archivo_digitalizacion_lote
  after insert or update or delete on tranqui_legal.trq_archivo_digitalizacion_lote
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select, insert, update on tranqui_legal.trq_archivo_digitalizacion_lote to authenticated;

-- Relación del caso judicial con el lote de digitalización
alter table tranqui_legal.trq_caso_judicial
  add constraint fk_trq_caso_lote_digitalizacion
  foreign key (cas_lote_digitalizacion_id) references tranqui_legal.trq_archivo_digitalizacion_lote(adl_id) on delete set null;

-- ------------------------------------------------------------------------------
-- 7. FUNCIONES RPC TRANSACCIONALES DE NEGOCIO
-- ------------------------------------------------------------------------------

-- 7.1. Inicializar Carpetas Procesales Estándar para un Caso
create or replace function tranqui_legal.trq_fn_crear_carpetas_estandar_caso(p_caso_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into tranqui_legal.trq_caso_carpeta (ccr_caso_id, ccr_codigo, ccr_nombre, ccr_descripcion, ccr_orden, ccr_es_sistema)
  values
    (p_caso_id, '01_poderes', '01. Identificación y Poderes', 'Cédulas, RUC, Poderes Notariales y Nombramientos', 1, true),
    (p_caso_id, '02_pruebas', '02. Pruebas y Evidencias', 'Contratos, Facturas, Informes Periciales y Evidencias', 2, true),
    (p_caso_id, '03_escritos', '03. Escritos y Minutas Judiciales', 'Demandas, Contestaciones y Minutas (Versiones vN)', 3, true),
    (p_caso_id, '04_providencias', '04. Providencias y Notificaciones', 'Autos de calificación, Citaciones y Sentencias SATJE', 4, true),
    (p_caso_id, '05_facturacion', '05. Comprobantes y Facturación', 'Tasas judiciales, Honorarios y Recibos', 5, true)
  on conflict (ccr_caso_id, ccr_codigo) do nothing;
end;
$$;

grant execute on function tranqui_legal.trq_fn_crear_carpetas_estandar_caso(uuid) to authenticated;

-- 7.2. Crear Expediente Digital Unificado (Matter Creation)
create or replace function tranqui_legal.trq_fn_crear_expediente(
  p_cliente_id uuid,
  p_titulo text,
  p_tipo_tramite text default 'judicial',
  p_materia_id uuid default null,
  p_provincia_id uuid default null,
  p_abogado_lider_id uuid default null,
  p_descripcion text default null,
  p_numero_proceso text default null,
  p_judicatura text default null,
  p_contraparte_nombres text default null,
  p_contraparte_identificacion text default null,
  p_es_historico boolean default false,
  p_lote_digitalizacion_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caso_id uuid;
  v_secuencial bigint;
  v_codigo_exp text;
  v_anio int;
begin
  -- Validar permisos: Staff o el propio cliente
  if not (comun_seguridad.seg_fn_es_admin_negocio('tranqi') or tranqui_legal.trq_fn_abogado_actual() is not null or auth.uid() = p_cliente_id) then
    raise exception 'No tiene permisos para crear un expediente.';
  end if;

  v_anio := extract(year from now())::int;

  insert into tranqui_legal.trq_caso_judicial (
    cas_cliente_id,
    cas_abogado_id,
    cas_materia_id,
    cas_provincia_id,
    cas_titulo,
    cas_descripcion,
    cas_tipo_tramite,
    cas_numero_proceso,
    cas_judicatura,
    cas_contraparte_nombres,
    cas_contraparte_identificacion,
    cas_es_historico_digitalizado,
    cas_lote_digitalizacion_id,
    cas_estado,
    cas_etapa_procesal,
    cas_origen
  ) values (
    p_cliente_id,
    p_abogado_lider_id,
    p_materia_id,
    p_provincia_id,
    p_titulo,
    p_descripcion,
    p_tipo_tramite,
    p_numero_proceso,
    p_judicatura,
    p_contraparte_nombres,
    p_contraparte_identificacion,
    p_es_historico,
    p_lote_digitalizacion_id,
    case when p_es_historico then 'cerrado' when p_abogado_lider_id is not null then 'asignado' else 'nuevo' end,
    case when p_es_historico then 'archivado' else 'intake' end,
    case when p_es_historico then 'archivo_historico' when auth.uid() = p_cliente_id then 'web' else 'operador' end
  )
  returning cas_id, cas_secuencial into v_caso_id, v_secuencial;

  -- Generar código identificador amigable TRQ-MAT-YYYY-XXXXX
  v_codigo_exp := 'TRQ-MAT-' || v_anio::text || '-' || lpad(v_secuencial::text, 5, '0');
  update tranqui_legal.trq_caso_judicial
  set cas_codigo_expediente = v_codigo_exp
  where cas_id = v_caso_id;

  -- Asignar abogado titular al equipo si se especificó
  if p_abogado_lider_id is not null then
    insert into tranqui_legal.trq_caso_abogado_equipo (
      cae_caso_id,
      cae_abogado_id,
      cae_rol,
      cae_asignado_por,
      cae_activo
    ) values (
      v_caso_id,
      p_abogado_lider_id,
      'titular',
      auth.uid(),
      true
    ) on conflict do nothing;
  end if;

  -- Inicializar carpetas estándar
  perform tranqui_legal.trq_fn_crear_carpetas_estandar_caso(v_caso_id);

  -- Registrar hito inicial en la bitácora
  insert into tranqui_legal.trq_caso_actuacion (
    act_caso_id,
    act_autor_id,
    act_tipo,
    act_titulo,
    act_descripcion,
    act_es_publica_cliente
  ) values (
    v_caso_id,
    auth.uid(),
    'hito_publico',
    'Expediente radicado exitosamente',
    'Se ha generado el expediente ' || v_codigo_exp || ' para la atención del trámite.',
    true
  );

  return v_caso_id;
end;
$$;

grant execute on function tranqui_legal.trq_fn_crear_expediente(uuid, text, text, uuid, uuid, uuid, text, text, text, text, text, boolean, uuid) to authenticated;

-- 7.3. Verificación de Conflicto de Intereses (Conflict Check)
create or replace function tranqui_legal.trq_fn_verificar_conflicto_intereses(
  p_identificacion text,
  p_nombres text default null
)
returns table (
  conflicto_detectado boolean,
  tipo_conflicto text,
  caso_id uuid,
  caso_codigo text,
  caso_titulo text,
  abogado_asignado text,
  fecha_radicacion timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    true as conflicto_detectado,
    'contraparte_en_litigio_activo' as tipo_conflicto,
    c.cas_id,
    c.cas_codigo_expediente,
    c.cas_titulo,
    coalesce(u.usu_nombre_completo, 'Sin asignar') as abogado_asignado,
    c.cas_abierto_en as fecha_radicacion
  from tranqui_legal.trq_caso_judicial c
  left join tranqui_legal.trq_abogado a on a.abg_id = c.cas_abogado_id
  left join comun_seguridad.seg_usuario u on u.usu_id = a.abg_usuario_id
  where c.cas_eliminado_en is null
    and c.cas_estado in ('nuevo', 'asignado', 'en_curso')
    and (
      (p_identificacion is not null and length(trim(p_identificacion)) >= 9 and c.cas_contraparte_identificacion = trim(p_identificacion))
      or (p_nombres is not null and length(trim(p_nombres)) >= 5 and c.cas_contraparte_nombres ilike '%' || trim(p_nombres) || '%')
    );
end;
$$;

grant execute on function tranqui_legal.trq_fn_verificar_conflicto_intereses(text, text) to authenticated;
