# Cierre de Tarea — Anillos Viales `Entrega $3` a `Entrega $6` (11 km a 17 km en Auto)

**Fecha:** 2026-11-25  
**Requerimientos:** `TNK-002`, `PLT-009`  
**Rama:** `master`

## Qué se implementó

- Se completó la serie de anillos concéntricos por isodistancia vial real en auto (`\$1` cada 2 km adicionales sobre la zona gratuita de 5 km) alrededor del Taller Tinkay (`-0.1648075, -78.466175`) usando OSRM, excluyendo zonas sin calles transitables en auto:
  - **`Entrega $3`** (`entrega_3_usd`, hasta 11 km, `\$3.00`, 51 vértices, 0 cruces)
  - **`Entrega $4`** (`entrega_4_usd`, hasta 13 km, `\$4.00`, 60 vértices, 0 cruces)
  - **`Entrega $5`** (`entrega_5_usd`, hasta 15 km, `\$5.00`, 54 vértices, 0 cruces)
  - **`Entrega $6`** (`entrega_6_usd`, hasta 17 km, `\$6.00`, 50 vértices, 0 cruces)
- Actualizado `packages/comercio/src/logistica.ts`, `packages/comercio/src/logistica.test.ts`, migración `supabase/migrations/20261125000003_tinkay_zonas_entrega_3_a_6_usd_11km_a_17km.sql` y aplicada directamente en Supabase (`oaybbpdxhlxjbpwnoymy`).
