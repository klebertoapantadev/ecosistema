# Cierre: Renombre de áreas por KM ("Entrega 5km".."Entrega 24km") y visibilidad por rol en mapa

- **Fecha:** 2026-11-26
- **Resumen:**
  1. **Renombre de áreas de cobertura (`20261126000002_tinkay_renombrar_zonas_por_km.sql`, aplicada en vivo en Supabase + `packages/comercio/src/logistica.ts`):**
     - `centro_norte_quito` → **`Cobertura Gratuita 4km`** (`$0.00`)
     - `entrega_5km` .. `entrega_24km` → **`Entrega 5km`** (`+$0.75`) hasta **`Entrega 24km`** (`+$15.00`).
     - En `MapaCoberturaPichincha.tsx`, la etiqueta visible dentro de cada anillo muestra `"Cobertura Gratuita 4km"` y `"Entrega 5km +$0.75"` .. `"Entrega 24km +$15"`.
  2. **Visibilidad por rol en el mapa (`SelectorUbicacionEntrega.tsx`):**
     - **Operador / Admin / Ventas / SuperAdmin (`esStaffRutaEfectivo === true` y consola `/panel/logistica`):** visualizan **todas las áreas** de cobertura con sus etiquetas de km y precio.
     - **Cliente (`esStaffRutaEfectivo === false`):** visualiza **únicamente el área gratuita** (`modoCobro === "GRATIS"`) en verde en el mapa (tanto en el mapa integrado como en el modal a pantalla completa), manteniendo intacto el cálculo automático de tarifa en servidor para cualquier dirección fuera de la zona gratuita.
