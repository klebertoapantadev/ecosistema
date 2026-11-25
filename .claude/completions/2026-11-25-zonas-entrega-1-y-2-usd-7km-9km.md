# Cierre de Tarea — Zonas Concéntricas `Entrega $1` (7 km) y `Entrega $2` (9 km) en Auto

**Fecha:** 2026-11-25  
**Requerimientos:** `TNK-002`, `PLT-009`  
**Rama:** `master`

## Qué se implementó

- Se calcularon con **OSRM (red vial real de auto)** dos anillos adicionales alrededor de la zona gratuita de 5 km del Taller Tinkay (`-0.1648075, -78.466175`), excluyendo áreas sin calles transitables en auto:
  - **`Entrega $1`** (`entrega_1_usd`, tarifa fija `\$1.00`, 41 vértices sin cruces): cobertura vial hasta **7.0 km en auto** (+2 km extra sobre la zona gratuita).
  - **`Entrega $2`** (`entrega_2_usd`, tarifa fija `\$2.00`, 49 vértices sin cruces): cobertura vial hasta **9.0 km en auto** (+4 km extra sobre la zona gratuita).
- En `packages/comercio/src/componentes/MapaCoberturaPichincha.tsx`:
  - Ordenamiento de dibujo por área (anillos grandes abajo, internos arriba) y posicionamiento inteligente de etiquetas en anillos concéntricos para que **`Cobertura Gratuita`**, **`Entrega $1`** y **`Entrega $2`** no se superpongan ni dupliquen el símbolo `$`.
- Se actualizaron `packages/comercio/src/logistica.ts`, `packages/comercio/src/logistica.test.ts`, se creó la migración `supabase/migrations/20261125000002_tinkay_zonas_entrega_1_y_2_usd_7km_9km.sql` y se aplicó en Supabase (`oaybbpdxhlxjbpwnoymy`).
