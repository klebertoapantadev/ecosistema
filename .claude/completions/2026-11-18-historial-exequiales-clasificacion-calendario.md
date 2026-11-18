# Cierre de Tarea — Historial Permanente Exequiales, Clasificación Operativa y Calendario

- **Fecha:** 2026-11-18
- **Requerimientos cubiertos:** `PLT-009` / `TNK-002` / `TNK-005`
- **Resumen ejecutivo:**
  1. **Historial Permanente Unificado de Exequiales + Paridad de Foto de Confirmación:**
     - Migración idempotente `supabase/migrations/20261118000005_historial_permanente_exequiales_clasificacion_y_calendario.sql`.
     - Política RLS `FOR UPDATE` en `storage.objects` (`comun-publico/evidencias-entregas/%`) + `upsert: false` en `subirArchivoOperativoStorage` + respaldo de subida en servidor `subirArchivoEvidenciaServidorAction` para que las fotografías de confirmación de Exequiales (para informe IESS) y del resto de entregas se almacenen de forma 100% idéntica y permanente.
     - Sincronización bidireccional permanente entre `com_proforma`, `com_orden_taller` y `com_entrega_evidencia` incluyendo Sala de entrega, Quién solicitó, Detalle del producto, Nombre del fallecido, Fecha/Hora, Dirección de entrega y Foto GPS.
     - Unificación del historial permanente en `/panel/pedidos` (`BandejaPedidosTienda.tsx`), `/panel/envio-pedidos` (`ConsolaEnvioPedidosTaller.tsx`) y `/panel/entregas` (`ConsolaConfirmacionEntregas.tsx` — incluyendo carga/reemplazo de foto en edición previa al informe).
  2. **Clasificación Operativa Canónica (5 Categorías):**
     - `DOMICILIO`, `LOCAL`, `EXEQUIALES`, `EVENTOS`, `MOBILIARIO` con inferencia automática inteligente + selector y reclasificación manual en 1 clic (`com_fn_actualizar_clasificacion_pedido`).
  3. **Calendario Profesional con Íconos, Colores y Entregas Confirmadas en Tono Opaco:**
     - Paleta editorial sobria con íconos vectoriales Lucide (`Truck`, `Store`, `Ribbon`, `Sparkles`, `Armchair`) en `CalendarioPedidosTaller.tsx` y `InsigniaClasificacionPedido.tsx`.
     - Las entregas confirmadas en una misma fecha se distinguen visualmente con acabado opaco/atenuado, indicador `✓` y visor directo de fotografía (`ModalVisorEvidenciaEntrega`).
