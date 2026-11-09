/*  */-- ==============================================================================
-- Migración: 20261108000002_disponibilidad_horarios_fechas_especiales_y_cupos.sql
-- Descripción:
--   1. Incorpora en comun_agenda.age_config_negocio:
--      - cgn_max_citas_simultaneas (int default 1): número máximo de citas en la
--        misma fecha y hora dentro del horario definido.
--      - cgn_fechas_especiales (jsonb default '[]'): horarios diferenciados por
--        fecha exacta (ej. Navidad 2026-12-25 solo teleconsultas de 08:00 a 16:00
--        y oficina cerrada, o feriados cerrados).
--   2. Actualiza age_fn_guardar_config_negocio para persistir horarios normales
--      (telemático y oficina), fechas exactas diferenciadas y cupo máximo por
--      fecha/hora.
--   3. Actualiza age_fn_huecos_negocio_defecto, trq_fn_horarios_materia y
--      trq_fn_reservar_cita para aplicar precedencia de fechas exactas y
--      controlar el cupo máximo de citas simultáneas por bloque horario.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. COLUMNAS ADITIVAS EN comun_agenda.age_config_negocio
-- ------------------------------------------------------------------------------

alter table comun_agenda.age_config_negocio
  add column if not exists cgn_max_citas_simultaneas int not null default 1
    check (cgn_max_citas_simultaneas between 1 and 50),
  add column if not exists cgn_fechas_especiales jsonb not null default '[]'::jsonb;

-- Sembrar ejemplo inicial de Navidad (2026-12-25: solo teleconsultas 08:00 a 16:00)
-- únicamente si el arreglo de fechas especiales está vacío en Tranqi
update comun_agenda.age_config_negocio
set
  cgn_max_citas_simultaneas = coalesce(cgn_max_citas_simultaneas, 1),
  cgn_fechas_especiales = case
    when jsonb_typeof(cgn_fechas_especiales) = 'array' and jsonb_array_length(cgn_fechas_especiales) > 0
      then cgn_fechas_especiales
    else '[
      {
        "fecha": "2026-12-25",
        "nombre": "Navidad (Horario Especial)",
        "cerrado_total": false,
        "habilitar_virtual": true,
        "franjas_virtual": [
          {"hora_inicio": "08:00", "hora_fin": "16:00"}
        ],
        "habilitar_presencial": false,
        "franjas_presencial": [],
        "max_citas_simultaneas": 1
      }
    ]'::jsonb
  end,
  cgn_actualizado_en = now()
where cgn_negocio = 'tranqi';

-- ------------------------------------------------------------------------------
-- 2. RPC PARA GUARDAR CONFIGURACIÓN DE HORARIOS, FECHAS ESPECIALES Y CUPOS
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
  v_max_citas int;
  v_fechas_especiales jsonb;
  v_detalle_entrante jsonb;
begin
  if auth.uid() is not null and not comun_seguridad.seg_fn_es_operador_o_admin_negocio(p_negocio) then
    raise exception 'Solo un operador o administrador de % puede configurar los horarios de atención', p_negocio;
  end if;

  v_max_citas := greatest(1, least(50, coalesce((p_config->>'max_citas_simultaneas')::int, 1)));
  v_fechas_especiales := coalesce(p_config->'fechas_especiales', '[]'::jsonb);
  v_detalle_entrante := coalesce(p_config->'detalle_config', p_config->'detalle', '{}'::jsonb)
    || jsonb_build_object(
      'materia_defecto_nombre', coalesce(
        p_config->'detalle_config'->>'materia_defecto_nombre',
        p_config->'detalle'->>'materia_defecto_nombre',
        p_config->>'materia_defecto_nombre',
        'Civil'
      ),
      'max_citas_simultaneas', v_max_citas,
      'modo_capacidad', coalesce(p_config->>'modo_capacidad', 'fijo_negocio'),
      'fechas_especiales', v_fechas_especiales
    );

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
    cgn_max_citas_simultaneas,
    cgn_fechas_especiales,
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
    v_max_citas,
    v_fechas_especiales,
    v_detalle_entrante,
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
    cgn_max_citas_simultaneas    = excluded.cgn_max_citas_simultaneas,
    cgn_fechas_especiales        = excluded.cgn_fechas_especiales,
    cgn_detalle_config           = coalesce(c.cgn_detalle_config, '{}'::jsonb) || excluded.cgn_detalle_config,
    cgn_actualizado_en           = now(),
    cgn_eliminado_en             = null
  returning c.cgn_id into v_id;

  return v_id;
end;
$$;

grant execute on function comun_agenda.age_fn_guardar_config_negocio(text, jsonb) to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. GENERADOR DE HUECOS CON SOPORTE DE FECHAS EXACTAS Y CUPO POR FECHA/HORA
-- ------------------------------------------------------------------------------

create or replace function comun_agenda.age_fn_huecos_negocio_defecto(
  p_negocio text,
  p_desde timestamptz,
  p_hasta timestamptz,
  p_duracion_min int default null,
  p_modalidad text default 'virtual',
  p_limite int default 120
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
  v_max_defecto int;
  v_desde timestamptz;
  v_hasta timestamptz;
  v_franjas_semanales jsonb;
  v_fechas_esp jsonb;
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
    c.cgn_max_citas_simultaneas := 1;
    c.cgn_fechas_especiales := '[]'::jsonb;
    c.cgn_franjas_virtual := '[
      {"dia_semana": 1, "hora_inicio": "08:00", "hora_fin": "19:00"},
      {"dia_semana": 2, "hora_inicio": "08:00", "hora_fin": "19:00"},
      {"dia_semana": 3, "hora_inicio": "08:00", "hora_fin": "19:00"},
      {"dia_semana": 4, "hora_inicio": "08:00", "hora_fin": "19:00"},
      {"dia_semana": 5, "hora_inicio": "08:00", "hora_fin": "19:00"},
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

  v_dur         := coalesce(p_duracion_min, c.cgn_duracion_cita_min, 45);
  v_holgura     := coalesce(c.cgn_holgura_min, 15);
  v_max_defecto := greatest(1, coalesce(c.cgn_max_citas_simultaneas, (c.cgn_detalle_config->>'max_citas_simultaneas')::int, 1));
  v_fechas_esp  := coalesce(c.cgn_fechas_especiales, c.cgn_detalle_config->'fechas_especiales', '[]'::jsonb);
  v_desde       := greatest(p_desde, now() + make_interval(hours => coalesce(c.cgn_antelacion_minima_horas, 2)));
  v_hasta       := least(p_hasta,  now() + make_interval(days  => coalesce(c.cgn_horizonte_dias, 45)));

  if v_hasta <= v_desde then
    return;
  end if;

  if p_modalidad = 'presencial' then
    v_franjas_semanales := c.cgn_franjas_presencial;
  else
    v_franjas_semanales := c.cgn_franjas_virtual;
  end if;

  return query
  with dias as (
    select
      d::date as dia,
      to_char(d::date, 'YYYY-MM-DD') as fecha_txt,
      extract(isodow from d::date)::smallint as iso_dow
    from generate_series(
      (v_desde at time zone c.cgn_zona_horaria)::date,
      (v_hasta at time zone c.cgn_zona_horaria)::date,
      interval '1 day'
    ) d
  ),
  dias_con_regla as (
    select
      dias.dia,
      dias.fecha_txt,
      dias.iso_dow,
      esp.regla as regla_especial
    from dias
    left join lateral (
      select e as regla
      from jsonb_array_elements(
        case when jsonb_typeof(v_fechas_esp) = 'array' then v_fechas_esp else '[]'::jsonb end
      ) e
      where (e->>'fecha') = dias.fecha_txt
      limit 1
    ) esp on true
  ),
  ventanas_dia as (
    -- Caso 1: Día normal (sin fecha especial configurada) -> usa horario laborable semanal por defecto
    select
      dcr.dia,
      (f->>'hora_inicio')::time as hora_inicio,
      (f->>'hora_fin')::time as hora_fin,
      v_max_defecto as max_cupo
    from dias_con_regla dcr
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(v_franjas_semanales) = 'array' then v_franjas_semanales else '[]'::jsonb end
    ) f
    where dcr.regla_especial is null
      and (f->>'dia_semana')::smallint = dcr.iso_dow
      and (f->>'hora_fin')::time > (f->>'hora_inicio')::time

    union all

    -- Caso 2: Día con Fecha Exacta Especial -> reemplaza al horario por defecto
    select
      dcr.dia,
      (fe->>'hora_inicio')::time as hora_inicio,
      (fe->>'hora_fin')::time as hora_fin,
      greatest(1, coalesce((dcr.regla_especial->>'max_citas_simultaneas')::int, v_max_defecto)) as max_cupo
    from dias_con_regla dcr
    cross join lateral jsonb_array_elements(
      case
        when coalesce((dcr.regla_especial->>'cerrado_total')::boolean, false) then '[]'::jsonb
        when p_modalidad = 'presencial' then
          case
            when coalesce((dcr.regla_especial->>'habilitar_presencial')::boolean, false)
              and jsonb_typeof(dcr.regla_especial->'franjas_presencial') = 'array'
            then dcr.regla_especial->'franjas_presencial'
            else '[]'::jsonb
          end
        else
          case
            when coalesce((dcr.regla_especial->>'habilitar_virtual')::boolean, true)
              and jsonb_typeof(dcr.regla_especial->'franjas_virtual') = 'array'
            then dcr.regla_especial->'franjas_virtual'
            else '[]'::jsonb
          end
      end
    ) fe
    where dcr.regla_especial is not null
      and (fe->>'hora_fin')::time > (fe->>'hora_inicio')::time
  ),
  ventanas_tz as (
    select
      ((vd.dia + vd.hora_inicio) at time zone c.cgn_zona_horaria) as ini,
      ((vd.dia + vd.hora_fin)    at time zone c.cgn_zona_horaria) as fin,
      vd.max_cupo
    from ventanas_dia vd
  ),
  slots as (
    select
      s as ini,
      s + make_interval(mins => v_dur) as fin,
      v.max_cupo
    from ventanas_tz v
    cross join lateral generate_series(
      v.ini,
      v.fin - make_interval(mins => v_dur),
      make_interval(mins => v_dur + v_holgura)
    ) s
  ),
  slots_con_ocupacion as (
    select
      slots.ini as hueco_inicio,
      slots.fin as hueco_fin,
      greatest(
        0,
        slots.max_cupo - coalesce((
          select count(*)::int
          from tranqui_legal.trq_cita ct
          where ct.cit_eliminado_en is null
            and ct.cit_estado <> 'cancelada'
            and tstzrange(
              ct.cit_inicio_en,
              coalesce(ct.cit_fin_en, ct.cit_inicio_en + make_interval(mins => v_dur)),
              '[)'
            ) && tstzrange(slots.ini, slots.fin, '[)')
        ), 0)
      )::int as disponibles
    from slots
    where slots.ini >= v_desde
      and slots.fin <= v_hasta
  )
  select
    sco.hueco_inicio,
    sco.hueco_fin,
    sco.disponibles
  from slots_con_ocupacion sco
  where sco.disponibles > 0
  order by sco.hueco_inicio
  limit greatest(p_limite, 1);
end;
$$;

grant execute on function comun_agenda.age_fn_huecos_negocio_defecto(text, timestamptz, timestamptz, int, text, int) to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. ACTUALIZACIÓN DE trq_fn_horarios_materia Y trq_fn_reservar_cita
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
  v_modo_capacidad text := 'fijo_negocio';
  v_zona_horaria text := 'America/Guayaquil';
  v_fechas_esp jsonb := '[]'::jsonb;
  v_candidatos uuid[];
begin
  select (v.var_detalle_variante->>'duracion_min')::int
    into v_dur
  from comun_comercio.com_variante v
  where v.var_id = p_variante_id;

  select
    coalesce(cgn_permitir_sin_profesional, true),
    coalesce(cgn_detalle_config->>'modo_capacidad', 'fijo_negocio'),
    coalesce(cgn_zona_horaria, 'America/Guayaquil'),
    coalesce(cgn_fechas_especiales, cgn_detalle_config->'fechas_especiales', '[]'::jsonb)
  into
    v_permitir_sin_prof,
    v_modo_capacidad,
    v_zona_horaria,
    v_fechas_esp
  from comun_agenda.age_config_negocio
  where cgn_negocio = 'tranqi'
    and cgn_eliminado_en is null;

  v_candidatos := tranqui_legal.trq_fn_candidatos_materia(p_materia_id, p_provincia_id);

  -- Si el modo es 'fijo_negocio' (o mientras se opera con el horario y cupo base de Tranqi),
  -- el horario aplicable y el máximo de citas por fecha/hora los rige age_fn_huecos_negocio_defecto
  if coalesce(v_permitir_sin_prof, true) and v_modo_capacidad = 'fijo_negocio' then
    return query
    select d.hueco_inicio, d.hueco_fin, d.disponibles
    from comun_agenda.age_fn_huecos_negocio_defecto(
      'tranqi',
      p_desde,
      p_hasta,
      v_dur,
      coalesce(p_modalidad, 'virtual'),
      120
    ) d;
  elsif coalesce(v_permitir_sin_prof, true) then
    -- Modo híbrido: une horarios por defecto del negocio + pool de abogados,
    -- respetando cierres de fechas especiales
    return query
    with pool_abogados as (
      select h.hueco_inicio, h.hueco_fin, h.disponibles
      from comun_agenda.age_fn_huecos_del_pool(
        v_candidatos,
        p_desde,
        p_hasta,
        v_dur,
        p_modalidad,
        120
      ) h
      where not exists (
        select 1
        from jsonb_array_elements(
          case when jsonb_typeof(v_fechas_esp) = 'array' then v_fechas_esp else '[]'::jsonb end
        ) fe
        where (fe->>'fecha') = to_char((h.hueco_inicio at time zone v_zona_horaria)::date, 'YYYY-MM-DD')
      )
    ),
    horarios_defecto as (
      select d.hueco_inicio, d.hueco_fin, d.disponibles
      from comun_agenda.age_fn_huecos_negocio_defecto(
        'tranqi',
        p_desde,
        p_hasta,
        v_dur,
        coalesce(p_modalidad, 'virtual'),
        120
      ) d
    ),
    combinados as (
      select * from pool_abogados
      union all
      select hd.* from horarios_defecto hd
    )
    select c.hueco_inicio, c.hueco_fin, max(c.disponibles)::int as disponibles
    from combinados c
    group by c.hueco_inicio, c.hueco_fin
    order by c.hueco_inicio
    limit 120;
  else
    return query
    select h.hueco_inicio, h.hueco_fin, h.disponibles
    from comun_agenda.age_fn_huecos_del_pool(
      v_candidatos,
      p_desde,
      p_hasta,
      v_dur,
      p_modalidad,
      120
    ) h;
  end if;
end;
$$;

grant execute on function tranqui_legal.trq_fn_horarios_materia(uuid, timestamptz, timestamptz, uuid, text, uuid) to anon, authenticated, service_role;

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
  v_zona_horaria text := 'America/Guayaquil';
  v_max_citas int := 1;
  v_fechas_esp jsonb := '[]'::jsonb;
  v_fecha_cita_txt text;
  v_regla_fecha jsonb;
  v_citas_ocupadas int := 0;
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
    cgn_duracion_cita_min,
    coalesce(cgn_zona_horaria, 'America/Guayaquil'),
    greatest(1, coalesce(cgn_max_citas_simultaneas, (cgn_detalle_config->>'max_citas_simultaneas')::int, 1)),
    coalesce(cgn_fechas_especiales, cgn_detalle_config->'fechas_especiales', '[]'::jsonb)
  into
    v_permitir_sin_prof,
    v_materia_defecto_nombre,
    v_direccion_defecto,
    v_dur,
    v_zona_horaria,
    v_max_citas,
    v_fechas_esp
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

  -- Verificar si la fecha exacta tiene una regla especial (ej. Navidad)
  v_fecha_cita_txt := to_char((p_inicio_en at time zone v_zona_horaria)::date, 'YYYY-MM-DD');
  if jsonb_typeof(v_fechas_esp) = 'array' then
    select e into v_regla_fecha
    from jsonb_array_elements(v_fechas_esp) e
    where (e->>'fecha') = v_fecha_cita_txt
    limit 1;
  end if;

  if v_regla_fecha is not null then
    if coalesce((v_regla_fecha->>'cerrado_total')::boolean, false) then
      raise exception 'No hay atención habilitada en la fecha seleccionada (%).', coalesce(v_regla_fecha->>'nombre', v_fecha_cita_txt);
    end if;
    if p_modalidad = 'presencial' and not coalesce((v_regla_fecha->>'habilitar_presencial')::boolean, false) then
      raise exception 'En esta fecha (%) solo está habilitada la atención por teleconsulta.', coalesce(v_regla_fecha->>'nombre', v_fecha_cita_txt);
    end if;
    if p_modalidad = 'virtual' and not coalesce((v_regla_fecha->>'habilitar_virtual')::boolean, true) then
      raise exception 'En esta fecha (%) no está habilitada la modalidad telemática.', coalesce(v_regla_fecha->>'nombre', v_fecha_cita_txt);
    end if;
    v_max_citas := greatest(1, coalesce((v_regla_fecha->>'max_citas_simultaneas')::int, v_max_citas));
  end if;

  -- Validar el número máximo de citas permitidas en la misma fecha/hora
  select count(*)::int into v_citas_ocupadas
  from tranqui_legal.trq_cita ct
  where ct.cit_eliminado_en is null
    and ct.cit_estado <> 'cancelada'
    and tstzrange(
      ct.cit_inicio_en,
      coalesce(ct.cit_fin_en, ct.cit_inicio_en + make_interval(mins => v_dur)),
      '[)'
    ) && tstzrange(p_inicio_en, v_fin, '[)');

  if v_citas_ocupadas >= v_max_citas then
    raise exception 'El cupo máximo de citas (%) para esta fecha y hora ya fue reservado. Por favor selecciona otro horario.', v_max_citas;
  end if;

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

grant execute on function tranqui_legal.trq_fn_reservar_cita(uuid, timestamptz, uuid, text, text, uuid, uuid, text, uuid, boolean) to anon, authenticated, service_role;
