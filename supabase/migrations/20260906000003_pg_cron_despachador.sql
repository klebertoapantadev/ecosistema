-- ==============================================================================
-- Migración: 20260906000003_pg_cron_despachador.sql
-- Programa el despachador de tareas (ver 20260906000002).
-- ==============================================================================
--
-- pg_cron corre dentro de la base, así que no hay servicio externo que
-- mantener, autenticar ni vigilar. Las tareas son operaciones sobre datos que
-- ya viven aquí; el único trabajo que sale fuera —el correo— se deja encolado
-- en `not_cola_correo` para quien la vacía.
--
-- CADA 15 MINUTOS. El recordatorio de «una hora antes» puede llegar, en el peor
-- caso, con 15 minutos de adelanto sobre la hora exacta, y eso está bien: un
-- aviso que llega quince minutos antes de tiempo sigue sirviendo, y afinar más
-- significaría ejecutar cuatro veces más para el mismo resultado. Las otras
-- tareas (documentos que caducan en meses, bonos, notificaciones pospuestas) no
-- notan la diferencia entre 15 minutos y una hora.

create extension if not exists pg_cron;

-- Idempotencia de la propia programación: si la migración se reaplica, no deja
-- dos entradas haciendo el mismo trabajo.
select cron.unschedule('despachador-tareas')
where exists (select 1 from cron.job where jobname = 'despachador-tareas');

select cron.schedule(
  'despachador-tareas',
  '*/15 * * * *',
  $$select comun_tareas.tar_fn_despachar();$$
);

-- ============ Retención de la bitácora ============
-- 4 ejecuciones/hora × 4 tareas = 384 filas al día. Sin poda, en un año son
-- 140 000 filas de ruido en una tabla que solo se consulta para responder
-- «¿ha fallado algo últimamente?».
--
-- Se conservan 30 días de historial, y los FALLOS se conservan siempre: son
-- justo lo que alguien va a querer mirar meses después.
create or replace function comun_tareas.tar_fn_podar_bitacora()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare v_total int;
begin
  with borradas as (
    delete from comun_tareas.tar_ejecucion
     where tar_estado = 'ok'
       and tar_inicio_en < now() - interval '30 days'
    returning 1)
  select count(*) into v_total from borradas;
  return coalesce(v_total, 0);
end;
$$;

select cron.unschedule('podar-bitacora-tareas')
where exists (select 1 from cron.job where jobname = 'podar-bitacora-tareas');

select cron.schedule(
  'podar-bitacora-tareas',
  '30 4 * * *',   -- 04:30 UTC, madrugada en Ecuador
  $$select comun_tareas.tar_fn_podar_bitacora();$$
);
