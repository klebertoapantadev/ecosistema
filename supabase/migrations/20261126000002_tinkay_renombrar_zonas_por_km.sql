-- ============================================================================
-- Migración: 20261126000002_tinkay_renombrar_zonas_por_km.sql
-- Renombra las áreas de cobertura de Tinkay con los kilómetros alcanzados desde
-- el local:
--   - centro_norte_quito -> "Cobertura Gratuita 4km"
--   - entrega_5km .. entrega_24km -> "Entrega 5km" .. "Entrega 24km"
-- y sincroniza el snapshot en comun_configuracion.cfg_negocio.
-- ============================================================================

do $$
begin
  update comun_comercio.com_zona_cobertura
     set zon_nombre = 'Cobertura Gratuita 4km',
         zon_actualizado_en = now()
   where zon_negocio = 'tinkay'
     and zon_codigo = 'centro_norte_quito'
     and zon_eliminado_en is null;

  update comun_comercio.com_zona_cobertura
     set zon_nombre = 'Entrega ' || substring(zon_codigo from '^entrega_([0-9]+)km$') || 'km',
         zon_actualizado_en = now()
   where zon_negocio = 'tinkay'
     and zon_codigo ~ '^entrega_[0-9]+km$'
     and zon_eliminado_en is null;

  update comun_configuracion.cfg_negocio
     set cfg_detalle_configuracion = jsonb_set(
           jsonb_set(
             coalesce(cfg_detalle_configuracion, '{}'::jsonb),
             '{logistica,zonaGratisNombre}',
             '"Cobertura Gratuita 4km"'::jsonb,
             true
           ),
           '{logistica,zonas}',
           (
             select coalesce(jsonb_agg(
               jsonb_build_object(
                 'id', zon_id::text,
                 'codigo', zon_codigo,
                 'nombre', zon_nombre,
                 'provincia', zon_provincia,
                 'modoCobro', zon_modo_cobro,
                 'tarifaFija', zon_tarifa_fija,
                 'prioridad', zon_prioridad,
                 'activo', zon_activo,
                 'color', coalesce(zon_detalle_zona->>'color', '#16A34A'),
                 'sectoresReferencia', coalesce(zon_detalle_zona->'sectores_referencia', '[]'::jsonb),
                 'poligono', zon_poligono
               ) order by zon_prioridad asc, zon_tarifa_fija asc
             ), '[]'::jsonb)
             from comun_comercio.com_zona_cobertura
             where zon_negocio = 'tinkay'
               and zon_activo = true
               and zon_eliminado_en is null
           ),
           true
         ),
         cfg_actualizado_en = now()
   where cfg_negocio = 'tinkay';
end $$;
