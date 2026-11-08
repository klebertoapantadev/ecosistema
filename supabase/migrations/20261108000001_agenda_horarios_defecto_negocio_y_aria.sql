-- ==============================================================================
-- Migración: 20261108000001_agenda_horarios_defecto_negocio_y_aria.sql
-- Implementa:
--   1. Configuración de horarios de atención por defecto del negocio (consultas
--      telemáticas y consultas presenciales) administrable por Operadores y
--      Administradores (comun_agenda.age_config_negocio).
--   2. Generación de horarios disponibles (age_fn_huecos_negocio_defecto y
--      trq_fn_horarios_materia) que opera aunque no existan abogados con agenda
--      disponible en ese instante.
--   3. Clasificación de especialidad por ARIA (con especialidad por defecto) y
--      reserva de cita con pago confirmado (trq_fn_reservar_cita y
--      trq_fn_confirmar_pago_cita), permitiendo agendar sin abogado asignado
--      (pasa a cola de asignación del operador conservando la cita confirmada).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLA DE CONFIGURACIÓN DE HORARIOS POR DEFECTO DEL NEGOCIO
-- ------------------------------------------------------------------------------

create table if not exists comun_agenda.age_config_negocio (
  cgn_id uuid primary key default gen_random_uuid(),
  cgn_secuencial bigint generated always as identity,
  cgn_negocio text not null unique,

  cgn_zona_horaria text not null default 'America/Guayaquil',
  cgn_duracion_cita_min int not null default 45 check (cgn_duracion_cita_min between 15 and 240),
  cgn_holgura_min int not null default 15 check (cgn_holgura_min between 0 and 120),
  cgn_antelacion_minima_horas int not null default 2 check (cgn_antelacion_minima_horas between 0 and 720),
  cgn_horizonte_dias int not null default 45 check (cgn_horizonte_dias between 1 and 365),

  -- Permite agendar en los horarios del negocio aunque no haya un abogado libre
  -- en ese horario; la cita se confirma con el pago y queda en bandeja de
  -- asignaciones para cruce posterior con abogados.
  cgn_permitir_sin_profesional boolean not null default true,
  cgn_direccion_presencial text default 'Av. República del Salvador y Naciones Unidas, Quito',

  -- Franjas por defecto para consultas telemáticas (virtual) y presenciales
  cgn_franjas_virtual jsonb not null default '[
    {"dia_semana": 1, "hora_inicio": "08:00", "hora_fin": "20:00"},
    {"dia_semana": 2, "hora_inicio": "08:00", "hora_fin": "20:00"},
    {"dia_semana": 3, "hora_inicio": "08:00", "hora_fin": "20:00"},
    {"dia_semana": 4, "hora_inicio": "08:00", "hora_fin": "20:00"},
    {"dia_semana": 5, "hora_inicio": "08:00", "hora_fin": "20:00"},
    {"dia_semana": 6, "hora_inicio": "09:00", "hora_fin": "14:00"}
  ]'::jsonb,

  cgn_franjas_presencial jsonb not null default '[
    {"dia_semana": 1, "hora_inicio": "09:00", "hora_fin": "17:30"},
    {"dia_semana": 2, "hora_inicio": "09:00", "hora_fin": "17:30"},
    {"dia_semana": 3, "hora_inicio": "09:00", "hora_fin": "17:30"},
    {"dia_semana": 4, "hora_inicio": "09:00", "hora_fin": "17:30"},
    {"dia_semana": 5, "hora_inicio": "09:00", "hora_fin": "17:30"}
  ]'::jsonb,

  cgn_detalle_config jsonb not null default '{"materia_defecto_nombre": "Civil"}'::jsonb,
  cgn_creado_en timestamptz not null default now(),
  cgn_actualizado_en timestamptz not null default now(),
  cgn_eliminado_en timestamptz
);

alter table comun_agenda.age_config_negocio enable row level security;

drop policy if exists age_config_negocio_lectura on comun_agenda.age_config_negocio;
create policy age_config_negocio_lectura on comun_agenda.age_config_negocio
  for select using (true);

drop policy if exists age_config_negocio_staff on comun_agenda.age_config_negocio;
create policy age_config_negocio_staff on comun_agenda.age_config_negocio
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(cgn_negocio))
  with check (comun_seguridad.seg_fn_es_operador_o_admin_negocio(cgn_negocio));

drop trigger if exists trg_auditoria_age_config_negocio on comun_agenda.age_config_negocio;
create trigger trg_auditoria_age_config_negocio
  after insert or update or delete on comun_agenda.age_config_negocio
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select, insert, update on comun_agenda.age_config_negocio to authenticated;

-- Semilla inicial para los negocios del ecosistema
insert into comun_agenda.age_config_negocio (cgn_negocio, cgn_detalle_config)
values
  ('tranqi',     '{"materia_defecto_nombre": "Civil"}'::jsonb),
  ('fastfix',    '{"materia_defecto_nombre": "General"}'::jsonb),
  ('tinkay',     '{"materia_defecto_nombre": "General"}'::jsonb),
  ('margaritas', '{"materia_defecto_nombre": "General"}'::jsonb)
on conflict (cgn_negocio) do nothing;

-- ------------------------------------------------------------------------------
-- 2. COLUMNAS ADITIVAS EN tranqui_legal.trq_cita PARA MATERIA Y DETALLE ARIA
-- ------------------------------------------------------------------------------

alter table tranqui_legal.trq_cita
  add column if not exists cit_materia_id uuid references tranqui_legal.trq_materia(mat_id) on delete set null,
  add column if not exists cit_detalle_cita jsonb not null default '{}'::jsonb;

create index if not exists idx_trq_cita_materia on tranqui_legal.trq_cita (cit_materia_id)
  where cit_eliminado_en is null;

-- ------------------------------------------------------------------------------
-- 3. RPC PARA GUARDAR CONFIGURACIÓN DE HORARIOS POR DEFECTO (OPERADORES/ADMINS)
-- ------------------------------------------------------------------------------

create or replace function comun_agenda.age_fn_guardar_config_negocio(
  p_negocio text,
  p_config jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not comun_seguridad.seg_fn_es_operador_o_admin_negocio(p_negocio) then
    raise exception 'Solo un operador o administrador de % puede configurar los horarios de atención', p_negocio;
  end if;

  insert into comun_agenda.age_config_negocio as c (
    cgn_negocio,
    cgn_zona_horaria,
    cgn_duracion_cita_min,
    cgn_holgura_min,
    cgn_antelacion_minima_horas,
    cgn_horizonte_dias,
    cgn_permitir_sin_profesional,
    cgn_direccion_presencial,
    cgn_franjas_virtual,
    cgn_franjas_presencial,
    cgn_detalle_config,
    cgn_actualizado_en
  )
  values (
    p_negocio,
    coalesce(p_config->>'zona_horaria', 'America/Guayaquil'),
    greatest(15, least(240, coalesce((p_config->>'duracion_cita_min')::int, 45))),
    greatest(0, least(120, coalesce((p_config->>'holgura_min')::int, 15))),
    greatest(0, least(720, coalesce((p_config->>'antelacion_minima_horas')::int, 2))),
    greatest(1, least(365, coalesce((p_config->>'horizonte_dias')::int, 45))),
    coalesce((p_config->>'permitir_sin_profesional')::boolean, true),
    p_config->>'direccion_presencial',
    coalesce(p_config->'franjas_virtual', '[]'::jsonb),
    coalesce(p_config->'franjas_presencial', '[]'::jsonb),
    coalesce(p_config->'detalle_config', '{"materia_defecto_nombre": "Civil"}'::jsonb),
    now()
  )
  on conflict (cgn_negocio) do update set
    cgn_zona_horaria             = excluded.cgn_zona_horaria,
    cgn_duracion_cita_min        = excluded.cgn_duracion_cita_min,
    cgn_holgura_min              = excluded.cgn_holgura_min,
    cgn_antelacion_minima_horas  = excluded.cgn_antelacion_minima_horas,
    cgn_horizonte_dias           = excluded.cgn_horizonte_dias,
    cgn_permitir_sin_profesional = excluded.cgn_permitir_sin_profesional,
    cgn_direccion_presencial     = excluded.cgn_direccion_presencial,
    cgn_franjas_virtual          = excluded.cgn_franjas_virtual,
    cgn_franjas_presencial       = excluded.cgn_franjas_presencial,
    cgn_detalle_config           = coalesce(c.cgn_detalle_config, '{}'::jsonb) || excluded.cgn_detalle_config,
    cgn_actualizado_en           = now(),
    cgn_eliminado_en             = null
  returning c.cgn_id into v_id;

  return v_id;
end;
$$;

grant execute on function comun_agenda.age_fn_guardar_config_negocio(text, jsonb) to authenticated;

-- ------------------------------------------------------------------------------
-- 4. GENERADOR DE HUECOS POR DEFECTO DEL NEGOCIO (TELEMÁTICO Y PRESENCIAL)
-- ------------------------------------------------------------------------------

create or replace function comun_agenda.age_fn_huecos_negocio_defecto(
  p_negocio text,
  p_desde timestamptz,
  p_hasta timestamptz,
  p_duracion_min int default null,
  p_modalidad text default 'virtual',
  p_limite int default 80
)
returns table (hueco_inicio timestamptz, hueco_fin timestamptz, disponibles int)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c comun_agenda.age_config_negocio;
  v_dur int;
  v_holgura int;
  v_desde timestamptz;
  v_hasta timestamptz;
  v_franjas jsonb;
begin
  select * into c
  from comun_agenda.age_config_negocio
  where cgn_negocio = p_negocio
    and cgn_eliminado_en is null;

  if not found then
    c.cgn_zona_horaria := 'America/Guayaquil';
    c.cgn_duracion_cita_min := 45;
    c.cgn_holgura_min := 15;
    c.cgn_antelacion_minima_horas := 2;
    c.cgn_horizonte_dias := 45;
    c.cgn_franjas_virtual := '[
      {"dia_semana": 1, "hora_inicio": "08:00", "hora_fin": "20:00"},
      {"dia_semana": 2, "hora_inicio": "08:00", "hora_fin": "20:00"},
      {"dia_semana": 3, "hora_inicio": "08:00", "hora_fin": "20:00"},
      {"dia_semana": 4, "hora_inicio": "08:00", "hora_fin": "20:00"},
      {"dia_semana": 5, "hora_inicio": "08:00", "hora_fin": "20:00"},
      {"dia_semana": 6, "hora_inicio": "09:00", "hora_fin": "14:00"}
    ]'::jsonb;
    c.cgn_franjas_presencial := '[
      {"dia_semana": 1, "hora_inicio": "09:00", "hora_fin": "17:30"},
      {"dia_semana": 2, "hora_inicio": "09:00", "hora_fin": "17:30"},
      {"dia_semana": 3, "hora_inicio": "09:00", "hora_fin": "17:30"},
      {"dia_semana": 4, "hora_inicio": "09:00", "hora_fin": "17:30"},
      {"dia_semana": 5, "hora_inicio": "09:00", "hora_fin": "17:30"}
    ]'::jsonb;
  end if;

  v_dur     := coalesce(p_duracion_min, c.cgn_duracion_cita_min, 45);
  v_holgura := coalesce(c.cgn_holgura_min, 15);
  v_desde   := greatest(p_desde, now() + make_interval(hours => coalesce(c.cgn_antelacion_minima_horas, 2)));
  v_hasta   := least(p_hasta,  now() + make_interval(days  => coalesce(c.cgn_horizonte_dias, 45)));

  if v_hasta <= v_desde then
    return;
  end if;

  if p_modalidad = 'presencial' then
    v_franjas := c.cgn_franjas_presencial;
  else
    v_franjas := c.cgn_franjas_virtual;
  end if;

  return query
  with dias as (
    select d::date as dia
    from generate_series(
      (v_desde at time zone c.cgn_zona_horaria)::date,
      (v_hasta at time zone c.cgn_zona_horaria)::date,
      interval '1 day') d
  ),
  franjas_cfg as (
    select
      (f->>'dia_semana')::smallint as dia_semana,
      (f->>'hora_inicio')::time as hora_inicio,
      (f->>'hora_fin')::time as hora_fin
    from jsonb_array_elements(coalesce(v_franjas, '[]'::jsonb)) f
    where (f->>'hora_fin')::time > (f->>'hora_inicio')::time
  ),
  ventanas as (
    select
      ((dias.dia + fc.hora_inicio) at time zone c.cgn_zona_horaria) as ini,
      ((dias.dia + fc.hora_fin)    at time zone c.cgn_zona_horaria) as fin
    from dias
    join franjas_cfg fc
      on fc.dia_semana = extract(dow from dias.dia)::smallint
  ),
  slots as (
    select s as ini, s + make_interval(mins => v_dur) as fin
    from ventanas v
    cross join lateral generate_series(
      v.ini,
      v.fin - make_interval(mins => v_dur),
      make_interval(mins => v_dur + v_holgura)) s
  )
  select slots.ini as hueco_inicio, slots.fin as hueco_fin, 1::int as disponibles
  from slots
  where slots.ini >= v_desde
    and slots.fin <= v_hasta
  order by slots.ini
  limit greatest(p_limite, 1);
end;
$$;

grant execute on function comun_agenda.age_fn_huecos_negocio_defecto(text, timestamptz, timestamptz, int, text, int) to authenticated;

-- ------------------------------------------------------------------------------
-- 5. ACTUALIZACIÓN DE trq_fn_horarios_materia Y trq_fn_reservar_cita
-- ------------------------------------------------------------------------------

create or replace function tranqui_legal.trq_fn_horarios_materia(
  p_materia_id uuid,
  p_desde timestamptz,
  p_hasta timestamptz,
  p_variante_id uuid default null,
  p_modalidad text default null,
  p_provincia_id uuid default null
)
returns table (hueco_inicio timestamptz, hueco_fin timestamptz, disponibles int)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dur int;
  v_permitir_sin_prof boolean := true;
  v_candidatos uuid[];
begin
  select (v.var_detalle_variante->>'duracion_min')::int
    into v_dur
  from comun_comercio.com_variante v
  where v.var_id = p_variante_id;

  select coalesce(cgn_permitir_sin_profesional, true)
    into v_permitir_sin_prof
  from comun_agenda.age_config_negocio
  where cgn_negocio = 'tranqi'
    and cgn_eliminado_en is null;

  v_candidatos := tranqui_legal.trq_fn_candidatos_materia(p_materia_id, p_provincia_id);

  if coalesce(v_permitir_sin_prof, true) then
    -- Une los horarios por defecto configurados por operadores (telemático o
    -- presencial) con la disponibilidad de abogados si la hubiera, garantizando
    -- que el cliente siempre pueda agendar en los horarios de atención de Tranqi.
    return query
    with pool_abogados as (
      select h.hueco_inicio, h.hueco_fin, h.disponibles
      from comun_agenda.age_fn_huecos_del_pool(
        v_candidatos,
        p_desde,
        p_hasta,
        v_dur,
        p_modalidad,
        80
      ) h
    ),
    horarios_defecto as (
      select d.hueco_inicio, d.hueco_fin, d.disponibles
      from comun_agenda.age_fn_huecos_negocio_defecto(
        'tranqi',
        p_desde,
        p_hasta,
        v_dur,
        coalesce(p_modalidad, 'virtual'),
        80
      ) d
    ),
    combinados as (
      select * from pool_abogados
      union all
      select hd.*
      from horarios_defecto hd
      where not exists (
        select 1 from pool_abogados pa where pa.hueco_inicio = hd.hueco_inicio
      )
    )
    select c.hueco_inicio, c.hueco_fin, max(c.disponibles)::int as disponibles
    from combinados c
    group by c.hueco_inicio, c.hueco_fin
    order by c.hueco_inicio
    limit 80;
  else
    return query
    select h.hueco_inicio, h.hueco_fin, h.disponibles
    from comun_agenda.age_fn_huecos_del_pool(
      v_candidatos,
      p_desde,
      p_hasta,
      v_dur,
      p_modalidad,
      80
    ) h;
  end if;
end;
$$;

-- Reemplazamos la firma de 8 argumentos por la versión extendida (10 argumentos con defaults)
drop function if exists tranqui_legal.trq_fn_reservar_cita(uuid, timestamptz, uuid, text, text, uuid, uuid, text);

create or replace function tranqui_legal.trq_fn_reservar_cita(
  p_materia_id uuid,
  p_inicio_en timestamptz,
  p_variante_id uuid default null,
  p_modalidad text default 'virtual',
  p_motivo text default null,
  p_caso_id uuid default null,
  p_provincia_id uuid default null,
  p_origen text default 'panel',
  p_pago_id uuid default null,
  p_confirmar_inmediato boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente uuid := auth.uid();
  v_materia_id uuid := p_materia_id;
  v_materia_defecto_nombre text := 'Civil';
  v_permitir_sin_prof boolean := true;
  v_direccion_defecto text;
  v_dur int;
  v_fin timestamptz;
  v_candidatos uuid[];
  v_prof uuid;
  v_abogado uuid;
  v_suscripcion uuid;
  v_derecho uuid;
  v_cobertura text := 'pendiente';
  v_estado_cita text := 'propuesta';
  v_confirmada_en timestamptz := null;
  v_asignacion text := 'turno';
  v_reserva uuid := null;
  v_cita uuid;
  v_concepto text;
begin
  if v_cliente is null then
    raise exception 'Sesion no encontrada';
  end if;
  if p_inicio_en <= now() - interval '5 minutes' then
    raise exception 'Esa fecha ya paso. Elige un horario futuro.';
  end if;

  -- Cargar configuración operativa de Tranqi
  select
    coalesce(cgn_permitir_sin_profesional, true),
    coalesce(cgn_detalle_config->>'materia_defecto_nombre', 'Civil'),
    cgn_direccion_presencial,
    cgn_duracion_cita_min
  into
    v_permitir_sin_prof,
    v_materia_defecto_nombre,
    v_direccion_defecto,
    v_dur
  from comun_agenda.age_config_negocio
  where cgn_negocio = 'tranqi'
    and cgn_eliminado_en is null;

  -- Si la materia no existe o vino nula, asignar la especialidad por defecto
  if v_materia_id is null or not exists (
    select 1 from tranqui_legal.trq_materia where mat_id = v_materia_id and mat_activa = true
  ) then
    select mat_id into v_materia_id
    from tranqui_legal.trq_materia
    where mat_activa = true
      and lower(mat_nombre) = lower(coalesce(v_materia_defecto_nombre, 'Civil'))
    limit 1;

    if v_materia_id is null then
      select mat_id into v_materia_id
      from tranqui_legal.trq_materia
      where mat_activa = true
      order by mat_nombre
      limit 1;
    end if;
  end if;

  select coalesce((v.var_detalle_variante->>'duracion_min')::int, v_dur, 45),
         coalesce(v.var_detalle_variante->>'concepto_derecho', 'CONSULTA_TELEMATICA')
    into v_dur, v_concepto
  from comun_comercio.com_variante v
  where v.var_id = p_variante_id;

  v_dur := coalesce(v_dur, 45);
  v_concepto := coalesce(v_concepto, 'CONSULTA_TELEMATICA');
  v_fin := p_inicio_en + make_interval(mins => v_dur);

  -- 1. Intentar asignar abogado disponible en ese horario por turno rotativo
  v_candidatos := tranqui_legal.trq_fn_candidatos_materia(v_materia_id, p_provincia_id);
  if array_length(v_candidatos, 1) is not null then
    v_prof := comun_agenda.age_fn_siguiente_en_turno(v_candidatos, p_inicio_en, v_fin, p_modalidad);
  end if;

  if v_prof is not null then
    select a.abg_id into v_abogado
    from tranqui_legal.trq_abogado a
    join comun_agenda.age_profesional p on p.agp_usuario_id = a.abg_usuario_id
    where p.agp_id = v_prof and a.abg_estado = 'verificado';
    v_asignacion := 'turno';
  else
    -- Si no hay abogado disponible en ese horario pero el negocio permite agendar
    -- bajo el horario operativo por defecto, se agenda igual y pasa a la bandeja
    -- de asignaciones del operador (contingencia) para cruzar luego con abogados.
    if not coalesce(v_permitir_sin_prof, true) then
      raise exception 'No hay abogados con agenda disponible en ese horario. Prueba con otro horario.';
    end if;
    v_abogado := null;
    v_asignacion := 'contingencia';
  end if;

  -- 2. Resolver cobertura y pago
  if p_pago_id is not null then
    v_cobertura := 'pagada';
    v_estado_cita := 'confirmada';
    v_confirmada_en := now();
  else
    select s.sub_id into v_suscripcion
    from comun_comercio.com_suscripcion s
    where s.sub_cliente_id = v_cliente
      and s.sub_negocio = 'tranqi'
      and s.sub_estado = 'ACTIVA'
      and s.sub_eliminado_en is null
    order by s.sub_creado_en desc
    limit 1;

    if v_suscripcion is not null then
      v_derecho := comun_comercio.com_fn_consumir_derecho(v_suscripcion, v_concepto, null);
      if v_derecho is not null then
        v_cobertura := 'plan';
        v_estado_cita := 'confirmada';
        v_confirmada_en := now();
      end if;
    end if;

    if v_cobertura = 'pendiente' and p_confirmar_inmediato then
      v_cobertura := case when p_variante_id is null then 'cortesia' else 'pagada' end;
      v_estado_cita := 'confirmada';
      v_confirmada_en := now();
    elsif v_cobertura = 'pendiente' and p_variante_id is null then
      v_cobertura := 'cortesia';
      v_estado_cita := 'confirmada';
      v_confirmada_en := now();
    end if;
  end if;

  -- 3. Si hubo profesional disponible en turno, registrar ocupación en age_reserva
  if v_prof is not null then
    insert into comun_agenda.age_reserva (
      res_profesional_id, res_negocio, res_cliente_id, res_variante_id,
      res_inicio_en, res_fin_en, res_estado, res_modalidad,
      res_referencia_tabla)
    values (
      v_prof, 'tranqi', v_cliente, p_variante_id,
      p_inicio_en, v_fin, v_estado_cita, p_modalidad,
      'tranqui_legal.trq_cita')
    returning res_id into v_reserva;
  end if;

  -- 4. Insertar la cita en tranqui_legal.trq_cita
  insert into tranqui_legal.trq_cita (
    cit_caso_id, cit_cliente_id, cit_abogado_id, cit_materia_id,
    cit_inicio_en, cit_fin_en, cit_modalidad, cit_estado, cit_motivo,
    cit_lugar, cit_reserva_id, cit_variante_id, cit_origen, cit_asignacion,
    cit_cobertura, cit_pago_id, cit_derecho_id, cit_confirmada_en)
  values (
    p_caso_id, v_cliente, v_abogado, v_materia_id,
    p_inicio_en, v_fin, p_modalidad, v_estado_cita, p_motivo,
    case when p_modalidad = 'presencial' then v_direccion_defecto else null end,
    v_reserva, p_variante_id, p_origen, v_asignacion,
    v_cobertura, p_pago_id, v_derecho, v_confirmada_en)
  returning cit_id into v_cita;

  if v_reserva is not null then
    update comun_agenda.age_reserva
       set res_referencia_id = v_cita, res_actualizado_en = now()
     where res_id = v_reserva;
  end if;

  return v_cita;
end;
$$;

grant execute on function tranqui_legal.trq_fn_reservar_cita(uuid, timestamptz, uuid, text, text, uuid, uuid, text, uuid, boolean) to authenticated;

-- ------------------------------------------------------------------------------
-- 6. RPC PARA CONFIRMAR EL PAGO DE UNA CITA EXISTENTE
-- ------------------------------------------------------------------------------

create or replace function tranqui_legal.trq_fn_confirmar_pago_cita(
  p_cita_id uuid,
  p_pago_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c tranqui_legal.trq_cita;
  v_es_staff boolean := comun_seguridad.seg_fn_es_operador_o_admin_negocio('tranqi');
begin
  select * into c
  from tranqui_legal.trq_cita
  where cit_id = p_cita_id and cit_eliminado_en is null;

  if not found then
    raise exception 'La cita no existe';
  end if;

  if c.cit_cliente_id <> auth.uid() and not v_es_staff then
    raise exception 'No tienes permiso para confirmar el pago de esta cita';
  end if;

  update tranqui_legal.trq_cita
     set cit_cobertura = 'pagada',
         cit_pago_id = coalesce(p_pago_id, cit_pago_id),
         cit_estado = 'confirmada',
         cit_confirmada_en = coalesce(cit_confirmada_en, now()),
         cit_actualizado_en = now()
   where cit_id = p_cita_id;

  if c.cit_reserva_id is not null then
    update comun_agenda.age_reserva
       set res_estado = 'confirmada',
           res_actualizado_en = now()
     where res_id = c.cit_reserva_id;
  end if;

  return p_cita_id;
end;
$$;

grant execute on function tranqui_legal.trq_fn_confirmar_pago_cita(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 7. REGISTRO DEL WIDGET DE HORARIOS DE ATENCIÓN POR DEFECTO (REGLA 15)
-- ------------------------------------------------------------------------------

insert into comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget)
values
  ('tranqi',     'horarios_atencion_agenda', 'Horarios de Atención (Telemático y Presencial)', true, '{"descripcion": "Configuración operativa de horarios por defecto para consultas telemáticas y presenciales, y especialidad por defecto de ARIA", "categoria": "Agendamiento & Operación", "ruta": "/panel/agendamiento?widget=horarios_atencion_agenda", "panel_defecto": "panel_agendamiento", "icono": "CalendarClock"}'::jsonb),
  ('fastfix',    'horarios_atencion_agenda', 'Horarios de Atención (Telemático y Presencial)', true, '{"descripcion": "Configuración operativa de horarios por defecto de atención", "categoria": "Agendamiento & Operación", "ruta": "/panel/agendamiento?widget=horarios_atencion_agenda", "panel_defecto": "panel_agendamiento", "icono": "CalendarClock"}'::jsonb),
  ('tinkay',     'horarios_atencion_agenda', 'Horarios de Atención (Telemático y Presencial)', true, '{"descripcion": "Configuración operativa de horarios por defecto de atención", "categoria": "Agendamiento & Operación", "ruta": "/panel/agendamiento?widget=horarios_atencion_agenda", "panel_defecto": "panel_agendamiento", "icono": "CalendarClock"}'::jsonb),
  ('margaritas', 'horarios_atencion_agenda', 'Horarios de Atención (Telemático y Presencial)', true, '{"descripcion": "Configuración operativa de horarios por defecto de atención", "categoria": "Agendamiento & Operación", "ruta": "/panel/agendamiento?widget=horarios_atencion_agenda", "panel_defecto": "panel_agendamiento", "icono": "CalendarClock"}'::jsonb)
on conflict (wdg_negocio, wdg_clave) do update set
  wdg_nombre = excluded.wdg_nombre,
  wdg_activo = true,
  wdg_detalle_widget = excluded.wdg_detalle_widget;

insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
select w.wdg_negocio, r.rol, w.wdg_id, true
from comun_seguridad.seg_widget w
cross join (values ('OPERADOR'), ('ADMINISTRADOR'), ('SUPERADMIN')) as r(rol)
where w.wdg_clave = 'horarios_atencion_agenda'
on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set rlw_visible = true;

