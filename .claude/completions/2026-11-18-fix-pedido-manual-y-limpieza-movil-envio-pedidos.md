# Cierre: Reparación de Pedido Manual y Limpieza Móvil en Enviar Pedidos (`TNK-005`)

**Fecha:** 2026-11-18
**Requerimientos:** `TNK-005`, `PLT-009`, `PLT-011`

## Problemas Resueltos
1. **Error `Could not find the 'prf_impuestos' column of 'com_proforma' in the schema cache` al cargar Pedido Manual:**
   - Al no haberse ejecutado aún la tabla `com_orden_taller` en Supabase, `crearOActualizarPedidoOperadorAction` caía en modo híbrido sobre `com_proforma` enviando `prf_impuestos: 0` (columna inexistente; la columna real es `prf_iva`) y omitiendo `prf_cliente_nombre` (`NOT NULL`).
   - Se corrigió el respaldo en `packages/comercio/src/acciones-operaciones-taller.ts` (`prf_iva`, `prf_cliente_nombre`, `prf_observaciones`, soporte de edición por `ordenId` y notificación push al despachar).
   - Se corrigieron también en `supabase/migrations/20261118000004_tarjetas_dedicatoria_hibridas_qr_musica_y_taller.sql` las referencias a `gen_random_bytes` con `search_path = ''`, columnas de `com_entrega_evidencia` y permisos `VENTAS` en `seg_fn_es_operador_o_admin_negocio`.
2. **Selección directa de producto sin pulsar `+ Agregar`:**
   - `guardarPedidoManual` ahora incorpora automáticamente el arreglo seleccionado en `SelectConBuscador` y concatena cualquier nota de color/detalle escrita debajo, autocompletando también el valor total USD.
3. **Diseño limpio en móviles y renombrado de pestañas:**
   - Eliminados los botones `Ir a Taller` y `Actualizar` y el banner técnico de migración.
   - Ocultos los subtítulos descriptivos en móviles (`<640px`).
   - Renombrados los botones a `(Icono Cruz) Exequiales` y `Pedido Manual`.
