-- ==============================================================================
-- Migración: 20260905000005_comun_comercio_derecho_consumo.sql
-- Módulo: Derechos de consumo incluidos en una suscripción (PLT-009 / PLT-020).
-- ==============================================================================
--
-- Los planes de Tranqi no venden dinero, venden consultas: "1 consulta legal
-- telematica mensual" (Plan Basico), "3 consultas mensuales + 2 revisiones de
-- contratos" (Plan Medio), "consultas ilimitadas" (Plan Plus Familiar). Ver
-- gobernanza/productos/tranqi/catalogo-productos.md §2.B.
--
-- Eso es un derecho de consumo con periodo, y hasta ahora no habia donde
-- llevarlo: com_suscripcion sabe cuanto se cobra y cuando, pero no que incluye
-- ni cuanto queda. Sin esta tabla, la agenda no puede responder "esta cita
-- entra en tu plan" y todo acabaria cobrandose dos veces o ninguna.
--
-- Es transversal por construccion: FastFix puede vender "2 visitas tecnicas al
-- año" con el mismo mecanismo.

create table comun_comercio.com_derecho_consumo (
  der_id uuid primary key default gen_random_uuid(),
  der_secuencial bigint generated always as identity,
  der_negocio text not null,
  der_suscripcion_id uuid not null references comun_comercio.com_suscripcion(sub_id) on delete cascade,

  -- Que se consume. Texto y no enum: cada negocio define sus conceptos y un
  -- enum obligaria a migrar el tipo para añadir uno nuevo.
  der_concepto text not null,          -- 'CONSULTA_TELEMATICA' | 'REVISION_CONTRATO' | 'PODER_NOTARIAL' | ...

  -- Dia 1 del periodo (mes o año). date y no texto para poder ordenar y
  -- agrupar sin parsear, igual que trq_honorario.hon_periodo.
  der_periodo date not null,

  -- null = ilimitado. Es el Plan Plus Familiar: no se lleva cuenta contra un
  -- tope, pero si se cuenta el consumo, que es lo que permite ver el uso real
  -- del plan sin inventar un tope ficticio.
  der_incluidos int check (der_incluidos is null or der_incluidos >= 0),
  der_consumidos int not null default 0 check (der_consumidos >= 0),

  der_detalle_derecho jsonb not null default '{}'::jsonb,
  der_creado_en timestamptz not null default now(),
  der_actualizado_en timestamptz not null default now(),
  der_eliminado_en timestamptz,
  unique (der_suscripcion_id, der_concepto, der_periodo)
);

create index idx_com_derecho_suscripcion on comun_comercio.com_derecho_consumo (der_suscripcion_id, der_periodo)
  where der_eliminado_en is null;

-- Consume una unidad. La condicion del tope va DENTRO del update, no en un
-- select previo: si se lee y luego se escribe, dos pestañas abiertas gastan la
-- misma consulta del mes. La fila se crea al vuelo la primera vez del periodo,
-- tomando lo incluido de var_detalle_variante del plan contratado.
create or replace function comun_comercio.com_fn_consumir_derecho(
  p_suscripcion_id uuid,
  p_concepto text,
  p_periodo date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_periodo date := coalesce(p_periodo, date_trunc('month', now())::date);
  v_negocio text;
  v_incluidos int;
  v_id uuid;
begin
  select s.sub_negocio,
         (select (d->>'incluidos')::int
          from jsonb_array_elements(coalesce(v.var_detalle_variante->'derechos', '[]'::jsonb)) d
          where d->>'concepto' = p_concepto
          limit 1)
    into v_negocio, v_incluidos
  from comun_comercio.com_suscripcion s
  join comun_comercio.com_variante v on v.var_id = s.sub_variante_id
  where s.sub_id = p_suscripcion_id
    and s.sub_estado = 'ACTIVA'
    and s.sub_eliminado_en is null;

  if v_negocio is null then
    return null;   -- sin suscripcion activa: no hay derecho que consumir
  end if;

  -- El plan no incluye este concepto. Distinto de "incluye ilimitado", que en
  -- el jsonb se expresa con "incluidos": null.
  if v_incluidos is null and not exists (
       select 1
       from comun_comercio.com_suscripcion s
       join comun_comercio.com_variante v on v.var_id = s.sub_variante_id
       cross join lateral jsonb_array_elements(coalesce(v.var_detalle_variante->'derechos','[]'::jsonb)) d
       where s.sub_id = p_suscripcion_id and d->>'concepto' = p_concepto)
  then
    return null;
  end if;

  insert into comun_comercio.com_derecho_consumo (
    der_negocio, der_suscripcion_id, der_concepto, der_periodo, der_incluidos, der_consumidos)
  values (v_negocio, p_suscripcion_id, p_concepto, v_periodo, v_incluidos, 0)
  on conflict (der_suscripcion_id, der_concepto, der_periodo) do nothing;

  update comun_comercio.com_derecho_consumo
     set der_consumidos = der_consumidos + 1,
         der_actualizado_en = now()
   where der_suscripcion_id = p_suscripcion_id
     and der_concepto = p_concepto
     and der_periodo = v_periodo
     and der_eliminado_en is null
     and (der_incluidos is null or der_consumidos < der_incluidos)
  returning der_id into v_id;

  return v_id;   -- null = el cupo del periodo esta agotado
end;
$$;

-- Devuelve el cupo cuando una cita se cancela en plazo. Nunca baja de cero: un
-- error de doble devolucion no puede regalar consultas.
create or replace function comun_comercio.com_fn_devolver_derecho(p_derecho_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  update comun_comercio.com_derecho_consumo
     set der_consumidos = der_consumidos - 1,
         der_actualizado_en = now()
   where der_id = p_derecho_id
     and der_consumidos > 0
     and der_eliminado_en is null
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

-- Que le queda al usuario este periodo. Lo consulta el checkout y la
-- herramienta `mi_cobertura` del asistente.
create or replace function comun_comercio.com_fn_cobertura_usuario(
  p_negocio text,
  p_periodo date default null
)
returns table (
  suscripcion_id uuid,
  plan_nombre text,
  concepto text,
  incluidos int,
  consumidos int,
  restantes int
)
language sql
stable
security definer
set search_path = ''
as $$
  with v_periodo as (select coalesce(p_periodo, date_trunc('month', now())::date) as p)
  select
    s.sub_id,
    v.var_nombre,
    d->>'concepto',
    (d->>'incluidos')::int,
    coalesce(c.der_consumidos, 0),
    case when (d->>'incluidos') is null then null
         else greatest((d->>'incluidos')::int - coalesce(c.der_consumidos, 0), 0) end
  from comun_comercio.com_suscripcion s
  join comun_comercio.com_variante v on v.var_id = s.sub_variante_id
  cross join lateral jsonb_array_elements(coalesce(v.var_detalle_variante->'derechos','[]'::jsonb)) d
  cross join v_periodo
  left join comun_comercio.com_derecho_consumo c
    on c.der_suscripcion_id = s.sub_id
   and c.der_concepto = d->>'concepto'
   and c.der_periodo = v_periodo.p
   and c.der_eliminado_en is null
  where s.sub_cliente_id = auth.uid()
    and s.sub_negocio = p_negocio
    and s.sub_estado = 'ACTIVA'
    and s.sub_eliminado_en is null;
$$;

alter table comun_comercio.com_derecho_consumo enable row level security;

create policy com_derecho_propio on comun_comercio.com_derecho_consumo
  for select using (exists (select 1 from comun_comercio.com_suscripcion s
                            where s.sub_id = der_suscripcion_id and s.sub_cliente_id = auth.uid()));
create policy com_derecho_staff on comun_comercio.com_derecho_consumo
  for select using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(der_negocio));
-- Sin INSERT ni UPDATE: el consumo es RPC. Un cliente que pudiera escribir
-- aqui se regalaria consultas.

create trigger trg_auditoria_com_derecho_consumo after insert or update or delete on comun_comercio.com_derecho_consumo for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_comercio.com_derecho_consumo to authenticated;
grant usage, select on all sequences in schema comun_comercio to authenticated;
grant execute on function comun_comercio.com_fn_cobertura_usuario(text, date) to authenticated;
-- com_fn_consumir_derecho y com_fn_devolver_derecho NO se conceden a
-- authenticated: solo se invocan desde los RPC de reserva de cada negocio.
