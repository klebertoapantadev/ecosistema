-- ==============================================================================
-- Migración: 20260906000005_despachador_portable.sql
-- PLT-021 regla 1 / PLT-020 regla 8 — el despacho deja de depender del proveedor.
-- ==============================================================================
--
-- Hasta aquí, pg_cron ejecutaba el SQL directamente. Funcionaba, pero ataba el
-- despacho a Supabase: migrar a un Linux propio habría obligado a reescribirlo.
-- PLT-020 regla 8 exige lo contrario —«cero dependencia de vendor»— y lista tres
-- formas intercambiables de disparar: tarea de `vercel.json`, `cron`/`systemd`
-- con `curl`, o pg_cron.
--
-- QUÉ SE MUEVE Y QUÉ NO. El disparo se saca fuera; el trabajo se queda dentro.
-- Las cuatro tareas son operaciones de conjunto sobre datos que ya viven en
-- PostgreSQL, y hacerlas en TypeScript significaría traerse las filas por la red
-- para devolverlas escritas, perdiendo de paso la transacción que hoy garantiza
-- que marcar el aviso y enviarlo ocurran o no ocurran juntos. Lo que sí sale es
-- la orquestación: quién decide que es hora de despachar, y quién responde de
-- ello. Eso pasa a `packages/notificaciones` detrás de un endpoint HTTP.
--
-- Consecuencia práctica: mudarse de Vercel a un servidor propio es apuntar un
-- `curl` al mismo endpoint y borrar el trabajo de pg_cron. Ni una línea de SQL.

-- ============ El despachador informa de lo que hizo ============
-- Antes devolvía void: quien lo llamaba no podía saber si algo había fallado sin
-- ir a mirar la bitácora. Un endpoint HTTP necesita responder, así que ahora
-- devuelve el resumen de la pasada.
drop function if exists comun_tareas.tar_fn_despachar();

create or replace function comun_tareas.tar_fn_despachar(p_origen text default 'pg_cron')
returns jsonb
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
  v_resultado jsonb := '[]'::jsonb;
  v_fallos int := 0;
begin
  foreach t in array v_tareas loop
    -- Se deja constancia de QUIÉN disparó la pasada. Con dos disparadores
    -- posibles conviviendo, una bitácora que no lo diga vuelve imposible saber
    -- si el camino portable está funcionando de verdad.
    insert into comun_tareas.tar_ejecucion (tar_tarea, tar_detalle)
    values (t, jsonb_build_object('origen', coalesce(p_origen, 'desconocido')))
    returning tar_id into v_id;

    begin
      execute format('select comun_tareas.tar_fn_%I()', t) into v_filas;
      update comun_tareas.tar_ejecucion
         set tar_estado = 'ok', tar_filas = coalesce(v_filas, 0),
             tar_fin_en = now(), tar_actualizado_en = now()
       where tar_id = v_id;
      v_resultado := v_resultado || jsonb_build_object(
        'tarea', t, 'estado', 'ok', 'filas', coalesce(v_filas, 0));
    exception when others then
      update comun_tareas.tar_ejecucion
         set tar_estado = 'error', tar_error = sqlerrm,
             tar_fin_en = now(), tar_actualizado_en = now()
       where tar_id = v_id;
      v_fallos := v_fallos + 1;
      v_resultado := v_resultado || jsonb_build_object(
        'tarea', t, 'estado', 'error', 'error', sqlerrm);
    end;
  end loop;

  return jsonb_build_object(
    'origen', coalesce(p_origen, 'desconocido'),
    'ejecutado_en', now(),
    'fallos', v_fallos,
    'tareas', v_resultado);
end;
$$;

-- El endpoint corre con `service_role`, no como superusuario de la base. Sin
-- este grant, la vía portable devolvería «permission denied» y solo funcionaría
-- pg_cron, que es justo la dependencia que esta migración viene a romper.
grant execute on function comun_tareas.tar_fn_despachar(text) to service_role;

-- `authenticated` sigue sin poder invocarlo: quien pudiera dispararlo a voluntad
-- podría inundar de notificaciones a cualquiera.

-- ============ pg_cron pasa a ser la red de seguridad ============
-- El disparador principal es la tarea de `vercel.json` contra el endpoint. Este
-- se mantiene porque es el único que sigue vivo si la aplicación web está caída
-- o desplegándose, y repetir una pasada no cuesta nada: las tareas son
-- idempotentes y las notificaciones llevan clave única.
select cron.unschedule('despachador-tareas')
where exists (select 1 from cron.job where jobname = 'despachador-tareas');

select cron.schedule(
  'despachador-tareas',
  '*/15 * * * *',
  $$select comun_tareas.tar_fn_despachar('pg_cron');$$
);
