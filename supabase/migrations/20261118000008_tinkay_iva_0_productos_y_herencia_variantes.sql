-- ==============================================================================
-- Migración: 20261118000008_tinkay_iva_0_productos_y_herencia_variantes.sql
-- Módulo: Catálogo Comercial Tinkay — Tarifa IVA 0% y Herencia en Variantes (PLT-009 / TNK-001)
-- Descripción:
--   1. Normaliza todos los productos de Tinkay (`tinkay` / `tnk`) en `comun_comercio.com_producto`
--      con `tarifa_iva_predeterminada = 0` y `codigo_impuesto_sri = 'IVA_0'`.
--   2. Normaliza todas las variantes de Tinkay en `comun_comercio.com_variante` con
--      `var_tarifa_iva_porcentaje = 0.00`, `var_codigo_impuesto_sri = 'IVA_0'` y
--      `iva_personalizado = false`, garantizando que respeten IVA 0% por defecto.
-- ==============================================================================

-- 1. Productos de Tinkay: IVA 0% predeterminado
update comun_comercio.com_producto
   set pro_detalle_producto = coalesce(pro_detalle_producto, '{}'::jsonb)
         || jsonb_build_object(
              'tarifa_iva_predeterminada', 0,
              'codigo_impuesto_sri', 'IVA_0'
            ),
       pro_actualizado_en = now()
 where lower(btrim(coalesce(pro_negocio, ''))) in ('tinkay', 'tnk')
   and pro_eliminado_en is null;

-- 2. Variantes de Tinkay: IVA 0% y código SRI 'IVA_0'
update comun_comercio.com_variante
   set var_tarifa_iva_porcentaje = 0.00,
       var_codigo_impuesto_sri = 'IVA_0',
       var_detalle_variante = coalesce(var_detalle_variante, '{}'::jsonb)
         || jsonb_build_object('iva_personalizado', false),
       var_actualizado_en = now()
 where lower(btrim(coalesce(var_negocio, ''))) in ('tinkay', 'tnk')
   and var_eliminado_en is null;
