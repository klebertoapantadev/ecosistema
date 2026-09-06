-- ==============================================================================
-- Migración: 20260905000006_tranqui_legal_agenda.sql
-- Implementa: TRQ-ABG-004 (agenda profesional y videoconsulta) y la parte de
--             agendamiento de TRQ-CLI-001, sobre el motor comun de PLT-020.
-- ==============================================================================
--
-- Tres cosas que hoy estan rotas o ausentes y esta migracion resuelve:
--
--   1. La especialidad del abogado solo existe en trq_solicitud_materia, atada
--      a la solicitud de acreditacion. Eso no sirve para rutear: se pierde si
--      el abogado vuelve a postular (el indice unico parcial de 20260728000002
--      lo permite tras un rechazo) y no le deja cambiar de materia sin tocar
--      una solicitud ya decidida. El turno rotativo por materia la necesita
--      como dato propio del abogado.
--
--   2. La herramienta `agendar_cita` del asistente inserta en trq_cita SIN
--      cit_abogado_id. Como trq_cita_abogado_select filtra por ese campo, toda
--      cita creada asi es invisible para cualquier abogado: se agenda contra
--      nadie. Se sustituye por un RPC que resuelve turno, cobertura y solape.
--
--   3. trq_cita_cliente_insert deja al cliente insertar directo (forzando
--      estado 'propuesta'). Mientras exista, las franjas, el turno y el cupo
--      del plan son decorativos: basta un POST a PostgREST para agendar a las
--      3 de la mañana con un abogado que no lo ofrece. Se elimina.

-- ============ 1. Especialidad y cobertura como dato del abogado ============

create table tranqui_legal.trq_abogado_materia (
  amt_id uuid primary key default gen_random_uuid(),
  amt_abogado_id uuid not null references tranqui_legal.trq_abogado(abg_id) on delete cascade,
  amt_materia_id uuid not null references tranqui_legal.trq_materia(mat_id) on delete restrict,
  amt_creado_en timestamptz not null default now(),
  amt_actualizado_en timestamptz not null default now(),
  amt_eliminado_en timestamptz,
  unique (amt_abogado_id, amt_materia_id)
);

create table tranqui_legal.trq_abogado_provincia (
  apr_id uuid primary key default gen_random_uuid(),
  apr_abogado_id uuid not null references tranqui_legal.trq_abogado(abg_id) on delete cascade,
  apr_provincia_id uuid not null references comun_catalogo.cat_provincia(cat_id) on delete restrict,
  apr_creado_en timestamptz not null default now(),
  apr_actualizado_en timestamptz not null default now(),
  apr_eliminado_en timestamptz,
  unique (apr_abogado_id, apr_provincia_id)
);

create index idx_trq_abogado_materia on tranqui_legal.trq_abogado_materia (amt_materia_id)
  where amt_eliminado_en is null;
create index idx_trq_abogado_provincia on tranqui_legal.trq_abogado_provincia (apr_provincia_id)
  where apr_eliminado_en is null;

-- Backfill desde la solicitud aceptada. A partir de aqui la fuente es la tabla
-- nueva: el abogado edita sus materias sin tocar un expediente ya decidido.
insert into tranqui_legal.trq_abogado_materia (amt_abogado_id, amt_materia_id)
select a.abg_id, sm.sma_materia_id
from tranqui_legal.trq_abogado a
join tranqui_legal.trq_solicitud_socio s on s.ssc_id = a.abg_solicitud_id and s.ssc_estado = 'aceptada'
join tranqui_legal.trq_solicitud_materia sm on sm.sma_solicitud_id = s.ssc_id
on conflict (amt_abogado_id, amt_materia_id) do nothing;

insert into tranqui_legal.trq_abogado_provincia (apr_abogado_id, apr_provincia_id)
select a.abg_id, sp.spr_provincia_id
from tranqui_legal.trq_abogado a
join tranqui_legal.trq_solicitud_socio s on s.ssc_id = a.abg_solicitud_id and s.ssc_estado = 'aceptada'
join tranqui_legal.trq_solicitud_provincia sp on sp.spr_solicitud_id = s.ssc_id
on conflict (apr_abogado_id, apr_provincia_id) do nothing;

-- ============ 2. La consulta rapida que atiende ARIA ============

create table tranqui_legal.trq_consulta_rapida (
  crp_id uuid primary key default gen_random_uuid(),
  crp_secuencial bigint generated always as identity,
  crp_usuario_id uuid not null references comun_seguridad.seg_usuario(usu_id) on delete cascade,
  crp_conversacion_id uuid references tranqui_legal.trq_conversacion(cnv_id) on delete set null,
  crp_pregunta text not null,
  crp_materia_sugerida_id uuid references tranqui_legal.trq_materia(mat_id) on delete set null,
  crp_variante_sugerida_id uuid references comun_comercio.com_variante(var_id) on delete set null,
  crp_resuelta boolean not null default false,
  crp_escalada_en timestamptz,
  -- Cierra el circulo: de la duda gratuita a la cita que salio de ella.
  crp_cita_id uuid,
  crp_creado_en timestamptz not null default now(),
  crp_actualizado_en timestamptz not null default now(),
  crp_eliminado_en timestamptz
);

create index idx_trq_consulta_rapida_usuario on tranqui_legal.trq_consulta_rapida (crp_usuario_id, crp_creado_en desc)
  where crp_eliminado_en is null;

-- ============ 3. trq_cita se engancha al motor comun ============
-- Todo aditivo: las apps Capacitor consultan esta tabla directo y el cambio
-- debe ser retrocompatible (marco-de-trabajo.md §5).

alter table tranqui_legal.trq_cita
  add column if not exists cit_reserva_id uuid references comun_agenda.age_reserva(res_id) on delete set null,
  add column if not exists cit_variante_id uuid references comun_comercio.com_variante(var_id) on delete set null,
  add column if not exists cit_origen text not null default 'panel',
  add column if not exists cit_asignacion text not null default 'turno',
  add column if not exists cit_reasignada_de uuid references tranqui_legal.trq_abogado(abg_id) on delete set null,
  add column if not exists cit_google_evento_id text,
  add column if not exists cit_confirmada_en timestamptz,
  add column if not exists cit_cancelada_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  add column if not exists cit_cobertura text not null default 'pendiente',
  add column if not exists cit_pago_id uuid references comun_comercio.com_transaccion_pago(pag_id) on delete set null,
  add column if not exists cit_derecho_id uuid references comun_comercio.com_derecho_consumo(der_id) on delete set null;

alter table tranqui_legal.trq_cita
  drop constraint if exists trq_cita_origen_check;
alter table tranqui_legal.trq_cita
  add constraint trq_cita_origen_check
  check (cit_origen in ('panel','asistente','operador','escalado_rapida'));

alter table tranqui_legal.trq_cita
  drop constraint if exists trq_cita_asignacion_check;
alter table tranqui_legal.trq_cita
  add constraint trq_cita_asignacion_check
  check (cit_asignacion in ('turno','operador','contingencia'));

alter table tranqui_legal.trq_cita
  drop constraint if exists trq_cita_cobertura_check;
alter table tranqui_legal.trq_cita
  add constraint trq_cita_cobertura_check
  check (cit_cobertura in ('pendiente','plan','cupon','pagada','cortesia'));

create index if not exists idx_trq_cita_reserva on tranqui_legal.trq_cita (cit_reserva_id);
-- Cola de contingencia del operador: citas vivas que se quedaron sin abogado.
create index if not exists idx_trq_cita_contingencia on tranqui_legal.trq_cita (cit_inicio_en)
  where cit_asignacion = 'contingencia' and cit_eliminado_en is null;

-- Las citas creadas por la herramienta rota no tienen abogado ni fin, y por
-- tanto no las ve nadie. No se borran (no hay borrado fisico de filas de
-- negocio): se cancelan con motivo, que es lo que de hecho les paso.
update tranqui_legal.trq_cita
   set cit_estado = 'cancelada',
       cit_notas = coalesce(cit_notas || E'\n', '') ||
                   'Cancelada por la migracion 20260905000006: se creo sin abogado asignado '
                   'y nunca fue visible para ningun profesional.',
       cit_actualizado_en = now()
 where cit_abogado_id is null
   and cit_estado in ('propuesta','confirmada','reagendada')
   and cit_eliminado_en is null;

-- ============ 4. El cliente deja de escribir citas a mano ============
drop policy if exists trq_cita_cliente_insert on tranqui_legal.trq_cita;
drop policy if exists trq_cita_cliente_update on tranqui_legal.trq_cita;

-- El cliente conserva la capacidad de cancelar lo suyo, no la de moverlo: un
-- UPDATE libre sobre cit_inicio_en volveria a saltarse franjas y solape.
create policy trq_cita_cliente_cancela on tranqui_legal.trq_cita
  for update using (cit_cliente_id = auth.uid())
  with check (cit_cliente_id = auth.uid() and cit_estado in ('cancelada','propuesta'));

-- ============ 5. RLS de las tablas nuevas ============

alter table tranqui_legal.trq_abogado_materia   enable row level security;
alter table tranqui_legal.trq_abogado_provincia enable row level security;
alter table tranqui_legal.trq_consulta_rapida   enable row level security;

-- La especialidad de un abogado verificado es informacion de directorio: quien
-- este autenticado puede leerla (TRQ-CLI-003 ya publica el directorio). Solo
-- el propio abogado y el staff la escriben.
create policy trq_abogado_materia_select on tranqui_legal.trq_abogado_materia
  for select using (true);
create policy trq_abogado_materia_propia on tranqui_legal.trq_abogado_materia
  for all using (amt_abogado_id = tranqui_legal.trq_fn_abogado_actual())
  with check (amt_abogado_id = tranqui_legal.trq_fn_abogado_actual());
create policy trq_abogado_materia_staff on tranqui_legal.trq_abogado_materia
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio('tranqi'));

create policy trq_abogado_provincia_select on tranqui_legal.trq_abogado_provincia
  for select using (true);
create policy trq_abogado_provincia_propia on tranqui_legal.trq_abogado_provincia
  for all using (apr_abogado_id = tranqui_legal.trq_fn_abogado_actual())
  with check (apr_abogado_id = tranqui_legal.trq_fn_abogado_actual());
create policy trq_abogado_provincia_staff on tranqui_legal.trq_abogado_provincia
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio('tranqi'));

-- La consulta rapida es una duda legal personal. Se trata como
-- trq_conversacion: solo el dueño, ni siquiera el administrador. Darle
-- visibilidad de oficio seria un problema de privacidad, no una comodidad de
-- soporte.
create policy trq_consulta_rapida_propia on tranqui_legal.trq_consulta_rapida
  for all using (crp_usuario_id = auth.uid()) with check (crp_usuario_id = auth.uid());

-- ============ 6. Candidatos y reserva ============

-- Abogados que pueden atender una materia y tienen agenda viva. Es la lista
-- que entra al turno rotativo.
create or replace function tranqui_legal.trq_fn_candidatos_materia(
  p_materia_id uuid,
  p_provincia_id uuid default null
)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.agp_id order by p.agp_ultimo_turno_en nulls first, p.agp_creado_en), '{}')
  from tranqui_legal.trq_abogado a
  join comun_agenda.age_profesional p
    on p.agp_usuario_id = a.abg_usuario_id and p.agp_negocio = 'tranqi'
  join tranqui_legal.trq_abogado_materia m
    on m.amt_abogado_id = a.abg_id and m.amt_eliminado_en is null
  where a.abg_estado = 'verificado'
    and m.amt_materia_id = p_materia_id
    and p.agp_eliminado_en is null
    and p.agp_configurada_en is not null
    and p.agp_acepta_turno
    and (p_provincia_id is null or exists (
          select 1 from tranqui_legal.trq_abogado_provincia v
          where v.apr_abogado_id = a.abg_id
            and v.apr_provincia_id = p_provincia_id
            and v.apr_eliminado_en is null));
$$;

-- Huecos del pool para una materia. Lo que ve el cliente: horas, no personas.
create or replace function tranqui_legal.trq_fn_horarios_materia(
  p_materia_id uuid,
  p_desde timestamptz,
  p_hasta timestamptz,
  p_variante_id uuid default null,
  p_modalidad text default null,
  p_provincia_id uuid default null
)
returns table (hueco_inicio timestamptz, hueco_fin timestamptz, disponibles int)
language sql
stable
security definer
set search_path = ''
as $$
  select h.hueco_inicio, h.hueco_fin, h.disponibles
  from comun_agenda.age_fn_huecos_del_pool(
    tranqui_legal.trq_fn_candidatos_materia(p_materia_id, p_provincia_id),
    p_desde,
    p_hasta,
    (select (v.var_detalle_variante->>'duracion_min')::int
     from comun_comercio.com_variante v where v.var_id = p_variante_id),
    p_modalidad,
    40) h;
$$;

-- El corazon. Turno, cobertura y solape se resuelven en UNA transaccion: si
-- alguna de las tres falla, no queda ni media cita.
create or replace function tranqui_legal.trq_fn_reservar_cita(
  p_materia_id uuid,
  p_inicio_en timestamptz,
  p_variante_id uuid default null,
  p_modalidad text default 'virtual',
  p_motivo text default null,
  p_caso_id uuid default null,
  p_provincia_id uuid default null,
  p_origen text default 'panel'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente uuid := auth.uid();
  v_dur int;
  v_fin timestamptz;
  v_candidatos uuid[];
  v_prof uuid;
  v_abogado uuid;
  v_suscripcion uuid;
  v_derecho uuid;
  v_cobertura text := 'pendiente';
  v_reserva uuid;
  v_cita uuid;
  v_concepto text;
begin
  if v_cliente is null then
    raise exception 'Sesion no encontrada';
  end if;
  if p_inicio_en <= now() then
    raise exception 'Esa fecha ya paso. Propon una futura.';
  end if;

  select coalesce((v.var_detalle_variante->>'duracion_min')::int, 45),
         coalesce(v.var_detalle_variante->>'concepto_derecho', 'CONSULTA_TELEMATICA')
    into v_dur, v_concepto
  from comun_comercio.com_variante v
  where v.var_id = p_variante_id;
  v_dur := coalesce(v_dur, 45);
  v_concepto := coalesce(v_concepto, 'CONSULTA_TELEMATICA');
  v_fin := p_inicio_en + make_interval(mins => v_dur);

  -- Turno rotativo. El UPDATE de dentro marca el turno y bloquea la fila, asi
  -- que dos reservas simultaneas no eligen al mismo por leer antes de escribir.
  v_candidatos := tranqui_legal.trq_fn_candidatos_materia(p_materia_id, p_provincia_id);
  if array_length(v_candidatos, 1) is null then
    raise exception 'Todavia no hay abogados con agenda disponible para esa materia. Deja tu consulta y un operador te contacta.';
  end if;

  v_prof := comun_agenda.age_fn_siguiente_en_turno(v_candidatos, p_inicio_en, v_fin, p_modalidad);
  if v_prof is null then
    raise exception 'Ese horario acaba de ocuparse. Consulta los siguientes disponibles y ofrece otro.';
  end if;

  select a.abg_id into v_abogado
  from tranqui_legal.trq_abogado a
  join comun_agenda.age_profesional p on p.agp_usuario_id = a.abg_usuario_id
  where p.agp_id = v_prof and a.abg_estado = 'verificado';

  -- Cobertura, en orden: lo que ya pago el cliente en su plan, y solo si no
  -- alcanza, el cobro. Consumir el cupo aqui dentro es lo que impide que dos
  -- pestañas abiertas gasten la misma consulta del mes.
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
    end if;
  end if;

  -- Sin variante no hay nada que cobrar: es una consulta de cortesia o el
  -- escalado de una duda gratuita.
  if v_cobertura = 'pendiente' and p_variante_id is null then
    v_cobertura := 'cortesia';
  end if;

  -- La reserva se inserta con el cliente y el rango exactos. Si otro gano la
  -- carrera por milisegundos, age_reserva_sin_solape la rechaza aqui y toda la
  -- transaccion se deshace, cupo consumido incluido.
  insert into comun_agenda.age_reserva (
    res_profesional_id, res_negocio, res_cliente_id, res_variante_id,
    res_inicio_en, res_fin_en, res_estado, res_modalidad,
    res_referencia_tabla)
  values (v_prof, 'tranqi', v_cliente, p_variante_id,
          p_inicio_en, v_fin, 'propuesta', p_modalidad,
          'tranqui_legal.trq_cita')
  returning res_id into v_reserva;

  insert into tranqui_legal.trq_cita (
    cit_caso_id, cit_cliente_id, cit_abogado_id, cit_inicio_en, cit_fin_en,
    cit_modalidad, cit_estado, cit_motivo,
    cit_reserva_id, cit_variante_id, cit_origen, cit_asignacion,
    cit_cobertura, cit_derecho_id)
  values (
    p_caso_id, v_cliente, v_abogado, p_inicio_en, v_fin,
    p_modalidad, 'propuesta', p_motivo,
    v_reserva, p_variante_id, p_origen, 'turno',
    v_cobertura, v_derecho)
  returning cit_id into v_cita;

  update comun_agenda.age_reserva
     set res_referencia_id = v_cita, res_actualizado_en = now()
   where res_id = v_reserva;

  return v_cita;
end;
$$;

-- Confirmar, reagendar, cancelar y marcar realizada. Mueve cita y reserva a la
-- vez: si se separan, la agenda del abogado y su ocupacion real divergen.
create or replace function tranqui_legal.trq_fn_decidir_cita(
  p_cita_id uuid,
  p_decision text,
  p_nuevo_inicio timestamptz default null,
  p_motivo text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  c tranqui_legal.trq_cita;
  v_abogado uuid := tranqui_legal.trq_fn_abogado_actual();
  v_es_cliente boolean;
  v_es_staff boolean := comun_seguridad.seg_fn_es_operador_o_admin_negocio('tranqi');
  v_dur int;
begin
  select * into c from tranqui_legal.trq_cita where cit_id = p_cita_id and cit_eliminado_en is null;
  if not found then
    raise exception 'La cita no existe';
  end if;

  v_es_cliente := (c.cit_cliente_id = auth.uid());
  if not (v_es_cliente or v_es_staff or (v_abogado is not null and c.cit_abogado_id = v_abogado)) then
    raise exception 'No participas en esa cita';
  end if;

  v_dur := coalesce((extract(epoch from (c.cit_fin_en - c.cit_inicio_en)) / 60)::int, 45);

  if p_decision = 'confirmar' then
    if v_es_cliente and not v_es_staff and v_abogado is null then
      raise exception 'La confirmacion la hace el abogado o un operador';
    end if;
    update tranqui_legal.trq_cita
       set cit_estado = 'confirmada', cit_confirmada_en = now(), cit_actualizado_en = now()
     where cit_id = p_cita_id;
    update comun_agenda.age_reserva
       set res_estado = 'confirmada', res_actualizado_en = now()
     where res_id = c.cit_reserva_id;
    return 'confirmada';

  elsif p_decision = 'reagendar' then
    if p_nuevo_inicio is null or p_nuevo_inicio <= now() then
      raise exception 'Indica una fecha futura para reagendar';
    end if;
    -- El solape lo vuelve a comprobar age_reserva_sin_solape al actualizar.
    update comun_agenda.age_reserva
       set res_inicio_en = p_nuevo_inicio,
           res_fin_en = p_nuevo_inicio + make_interval(mins => v_dur),
           res_actualizado_en = now()
     where res_id = c.cit_reserva_id;
    update tranqui_legal.trq_cita
       set cit_inicio_en = p_nuevo_inicio,
           cit_fin_en = p_nuevo_inicio + make_interval(mins => v_dur),
           cit_estado = 'reagendada',
           cit_notas = coalesce(cit_notas || E'\n', '') || coalesce('Reagendada: ' || p_motivo, 'Reagendada'),
           cit_actualizado_en = now()
     where cit_id = p_cita_id;
    return 'reagendada';

  elsif p_decision = 'cancelar' then
    -- Contingencia (PLT-020 regla 4): si quien cancela es el abogado, la cita
    -- del cliente NO se cancela. Se queda viva, sin abogado, en la cola del
    -- operador. Cancelarla aqui seria trasladarle al cliente un problema que
    -- no es suyo.
    if v_abogado is not null and c.cit_abogado_id = v_abogado and not v_es_cliente then
      update comun_agenda.age_reserva
         set res_estado = 'cancelada', res_actualizado_en = now()
       where res_id = c.cit_reserva_id;
      update tranqui_legal.trq_cita
         set cit_asignacion = 'contingencia',
             cit_reasignada_de = c.cit_abogado_id,
             cit_abogado_id = null,
             cit_reserva_id = null,
             cit_estado = 'propuesta',
             cit_notas = coalesce(cit_notas || E'\n', '') ||
                         coalesce('El abogado cancelo: ' || p_motivo, 'El abogado cancelo'),
             cit_actualizado_en = now()
       where cit_id = p_cita_id;
      return 'contingencia';
    end if;

    update comun_agenda.age_reserva
       set res_estado = 'cancelada', res_actualizado_en = now()
     where res_id = c.cit_reserva_id;
    update tranqui_legal.trq_cita
       set cit_estado = 'cancelada',
           cit_cancelada_por = auth.uid(),
           cit_notas = coalesce(cit_notas || E'\n', '') || coalesce('Cancelada: ' || p_motivo, 'Cancelada'),
           cit_actualizado_en = now()
     where cit_id = p_cita_id;

    -- El cupo del plan vuelve al cliente si cancela con la antelacion minima
    -- del abogado. Fuera de plazo se pierde: es la unica forma de que la
    -- antelacion signifique algo.
    if c.cit_derecho_id is not null
       and c.cit_inicio_en > now() + make_interval(hours => 24) then
      perform comun_comercio.com_fn_devolver_derecho(c.cit_derecho_id);
    end if;
    return 'cancelada';

  elsif p_decision in ('marcar_realizada','marcar_no_asistio') then
    if v_abogado is null and not v_es_staff then
      raise exception 'Solo el abogado o un operador cierran la cita';
    end if;
    update tranqui_legal.trq_cita
       set cit_estado = 'realizada', cit_actualizado_en = now()
     where cit_id = p_cita_id;
    update comun_agenda.age_reserva
       set res_estado = case when p_decision = 'marcar_realizada' then 'realizada' else 'no_asistio' end,
           res_actualizado_en = now()
     where res_id = c.cit_reserva_id;
    return p_decision;
  end if;

  raise exception 'Decision no reconocida: %', p_decision;
end;
$$;

-- Reasignacion manual del operador (PLT-020 regla 4) y salida de la cola de
-- contingencia. Exige staff: es la facultad que le da la gobernanza a la mesa
-- de control, no al abogado ni al cliente.
create or replace function tranqui_legal.trq_fn_reasignar_cita(
  p_cita_id uuid,
  p_abogado_destino uuid,
  p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c tranqui_legal.trq_cita;
  v_prof uuid;
  v_reserva uuid;
begin
  if not comun_seguridad.seg_fn_es_operador_o_admin_negocio('tranqi') then
    raise exception 'Solo un operador o administrador de tranqi reasigna citas';
  end if;

  select * into c from tranqui_legal.trq_cita where cit_id = p_cita_id and cit_eliminado_en is null;
  if not found then
    raise exception 'La cita no existe';
  end if;

  select p.agp_id into v_prof
  from tranqui_legal.trq_abogado a
  join comun_agenda.age_profesional p
    on p.agp_usuario_id = a.abg_usuario_id and p.agp_negocio = 'tranqi'
  where a.abg_id = p_abogado_destino
    and a.abg_estado = 'verificado'
    and p.agp_eliminado_en is null;
  if v_prof is null then
    raise exception 'El abogado destino no tiene agenda configurada en tranqi';
  end if;

  -- La reserva anterior se libera y se crea una nueva. Si el destino ya esta
  -- ocupado a esa hora, age_reserva_sin_solape lo rechaza y la reasignacion no
  -- ocurre: el operador se entera antes, no el cliente despues.
  if c.cit_reserva_id is not null then
    update comun_agenda.age_reserva
       set res_estado = 'cancelada', res_actualizado_en = now()
     where res_id = c.cit_reserva_id;
  end if;

  insert into comun_agenda.age_reserva (
    res_profesional_id, res_negocio, res_cliente_id, res_variante_id,
    res_inicio_en, res_fin_en, res_estado, res_modalidad,
    res_referencia_tabla, res_referencia_id)
  values (v_prof, 'tranqi', c.cit_cliente_id, c.cit_variante_id,
          c.cit_inicio_en, coalesce(c.cit_fin_en, c.cit_inicio_en + interval '45 minutes'),
          'confirmada', c.cit_modalidad,
          'tranqui_legal.trq_cita', c.cit_id)
  returning res_id into v_reserva;

  update tranqui_legal.trq_cita
     set cit_abogado_id = p_abogado_destino,
         cit_reserva_id = v_reserva,
         cit_asignacion = 'operador',
         cit_reasignada_de = c.cit_abogado_id,
         cit_estado = 'confirmada',
         cit_notas = coalesce(cit_notas || E'\n', '') ||
                     coalesce('Reasignada por operador: ' || p_motivo, 'Reasignada por operador'),
         cit_actualizado_en = now()
   where cit_id = p_cita_id;

  return v_reserva;
end;
$$;

-- ============ 7. Auditoria y grants ============

create trigger trg_auditoria_trq_abogado_materia   after insert or update or delete on tranqui_legal.trq_abogado_materia   for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_trq_abogado_provincia after insert or update or delete on tranqui_legal.trq_abogado_provincia for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_trq_consulta_rapida   after insert or update or delete on tranqui_legal.trq_consulta_rapida   for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select, insert, update on tranqui_legal.trq_abogado_materia   to authenticated;
grant select, insert, update on tranqui_legal.trq_abogado_provincia to authenticated;
grant select, insert, update on tranqui_legal.trq_consulta_rapida   to authenticated;

grant execute on function tranqui_legal.trq_fn_candidatos_materia(uuid, uuid) to authenticated;
grant execute on function tranqui_legal.trq_fn_horarios_materia(uuid, timestamptz, timestamptz, uuid, text, uuid) to authenticated;
grant execute on function tranqui_legal.trq_fn_reservar_cita(uuid, timestamptz, uuid, text, text, uuid, uuid, text) to authenticated;
grant execute on function tranqui_legal.trq_fn_decidir_cita(uuid, text, timestamptz, text) to authenticated;
grant execute on function tranqui_legal.trq_fn_reasignar_cita(uuid, uuid, text) to authenticated;
