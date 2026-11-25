# Cierre de Tarea — Optimización de Zona Gratuita, Input Maps con Actualizar, Etiquetas en Mapa y Detalle de Ruta Staff

**Fecha:** 2026-11-25  
**Requerimientos:** `TNK-002`, `PLT-009`  
**Rama:** `master`

## Qué se implementó

1. **Mensaje compacto de zona gratuita (`SelectorUbicacionEntrega.tsx`):**
   - Registrado: barra compacta `✓ Zona gratuita` + `$0.00` y nota breve `El área en verde en el mapa es gratuita.`
   - Invitado: barra compacta `Regístrate para activar la zona gratuita` + acciones rápidas `Registrarme` / `Ingresar` y nota breve sobre el área verde en el mapa.

2. **Input de URL de Google Maps con selección automática y botón `Actualizar` (`SelectorUbicacionEntrega.tsx`):**
   - Al entrar/tocar el input de URL se selecciona automáticamente todo el contenido (`onFocus` + guarda `onMouseUp`) para facilitar pegar o editar de inmediato.
   - Placeholder claro cuando está vacío: `Pega aquí la dirección de Google Maps`.
   - Reemplazado el ícono ambiguo de pin por botón **`Actualizar`** con ícono `RefreshCw`.

3. **Etiquetas de zonas dentro del mapa Leaflet (`MapaCoberturaPichincha.tsx`):**
   - Cada polígono activo muestra su etiqueta centrada y legible (`Cobertura Gratuita`, `Calderón +$3`, etc.) con `pointer-events: none` para no interferir con la selección táctil del punto de entrega.

4. **Detalle de ruta para Operador / Admin / Ventas (`acciones-logistica.ts`, `SelectorUbicacionEntrega.tsx`, `ModalCheckoutTinkay.tsx`, `BandejaPedidosTienda.tsx`):**
   - `obtenerEstadoRegaloPrimeraCompraAction` ahora expone `esStaffNegocio` verificando roles activos (`SUPERADMIN`, `ADMINISTRADOR`, `OPERADOR`, `VENTAS`, `TALLER`).
   - En `SelectorUbicacionEntrega` (checkout y mapa ampliado) y en `BandejaPedidosTienda` (`/panel/pedidos`), el personal staff visualiza **KM reales**, **costo adicional de delivery cobrado**, **zona detectada**, **GPS** y **detalle completo de la ruta y ubicación**.
