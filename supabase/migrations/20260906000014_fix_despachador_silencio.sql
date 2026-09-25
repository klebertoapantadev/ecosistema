-- ==============================================================================
-- Migración: 20260906000004_fix_despachador_silencio.sql
-- Corrige: PLT-021 regla 5 — el silencio temporal perdía el aviso.
-- ==============================================================================
--
-- `tar_fn_recordatorios_cita` llamaba a `tar_fn_notificar` con `perform`,
-- tirando el booleano que devuelve, y marcaba la cita como avisada pasara lo que
-- pasara. Resultado: si el afiliado tenía el silencio temporal activo
-- (PLT-013 regla 7), no recibía la notificación Y la cita quedaba marcada, así
-- que el recordatorio no volvía a intentarse nunca. El aviso se perdía en
-- silencio, que es exactamente lo contrario de lo que promete la regla.
--
-- Lo cazó la prueba del escenario de silencio antes de que el cron llegara a
-- ejecutarse en horario normal.
--
-- Se arregla en dos piezas:
--
-- 1. `tar_fn_notificar` acepta una CLAVE ÚNICA y no duplica: si ya existe una
--    notificación viva con esa clave para ese usuario, la da por entregada. Sin
--    esto, al dejar de marcar la cita, cada pasada del cron le mandaría al
--    abogado el mismo recordatorio otra vez mientras el afiliado siguiera
--    silenciado.
-- 2. La tarea solo marca la cita cuando el AFILIADO ha sido avisado de verdad.
--    Es el destinatario que importa: el abogado tiene además su propia agenda.

create or replace function comun_tareas.tar_fn_notificar(
  p_usuario_id uuid,
  p_negocio text,
  p_titulo text,
  p_contenido_html text,
  p_url_accion text default null,
  p_plantilla_correo text default null,
  p_detalles jsonb default '{}'::jsonb,
  p_clave_unica text default null
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
  v_detalles jsonb;
begin
  if p_usuario_id is null then
    return false;
  end if;

  v_detalles := coalesce(p_detalles, '{}'::jsonb);
  if p_clave_unica is not null then
    v_detalles := v_detalles || jsonb_build_object('clave_unica', p_clave_unica);

    -- Ya se le mandó esto: se da por entregado en vez de duplicarlo.
    if exists (
      select 1 from comun_notificacion.not_registro
      where not_usuario_id = p_usuario_id
        and not_detalles ->> 'clave_unica' = p_clave_unica
    ) then
      return true;
    end if;
  end if;

  select pfn_canal_email, pfn_canal_in_app, pfn_silenciado_hasta into v_pref
  from comun_seguridad.seg_preferencia_notificacion
  where pfn_usuario_id = p_usuario_id and upper(pfn_negocio) = upper(p_negocio)
  limit 1;

  -- Silencio activo: no se manda nada y se devuelve false para que quien llama
  -- NO lo dé por hecho y vuelva a intentarlo cuando el silencio expire.
  if v_pref.pfn_silenciado_hasta is not null and v_pref.pfn_silenciado_hasta > now() then
    return false;
  end if;

  if coalesce(v_pref.pfn_canal_in_app, true) then
    insert into comun_notificacion.not_registro (
      not_usuario_id, not_negocio, not_canal, not_titulo, not_contenido_html, not_url_accion, not_detalles)
    values (p_usuario_id, upper(p_negocio), 'IN_APP', p_titulo, p_contenido_html, p_url_accion, v_detalles);
    v_enviada := true;
  end if;

  if coalesce(v_pref.pfn_canal_email, true) and p_plantilla_correo is not null then
    select usu_correo into v_correo from comun_seguridad.seg_usuario where usu_id = p_usuario_id;
    if v_correo is not null and v_correo not like 'anonimo+%' then
      insert into comun_notificaciones.not_cola_correo (
        not_negocio, not_destinatario_usuario_id, not_destinatario_correo,
        not_plantilla, not_asunto, not_datos, not_estado)
      values (upper(p_negocio), p_usuario_id, v_correo, p_plantilla_correo, p_titulo,
              v_detalles || jsonb_build_object('titulo', p_titulo, 'url_accion', p_url_accion),
              'pendiente');
      v_enviada := true;
    end if;
  end if;

  -- Si el usuario apagó todos los canales, no hay nada que reintentar: se da
  -- por resuelto para que la tarea no se quede dando vueltas eternamente.
  if not v_enviada
     and coalesce(v_pref.pfn_canal_in_app, true) = false
     and coalesce(v_pref.pfn_canal_email, true) = false then
    return true;
  end if;

  return v_enviada;
end;
$$;

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
  v_es_1h boolean;
  v_avisado_afiliado boolean;
  v_clave text;
begin
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
    v_es_1h := c.cit_inicio_en <= now() + interval '1 hour' and c.cit_recordado_1h_en is null;
    v_cuando := case when v_es_1h then 'dentro de menos de una hora' else 'mañana' end;
    v_clave := 'cita:' || c.cit_id || ':' || case when v_es_1h then '1h' else '24h' end;

    v_avisado_afiliado := comun_tareas.tar_fn_notificar(
      c.cit_cliente_id, 'TRANQ',
      'Recordatorio: tu consulta es ' || v_cuando,
      '<p>Te recordamos tu consulta legal, ' || v_cuando || '.</p>' ||
      case when c.cit_modalidad = 'virtual'
           then '<p>Es por videollamada: el enlace se activa 10 minutos antes desde tus citas.</p>'
           else '<p>Es presencial en el despacho de tu abogado.</p>' end,
      '/panel/mis-citas', 'recordatorio_cita',
      jsonb_build_object('cita_id', c.cit_id, 'inicio_en', c.cit_inicio_en),
      v_clave);

    if c.cit_abogado_id is not null then
      perform comun_tareas.tar_fn_notificar(
        (select abg_usuario_id from tranqui_legal.trq_abogado where abg_id = c.cit_abogado_id),
        'TRANQ',
        'Recordatorio: tienes una consulta ' || v_cuando,
        '<p>Tienes una consulta agendada ' || v_cuando || '.</p>',
        '/panel/agenda', 'recordatorio_cita',
        jsonb_build_object('cita_id', c.cit_id, 'inicio_en', c.cit_inicio_en),
        v_clave || ':abogado');
    end if;

    -- Solo se marca si el afiliado fue avisado de verdad. Si tiene el silencio
    -- puesto, la cita queda sin marcar y el aviso vuelve a intentarse en la
    -- siguiente pasada; al abogado no se le duplica nada porque su notificación
    -- lleva clave única.
    if v_avisado_afiliado then
      if v_es_1h then
        update tranqui_legal.trq_cita
           set cit_recordado_1h_en = now(),
               cit_recordado_24h_en = coalesce(cit_recordado_24h_en, now())
         where cit_id = c.cit_id;
      else
        update tranqui_legal.trq_cita set cit_recordado_24h_en = now() where cit_id = c.cit_id;
      end if;
      v_total := v_total + 1;
    end if;
  end loop;

  return v_total;
end;
$$;

-- Encontrar rápido una notificación por su clave, que es lo que hace la
-- comprobación de duplicados en cada pasada del cron.
create index if not exists idx_not_registro_clave_unica
  on comun_notificacion.not_registro ((not_detalles ->> 'clave_unica'))
  where not_detalles ? 'clave_unica';
