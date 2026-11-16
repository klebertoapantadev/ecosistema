# Cierre de Tarea — Pantalla Enviar Pedidos, Pantalla Taller con Notificaciones, Exequiales vía Llamada y Calendario (Hoy / Semana / Mes)

**Fecha:** 2026-11-16
**Negocios / Paquetes:** `apps/tinkay-web`, `apps/margaritas-web`, `apps/tranqi-web`, `@eco/comercio`, `@eco/configuracion-negocio`, `@eco/gestion-usuarios`, `supabase/migrations`

## Resumen de Entregables Implementados

1. **Pantalla de Programación y Envío de Pedidos (`/panel/envio-pedidos` — `ConsolaEnvioPedidosTaller.tsx`):**
   - Sincronización automática de todas las ventas (`com_proforma`) en bandeja de validación con `@eco/datagrid`, filtro por fecha de entrega (`Hoy`, `Mañana / Futuros`, `Por Enviar`) y despacho individual o masivo (`Enviar a Taller` / `Enviar Hoy`).
   - Carga manual de pedidos conocidos con anticipación (elaboración hoy para entrega mañana o miércoles) con los 3 rangos horarios oficiales (`A) 09:00 - 13:00`, `B) 13:00 - 17:00`, `C) 17:00 - 20:00`, homologados también en el carrito y checkout web).
   - Formulario rápido de **Llamada Exequiales**: `Set condolencias (3 arreglos)` por defecto, fecha `Hoy` por defecto, hora, quién solicita (`Cristian Montaluisa`, `Cristina` o libre), Sala (`Sala 1..4` / `Capilla / Oficina`) y nombre del fallecido, despachando de inmediato a Taller y pre-cargando la orden en `/panel/entregas`.

2. **Pantalla `"Taller"` (`/panel/taller` — `ConsolaTallerFloral.tsx`):**
   - Recepción de notificaciones en tiempo real (Supabase Realtime `com_orden_taller` + Broadcast `eco-taller-*` + `CampanaNotificaciones` + alerta sonora y notificación del navegador).
   - Visualización de pedidos de **Hoy** y **Futuros**, manteniendo **ocultos por defecto los históricos** con botón explícito `Ver Históricos`.
   - Botones directos para actualizar estado: **`En Preparación`** y **`Listo Entrega`**.

3. **Calendario de Pedidos (`CalendarioPedidosTaller.tsx`):**
   - Vistas conmutables **`Hoy (Elaboración)`**, **`Semana`** y **`Mes`** marcando cada fecha de entrega y mostrando en `Hoy` todos los pedidos en elaboración.

4. **Integración en Confirmación de Entregas (`/panel/entregas`) y Registro 10/10 de Widgets:**
   - Tarjetas táctiles de órdenes Exequiales pre-cargadas con su estado de Taller (`🟢 Listo entrega` / `🔨 En preparación`) donde solo se completan datos faltantes o eventuales cambios de Sala.
   - Pre-configuración completa de `envio_pedidos_taller` y `taller_floral` en BDD (`20261116000001_despacho_pedidos_y_consola_taller.sql`) y en las 10 superficies de UI.
