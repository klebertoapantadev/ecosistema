# Completado: PWA Única con Aterrizaje Directo por Rol (Ventas, Taller, Delivery Interno/Subcontratado) y GPS en Ruta

**Fecha:** 2026-11-16
**Requerimientos:** `PLT-011`, `PLT-009`, `TNK-005`

## Resumen de lo implementado

1. **PWA Única Personalizada por Rol (`apps/tinkay-web/app/manifest.ts`, `sw-operaciones.js`, `acceso-tinkay.ts`, `panel/page.tsx`):**
   - `start_url` e `id` unificados en `"/panel"` para que una sola aplicación instalable sirva tanto a Clientes como a Ventas, Taller, Delivery Interno, Delivery Subcontratado y Administración.
   - Redirección directa automática al abrir `/panel` o la PWA instalada:
     - `VENTAS` → `/panel/conversaciones` (con barra lateral concentrada en Chats, Enviar Pedidos, Pedidos/Proformas, Entrega Inmediata e Inventario de Rosas).
     - `TALLER` → `/panel/taller` (sin precios ni montos financieros, dejando habilitados **Inventario de Rosas** y **Entrega Inmediata**).
     - `DELIVERY` (Interno) y `DELIVERY_EXTERNO` (Subcontratado) → `/panel/entregas` (únicamente captura/confirmación GPS y Mi Cuenta).

2. **Aislamiento Estricto en Base de Datos y Gestión de Invitaciones (`20261116000002_perfiles_taller_delivery_asignacion_y_ruta_gps.sql` y `@eco/gestion-usuarios`):**
   - Nuevos perfiles en `comun_seguridad.seg_perfil`: `TALLER`, `DELIVERY` (Interno), `DELIVERY_EXTERNO` (Subcontratado) y `VENTAS`.
   - `FormularioInvitacionEquipo.tsx` permite invitar por correo eligiendo cualquiera de los 6 roles operativos con descripción clara.
   - Filtrado por fila en SQL (`com_fn_obtener_tablero_entregas`): `DELIVERY_EXTERNO` solo recibe pedidos asignados a su `usu_id`; `TALLER` recibe `totalUsd = 0` en `com_fn_obtener_consola_taller_y_despacho`.

3. **Asignación de Repartidor y Ubicación GPS en Vivo en Ruta (`@eco/comercio`):**
   - Selector en línea de repartidor (Interno / Subcontratado) e insignia `📍 En Ruta · GPS Vivo` en `ConsolaEnvioPedidosTaller.tsx`.
   - Botón `Iniciar Ruta` / `Detener Ruta` en `ConsolaConfirmacionEntregas.tsx` con `watchPosition` + Broadcast Realtime + apagado automático al `Confirmar Entrega`.
