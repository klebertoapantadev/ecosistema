-- ==============================================================================
-- comun_comercio: credenciales privadas fuera de la API y visibilidad 'TODOS'
-- (TRQ-ADM-004)
-- ==============================================================================
-- 1. Al exponer comun_comercio en la API REST (PostgREST, ver
--    supabase/functions/README.md), la política com_pasarela_staff (FOR ALL a
--    operadores y administradores del negocio) dejaría leer
--    psc_credenciales_privadas: el token de Payphone y el Basic del webhook de
--    PLUX. authenticated pierde el SELECT de esa columna; puede seguir
--    escribiéndola (la pantalla de configuración de Payphone la guarda), pero
--    no leerla. Solo la leen las funciones security definer.
--
-- 2. com_fn_pasarela_visible: `visibilidad = 'TODOS'` abre la pasarela a todos
--    aunque esté en PRUEBAS. Decisión de producto (5-nov-2026): probar PLUX en
--    sandbox con usuarios reales, asumiendo que una tarjeta de prueba activa
--    un plan sin cobro real mientras dure el sandbox.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. psc_credenciales_privadas: solo escritura para authenticated
-- ------------------------------------------------------------------------------
revoke select on comun_comercio.com_pasarela_configuracion from anon, authenticated;

grant select (
  psc_id,
  psc_secuencial,
  psc_negocio,
  psc_pasarela,
  psc_nombre_visible,
  psc_ambiente,
  psc_activo,
  psc_credenciales_publicas,
  psc_comision_porcentaje,
  psc_comision_fija,
  psc_orden_visual,
  psc_detalle_pasarela,
  psc_creado_en,
  psc_actualizado_en,
  psc_eliminado_en
) on comun_comercio.com_pasarela_configuracion to authenticated;

-- ------------------------------------------------------------------------------
-- 2. Visibilidad: 'TODOS' explícito abre también una pasarela en PRUEBAS
-- ------------------------------------------------------------------------------
-- Sin `visibilidad`, una pasarela en PRUEBAS sigue oculta (solo superadmins y
-- probadores): abrir un sandbox a todos tiene que ser una decisión explícita.
create or replace function comun_comercio.com_fn_pasarela_visible(p_ambiente text, p_detalle jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_detalle->>'visibilidad', '') = 'TODOS'
      or (p_ambiente = 'PRODUCCION' and coalesce(p_detalle->>'visibilidad', 'TODOS') <> 'PROBADORES')
      or comun_seguridad.seg_fn_es_superadmin()
      or exists (
           select 1
           from comun_seguridad.seg_usuario u
           cross join lateral jsonb_array_elements_text(
             case when jsonb_typeof(p_detalle->'probadores') = 'array' then p_detalle->'probadores'
                  else '[]'::jsonb end) p(correo)
           where u.usu_id = auth.uid()
             and lower(u.usu_correo) = lower(trim(p.correo))
         );
$$;
