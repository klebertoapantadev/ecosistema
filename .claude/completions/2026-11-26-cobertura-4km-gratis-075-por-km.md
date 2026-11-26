# Cierre: Áreas de cobertura 4 km gratis + $0.75 por cada km adicional

- **Fecha:** 2026-11-26
- **Resumen:**
  1. **Nuevas isodistancias viales reales en auto (OSRM, sin áreas sin calles):**
     - **Zona gratuita (`centro_norte_quito`):** reducida a **4.0 km** reales en auto desde Taller Tinkay (`-0.1648075, -78.466175`), excluyendo el bosque interior de Parque Metropolitano (`$0.00`).
     - **20 anillos concéntricos cada 1 km adicional (5 km a 24 km):** `Entrega $0.75` (`5 km`) hasta `Entrega $15.00` (`24 km`), sumando exactamente **`+$0.75 USD`** por cada km adicional.
     - **Fórmula `POR_KM` fuera de polígonos (25–45 km):** sincronizada en `tarifaPorKm = 0.75`, `subsidioBaseUsd = 3.00` (`4 km × $0.75`) y `recargoMinimoExtra = 0.75`.
  2. **Precisión exacta en `TARIFA_FIJA` (`packages/comercio/src/logistica.ts`):**
     - `TARIFA_FIJA` ahora cobra el monto exacto a 2 decimales (`redondearMoneda`), evitando que `$0.75`, `$2.25`, `$3.75`, etc. se redondearan a tramos de `$0.50`.
  3. **Migración SQL aplicada en vivo (`ecosistema`, `oaybbpdxhlxjbpwnoymy`):**
     - `supabase/migrations/20261126000001_tinkay_cobertura_4km_gratis_y_075_por_km.sql`: desactivó los antiguos anillos `entrega_1_usd..entrega_10_usd`, cargó los 21 nuevos polígonos en `comun_comercio.com_zona_cobertura` y sincronizó `comun_configuracion.cfg_negocio`.
