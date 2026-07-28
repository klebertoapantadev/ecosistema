-- TRQ-001 ampliacion: documentos de respaldo del admin (con comentario),
-- cola de notificacion por correo (modelada, envio real pendiente de
-- proveedor -- ver README del modulo), y esquema comun_notificaciones
-- nuevo y reutilizable por cualquier negocio.

-- ═══════════ Documentos: quien subio + comentario ═══════════
-- Hasta ahora solo el solicitante podia adjuntar. El admin que revisa
-- tambien necesita poder subir su propio respaldo (ej. captura de la
-- verificacion en SENESCYT) con un comentario explicando que es.
alter table tranqui_legal.trq_documento_socio
  add column dcs_subido_por uuid references comun_seguridad.seg_usuario(usu_id),
  add column dcs_comentario text;

-- Backfill de filas existentes (auth.uid() no resuelve nada en contexto de
-- migracion, sin sesion) -- se asume que documentos previos los subio el
-- propio solicitante, que era el unico que podia hacerlo hasta ahora.
update tranqui_legal.trq_documento_socio d
set dcs_subido_por = s.ssc_usuario_id
from tranqui_legal.trq_solicitud_socio s
where s.ssc_id = d.dcs_solicitud_id and d.dcs_subido_por is null;

alter table tranqui_legal.trq_documento_socio alter column dcs_subido_por set not null;
alter table tranqui_legal.trq_documento_socio alter column dcs_subido_por set default auth.uid();

alter table tranqui_legal.trq_documento_socio drop constraint trq_documento_socio_dcs_tipo_check;
alter table tranqui_legal.trq_documento_socio
  add constraint trq_documento_socio_dcs_tipo_check
  check (dcs_tipo in ('titulo', 'matricula', 'cedula', 'otro', 'respaldo_revision'));

drop policy trq_documento_socio_insert on tranqui_legal.trq_documento_socio;
create policy trq_documento_socio_insert on tranqui_legal.trq_documento_socio
  for insert with check (
    exists (select 1 from tranqui_legal.trq_solicitud_socio s where s.ssc_id = dcs_solicitud_id and s.ssc_usuario_id = auth.uid())
    or tranqui_legal.trq_fn_es_admin_mfa_verificado()
  );

-- Storage: el admin-mfa tambien puede subir a la carpeta de la solicitud
-- (antes solo el dueno). La lectura ya lo permitia (socios_documentos_select).
drop policy socios_documentos_propio_insert on storage.objects;
create policy socios_documentos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'socios-documentos'
    and (
      exists (
        select 1 from tranqui_legal.trq_solicitud_socio s
        where s.ssc_id::text = (storage.foldername(name))[1]
          and s.ssc_usuario_id = auth.uid()
      )
      or tranqui_legal.trq_fn_es_admin_mfa_verificado()
    )
  );

-- ═══════════ comun_notificaciones: cola de correo (nueva, compartida) ═══════════
-- Generica para cualquier negocio -- no es exclusiva de socios. Escritura
-- solo via funciones SECURITY DEFINER (ej. trq_fn_decidir_solicitud), nunca
-- INSERT directo del cliente. Envio real pendiente de proveedor (Resend/
-- SendGrid/etc) -- por ahora esto es la cola, no el envio.
create schema if not exists comun_notificaciones;

create table comun_notificaciones.not_cola_correo (
  not_id uuid primary key default gen_random_uuid(),
  not_secuencial bigint generated always as identity,
  not_negocio text not null,
  not_destinatario_usuario_id uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  not_destinatario_correo text not null,
  not_plantilla text not null,
  not_asunto text not null,
  not_datos jsonb not null default '{}'::jsonb,
  not_estado text not null default 'pendiente' check (not_estado in ('pendiente', 'enviado', 'fallido')),
  not_intentos int not null default 0,
  not_error text,
  not_creado_en timestamptz not null default now(),
  not_enviado_en timestamptz
);

create index not_cola_correo_pendientes_idx on comun_notificaciones.not_cola_correo (not_estado, not_creado_en)
  where not_estado = 'pendiente';

alter table comun_notificaciones.not_cola_correo enable row level security;

create policy not_cola_correo_superadmin_select on comun_notificaciones.not_cola_correo
  for select using (
    exists (select 1 from comun_seguridad.seg_usuario u where u.usu_id = auth.uid() and u.usu_superadmin_plataforma)
  );
-- Sin politica de INSERT/UPDATE para clientes -- solo SECURITY DEFINER.

create trigger trg_auditoria_not_cola_correo after insert or update or delete on comun_notificaciones.not_cola_correo for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant usage on schema comun_notificaciones to authenticated;
grant select on comun_notificaciones.not_cola_correo to authenticated;

-- ═══════════ RPC decidir_solicitud: encola notificacion al decidir ═══════════
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
  v_correo text;
  v_nombre text;
begin
  if not tranqui_legal.trq_fn_es_admin_mfa_verificado() then
    raise exception 'No autorizado: se requiere ser administrador de tranqi con verificacion MFA (aal2) activa';
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

  select usu_correo, usu_nombres into v_correo, v_nombre from comun_seguridad.seg_usuario where usu_id = v_solicitud.ssc_usuario_id;

  insert into comun_notificaciones.not_cola_correo (
    not_negocio, not_destinatario_usuario_id, not_destinatario_correo, not_plantilla, not_asunto, not_datos
  ) values (
    'tranqi', v_solicitud.ssc_usuario_id, v_correo,
    case when p_decision = 'aceptada' then 'socio_aceptado' else 'socio_rechazado' end,
    case when p_decision = 'aceptada' then 'Tu solicitud para ser socio abogado fue aceptada' else 'Sobre tu solicitud para ser socio abogado' end,
    jsonb_build_object('nombre', v_nombre, 'decision', p_decision, 'comentario', p_comentario)
  );

  return v_solicitud;
end;
$$;
