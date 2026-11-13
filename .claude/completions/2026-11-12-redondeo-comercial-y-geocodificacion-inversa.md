# Redondeo Comercial de Tarifa de Envío y Geocodificación Inversa (Calles, Sector y Parroquia)

**Fecha:** 2026-11-12
**Requerimiento:** `TNK-002` / `TNK-004` (`packages/comercio`, `apps/tinkay-web`, `apps/margaritas-web`)

## Resumen de implementación

1. **Redondeo Comercial de Tarifas (`redondearTarifaComercialEnvio`)**:
   - `< $0.25` (`0..24 ctv`): aproxima hacia abajo al entero inferior (`$5.03` -> `$5.00`).
   - `$0.25..$0.50` (`25..50 ctv`): aproxima a `$X.50` (`$5.38` -> `$5.50`).
   - `> $0.50` (`51..99 ctv`): aproxima al siguiente entero superior (`$5.92` -> `$6.00`).
   - La auditoría interna (`formulaDetalle`) conserva tanto el cálculo exacto como el monto aproximado (`→ aproximado $X.XX`) exclusivamente para el simulador administrativo (`/panel/logistica`) y la orden de tienda (`/panel/pedidos`).

2. **Geocodificación Inversa de Calles, Sector y Parroquia (`geocodificarInversoCoordenadas`)**:
   - Resolución paralela (`Promise.all`) junto a OSRM en `cotizarEnvioDesdeEntradaAction`, extrayendo calle principal / POI del enlace de Google Maps, sector/barrio, parroquia urbana/rural y ciudad.
   - Autocompletado automático en Carrito (`DrawerCarritoFloristeria`), Selector de Ubicación (`SelectorUbicacionEntrega`), Chat Web (`ChatAriaFlotante`), MCP WhatsApp (`/api/mcp/catalogo`), Simulador (`/panel/logistica`) y Bandeja de Pedidos (`/panel/pedidos`).

## Verificación

- Pruebas unitarias en `packages/comercio/src/logistica.test.ts` (redondeo en los 3 tramos y extracción inversa de calles/sector/parroquia).
- `typecheck` limpio en `@eco/comercio`, `tinkay-web` y `margaritas-web`.

