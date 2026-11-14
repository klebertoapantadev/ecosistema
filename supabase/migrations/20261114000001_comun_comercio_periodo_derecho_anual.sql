-- TRQ-022 · Cupos anuales de los planes de tranqi.
--
-- Hasta hoy el cupo de un derecho (p. ej. CONSULTA_TELEMATICA) se contaba por
-- MES calendario: com_fn_consumir_derecho y com_fn_cobertura_usuario usaban
-- date_trunc('month', now()) como periodo. Desde el 14-nov-2026 los planes de
-- tranqi son ANUALES («2 consultas al año»), y con el periodo mensual el cupo
-- se renovaba cada mes.
--
-- Regla nueva, en una sola función para la base y la app:
--   · el derecho dice su periodo en var_detalle_variante->'derechos'[].periodo;
--     si no lo dice, manda la frecuencia de la suscripción;
--   · ANUAL  → el ciclo empieza en el aniversario de la compra (sub_creado_en);
--   · resto  → el mes calendario, como hasta ahora.
-- La app replica la misma regla en @eco/comercio (utils/periodoDerecho.ts).

create or replace function comun_comercio.com_fn_periodo_derecho(
  p_suscripcion_id uuid,
  p_concepto text,
  p_fecha date default null
)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select
      coalesce(p_fecha, (now() at time zone 'utc')::date) as hoy,
      (s.sub_creado_en at time zone 'utc')::date as inicio,
      upper(coalesce(
        (select nullif(btrim(d->>'periodo'), '')
           from jsonb_array_elements(coalesce(v.var_detalle_variante->'derechos', '[]'::jsonb)) d
          where d->>'concepto' = p_concepto
          limit 1),
        nullif(btrim(s.sub_frecuencia), ''),
        'MENSUAL')) as periodo
    from comun_comercio.com_suscripcion s
    join comun_comercio.com_variante v on v.var_id = s.sub_variante_id
    where s.sub_id = p_suscripcion_id
  ), anios as (
    -- Años cumplidos contando el aniversario con «+ n years» (el 29-feb cae
    -- en el 28-feb), igual que periodoDerecho.ts; age() lo movería al 1-mar.
    select b.*, (extract(year from hoy) - extract(year from inicio))::int as n
    from base b
  )
  select case
           when periodo = 'ANUAL' and hoy >= inicio
             then (inicio + make_interval(years => n - case when (inicio + make_interval(years => n))::date > hoy then 1 else 0 end))::date
           else date_trunc('month', hoy)::date
         end
  from anios;
$$;

-- Solo la usan otras funciones SECURITY DEFINER (corren como su dueño): nadie
-- más necesita llamarla por RPC.
revoke execute on function comun_comercio.com_fn_periodo_derecho(uuid, text, date) from public, anon, authenticated;
grant execute on function comun_comercio.com_fn_periodo_derecho(uuid, text, date) to service_role;

-- Igual que la versión de 20260905000005, salvo el periodo por defecto.
create or replace function comun_comercio.com_fn_consumir_derecho(p_suscripcion_id uuid, p_concepto text, p_periodo date default null::date)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_periodo date := coalesce(p_periodo, comun_comercio.com_fn_periodo_derecho(p_suscripcion_id, p_concepto));
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
$function$;

-- Igual que la versión de 20260905000005, salvo que sin p_periodo cada
-- derecho se mide en su propio periodo (anual o mensual).
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
  left join comun_comercio.com_derecho_consumo c
    on c.der_suscripcion_id = s.sub_id
   and c.der_concepto = d->>'concepto'
   and c.der_periodo = coalesce(p_periodo, comun_comercio.com_fn_periodo_derecho(s.sub_id, d->>'concepto'))
   and c.der_eliminado_en is null
  where s.sub_cliente_id = auth.uid()
    and s.sub_negocio = p_negocio
    and s.sub_estado = 'ACTIVA'
    and s.sub_eliminado_en is null;
$$;

-- com_fn_consumir_derecho tenía el permiso por defecto (EXECUTE para PUBLIC):
-- cualquiera, incluso anon, podía gastar el cupo de una suscripción ajena por
-- RPC. Se cierra a anon. Se mantiene a authenticated porque la app la llama con
-- la sesión del usuario cuando no hay cliente admin; queda pendiente exigir
-- que la suscripción sea del propio usuario o de personal autorizado.
revoke execute on function comun_comercio.com_fn_consumir_derecho(uuid, text, date) from public, anon;
grant execute on function comun_comercio.com_fn_consumir_derecho(uuid, text, date) to authenticated, service_role;
