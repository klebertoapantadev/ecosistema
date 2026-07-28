-- TRQ-001: Solicitud de registro de socio abogado. Primera tabla propia de
-- Tranqi (prefijo trq_, esquema tranqui_legal) -- ver
-- gobernanza/productos/tranqi/especificacion-{funcional,tecnica}.md.
--
-- Notas de alcance de esta migracion (documentadas tambien en la espec.
-- tecnica): cedula/matricula van en texto plano protegidas por RLS
-- (owner + admin de tranqi unicamente) en vez de pgp_sym_encrypt -- cifrar
-- de verdad requiere gestion de claves (Supabase Vault) que todavia no
-- existe en el proyecto y merece su propia decision, no improvisarse aqui.
-- MFA (PLT-002) no bloquea el envio de la solicitud -- se exige mas adelante
-- para activar capacidades reales de trq_abogado (ver columna
-- abg_mfa_verificado), no para postular. trq_documento_socio queda modelada
-- pero sin UI de carga todavia (no hay bucket de Storage en el proyecto).

create schema if not exists tranqui_legal;

-- ═══════════ Catalogo de materias (especialidades legales) ═══════════
create table tranqui_legal.trq_materia (
  mat_id uuid primary key default gen_random_uuid(),
  mat_nombre text not null unique,
  mat_activa boolean not null default true,
  mat_creado_en timestamptz not null default now()
);

alter table tranqui_legal.trq_materia enable row level security;
create policy trq_materia_select on tranqui_legal.trq_materia for select using (true);
create trigger trg_auditoria_trq_materia after insert or update or delete on tranqui_legal.trq_materia for each row execute function comun_auditoria.aud_fn_auditar_tabla();
grant select on tranqui_legal.trq_materia to authenticated;

insert into tranqui_legal.trq_materia (mat_nombre) values
  ('Civil'), ('Penal'), ('Laboral'), ('Familia y Niñez'),
  ('Societario y Corporativo'), ('Tributario'), ('Migratorio'), ('Tránsito'),
  ('Propiedad Intelectual'), ('Administrativo'), ('Constitucional'),
  ('Arrendamiento e Inquilinato')
on conflict (mat_nombre) do nothing;

-- ═══════════ Solicitud de socio ═══════════
create table tranqui_legal.trq_solicitud_socio (
  ssc_id uuid primary key default gen_random_uuid(),
  ssc_secuencial bigint generated always as identity,
  ssc_usuario_id uuid not null references comun_seguridad.seg_usuario(usu_id) on delete cascade,
  ssc_estado text not null default 'enviada' check (ssc_estado in ('borrador','enviada','en_revision','aceptada','rechazada')),
  ssc_cedula text not null,
  ssc_matricula_profesional text not null,
  ssc_universidad text not null,
  ssc_anio_graduacion int not null,
  ssc_anos_experiencia int not null default 0,
  ssc_resumen_profesional text not null,
  ssc_telefono_contacto text,
  ssc_enlace_senescyt_verificado boolean not null default false,
  ssc_enlace_foro_verificado boolean not null default false,
  ssc_creado_en timestamptz not null default now(),
  ssc_actualizado_en timestamptz not null default now(),
  ssc_enviada_en timestamptz not null default now(),
  ssc_eliminado_en timestamptz
);

-- Una sola solicitud activa (no terminal) por usuario -- evita duplicados
-- mientras permite volver a postular despues de un rechazo.
create unique index trq_solicitud_socio_usuario_activa_idx on tranqui_legal.trq_solicitud_socio (ssc_usuario_id)
  where ssc_estado in ('borrador','enviada','en_revision');

alter table tranqui_legal.trq_solicitud_socio enable row level security;

create policy trq_solicitud_socio_propia_select on tranqui_legal.trq_solicitud_socio
  for select using (ssc_usuario_id = auth.uid());
create policy trq_solicitud_socio_admin_select on tranqui_legal.trq_solicitud_socio
  for select using (comun_seguridad.seg_fn_es_admin_negocio('tranqi'));
create policy trq_solicitud_socio_propia_insert on tranqui_legal.trq_solicitud_socio
  for insert with check (ssc_usuario_id = auth.uid());
-- Sin politica de UPDATE directo: la transicion de estado es RPC dedicado
-- (trq_fn_decidir_solicitud, SECURITY DEFINER) -- regla 5 de AGENTS.md.

create trigger trg_auditoria_trq_solicitud_socio after insert or update or delete on tranqui_legal.trq_solicitud_socio for each row execute function comun_auditoria.aud_fn_auditar_tabla();
grant select, insert on tranqui_legal.trq_solicitud_socio to authenticated;

-- ═══════════ Experiencia laboral (repetible por solicitud) ═══════════
create table tranqui_legal.trq_experiencia_laboral (
  exp_id uuid primary key default gen_random_uuid(),
  exp_solicitud_id uuid not null references tranqui_legal.trq_solicitud_socio(ssc_id) on delete cascade,
  exp_empresa text not null,
  exp_cargo text not null,
  exp_fecha_inicio date not null,
  exp_fecha_fin date,
  exp_descripcion text,
  exp_creado_en timestamptz not null default now()
);

alter table tranqui_legal.trq_experiencia_laboral enable row level security;
create policy trq_experiencia_laboral_select on tranqui_legal.trq_experiencia_laboral
  for select using (
    exists (select 1 from tranqui_legal.trq_solicitud_socio s where s.ssc_id = exp_solicitud_id and (s.ssc_usuario_id = auth.uid() or comun_seguridad.seg_fn_es_admin_negocio('tranqi')))
  );
create policy trq_experiencia_laboral_insert on tranqui_legal.trq_experiencia_laboral
  for insert with check (
    exists (select 1 from tranqui_legal.trq_solicitud_socio s where s.ssc_id = exp_solicitud_id and s.ssc_usuario_id = auth.uid())
  );
create trigger trg_auditoria_trq_experiencia_laboral after insert or update or delete on tranqui_legal.trq_experiencia_laboral for each row execute function comun_auditoria.aud_fn_auditar_tabla();
grant select, insert on tranqui_legal.trq_experiencia_laboral to authenticated;

-- ═══════════ Documentos de respaldo (modelada, sin UI de carga todavia) ═══════════
create table tranqui_legal.trq_documento_socio (
  dcs_id uuid primary key default gen_random_uuid(),
  dcs_solicitud_id uuid not null references tranqui_legal.trq_solicitud_socio(ssc_id) on delete cascade,
  dcs_tipo text not null check (dcs_tipo in ('titulo','matricula','cedula','otro')),
  dcs_url text not null,
  dcs_nombre_archivo text,
  dcs_creado_en timestamptz not null default now()
);

alter table tranqui_legal.trq_documento_socio enable row level security;
create policy trq_documento_socio_select on tranqui_legal.trq_documento_socio
  for select using (
    exists (select 1 from tranqui_legal.trq_solicitud_socio s where s.ssc_id = dcs_solicitud_id and (s.ssc_usuario_id = auth.uid() or comun_seguridad.seg_fn_es_admin_negocio('tranqi')))
  );
create policy trq_documento_socio_insert on tranqui_legal.trq_documento_socio
  for insert with check (
    exists (select 1 from tranqui_legal.trq_solicitud_socio s where s.ssc_id = dcs_solicitud_id and s.ssc_usuario_id = auth.uid())
  );
create trigger trg_auditoria_trq_documento_socio after insert or update or delete on tranqui_legal.trq_documento_socio for each row execute function comun_auditoria.aud_fn_auditar_tabla();
grant select, insert on tranqui_legal.trq_documento_socio to authenticated;

-- ═══════════ N:M materia / provincia ═══════════
create table tranqui_legal.trq_solicitud_materia (
  sma_id uuid primary key default gen_random_uuid(),
  sma_solicitud_id uuid not null references tranqui_legal.trq_solicitud_socio(ssc_id) on delete cascade,
  sma_materia_id uuid not null references tranqui_legal.trq_materia(mat_id),
  unique (sma_solicitud_id, sma_materia_id)
);

alter table tranqui_legal.trq_solicitud_materia enable row level security;
create policy trq_solicitud_materia_select on tranqui_legal.trq_solicitud_materia
  for select using (
    exists (select 1 from tranqui_legal.trq_solicitud_socio s where s.ssc_id = sma_solicitud_id and (s.ssc_usuario_id = auth.uid() or comun_seguridad.seg_fn_es_admin_negocio('tranqi')))
  );
create policy trq_solicitud_materia_insert on tranqui_legal.trq_solicitud_materia
  for insert with check (
    exists (select 1 from tranqui_legal.trq_solicitud_socio s where s.ssc_id = sma_solicitud_id and s.ssc_usuario_id = auth.uid())
  );
create trigger trg_auditoria_trq_solicitud_materia after insert or update or delete on tranqui_legal.trq_solicitud_materia for each row execute function comun_auditoria.aud_fn_auditar_tabla();
grant select, insert on tranqui_legal.trq_solicitud_materia to authenticated;

create table tranqui_legal.trq_solicitud_provincia (
  spr_id uuid primary key default gen_random_uuid(),
  spr_solicitud_id uuid not null references tranqui_legal.trq_solicitud_socio(ssc_id) on delete cascade,
  spr_provincia_id uuid not null references comun_catalogo.cat_provincia(cat_id),
  unique (spr_solicitud_id, spr_provincia_id)
);

alter table tranqui_legal.trq_solicitud_provincia enable row level security;
create policy trq_solicitud_provincia_select on tranqui_legal.trq_solicitud_provincia
  for select using (
    exists (select 1 from tranqui_legal.trq_solicitud_socio s where s.ssc_id = spr_solicitud_id and (s.ssc_usuario_id = auth.uid() or comun_seguridad.seg_fn_es_admin_negocio('tranqi')))
  );
create policy trq_solicitud_provincia_insert on tranqui_legal.trq_solicitud_provincia
  for insert with check (
    exists (select 1 from tranqui_legal.trq_solicitud_socio s where s.ssc_id = spr_solicitud_id and s.ssc_usuario_id = auth.uid())
  );
create trigger trg_auditoria_trq_solicitud_provincia after insert or update or delete on tranqui_legal.trq_solicitud_provincia for each row execute function comun_auditoria.aud_fn_auditar_tabla();
grant select, insert on tranqui_legal.trq_solicitud_provincia to authenticated;

-- ═══════════ Revision (bitacora de decision del administrador) ═══════════
create table tranqui_legal.trq_revision_solicitud (
  rev_id uuid primary key default gen_random_uuid(),
  rev_solicitud_id uuid not null references tranqui_legal.trq_solicitud_socio(ssc_id) on delete cascade,
  rev_admin_id uuid not null references comun_seguridad.seg_usuario(usu_id),
  rev_decision text not null check (rev_decision in ('aceptada','rechazada')),
  rev_comentario text,
  rev_creado_en timestamptz not null default now()
);

alter table tranqui_legal.trq_revision_solicitud enable row level security;
create policy trq_revision_solicitud_select on tranqui_legal.trq_revision_solicitud
  for select using (
    comun_seguridad.seg_fn_es_admin_negocio('tranqi')
    or exists (select 1 from tranqui_legal.trq_solicitud_socio s where s.ssc_id = rev_solicitud_id and s.ssc_usuario_id = auth.uid())
  );
-- Sin politica de INSERT: solo el RPC trq_fn_decidir_solicitud (SECURITY
-- DEFINER) escribe aqui.

create trigger trg_auditoria_trq_revision_solicitud after insert or update or delete on tranqui_legal.trq_revision_solicitud for each row execute function comun_auditoria.aud_fn_auditar_tabla();
grant select on tranqui_legal.trq_revision_solicitud to authenticated;

-- ═══════════ Socio verificado (existe una vez aceptada la solicitud) ═══════════
create table tranqui_legal.trq_abogado (
  abg_id uuid primary key default gen_random_uuid(),
  abg_usuario_id uuid not null unique references comun_seguridad.seg_usuario(usu_id) on delete cascade,
  abg_solicitud_id uuid not null references tranqui_legal.trq_solicitud_socio(ssc_id),
  abg_estado text not null default 'verificado' check (abg_estado in ('verificado','suspendido')),
  -- Hook para PLT-002: capacidades reales de abogado (agenda, casos) no se
  -- activan sin MFA configurado. Si el usuario ya tiene MFA de un flujo de
  -- pago previo (proceso critico, PLT-002), ya cumple este requisito -- no
  -- se le vuelve a pedir. Verificacion real todavia no implementada (MFA no
  -- existe en el codigo), esta columna deja el esquema listo para cuando
  -- exista.
  abg_mfa_verificado boolean not null default false,
  abg_verificado_en timestamptz not null default now(),
  abg_creado_en timestamptz not null default now(),
  abg_actualizado_en timestamptz not null default now()
);

alter table tranqui_legal.trq_abogado enable row level security;
create policy trq_abogado_select on tranqui_legal.trq_abogado
  for select using (abg_usuario_id = auth.uid() or comun_seguridad.seg_fn_es_admin_negocio('tranqi'));
-- Sin politica de INSERT/UPDATE directo: solo el RPC trq_fn_decidir_solicitud.

create trigger trg_auditoria_trq_abogado after insert or update or delete on tranqui_legal.trq_abogado for each row execute function comun_auditoria.aud_fn_auditar_tabla();
grant select on tranqui_legal.trq_abogado to authenticated;

-- ═══════════ RPC: decidir solicitud (aceptar/rechazar) ═══════════
-- Transicion de estado irreversible -> RPC transaccional, no UPDATE directo
-- (regla 5 AGENTS.md, mismo patron que seg_fn_asignar_rol). Al aceptar: crea
-- trq_abogado y asigna el rol ABOGADO via el RPC de plataforma existente.
create or replace function tranqui_legal.trq_fn_decidir_solicitud(
  p_solicitud_id uuid,
  p_decision text,
  p_comentario text default null
)
returns tranqui_legal.trq_solicitud_socio
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_solicitud tranqui_legal.trq_solicitud_socio;
begin
  if not comun_seguridad.seg_fn_es_admin_negocio('tranqi') then
    raise exception 'No autorizado para revisar solicitudes de socios';
  end if;

  if p_decision not in ('aceptada', 'rechazada') then
    raise exception 'Decision invalida: %', p_decision;
  end if;

  select * into v_solicitud from tranqui_legal.trq_solicitud_socio where ssc_id = p_solicitud_id for update;
  if not found then
    raise exception 'Solicitud no encontrada';
  end if;
  if v_solicitud.ssc_estado not in ('enviada', 'en_revision') then
    raise exception 'La solicitud ya fue decidida (estado actual: %)', v_solicitud.ssc_estado;
  end if;

  insert into tranqui_legal.trq_revision_solicitud (rev_solicitud_id, rev_admin_id, rev_decision, rev_comentario)
  values (p_solicitud_id, auth.uid(), p_decision, p_comentario);

  update tranqui_legal.trq_solicitud_socio
  set ssc_estado = p_decision, ssc_actualizado_en = now()
  where ssc_id = p_solicitud_id
  returning * into v_solicitud;

  if p_decision = 'aceptada' then
    insert into tranqui_legal.trq_abogado (abg_usuario_id, abg_solicitud_id)
    values (v_solicitud.ssc_usuario_id, p_solicitud_id)
    on conflict (abg_usuario_id) do update
      set abg_solicitud_id = excluded.abg_solicitud_id, abg_estado = 'verificado', abg_actualizado_en = now();

    perform comun_seguridad.seg_fn_asignar_rol(v_solicitud.ssc_usuario_id, 'tranqi', 'ABOGADO');
  end if;

  return v_solicitud;
end;
$$;

grant execute on function tranqui_legal.trq_fn_decidir_solicitud(uuid, text, text) to authenticated;

-- ═══════════ Widget del panel: "Socios", visible para ADMINISTRADOR ═══════════
insert into comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre) values
  ('tranqi', 'socios', 'Socios')
on conflict (wdg_negocio, wdg_clave) do nothing;

insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id)
select wdg_negocio, 'ADMINISTRADOR', wdg_id from comun_seguridad.seg_widget
where wdg_clave = 'socios' and wdg_negocio = 'tranqi'
on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do nothing;
