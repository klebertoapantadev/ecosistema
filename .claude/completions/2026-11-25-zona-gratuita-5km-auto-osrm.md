# Cierre de Tarea — Zona de Cobertura Gratuita por Isodistancia Vial Real de 5 km en Auto

**Fecha:** 2026-11-25  
**Requerimientos:** `TNK-002`, `PLT-009`  
**Rama:** `master`

## Qué se implementó

- Se calculó la **isodistancia real de hasta 5.0 km en auto** alrededor del Taller Tinkay (`-0.1648075, -78.466175`) usando la red vial real de OpenStreetMap (OSRM), filtrando calles transitables en auto (`snap <= 110 m`) y excluyendo explícitamente áreas sin calles vehiculares (como el interior boscoso del Parque Metropolitano Guangüiltagua), generando un polígono simple de **46 vértices sin auto-intersecciones**.
- Se actualizó el polígono por defecto en `packages/comercio/src/logistica.ts` (`ZONAS_PICHINCHA_POR_DEFECTO` → `centro_norte_quito`).
- Se agregaron pruebas unitarias de inclusión/exclusión en `packages/comercio/src/logistica.test.ts` (Quicentro y El Inca dentro; bosque interior de Parque Metropolitano y Plaza Foch >5 km fuera).
- Se creó y aplicó en Supabase (`oaybbpdxhlxjbpwnoymy`) la migración `supabase/migrations/20261125000001_tinkay_zona_gratuita_isocrona_5km_auto.sql` actualizando la zona `centro_norte_quito` de `tinkay` en `comun_comercio.com_zona_cobertura`.
