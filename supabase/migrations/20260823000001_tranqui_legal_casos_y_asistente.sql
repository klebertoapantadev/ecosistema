-- TRQ-009: modelo de datos operativo de Tranqi (casos, citas, documentos de
-- caso, honorarios) y persistencia del asistente conversacional (PLT-004
-- regla 3, "el historial se persiste en PostgreSQL").
--
-- Hasta esta migracion tranqui_legal solo modelaba el alta de socios abogados
-- (TRQ-001). El panel de cliente y el de abogado eran maqueta porque no habia
-- nada que consultar. Estas seis tablas son el cimiento sobre el que operan
-- los asistentes ARIA y los requerimientos TRQ-CLI-002, TRQ-ABG-005 y
-- TRQ-ADM-002.
--
-- Frontera de seguridad: los asistentes NO usan service_role. Consultan por
-- PostgREST con un JWT de usuario, asi que estas politicas RLS son la unica
-- cosa que decide que ve cada quien. No son defensa en profundidad: son LA
-- defensa.

-- ═══════════ Helper: el abogado que corresponde al usuario en sesion ═══════════
-- Se usa en varias politicas; centralizarlo evita repetir el subselect y que
-- una copia se quede desalineada. STABLE + SECURITY DEFINER como
-- seg_fn_es_admin_negocio: necesita leer trq_abogado saltandose su propio RLS,
-- que a su vez depende de esta misma pregunta.
create or replace function tranqui_legal.trq_fn_abogado_actual()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select abg_id from tranqui_legal.trq_abogado
  where abg_usuario_id = auth.uid() and abg_estado = 'verificado'
$$;

-- Sin este grant las politicas que la invocan fallan: una expresion de RLS se
-- evalua con los privilegios de quien consulta, no con los del dueño de la
-- tabla. Es el mismo olvido que ya costo dos migraciones de correccion de
-- GRANT USAGE en este esquema (ver especificacion-tecnica.md).
grant execute on function tranqui_legal.trq_fn_abogado_actual() to authenticated;

-- ═══════════ Caso judicial ═══════════
-- El nombre de tabla y el prefijo cas_ estan fijados como ejemplo canonico en
-- gobernanza/estandares/00-nomenclatura-base-datos.md §3: se respetan literal.
create table tranqui_legal.trq_caso_judicial (
  cas_id uuid primary key default gen_random_uuid(),
  cas_secuencial bigint generated always as identity,
  cas_cliente_id uuid not null references comun_seguridad.seg_usuario(usu_id) on delete restrict,
  -- Nullable a proposito: un caso entra sin abogado y la asignacion es un paso
  -- posterior (TRQ-ADM-002). Un NOT NULL aqui obligaria a inventar un abogado
  -- de relleno en el momento de la creacion.
  cas_abogado_id uuid references tranqui_legal.trq_abogado(abg_id) on delete set null,
  cas_materia_id uuid references tranqui_legal.trq_materia(mat_id) on delete set null,
  cas_provincia_id uuid references comun_catalogo.cat_provincia(cat_id) on delete set null,
  cas_titulo text not null,
  cas_descripcion text,
  cas_estado text not null default 'nuevo'
    check (cas_estado in ('nuevo','asignado','en_curso','suspendido','cerrado')),
  cas_prioridad text not null default 'normal'
    check (cas_prioridad in ('normal','alta','urgente')),
  -- Numero de proceso de la Funcion Judicial. Texto libre: el formato varia
  -- por judicatura y validarlo aqui rechazaria casos reales.
  cas_numero_proceso text,
  cas_detalle_caso jsonb not null default '{}'::jsonb,
  cas_abierto_en timestamptz not null default now(),
  cas_cerrado_en timestamptz,
  cas_creado_en timestamptz not null default now(),
  cas_actualizado_en timestamptz not null default now(),
  cas_eliminado_en timestamptz
);

create index trq_caso_judicial_cliente_idx on tranqui_legal.trq_caso_judicial (cas_cliente_id) where cas_eliminado_en is null;
create index trq_caso_judicial_abogado_idx on tranqui_legal.trq_caso_judicial (cas_abogado_id) where cas_eliminado_en is null;
-- Bandeja de asignacion de TRQ-ADM-002: los casos sin abogado, por antiguedad.
create index trq_caso_judicial_sin_asignar_idx on tranqui_legal.trq_caso_judicial (cas_abierto_en)
  where cas_abogado_id is null and cas_eliminado_en is null;

alter table tranqui_legal.trq_caso_judicial enable row level security;

create policy trq_caso_judicial_cliente_select on tranqui_legal.trq_caso_judicial
  for select using (cas_cliente_id = auth.uid());
create policy trq_caso_judicial_abogado_select on tranqui_legal.trq_caso_judicial
  for select using (cas_abogado_id = tranqui_legal.trq_fn_abogado_actual());
create policy trq_caso_judicial_admin_select on tranqui_legal.trq_caso_judicial
  for select using (comun_seguridad.seg_fn_es_admin_negocio('tranqi'));
-- El abogado asignado actualiza el expediente que lleva; el cliente no. Sin
-- politica de INSERT ni DELETE: crear y asignar casos es RPC (regla 5 de
-- AGENTS.md) y no hay borrado fisico de filas de negocio.
create policy trq_caso_judicial_abogado_update on tranqui_legal.trq_caso_judicial
  for update using (cas_abogado_id = tranqui_legal.trq_fn_abogado_actual())
  with check (cas_abogado_id = tranqui_legal.trq_fn_abogado_actual());

create trigger trg_auditoria_trq_caso_judicial after insert or update or delete on tranqui_legal.trq_caso_judicial for each row execute function comun_auditoria.aud_fn_auditar_tabla();
grant select, update on tranqui_legal.trq_caso_judicial to authenticated;

-- ═══════════ Cita ═══════════
create table tranqui_legal.trq_cita (
  cit_id uuid primary key default gen_random_uuid(),
  cit_secuencial bigint generated always as identity,
  -- Nullable: la primera consulta de un afiliado ocurre antes de que exista
  -- expediente. Obligar a un caso convertiria "quiero preguntar algo" en
  -- "abre un caso primero", que es justo la friccion que Tranqi elimina.
  cit_caso_id uuid references tranqui_legal.trq_caso_judicial(cas_id) on delete set null,
  cit_cliente_id uuid not null references comun_seguridad.seg_usuario(usu_id) on delete restrict,
  cit_abogado_id uuid references tranqui_legal.trq_abogado(abg_id) on delete set null,
  cit_inicio_en timestamptz not null,
  cit_fin_en timestamptz,
  cit_modalidad text not null default 'virtual' check (cit_modalidad in ('presencial','virtual')),
  cit_estado text not null default 'propuesta'
    check (cit_estado in ('propuesta','confirmada','reagendada','cancelada','realizada')),
  cit_motivo text,
  cit_enlace text,
  cit_lugar text,
  cit_notas text,
  cit_creado_en timestamptz not null default now(),
  cit_actualizado_en timestamptz not null default now(),
  cit_eliminado_en timestamptz,
  constraint trq_cita_rango_valido check (cit_fin_en is null or cit_fin_en > cit_inicio_en)
);

create index trq_cita_cliente_idx on tranqui_legal.trq_cita (cit_cliente_id, cit_inicio_en) where cit_eliminado_en is null;
-- "Como viene el dia" del asistente del abogado: agenda por profesional y fecha.
create index trq_cita_abogado_idx on tranqui_legal.trq_cita (cit_abogado_id, cit_inicio_en) where cit_eliminado_en is null;

alter table tranqui_legal.trq_cita enable row level security;

create policy trq_cita_cliente_select on tranqui_legal.trq_cita
  for select using (cit_cliente_id = auth.uid());
create policy trq_cita_abogado_select on tranqui_legal.trq_cita
  for select using (cit_abogado_id = tranqui_legal.trq_fn_abogado_actual());
create policy trq_cita_admin_select on tranqui_legal.trq_cita
  for select using (comun_seguridad.seg_fn_es_admin_negocio('tranqi'));
-- El cliente propone su cita (es la accion que el asistente ejecuta en su
-- nombre tras confirmacion explicita); el abogado la gestiona.
create policy trq_cita_cliente_insert on tranqui_legal.trq_cita
  for insert with check (cit_cliente_id = auth.uid() and cit_estado = 'propuesta');
create policy trq_cita_cliente_update on tranqui_legal.trq_cita
  for update using (cit_cliente_id = auth.uid()) with check (cit_cliente_id = auth.uid());
create policy trq_cita_abogado_update on tranqui_legal.trq_cita
  for update using (cit_abogado_id = tranqui_legal.trq_fn_abogado_actual())
  with check (cit_abogado_id = tranqui_legal.trq_fn_abogado_actual());

create trigger trg_auditoria_trq_cita after insert or update or delete on tranqui_legal.trq_cita for each row execute function comun_auditoria.aud_fn_auditar_tabla();
grant select, insert, update on tranqui_legal.trq_cita to authenticated;

-- ═══════════ Documento de caso ═══════════
-- Solo metadatos: el binario vive en el bucket privado de Storage y se sirve
-- con URL firmada de corta vida. Se guarda la ruta, nunca una URL publica.
create table tranqui_legal.trq_documento_caso (
  dcc_id uuid primary key default gen_random_uuid(),
  dcc_caso_id uuid not null references tranqui_legal.trq_caso_judicial(cas_id) on delete cascade,
  dcc_subido_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  dcc_tipo text not null default 'otro'
    check (dcc_tipo in ('cedula','contrato','minuta','notificacion','prueba','escrito','otro')),
  dcc_ruta_storage text not null,
  dcc_nombre_archivo text,
  dcc_mime text,
  dcc_tamano_bytes bigint,
  -- TRQ-ABG-005 y TRQ-CLI-002 escriben aqui. El dictamen es jsonb y no texto
  -- porque lleva estructura (hallazgos, clausulas, nivel de riesgo) y porque
  -- su forma va a cambiar mientras se afina el prompt.
  dcc_estado_revision text not null default 'pendiente'
    check (dcc_estado_revision in ('pendiente','en_revision','aceptado','rechazado')),
  dcc_dictamen jsonb not null default '{}'::jsonb,
  dcc_dictaminado_en timestamptz,
  dcc_creado_en timestamptz not null default now(),
  dcc_actualizado_en timestamptz not null default now(),
  dcc_eliminado_en timestamptz
);

create index trq_documento_caso_caso_idx on tranqui_legal.trq_documento_caso (dcc_caso_id) where dcc_eliminado_en is null;

alter table tranqui_legal.trq_documento_caso enable row level security;

-- Hereda la visibilidad del caso: quien puede ver el expediente ve sus
-- documentos, y nadie mas. El EXISTS se resuelve contra trq_caso_judicial, que
-- ya tiene RLS, asi que hay un solo sitio donde equivocarse en vez de dos.
create policy trq_documento_caso_select on tranqui_legal.trq_documento_caso
  for select using (
    exists (select 1 from tranqui_legal.trq_caso_judicial c where c.cas_id = dcc_caso_id)
  );
create policy trq_documento_caso_insert on tranqui_legal.trq_documento_caso
  for insert with check (
    dcc_subido_por = auth.uid()
    and exists (select 1 from tranqui_legal.trq_caso_judicial c where c.cas_id = dcc_caso_id)
  );
-- Solo el abogado del caso cambia el estado de revision de un documento: el
-- dictamen de la IA es insumo suyo, no una decision del cliente sobre su
-- propia prueba.
create policy trq_documento_caso_abogado_update on tranqui_legal.trq_documento_caso
  for update using (
    exists (select 1 from tranqui_legal.trq_caso_judicial c
            where c.cas_id = dcc_caso_id and c.cas_abogado_id = tranqui_legal.trq_fn_abogado_actual())
  );

create trigger trg_auditoria_trq_documento_caso after insert or update or delete on tranqui_legal.trq_documento_caso for each row execute function comun_auditoria.aud_fn_auditar_tabla();
grant select, insert, update on tranqui_legal.trq_documento_caso to authenticated;

-- ═══════════ Honorario ═══════════
create table tranqui_legal.trq_honorario (
  hon_id uuid primary key default gen_random_uuid(),
  hon_secuencial bigint generated always as identity,
  hon_abogado_id uuid not null references tranqui_legal.trq_abogado(abg_id) on delete restrict,
  hon_caso_id uuid references tranqui_legal.trq_caso_judicial(cas_id) on delete set null,
  hon_concepto text not null,
  -- numeric, nunca float: es dinero.
  hon_monto numeric(12,2) not null check (hon_monto >= 0),
  hon_moneda text not null default 'USD',
  hon_estado text not null default 'pendiente'
    check (hon_estado in ('pendiente','aprobado','liquidado','rechazado')),
  -- Dia 1 del mes de liquidacion. Se guarda como date y no como texto para
  -- poder ordenar y agrupar por periodo sin parsear.
  hon_periodo date not null,
  hon_liquidado_en timestamptz,
  hon_creado_en timestamptz not null default now(),
  hon_actualizado_en timestamptz not null default now(),
  hon_eliminado_en timestamptz
);

create index trq_honorario_abogado_periodo_idx on tranqui_legal.trq_honorario (hon_abogado_id, hon_periodo) where hon_eliminado_en is null;

alter table tranqui_legal.trq_honorario enable row level security;

create policy trq_honorario_abogado_select on tranqui_legal.trq_honorario
  for select using (hon_abogado_id = tranqui_legal.trq_fn_abogado_actual());
create policy trq_honorario_admin_select on tranqui_legal.trq_honorario
  for select using (comun_seguridad.seg_fn_es_admin_negocio('tranqi'));
-- El abogado LEE sus honorarios; no los crea ni los aprueba. La liquidacion es
-- del operador (TRQ-ADM-002) y entra por RPC cuando ese requerimiento se
-- implemente. Un abogado que pudiera insertar aqui se pagaria solo.

create trigger trg_auditoria_trq_honorario after insert or update or delete on tranqui_legal.trq_honorario for each row execute function comun_auditoria.aud_fn_auditar_tabla();
grant select on tranqui_legal.trq_honorario to authenticated;

-- ═══════════ Conversacion con el asistente (PLT-004 regla 3) ═══════════
-- cnv_id ES el conversation_id que se le pasa a ARIA: un solo identificador
-- para el hilo, sin tabla de correspondencia que mantener sincronizada.
create table tranqui_legal.trq_conversacion (
  cnv_id uuid primary key default gen_random_uuid(),
  cnv_usuario_id uuid not null references comun_seguridad.seg_usuario(usu_id) on delete cascade,
  -- Con que asistente habla. Determina el agente de ARIA y, por tanto, que
  -- herramientas tuvo disponibles ese hilo.
  cnv_rol text not null check (cnv_rol in ('CLIENTE','ABOGADO','ADMINISTRADOR')),
  cnv_agente_slug text,
  cnv_titulo text,
  cnv_ultimo_mensaje_en timestamptz not null default now(),
  cnv_creado_en timestamptz not null default now(),
  cnv_actualizado_en timestamptz not null default now(),
  cnv_eliminado_en timestamptz
);

create index trq_conversacion_usuario_idx on tranqui_legal.trq_conversacion (cnv_usuario_id, cnv_ultimo_mensaje_en desc) where cnv_eliminado_en is null;

alter table tranqui_legal.trq_conversacion enable row level security;

-- Solo el dueño. A diferencia del resto de tablas, un administrador de tranqi
-- NO lee estas conversaciones: son consultas legales personales del afiliado y
-- darles visibilidad de oficio seria un problema de privacidad, no una
-- comodidad de soporte. Si hiciera falta para soporte, que sea un RPC con
-- consentimiento y su propio rastro de auditoria.
create policy trq_conversacion_propia_select on tranqui_legal.trq_conversacion
  for select using (cnv_usuario_id = auth.uid());
create policy trq_conversacion_propia_insert on tranqui_legal.trq_conversacion
  for insert with check (cnv_usuario_id = auth.uid());
create policy trq_conversacion_propia_update on tranqui_legal.trq_conversacion
  for update using (cnv_usuario_id = auth.uid()) with check (cnv_usuario_id = auth.uid());

create trigger trg_auditoria_trq_conversacion after insert or update or delete on tranqui_legal.trq_conversacion for each row execute function comun_auditoria.aud_fn_auditar_tabla();
grant select, insert, update on tranqui_legal.trq_conversacion to authenticated;

-- ═══════════ Mensaje ═══════════
create table tranqui_legal.trq_mensaje (
  msg_id uuid primary key default gen_random_uuid(),
  msg_conversacion_id uuid not null references tranqui_legal.trq_conversacion(cnv_id) on delete cascade,
  msg_autor text not null check (msg_autor in ('usuario','asistente')),
  msg_contenido text not null,
  -- run_id de ARIA: permite abrir la traza de herramientas de esa respuesta
  -- desde la pantalla de agentes sin guardar aqui una copia de la traza.
  msg_run_id text,
  msg_creado_en timestamptz not null default now()
);

create index trq_mensaje_conversacion_idx on tranqui_legal.trq_mensaje (msg_conversacion_id, msg_creado_en);

alter table tranqui_legal.trq_mensaje enable row level security;

create policy trq_mensaje_select on tranqui_legal.trq_mensaje
  for select using (
    exists (select 1 from tranqui_legal.trq_conversacion c where c.cnv_id = msg_conversacion_id)
  );
create policy trq_mensaje_insert on tranqui_legal.trq_mensaje
  for insert with check (
    exists (select 1 from tranqui_legal.trq_conversacion c where c.cnv_id = msg_conversacion_id)
  );

create trigger trg_auditoria_trq_mensaje after insert or update or delete on tranqui_legal.trq_mensaje for each row execute function comun_auditoria.aud_fn_auditar_tabla();
grant select, insert on tranqui_legal.trq_mensaje to authenticated;
