-- ==============================================================================
-- Migración: 20260906000002_comun_tareas_despachador.sql
-- Módulo: Despachador de tareas programadas (PLT-013, PLT-020, PLT-009).
-- ==============================================================================
--
-- El ecosistema lleva meses prometiendo cosas que ocurren solas y no tenía nada
-- que las ejecutara:
--
--   · Recordatorios de cita (PLT-020 regla 9 y TRQ-ABG-004).
--   · «Posponer alerta» (PLT-013 regla 5): `not_pospuesta_hasta` se guardaba y
--     nadie devolvía la notificación al vencer el plazo.
--   · Alertas de caducidad de la billetera (TRQ-COM-001 regla 4): las columnas
--     de configuración existen desde agosto, el disparador no.
--   · Caducidad de los bonos de convenio (`wlm_expira_en`).
--   · `not_campana` admite el estado PROGRAMADA sin nada que lo despache.
--
-- Se resuelve con **pg_cron dentro de la propia base**, y no con un cron
-- externo, porque todas estas tareas son operaciones sobre datos que ya están
-- aquí: sacarlas fuera obligaría a exponer un endpoint, autenticarlo y
-- vigilarlo, para acabar haciendo el mismo UPDATE. Lo que sí sale fuera —el
-- correo— ya tiene su camino: se encola en `not_cola_correo` y lo despacha
-- quien la vacía.
--
-- Dos decisiones que hacen esto operable:
--
-- 1. TODAS las tareas son idempotentes y RECUPERABLES. No preguntan «¿falta
--    justo un día para la cita?», sino «¿queda menos de un día y aún no avisé?».
--    Si el cron se cae dos horas, al volver manda lo pendiente en vez de
--    perderlo para siempre. Una ventana estrecha convierte cualquier caída en
--    silencio permanente.
-- 2. Cada ejecución deja rastro en `tar_ejecucion`. Un cron sin bitácora que
--    falla es indistinguible de un cron que no tenía nada que hacer.

create schema if not exists comun_tareas;

-- ============ Bitácora ============

create table comun_tareas.tar_ejecucion (
  tar_id uuid primary key default gen_random_uuid(),
  tar_secuencial bigint generated always as identity,
  tar_tarea text not null,
  tar_inicio_en timestamptz not null default now(),
  tar_fin_en timestamptz,
  tar_filas int not null default 0,
  tar_estado text not null default 'corriendo' check (tar_estado in ('corriendo','ok','error')),
  tar_error text,
  tar_detalle jsonb not null default '{}'::jsonb,
  tar_creado_en timestamptz not null default now(),
  tar_actualizado_en timestamptz not null default now(),
  tar_eliminado_en timestamptz
);

create index idx_tar_ejecucion_tarea on comun_tareas.tar_ejecucion (tar_tarea, tar_inicio_en desc);
-- Para la pregunta que se hace de verdad: «¿ha fallado algo últimamente?»
create index idx_tar_ejecucion_fallos on comun_tareas.tar_ejecucion (tar_inicio_en desc)
  where tar_estado = 'error';

alter table comun_tareas.tar_ejecucion enable row level security;

-- Solo el staff la lee, y nadie la escribe desde fuera: las filas las pone el
-- propio despachador, que corre como el dueño del esquema.
create policy tar_ejecucion_staff on comun_tareas.tar_ejecucion
  for select using (
    exists (select 1 from comun_seguridad.seg_usuario u
            where u.usu_id = auth.uid() and u.usu_superadmin_plataforma)
    or comun_seguridad.seg_fn_es_operador_o_admin_negocio('tranqi')
  );

create trigger trg_auditoria_tar_ejecucion after insert or update or delete
  on comun_tareas.tar_ejecucion for each row execute function comun_auditoria.aud_fn_auditar_tabla();

-- ============ Marcas de idempotencia ============
-- Sin esto, cada pasada del cron volvería a avisar de la misma cita.

alter table tranqui_legal.trq_cita
  add column if not exists cit_recordado_24h_en timestamptz,
  add column if not exists cit_recordado_1h_en timestamptz;

alter table tranqui_legal.trq_billetera_documento
  add column if not exists doc_alertado_caducidad_en timestamptz;

-- ============ Helper: notificar respetando las preferencias ============
-- PLT-013 regla 7: el usuario puede silenciar temporalmente y elegir canales.
-- Un despachador que ignore eso convierte una función de usuario en una mentira.
create or replace function comun_tareas.tar_fn_notificar(
  p_usuario_id uuid,
  p_negocio text,
  p_titulo text,
  p_contenido_html text,
  p_url_accion text default null,
  p_plantilla_correo text default null,
  p_detalles jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pref record;
  v_correo text;
  v_enviada boolean := false;
begin
  select pfn_canal_email, pfn_canal_in_app, pfn_silenciado_hasta into v_pref
  from comun_seguridad.seg_preferencia_notificacion
  where pfn_usuario_id = p_usuario_id and upper(pfn_negocio) = upper(p_negocio)
  limit 1;

  -- Silencio temporal activo: no se manda nada y no se marca como enviada, para
  -- que la tarea vuelva a intentarlo cuando el silencio expire.
  if v_pref.pfn_silenciado_hasta is not null and v_pref.pfn_silenciado_hasta > now() then
    return false;
  end if;

  if coalesce(v_pref.pfn_canal_in_app, true) then
    insert into comun_notificacion.not_registro (
      not_usuario_id, not_negocio, not_canal, not_titulo, not_contenido_html, not_url_accion, not_detalles)
    values (p_usuario_id, upper(p_negocio), 'IN_APP', p_titulo, p_contenido_html, p_url_accion, p_detalles);
    v_enviada := true;
  end if;

  if coalesce(v_pref.pfn_canal_email, true) and p_plantilla_correo is not null then
    select usu_correo into v_correo from comun_seguridad.seg_usuario where usu_id = p_usuario_id;
    if v_correo is not null and v_correo not like 'anonimo+%' then
      insert into comun_notificaciones.not_cola_correo (
        not_negocio, not_destinatario_usuario_id, not_destinatario_correo,
        not_plantilla, not_asunto, not_datos, not_estado)
      values (upper(p_negocio), p_usuario_id, v_correo,
              p_plantilla_correo, p_titulo,
              p_detalles || jsonb_build_object('titulo', p_titulo, 'url_accion', p_url_accion),
              'pendiente');
      v_enviada := true;
    end if;
  end if;

  return v_enviada;
end;
$$;

-- ============ Tarea: recordatorios de cita ============
create or replace function comun_tareas.tar_fn_recordatorios_cita()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  v_total int := 0;
  v_cuando text;
begin
  -- «Queda menos de X y todavía no avisé», no «faltan exactamente X»: así una
  -- caída del cron se recupera sola en la siguiente pasada.
  for c in
    select cit_id, cit_cliente_id, cit_abogado_id, cit_inicio_en, cit_modalidad,
           cit_recordado_24h_en, cit_recordado_1h_en
    from tranqui_legal.trq_cita
    where cit_eliminado_en is null
      and cit_estado in ('confirmada','reagendada')
      and cit_inicio_en > now()
      and (
        (cit_inicio_en <= now() + interval '24 hours' and cit_recordado_24h_en is null)
        or (cit_inicio_en <= now() + interval '1 hour' and cit_recordado_1h_en is null)
      )
    order by cit_inicio_en
    limit 500
  loop
    v_cuando := case when c.cit_inicio_en <= now() + interval '1 hour'
                     then 'dentro de menos de una hora' else 'mañana' end;

    -- Al afiliado.
    perform comun_tareas.tar_fn_notificar(
      c.cit_cliente_id, 'TRANQ',
      'Recordatorio: tu consulta es ' || v_cuando,
      '<p>Te recordamos tu consulta legal, ' || v_cuando || '.</p>' ||
      case when c.cit_modalidad = 'virtual'
           then '<p>Es por videollamada: el enlace se activa 10 minutos antes desde tus citas.</p>'
           else '<p>Es presencial en el despacho de tu abogado.</p>' end,
      '/panel/mis-citas', 'recordatorio_cita',
      jsonb_build_object('cita_id', c.cit_id, 'inicio_en', c.cit_inicio_en));

    -- Y al abogado, si lo tiene asignado. Una cita en contingencia no tiene a
    -- quién avisar, y eso ya lo vigila la mesa del operador.
    if c.cit_abogado_id is not null then
      perform comun_tareas.tar_fn_notificar(
        (select abg_usuario_id from tranqui_legal.trq_abogado where abg_id = c.cit_abogado_id),
        'TRANQ',
        'Recordatorio: tienes una consulta ' || v_cuando,
        '<p>Tienes una consulta agendada ' || v_cuando || '.</p>',
        '/panel/agenda', 'recordatorio_cita',
        jsonb_build_object('cita_id', c.cit_id, 'inicio_en', c.cit_inicio_en));
    end if;

    if c.cit_inicio_en <= now() + interval '1 hour' and c.cit_recordado_1h_en is null then
      update tranqui_legal.trq_cita
         set cit_recordado_1h_en = now(),
             -- Si se avisa a una hora, el de 24 h ya no tiene sentido.
             cit_recordado_24h_en = coalesce(cit_recordado_24h_en, now())
       where cit_id = c.cit_id;
    else
      update tranqui_legal.trq_cita set cit_recordado_24h_en = now() where cit_id = c.cit_id;
    end if;

    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

-- ============ Tarea: devolver las notificaciones pospuestas ============
-- PLT-013 regla 5. El usuario aplaza una alerta y espera que vuelva; hasta hoy
-- la fecha se guardaba y no volvía nunca.
create or replace function comun_tareas.tar_fn_reactivar_pospuestas()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare v_total int;
begin
  with reactivadas as (
    update comun_notificacion.not_registro
       set not_detalles = (not_detalles - 'pospuesta_hasta')
                          || jsonb_build_object('reactivada_en', now())
     where not_leido_en is null
       and not_detalles ? 'pospuesta_hasta'
       and (not_detalles ->> 'pospuesta_hasta')::timestamptz <= now()
       and coalesce((not_detalles ->> 'eliminada')::boolean, false) = false
    returning 1)
  select count(*) into v_total from reactivadas;
  return coalesce(v_total, 0);
end;
$$;

-- ============ Tarea: caducidad de documentos de la billetera ============
create or replace function comun_tareas.tar_fn_alertas_caducidad_documento()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
  v_total int := 0;
  v_dias int;
begin
  for d in
    select doc_id, doc_usuario_id, doc_titulo, doc_fecha_caducidad,
           coalesce(doc_meses_anticipacion_alerta, 3) as meses
    from tranqui_legal.trq_billetera_documento
    where doc_eliminado_en is null
      and coalesce(doc_alertar_caducidad, true)
      and doc_fecha_caducidad is not null
      and doc_alertado_caducidad_en is null
      and doc_fecha_caducidad > current_date
      and doc_fecha_caducidad <= current_date + (coalesce(doc_meses_anticipacion_alerta, 3) * interval '1 month')
    limit 500
  loop
    v_dias := d.doc_fecha_caducidad - current_date;
    perform comun_tareas.tar_fn_notificar(
      d.doc_usuario_id, 'TRANQ',
      'Tu documento «' || coalesce(d.doc_titulo, 'sin título') || '» caduca pronto',
      '<p>Caduca en ' || v_dias || ' días (' || to_char(d.doc_fecha_caducidad, 'DD/MM/YYYY') || ').</p>' ||
      '<p>Renuévalo y sube el nuevo a tu billetera para tenerlo a mano cuando lo necesites.</p>',
      '/panel/billetera-documentos', 'caducidad_documento',
      jsonb_build_object('documento_id', d.doc_id, 'expira', d.doc_fecha_caducidad));

    update tranqui_legal.trq_billetera_documento
       set doc_alertado_caducidad_en = now() where doc_id = d.doc_id;
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;

-- ============ Tarea: bonos de billetera caducados ============
-- El saldo de bono tiene fecha de caducidad por campaña. Que expire sin
-- descontarse deja al usuario viendo un saldo que ya no puede gastar.
create or replace function comun_tareas.tar_fn_expirar_bonos()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  v_total int := 0;
begin
  for m in
    select wlm_id, wlm_billetera_id, wlm_monto
    from comun_comercio.com_billetera_movimiento
    where wlm_tipo_saldo = 'BONO'
      and wlm_expira_en is not null
      and wlm_expira_en <= now()
      and coalesce((wlm_detalle_movimiento ->> 'expirado')::boolean, false) = false
    limit 500
  loop
    update comun_comercio.com_billetera
       set wlt_saldo_bono = greatest(wlt_saldo_bono - m.wlm_monto, 0),
           wlt_saldo_total = greatest(wlt_saldo_total - m.wlm_monto, 0),
           wlt_actualizado_en = now()
     where wlt_id = m.wlm_billetera_id;

    update comun_comercio.com_billetera_movimiento
       set wlm_detalle_movimiento = wlm_detalle_movimiento
                                    || jsonb_build_object('expirado', true, 'expirado_en', now())
     where wlm_id = m.wlm_id;

    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;

-- ============ El despachador ============
-- Corre las tareas, cada una aislada: que una falle no puede impedir que las
-- demás se ejecuten. Y todo queda en la bitácora, incluido el fallo.
create or replace function comun_tareas.tar_fn_despachar()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tareas text[] := array[
    'recordatorios_cita', 'reactivar_pospuestas',
    'alertas_caducidad_documento', 'expirar_bonos'
  ];
  t text;
  v_id uuid;
  v_filas int;
begin
  foreach t in array v_tareas loop
    insert into comun_tareas.tar_ejecucion (tar_tarea) values (t) returning tar_id into v_id;
    begin
      execute format('select comun_tareas.tar_fn_%I()', t) into v_filas;
      update comun_tareas.tar_ejecucion
         set tar_estado = 'ok', tar_filas = coalesce(v_filas, 0),
             tar_fin_en = now(), tar_actualizado_en = now()
       where tar_id = v_id;
    exception when others then
      update comun_tareas.tar_ejecucion
         set tar_estado = 'error', tar_error = sqlerrm,
             tar_fin_en = now(), tar_actualizado_en = now()
       where tar_id = v_id;
    end;
  end loop;
end;
$$;

-- ============ Grants ============
grant usage on schema comun_tareas to authenticated;
grant select on comun_tareas.tar_ejecucion to authenticated;
-- Las funciones NO se conceden a authenticated: las invoca el cron, que corre
-- como superusuario de la base. Un usuario que pudiera dispararlas a voluntad
-- podría inundar de notificaciones a cualquiera.
