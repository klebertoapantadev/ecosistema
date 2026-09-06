-- ==============================================================================
-- Migración: 20260905000004_comun_agenda.sql
-- Módulo: Agenda, Disponibilidad y Citas de Profesionales.
-- Implementa: PLT-020. Sustenta el widget "Citas Programadas" del Panel
--             Profesional (PLT-011 regla 8) y se concreta en TRQ-ABG-004.
-- ==============================================================================
--
-- Esquema transversal, no de Tranqi. El mismo motor sirve al abogado
-- (trq_abogado) y al tecnico de FastFix (ffh_tecnico): PLT-011 regla 8 los
-- trata como el mismo rol SOCIO/PROFESIONAL y les promete el mismo widget.
--
-- La division sigue el criterio de ADR-0003, el mismo que separa el catalogo
-- comun del pedido de cada negocio:
--   comun_agenda  -> QUIEN esta ocupado y CUANDO (age_reserva).
--   el negocio    -> QUE pasa en ese encuentro (trq_cita: motivo, caso, dictamen).
-- trq_cita no se mueve: tiene datos, RLS, auditoria y dos herramientas MCP
-- encima, y las apps Capacitor la consultan directo (marco-de-trabajo.md §5).
--
-- Tampoco hay catalogo propio de tipos de cita: lo agendable es una variante de
-- comun_comercio, de donde salen duracion, precio e impuestos.

create schema if not exists comun_agenda;

-- ------------------------------------------------------------------------------
-- 1. PROFESIONAL AGENDABLE
-- ------------------------------------------------------------------------------

create table comun_agenda.age_profesional (
  agp_id uuid primary key default gen_random_uuid(),
  agp_secuencial bigint generated always as identity,
  agp_usuario_id uuid not null references comun_seguridad.seg_usuario(usu_id) on delete cascade,
  agp_negocio text not null,                -- 'tranqi' | 'fastfix' | 'tinkay' | 'margaritas'

  -- IANA, no un offset fijo. El helper diaEcuador() de las herramientas del
  -- asistente clava '-05:00' a mano y su propio comentario admite que deja
  -- Galapagos (UTC-6) fuera. Para "como viene mi dia" pasa; para reservar
  -- huecos que otra persona ocupa, no.
  agp_zona_horaria text not null default 'America/Guayaquil',

  agp_duracion_cita_min int not null default 45 check (agp_duracion_cita_min between 15 and 240),
  agp_holgura_min int not null default 15 check (agp_holgura_min between 0 and 120),
  agp_antelacion_minima_horas int not null default 24 check (agp_antelacion_minima_horas between 0 and 720),
  agp_horizonte_dias int not null default 60 check (agp_horizonte_dias between 1 and 365),
  agp_modalidades text[] not null default '{virtual,presencial}',

  -- Turno rotativo (PLT-020 regla 4). Se ordena por la fecha del ultimo turno
  -- recibido: reparto determinista y auditable, no aleatorio.
  agp_acepta_turno boolean not null default true,
  agp_ultimo_turno_en timestamptz,

  agp_direccion text,                       -- para citas presenciales

  -- Google Calendar / Meet (PLT-020 regla 7). Aqui va SOLO la referencia a la
  -- credencial en Supabase Vault, nunca el refresh token: ese token da acceso
  -- al calendario entero del profesional.
  agp_google_calendar_id text,
  agp_google_credencial_ref text,

  -- null = onboarding pendiente. Un profesional sin agenda configurada no
  -- aparece disponible ni recibe turnos: se falla cerrado.
  agp_configurada_en timestamptz,

  agp_detalle_profesional jsonb not null default '{}'::jsonb,
  agp_creado_en timestamptz not null default now(),
  agp_actualizado_en timestamptz not null default now(),
  agp_eliminado_en timestamptz,
  unique (agp_usuario_id, agp_negocio)
);

create index idx_age_profesional_negocio on comun_agenda.age_profesional (agp_negocio)
  where agp_eliminado_en is null and agp_configurada_en is not null;
-- Orden del turno rotativo: nulls first para que quien nunca recibio uno entre primero.
create index idx_age_profesional_turno on comun_agenda.age_profesional (agp_negocio, agp_ultimo_turno_en nulls first)
  where agp_eliminado_en is null and agp_acepta_turno;

-- ------------------------------------------------------------------------------
-- 2. HORAS OPERATIVAS Y EXCEPCIONES
-- ------------------------------------------------------------------------------

-- Franja recurrente. Se guarda en hora LOCAL del despacho, no como instante:
-- "los martes de 09:00 a 13:00" es una regla que debe sobrevivir a cualquier
-- cambio de huso. La conversion a timestamptz ocurre al calcular huecos.
create table comun_agenda.age_franja (
  fra_id uuid primary key default gen_random_uuid(),
  fra_secuencial bigint generated always as identity,
  fra_profesional_id uuid not null references comun_agenda.age_profesional(agp_id) on delete cascade,
  fra_dia_semana smallint not null check (fra_dia_semana between 0 and 6),  -- 0 = domingo, como extract(dow)
  fra_hora_inicio time not null,
  fra_hora_fin time not null,
  fra_modalidad text not null default 'ambas' check (fra_modalidad in ('virtual','presencial','ambas')),
  fra_creado_en timestamptz not null default now(),
  fra_actualizado_en timestamptz not null default now(),
  fra_eliminado_en timestamptz,
  constraint age_franja_rango_valido check (fra_hora_fin > fra_hora_inicio)
);

create index idx_age_franja_profesional on comun_agenda.age_franja (fra_profesional_id, fra_dia_semana)
  where fra_eliminado_en is null;

create table comun_agenda.age_bloqueo (
  blq_id uuid primary key default gen_random_uuid(),
  blq_secuencial bigint generated always as identity,
  blq_profesional_id uuid not null references comun_agenda.age_profesional(agp_id) on delete cascade,
  blq_inicio_en timestamptz not null,
  blq_fin_en timestamptz not null,
  blq_motivo text,
  blq_origen text not null default 'manual' check (blq_origen in ('manual','audiencia','google_calendar')),
  -- Id del evento externo, para que una re-sincronizacion no duplique bloqueos.
  blq_origen_externo_id text,
  blq_creado_en timestamptz not null default now(),
  blq_actualizado_en timestamptz not null default now(),
  blq_eliminado_en timestamptz,
  constraint age_bloqueo_rango_valido check (blq_fin_en > blq_inicio_en)
);

create index idx_age_bloqueo_profesional on comun_agenda.age_bloqueo (blq_profesional_id, blq_inicio_en)
  where blq_eliminado_en is null;
create unique index idx_age_bloqueo_externo on comun_agenda.age_bloqueo (blq_profesional_id, blq_origen_externo_id)
  where blq_origen_externo_id is not null and blq_eliminado_en is null;

-- ------------------------------------------------------------------------------
-- 3. RESERVA: LA OCUPACION, Y DONDE VIVE EL ANTI-SOLAPE
-- ------------------------------------------------------------------------------

create table comun_agenda.age_reserva (
  res_id uuid primary key default gen_random_uuid(),
  res_secuencial bigint generated always as identity,
  res_profesional_id uuid not null references comun_agenda.age_profesional(agp_id) on delete restrict,

  -- Desnormalizado a proposito, y lo rellena un trigger. El anti-solape tiene
  -- que ser por PERSONA, no por registro de profesional: quien sea abogado en
  -- Tranqi y tecnico en FastFix tiene dos filas en age_profesional pero una
  -- sola linea temporal (PLT-020 regla 10). Con el EXCLUDE sobre agp_id podria
  -- estar en dos sitios a la vez.
  res_usuario_id uuid not null references comun_seguridad.seg_usuario(usu_id) on delete restrict,

  res_negocio text not null,
  res_cliente_id uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  -- De la variante salen duracion, precio e impuestos. Nullable: un bloqueo
  -- operativo o una cita de cortesia no tienen SKU.
  res_variante_id uuid references comun_comercio.com_variante(var_id) on delete set null,

  res_inicio_en timestamptz not null,
  -- NOT NULL desde el principio y no por gusto: EXCLUDE USING gist solo admite
  -- expresiones IMMUTABLE, y `res_inicio_en + interval '45 min'` no lo es
  -- (timestamptz_pl_interval es STABLE). Con la columna persistida, el rango
  -- es inmutable y Postgres acepta la restriccion.
  res_fin_en timestamptz not null,

  res_estado text not null default 'propuesta'
    check (res_estado in ('propuesta','confirmada','cancelada','realizada','no_asistio')),
  res_modalidad text not null default 'virtual' check (res_modalidad in ('presencial','virtual')),

  -- A que fila del negocio corresponde este encuentro. Sin FK: apunta a tablas
  -- de esquemas distintos segun el negocio (tranqui_legal.trq_cita hoy).
  res_referencia_tabla text,
  res_referencia_id uuid,

  res_detalle_reserva jsonb not null default '{}'::jsonb,
  res_creado_en timestamptz not null default now(),
  res_actualizado_en timestamptz not null default now(),
  res_eliminado_en timestamptz,
  constraint age_reserva_rango_valido check (res_fin_en > res_inicio_en)
);

create index idx_age_reserva_profesional on comun_agenda.age_reserva (res_profesional_id, res_inicio_en)
  where res_eliminado_en is null;
create index idx_age_reserva_cliente on comun_agenda.age_reserva (res_cliente_id, res_inicio_en)
  where res_eliminado_en is null;
create index idx_age_reserva_referencia on comun_agenda.age_reserva (res_referencia_tabla, res_referencia_id);

-- El usuario de la reserva se deriva del profesional, nunca se pasa a mano.
create or replace function comun_agenda.age_fn_derivar_usuario_reserva()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select agp_usuario_id into new.res_usuario_id
  from comun_agenda.age_profesional
  where agp_id = new.res_profesional_id;
  if new.res_usuario_id is null then
    raise exception 'El profesional % no existe', new.res_profesional_id;
  end if;
  new.res_actualizado_en := now();
  return new;
end;
$$;

create trigger trg_age_reserva_usuario before insert or update of res_profesional_id
  on comun_agenda.age_reserva
  for each row execute function comun_agenda.age_fn_derivar_usuario_reserva();

-- LA garantia. No una comprobacion mas: la unica que no se salta ni una race
-- condition entre dos clientes pidiendo el mismo hueco, ni un UPDATE mal
-- escrito. Lo que valide la aplicacion es comodidad de interfaz.
create extension if not exists btree_gist;

alter table comun_agenda.age_reserva add constraint age_reserva_sin_solape
  exclude using gist (
    res_usuario_id with =,
    tstzrange(res_inicio_en, res_fin_en) with &&
  ) where (res_eliminado_en is null and res_estado in ('propuesta','confirmada'));

-- ------------------------------------------------------------------------------
-- 4. MOTOR DE HUECOS
-- ------------------------------------------------------------------------------

-- Devuelve SOLO huecos libres. Nunca el detalle de lo ocupado: la agenda de un
-- profesional es dato de un tercero, y "ocupado de 10 a 11 con el caso X" no le
-- incumbe a quien busca cita (PLT-020 regla 6). Por eso es security definer:
-- el cliente no tiene -- ni debe tener -- select sobre age_reserva ajena.
create or replace function comun_agenda.age_fn_huecos_disponibles(
  p_profesional_id uuid,
  p_desde timestamptz,
  p_hasta timestamptz,
  p_duracion_min int default null,
  p_modalidad text default null
)
returns table (hueco_inicio timestamptz, hueco_fin timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a comun_agenda.age_profesional;
  v_dur int;
  v_holgura interval;
  v_desde timestamptz;
  v_hasta timestamptz;
begin
  select * into a
  from comun_agenda.age_profesional
  where agp_id = p_profesional_id
    and agp_eliminado_en is null
    and agp_configurada_en is not null;   -- sin configurar, no hay disponibilidad
  if not found then
    return;
  end if;

  v_dur     := coalesce(p_duracion_min, a.agp_duracion_cita_min);
  v_holgura := make_interval(mins => a.agp_holgura_min);
  v_desde   := greatest(p_desde, now() + make_interval(hours => a.agp_antelacion_minima_horas));
  v_hasta   := least(p_hasta,  now() + make_interval(days  => a.agp_horizonte_dias));
  if v_hasta <= v_desde then
    return;
  end if;

  return query
  with dias as (
    select d::date as dia
    from generate_series(
      (v_desde at time zone a.agp_zona_horaria)::date,
      (v_hasta at time zone a.agp_zona_horaria)::date,
      interval '1 day') d
  ),
  ventanas as (
    -- (fecha + hora local) at time zone IANA -> instante real, respetando el
    -- desplazamiento vigente ese dia concreto.
    select
      ((dias.dia + f.fra_hora_inicio) at time zone a.agp_zona_horaria) as ini,
      ((dias.dia + f.fra_hora_fin)    at time zone a.agp_zona_horaria) as fin
    from dias
    join comun_agenda.age_franja f
      on f.fra_profesional_id = a.agp_id
     and f.fra_eliminado_en is null
     and f.fra_dia_semana = extract(dow from dias.dia)::smallint
     and (p_modalidad is null or f.fra_modalidad = 'ambas' or f.fra_modalidad = p_modalidad)
  ),
  slots as (
    select s as ini, s + make_interval(mins => v_dur) as fin
    from ventanas v
    cross join lateral generate_series(
      v.ini,
      v.fin - make_interval(mins => v_dur),
      make_interval(mins => v_dur + a.agp_holgura_min)) s
  )
  select slots.ini, slots.fin
  from slots
  where slots.ini >= v_desde
    and slots.fin <= v_hasta
    and not exists (
      select 1 from comun_agenda.age_reserva r
      where r.res_usuario_id = a.agp_usuario_id      -- por persona, no por registro
        and r.res_eliminado_en is null
        and r.res_estado in ('propuesta','confirmada')
        and tstzrange(r.res_inicio_en - v_holgura, r.res_fin_en + v_holgura)
            && tstzrange(slots.ini, slots.fin))
    and not exists (
      select 1 from comun_agenda.age_bloqueo b
      where b.blq_profesional_id = a.agp_id
        and b.blq_eliminado_en is null
        and tstzrange(b.blq_inicio_en, b.blq_fin_en) && tstzrange(slots.ini, slots.fin))
  order by slots.ini;
end;
$$;

-- Huecos agregados de un conjunto de profesionales, sin decir de quien es cada
-- uno. Es lo que ve el cliente cuando la asignacion es por turno rotativo: pide
-- materia y hora, no elige persona.
create or replace function comun_agenda.age_fn_huecos_del_pool(
  p_candidatos uuid[],
  p_desde timestamptz,
  p_hasta timestamptz,
  p_duracion_min int default null,
  p_modalidad text default null,
  p_limite int default 40
)
returns table (hueco_inicio timestamptz, hueco_fin timestamptz, disponibles int)
language sql
stable
security definer
set search_path = ''
as $$
  select h.hueco_inicio, h.hueco_fin, count(*)::int as disponibles
  from unnest(p_candidatos) as c(agp_id)
  cross join lateral comun_agenda.age_fn_huecos_disponibles(
    c.agp_id, p_desde, p_hasta, p_duracion_min, p_modalidad) h
  group by h.hueco_inicio, h.hueco_fin
  order by h.hueco_inicio
  limit greatest(p_limite, 1);
$$;

-- Turno rotativo: de los candidatos que tienen ese hueco libre, el que lleva
-- mas tiempo sin recibir turno. El UPDATE ... RETURNING marca el turno y
-- bloquea la fila en la misma sentencia, asi que dos reservas simultaneas no
-- eligen al mismo por leer antes de escribir.
create or replace function comun_agenda.age_fn_siguiente_en_turno(
  p_candidatos uuid[],
  p_inicio timestamptz,
  p_fin timestamptz,
  p_modalidad text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_dur int := (extract(epoch from (p_fin - p_inicio)) / 60)::int;
begin
  update comun_agenda.age_profesional p
     set agp_ultimo_turno_en = now(),
         agp_actualizado_en  = now()
   where p.agp_id = (
     select q.agp_id
     from comun_agenda.age_profesional q
     where q.agp_id = any(p_candidatos)
       and q.agp_eliminado_en is null
       and q.agp_configurada_en is not null
       and q.agp_acepta_turno
       and exists (
         select 1
         from comun_agenda.age_fn_huecos_disponibles(q.agp_id, p_inicio, p_fin, v_dur, p_modalidad) h
         where h.hueco_inicio = p_inicio)
     order by q.agp_ultimo_turno_en nulls first, q.agp_creado_en
     limit 1)
  returning p.agp_id into v_id;

  return v_id;   -- null = nadie del pool tiene ese hueco
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. CONFIGURACION DE LA AGENDA POR EL PROPIO PROFESIONAL
-- ------------------------------------------------------------------------------

-- Reemplaza configuracion y franjas en una sola transaccion. Es lo que llaman
-- tanto la pantalla de disponibilidad como la herramienta del asistente, para
-- que no haya dos caminos que puedan divergir.
create or replace function comun_agenda.age_fn_configurar_agenda(
  p_negocio text,
  p_config jsonb,
  p_franjas jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_id uuid;
  v_franja jsonb;
begin
  if v_usuario is null then
    raise exception 'Sesion no encontrada';
  end if;

  insert into comun_agenda.age_profesional as p (
    agp_usuario_id, agp_negocio, agp_zona_horaria, agp_duracion_cita_min,
    agp_holgura_min, agp_antelacion_minima_horas, agp_horizonte_dias,
    agp_modalidades, agp_acepta_turno, agp_direccion, agp_configurada_en)
  values (
    v_usuario,
    p_negocio,
    coalesce(p_config->>'zona_horaria', 'America/Guayaquil'),
    coalesce((p_config->>'duracion_cita_min')::int, 45),
    coalesce((p_config->>'holgura_min')::int, 15),
    coalesce((p_config->>'antelacion_minima_horas')::int, 24),
    coalesce((p_config->>'horizonte_dias')::int, 60),
    coalesce((select array_agg(value::text) from jsonb_array_elements_text(p_config->'modalidades')),
             '{virtual,presencial}'),
    coalesce((p_config->>'acepta_turno')::boolean, true),
    p_config->>'direccion',
    now())
  on conflict (agp_usuario_id, agp_negocio) do update set
    agp_zona_horaria            = excluded.agp_zona_horaria,
    agp_duracion_cita_min       = excluded.agp_duracion_cita_min,
    agp_holgura_min             = excluded.agp_holgura_min,
    agp_antelacion_minima_horas = excluded.agp_antelacion_minima_horas,
    agp_horizonte_dias          = excluded.agp_horizonte_dias,
    agp_modalidades             = excluded.agp_modalidades,
    agp_acepta_turno            = excluded.agp_acepta_turno,
    agp_direccion               = excluded.agp_direccion,
    agp_configurada_en          = coalesce(p.agp_configurada_en, now()),
    agp_eliminado_en            = null,
    agp_actualizado_en          = now()
  returning p.agp_id into v_id;

  -- Las franjas se reemplazan enteras: es mas simple de razonar que un
  -- diff, y el historial de lo anterior queda en aud_registro.
  update comun_agenda.age_franja
     set fra_eliminado_en = now(), fra_actualizado_en = now()
   where fra_profesional_id = v_id and fra_eliminado_en is null;

  for v_franja in select * from jsonb_array_elements(coalesce(p_franjas, '[]'::jsonb))
  loop
    insert into comun_agenda.age_franja (
      fra_profesional_id, fra_dia_semana, fra_hora_inicio, fra_hora_fin, fra_modalidad)
    values (
      v_id,
      (v_franja->>'dia_semana')::smallint,
      (v_franja->>'hora_inicio')::time,
      (v_franja->>'hora_fin')::time,
      coalesce(v_franja->>'modalidad', 'ambas'));
  end loop;

  return v_id;
end;
$$;

create or replace function comun_agenda.age_fn_bloquear(
  p_negocio text,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_motivo text default null,
  p_origen text default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prof uuid;
  v_id uuid;
begin
  select agp_id into v_prof
  from comun_agenda.age_profesional
  where agp_usuario_id = auth.uid() and agp_negocio = p_negocio and agp_eliminado_en is null;
  if v_prof is null then
    raise exception 'No tienes agenda configurada en %', p_negocio;
  end if;
  if p_fin <= p_inicio then
    raise exception 'El bloqueo termina antes de empezar';
  end if;

  insert into comun_agenda.age_bloqueo (blq_profesional_id, blq_inicio_en, blq_fin_en, blq_motivo, blq_origen)
  values (v_prof, p_inicio, p_fin, p_motivo, p_origen)
  returning blq_id into v_id;

  return v_id;
end;
$$;

-- ------------------------------------------------------------------------------
-- 6. RLS
-- ------------------------------------------------------------------------------
-- Los asistentes de IA consultan por PostgREST con un JWT de usuario acuñado,
-- sin service_role (ADR-0005 §4). Estas politicas no son defensa en
-- profundidad: son LA defensa.

alter table comun_agenda.age_profesional enable row level security;
alter table comun_agenda.age_franja      enable row level security;
alter table comun_agenda.age_bloqueo     enable row level security;
alter table comun_agenda.age_reserva     enable row level security;

-- El profesional gestiona lo suyo. El staff del negocio lo ve para operar la
-- mesa de asignaciones. El cliente NO lee esta tabla: la disponibilidad ajena
-- solo sale por los RPC de huecos.
create policy age_profesional_propio on comun_agenda.age_profesional
  for all using (agp_usuario_id = auth.uid()) with check (agp_usuario_id = auth.uid());
create policy age_profesional_staff on comun_agenda.age_profesional
  for select using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(agp_negocio));

create policy age_franja_propia on comun_agenda.age_franja
  for all using (exists (select 1 from comun_agenda.age_profesional p
                         where p.agp_id = fra_profesional_id and p.agp_usuario_id = auth.uid()))
  with check (exists (select 1 from comun_agenda.age_profesional p
                      where p.agp_id = fra_profesional_id and p.agp_usuario_id = auth.uid()));
create policy age_franja_staff on comun_agenda.age_franja
  for select using (exists (select 1 from comun_agenda.age_profesional p
                            where p.agp_id = fra_profesional_id
                              and comun_seguridad.seg_fn_es_operador_o_admin_negocio(p.agp_negocio)));

create policy age_bloqueo_propio on comun_agenda.age_bloqueo
  for all using (exists (select 1 from comun_agenda.age_profesional p
                         where p.agp_id = blq_profesional_id and p.agp_usuario_id = auth.uid()))
  with check (exists (select 1 from comun_agenda.age_profesional p
                      where p.agp_id = blq_profesional_id and p.agp_usuario_id = auth.uid()));
create policy age_bloqueo_staff on comun_agenda.age_bloqueo
  for select using (exists (select 1 from comun_agenda.age_profesional p
                            where p.agp_id = blq_profesional_id
                              and comun_seguridad.seg_fn_es_operador_o_admin_negocio(p.agp_negocio)));

-- Reserva: cada parte ve la suya. Sin politica de INSERT ni DELETE -- crear una
-- reserva es RPC transaccional (AGENTS.md regla 5), porque hay que resolver
-- turno, cobertura y solape a la vez. Un INSERT directo del cliente se saltaria
-- las tres cosas.
create policy age_reserva_cliente on comun_agenda.age_reserva
  for select using (res_cliente_id = auth.uid());
create policy age_reserva_profesional on comun_agenda.age_reserva
  for select using (res_usuario_id = auth.uid());
create policy age_reserva_staff on comun_agenda.age_reserva
  for select using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(res_negocio));
-- El profesional marca realizada / no_asistio sobre lo suyo.
create policy age_reserva_profesional_update on comun_agenda.age_reserva
  for update using (res_usuario_id = auth.uid()) with check (res_usuario_id = auth.uid());
create policy age_reserva_staff_update on comun_agenda.age_reserva
  for update using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(res_negocio));

-- ------------------------------------------------------------------------------
-- 7. AUDITORIA
-- ------------------------------------------------------------------------------

create trigger trg_auditoria_age_profesional after insert or update or delete on comun_agenda.age_profesional for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_age_franja      after insert or update or delete on comun_agenda.age_franja      for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_age_bloqueo     after insert or update or delete on comun_agenda.age_bloqueo     for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_age_reserva     after insert or update or delete on comun_agenda.age_reserva     for each row execute function comun_auditoria.aud_fn_auditar_tabla();

-- ------------------------------------------------------------------------------
-- 8. GRANTS
-- ------------------------------------------------------------------------------
-- Sin USAGE en el esquema, los grants de tabla no sirven de nada. Es el olvido
-- que ya costo dos migraciones de correccion en tranqui_legal y comun_auditoria
-- (ver 20260728000003 y 20260728000007).

grant usage on schema comun_agenda to authenticated, service_role;

grant select, insert, update on comun_agenda.age_profesional to authenticated;
grant select, insert, update on comun_agenda.age_franja      to authenticated;
grant select, insert, update on comun_agenda.age_bloqueo     to authenticated;
grant select, update          on comun_agenda.age_reserva    to authenticated;
grant usage, select on all sequences in schema comun_agenda to authenticated;

-- Una expresion de RLS se evalua con los privilegios de quien consulta, no con
-- los del dueño de la tabla: sin estos grants, las politicas que invocan estas
-- funciones fallan.
grant execute on function comun_agenda.age_fn_huecos_disponibles(uuid, timestamptz, timestamptz, int, text) to authenticated;
grant execute on function comun_agenda.age_fn_huecos_del_pool(uuid[], timestamptz, timestamptz, int, text, int) to authenticated;
grant execute on function comun_agenda.age_fn_configurar_agenda(text, jsonb, jsonb) to authenticated;
grant execute on function comun_agenda.age_fn_bloquear(text, timestamptz, timestamptz, text, text) to authenticated;
-- age_fn_siguiente_en_turno NO se concede a authenticated: escribe el turno y
-- solo debe invocarse desde dentro de los RPC de reserva de cada negocio.
