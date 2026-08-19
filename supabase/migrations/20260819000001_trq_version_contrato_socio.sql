-- ═══════════════════════════════════════════════════════════════════
-- TRQ-ABG-001 / TRQ-ADM-001: Versionamiento Inmutable de Contratos
-- Permite que el operador/admin edite el contrato en Markdown (.MD)
-- antes de emitir, y que el solicitante acepte/firme o envíe comentarios.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists tranqui_legal.trq_version_contrato_socio (
  vcs_id uuid primary key default gen_random_uuid(),
  vcs_secuencial bigint generated always as identity,
  vcs_solicitud_id uuid not null references tranqui_legal.trq_solicitud_socio(ssc_id) on delete cascade,
  vcs_numero_version int not null default 1,
  vcs_titulo text not null default 'CONTRATO DE PRESTACIÓN DE SERVICIOS Y ASOCIACIÓN LEGAL',
  vcs_contenido_md text not null,
  vcs_comentarios text,
  vcs_creado_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  vcs_rol_creador text not null check (vcs_rol_creador in ('ADMINISTRADOR', 'OPERADOR', 'SOLICITANTE', 'SISTEMA')),
  vcs_tipo_evento text not null check (vcs_tipo_evento in (
    'EMISION_CONTRATO',
    'MODIFICACION_OPERADOR',
    'OBSERVACION_SOLICITANTE',
    'FIRMA_SOLICITANTE',
    'CONTRAFIRMA_TRANQI'
  )),
  vcs_path_pdf_firmado text,
  vcs_creado_en timestamptz not null default now()
);

-- Índices de consulta rápida
create index if not exists trq_version_contrato_solicitud_idx 
  on tranqui_legal.trq_version_contrato_socio (vcs_solicitud_id, vcs_numero_version desc);

-- RLS
alter table tranqui_legal.trq_version_contrato_socio enable row level security;

-- Los operadores/admins de tranqi y el solicitante dueño de la postulación pueden leer
create policy trq_version_contrato_socio_select on tranqui_legal.trq_version_contrato_socio
  for select using (
    exists (
      select 1 from tranqui_legal.trq_solicitud_socio s
      where s.ssc_id = vcs_solicitud_id
      and (
        s.ssc_usuario_id = auth.uid()
        or comun_seguridad.seg_fn_es_admin_negocio('tranqi')
        or exists (
          select 1 from comun_seguridad.seg_membresia_perfil mp
          join comun_seguridad.seg_membresia m on m.mem_id = mp.mep_membresia_id
          where m.mem_usuario_id = auth.uid()
          and m.mem_negocio = 'TRANQ'
          and mp.mep_perfil in ('ADMINISTRADOR', 'SUPERADMIN', 'OPERADOR')
        )
      )
    )
  );

-- Inserción autenticada
create policy trq_version_contrato_socio_insert on tranqui_legal.trq_version_contrato_socio
  for insert with check (
    exists (
      select 1 from tranqui_legal.trq_solicitud_socio s
      where s.ssc_id = vcs_solicitud_id
      and (
        s.ssc_usuario_id = auth.uid()
        or comun_seguridad.seg_fn_es_admin_negocio('tranqi')
        or exists (
          select 1 from comun_seguridad.seg_membresia_perfil mp
          join comun_seguridad.seg_membresia m on m.mem_id = mp.mep_membresia_id
          where m.mem_usuario_id = auth.uid()
          and m.mem_negocio = 'TRANQ'
          and mp.mep_perfil in ('ADMINISTRADOR', 'SUPERADMIN', 'OPERADOR')
        )
      )
    )
  );

-- Trigger de auditoría transversal
create trigger trg_auditoria_trq_version_contrato_socio 
  after insert or update or delete on tranqui_legal.trq_version_contrato_socio 
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

-- Permisos
grant select, insert on tranqui_legal.trq_version_contrato_socio to authenticated;
