# Cierre de Tarea — Participación Colaborativa, Ventas Diarias y Comisiones Variables por Asesor (`TNK-003`)

**Fecha:** 2026-11-28  
**Requerimiento:** `TNK-003` (`100%`)  
**Rama:** `master`

## Entregables Implementados
1. **Motor puro y pruebas unitarias (`packages/comercio/src/comisiones.ts`, `comisiones.test.ts`):**
   - Cálculo de participación colaborativa (`IA` vs cada asesor humano, excluyendo notas internas y mensajes del cliente) con detección automática del líder humano.
   - Cálculo de **Base Comisionable Neta** (`Venta Total - Delivery fijo - Cargo extra delivery - Extras no comisionables - Descuentos - Pasarela`).
   - 4 reglas de reparto con tasa variable individual por asesor: `Ganador único (100%)` (default), `Proporcional real (IA queda para tienda)`, `Proporcional humanos (100%)` y `Manual libre (%)`.
   - Filtro estricto por rol y fecha Ecuador (`America/Guayaquil`): asesores ven únicamente las ventas de **HOY** (propias y de sus compañeros).
2. **Migración SQL y Server Actions (`20261128000003_comisiones_ventas_colaborativas_y_tasas_asesor.sql`, `acciones-comisiones.ts`):**
   - Tablas `com_comision_asesor_tasa`, `com_venta_comision` y `com_venta_comision_participacion` con RLS estricto, `aud_fn_auditar_tabla()` y RPCs `SECURITY DEFINER`, más respaldo híbrido inmediato en `cfg_negocio`.
3. **UI Integrada en `ConsolaVentasOmnicanal.tsx`:**
   - Barra en vivo de participación (`IA X% · ⭐ Líder Y%`) + botón `Cerrar venta`.
   - `ModalCierreVentaComision.tsx` al cerrar con `Venta completada`.
   - Pestaña `Ventas y Comisiones` (`TableroVentasComisiones.tsx`) con configuración de tasas variables por asesor, KPIs diarios/históricos y exportación `DataGrid`.
