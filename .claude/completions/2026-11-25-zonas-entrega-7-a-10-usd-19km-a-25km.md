# Cierre de Tarea — Anillos Viales `Entrega $7` a `Entrega $10` (19 km a 25 km en Auto)

**Fecha:** 2026-11-25  
**Requerimientos:** `TNK-002`, `PLT-009`  
**Rama:** `master`

## Qué se implementó

- Se completó la serie de anillos concéntricos por isodistancia vial real en auto hasta `\$10` (`\$1` cada 2 km adicionales sobre la zona gratuita de 5 km) alrededor del Taller Tinkay (`-0.1648075, -78.466175`) usando OSRM, excluyendo zonas sin calles transitables en auto:
  - **`Entrega $7`** (`entrega_7_usd`, hasta 19 km, `\$7.00`, 52 vértices, 0 cruces)
  - **`Entrega $8`** (`entrega_8_usd`, hasta 21 km, `\$8.00`, 45 vértices, 0 cruces)
  - **`Entrega $9`** (`entrega_9_usd`, hasta 23 km, `\$9.00`, 51 vértices, 0 cruces)
  - **`Entrega $10`** (`entrega_10_usd`, hasta 25 km, `\$10.00`, 54 vértices, 0 cruces)
- Actualizado `packages/comercio/src/logistica.ts`, `packages/comercio/src/logistica.test.ts`, migración `supabase/migrations/20261125000004_tinkay_zonas_entrega_7_a_10_usd_19km_a_25km.sql` y aplicada directamente en Supabase (`oaybbpdxhlxjbpwnoymy`).
