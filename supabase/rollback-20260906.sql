-- ==============================================================================
-- ROLLBACK del despliegue del 2026-09-06
-- ==============================================================================
--
-- Deshace la aplicación de las 36 migraciones pendientes (de 20260802000001 en
-- adelante) sobre el proyecto `oaybbpdxhlxjbpwnoymy`.
--
-- Se apoya en el esquema `respaldo_20260906`, tomado justo antes del despliegue:
--   · 31 tablas de datos, copiadas íntegras (`esquema__tabla`)
--   · __definiciones_funciones   — el código fuente de las 26 funciones previas
--   · __definiciones_politicas   — las 62 políticas RLS previas
--   · __definiciones_constraints — las 102 restricciones previas
--   · supabase_migrations.respaldo_historial_20260906 — el historial previo
--
-- NO se ejecuta entero a ciegas. Cada bloque es independiente: aplica solo el
-- que corresponda a lo que haya que revertir. Léelo antes de correrlo.
--
-- Red de seguridad adicional: la organización está en plan Pro, con backup
-- diario automático y 7 días de retención. Este script sirve para revertir
-- quirúrgicamente sin perder lo que haya pasado después.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Esquemas nuevos: se van enteros
-- ─────────────────────────────────────────────────────────────────────────────
-- Ninguno existía antes del despliegue, así que no hay nada que preservar.
-- CASCADE se lleva sus tablas, funciones, políticas y las FK que apunten a ellos.

drop schema if exists comun_agenda        cascade;
drop schema if exists comun_comercio      cascade;
drop schema if exists comun_notificacion  cascade;  -- ojo: singular. El plural
                                                    -- (comun_notificaciones) es
                                                    -- la cola SMTP y YA EXISTÍA:
                                                    -- no tocarlo.
drop schema if exists comun_reclutamiento cascade;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Columnas añadidas a tablas que ya existían
-- ─────────────────────────────────────────────────────────────────────────────
-- Las FK hacia comun_comercio/comun_agenda ya cayeron con el CASCADE de arriba;
-- estas columnas quedarían huérfanas.

alter table tranqui_legal.trq_cita
  drop column if exists cit_reserva_id,
  drop column if exists cit_variante_id,
  drop column if exists cit_origen,
  drop column if exists cit_asignacion,
  drop column if exists cit_reasignada_de,
  drop column if exists cit_google_evento_id,
  drop column if exists cit_confirmada_en,
  drop column if exists cit_cancelada_por,
  drop column if exists cit_cobertura,
  drop column if exists cit_pago_id,
  drop column if exists cit_derecho_id;

alter table tranqui_legal.trq_materia drop column if exists mat_codigo;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tablas nuevas en esquemas que ya existían
-- ─────────────────────────────────────────────────────────────────────────────

drop table if exists tranqui_legal.trq_consulta_rapida     cascade;
drop table if exists tranqui_legal.trq_abogado_materia     cascade;
drop table if exists tranqui_legal.trq_abogado_provincia   cascade;
drop table if exists tranqui_legal.trq_version_contrato_socio cascade;
drop table if exists tranqui_legal.trq_plantilla_contrato  cascade;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Funciones: restaurar el código exacto que había antes
-- ─────────────────────────────────────────────────────────────────────────────
-- `create or replace function` pisa la versión anterior sin dejar rastro, así
-- que esto es lo único que devuelve, por ejemplo, seg_fn_eliminar_cuenta() a lo
-- que era. Las funciones que el despliegue creó de cero y no estaban en el
-- respaldo se eliminan.

do $$
declare d record;
begin
  -- 4a. Restaurar las que existían.
  for d in select definicion from respaldo_20260906.__definiciones_funciones loop
    execute d.definicion;
  end loop;

  -- 4b. Eliminar las que no existían antes.
  for d in
    select n.nspname as esq, p.proname as fn,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('comun_seguridad','tranqui_legal','comun_auditoria',
                        'comun_configuracion','comun_notificaciones','comun_catalogo')
      and not exists (
        select 1 from respaldo_20260906.__definiciones_funciones r
        where r.esquema = n.nspname and r.funcion = p.proname
          and r.argumentos = pg_get_function_identity_arguments(p.oid))
  loop
    execute format('drop function if exists %I.%I(%s) cascade', d.esq, d.fn, d.args);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Datos
-- ─────────────────────────────────────────────────────────────────────────────
-- Solo para las tablas que el despliegue modifica de verdad. Restaurar TODO
-- borraría lo que los usuarios hayan hecho desde el despliegue, así que esto va
-- tabla por tabla y a conciencia.
--
-- 5a. Las dos citas que 20260905000006 cancela por no tener abogado.

update tranqui_legal.trq_cita c
   set cit_estado = r.cit_estado,
       cit_notas  = r.cit_notas,
       cit_actualizado_en = r.cit_actualizado_en
  from respaldo_20260906.tranqui_legal__trq_cita r
 where c.cit_id = r.cit_id
   and c.cit_estado is distinct from r.cit_estado;

-- 5b. Widgets y asignaciones por rol: el despliegue inserta unos cuantos.
--     Se borra lo que no estaba y se repone lo que estaba.

delete from comun_seguridad.seg_rol_widget
 where rlw_id not in (select rlw_id from respaldo_20260906.comun_seguridad__seg_rol_widget);
delete from comun_seguridad.seg_widget
 where wdg_id not in (select wdg_id from respaldo_20260906.comun_seguridad__seg_widget);

insert into comun_seguridad.seg_widget
select * from respaldo_20260906.comun_seguridad__seg_widget
on conflict (wdg_id) do nothing;
insert into comun_seguridad.seg_rol_widget
select * from respaldo_20260906.comun_seguridad__seg_rol_widget
on conflict (rlw_id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Historial de migraciones
-- ─────────────────────────────────────────────────────────────────────────────
-- Se quitan las entradas de lo desplegado hoy. NO se restaura el respaldo
-- entero: eso devolvería el desfase de julio, que ya está arreglado y bien.

delete from supabase_migrations.schema_migrations
 where version >= '20260802000001'
   and version not in ('20260823183711','20260823185036');

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Comprobación
-- ─────────────────────────────────────────────────────────────────────────────
select
  (select count(*) from pg_namespace
    where nspname in ('comun_agenda','comun_comercio','comun_notificacion','comun_reclutamiento')) as esquemas_nuevos_restantes,
  (select count(*) from supabase_migrations.schema_migrations) as migraciones_registradas,
  (select count(*) from comun_seguridad.seg_widget) as widgets,
  (select count(*) from tranqui_legal.trq_cita where cit_estado <> 'cancelada') as citas_vivas;
-- Esperado tras revertir del todo:
--   esquemas_nuevos_restantes = 0
--   migraciones_registradas   = 35
--   widgets                   = 15
--   citas_vivas               = 2

-- ─────────────────────────────────────────────────────────────────────────────
-- Cuando el despliegue esté verificado y ya no haga falta volver atrás:
--   drop schema respaldo_20260906 cascade;
--   drop table supabase_migrations.respaldo_historial_20260906;
-- ─────────────────────────────────────────────────────────────────────────────
