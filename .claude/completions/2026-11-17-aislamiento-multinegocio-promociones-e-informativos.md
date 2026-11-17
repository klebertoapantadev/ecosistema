# Cierre de Tarea — Aislamiento Multi-Negocio de Campañas Informativas y Promociones

- **Fecha:** 2026-11-17
- **Rama:** `master`
- **Negocios cubiertos:** `tinkay`, `tranqi`, `margaritas`, `fastfix`

## Causa Raíz Identificada
- En `packages/comercio/src/acciones-informativos.ts`, cuando `com_fn_obtener_campanas_informativas` o la consulta directa a `com_campana_informativa` devolvían legítimamente `[]` (0 filas para `tinkay`), la condición `dataRpc.length > 0` / `data.length > 0` impedía almacenar `[]` en caché y caía en el fallback global `CAMPANAS_SEMILLA_TRANQI` (9 avisos legales, regulatorios y tributarios de Tranqi), mostrándolos en `/panel?vista=promociones` de Tinkay.

## Solución Implementada
1. ** Módulo Puro Multi-Negocio (`packages/comercio/src/utils/informativos.ts`):**
   - Partición estricta de semillas `SEMILLAS_CAMPANAS_POR_NEGOCIO` (`tranqi` conserva sus semillas jurídicas; `tinkay`, `margaritas` y `fastfix` devuelven `[]`).
   - Funciones puras `normalizarNegocioCampana`, `perteneceCampanaANegocio` y `filtrarCampanasPorNegocioYCriterios` que bloquean cualquier cruce entre negocios incluso usando alias (`TNK`, `TRQ`, `MRG`, `FFH`).
2. **Server Actions (`packages/comercio/src/acciones-informativos.ts`, `acciones-convenios.ts`, `acciones.ts`):**
   - Respuesta vacía `[]` de Supabase respetada como autoritativa en negocios comerciales sin caer jamás en semillas de `tranqi`.
   - `guardarCampanaInformativaAction`, `alternarActivoCampanaAction`, `eliminarCampanaInformativaAction` y `restaurarCampanasEjemploAction` aisladas por `inf_negocio`.
   - Endurecido `obtenerConveniosEmpresaAction` (bloque `catch`) y semillas de catálogo en `acciones.ts` para evitar filtraciones hacia otros negocios.
3. **Componentes Cliente (`ConsolaGestionInformativosWidget.tsx`, `TableroBeneficiosAvisosWidget.tsx`, `BannerInformativoSuperior.tsx`, `EspacioClienteEcommerceTinkay.tsx`):**
   - Caché `localStorage` particionada por código normalizado de negocio y filtrada con `perteneceCampanaANegocio`.
   - En `EspacioClienteEcommerceTinkay.tsx`, la pestaña `Promociones` exige además `perteneceCampanaANegocio(c, 'tinkay')` y tipos comerciales (`BENEFICIO_CONVENIO` / `COMUNICADO_GENERAL`).
4. **Base de Datos (`supabase/migrations/20261117000006_aislamiento_multinegocio_campanas_informativas.sql`):**
   - Políticas RLS y RPCs `com_fn_*_campana_informativa` endurecidas validando membresía activa del mismo negocio (`mem_negocio` = `inf_negocio`) y revocando escritura a `anon`.
5. **Pruebas Unitarias (`packages/comercio/src/informativos.test.ts`):**
   - 5 suites de aislamiento multi-negocio aprobadas (`84/84` tests pasando en `@eco/comercio`).
