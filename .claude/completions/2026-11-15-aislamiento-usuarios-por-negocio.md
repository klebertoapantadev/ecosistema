# Cierre de Tarea — Aislamiento de Usuarios por Negocio en Panel de Gestión

- **Fecha:** 2026-11-15
- **Requerimientos cubiertos:** `PLT-003`, `PLT-011`
- **Módulos afectados:** `packages/gestion-usuarios/src/consultas.ts`

## Resumen del Problema y Corrección

### Causa Raíz
En `packages/gestion-usuarios/src/consultas.ts`, la función `buscarUsuarios(consulta, negocio)` realizaba una consulta directa a `comun_seguridad.seg_usuario` trayendo los últimos 50 usuarios de toda la plataforma sin filtrar por pertenencia a `comun_seguridad.seg_membresia.mem_negocio`. Además, un fallback asociaba membresías de otros negocios (como Tranqi Legal) a los usuarios que no contaban con membresía en Tinkay, mostrando abogados y clientes de Tranqi dentro del panel de Tinkay.

### Corrección Realizada
1. **Filtro Estricto de Membresías:** `buscarUsuarios` ahora consulta primero las membresías en `comun_seguridad.seg_membresia` filtrando estrictamente por `mem_negocio in [negocio, negocioUpper]` (soporte normalizado para `tranqi`/`tranq`/`tinkay`/`fastfix`/`margaritas`).
2. **Inclusión de SuperAdmins:** Se incluyen únicamente los usuarios que cuentan con membresía en el negocio consultado, más los superadministradores de plataforma (`usu_superadmin_plataforma = true`).
3. **Mapeo Aislado:** El mapeo de perfiles y roles solo procesa las membresías pertinentes al negocio actual. Los roles específicos de otros negocios (como `ABOGADO` de Tranqi) ya no se filtran ni se asocian erróneamente en la vista de Tinkay.
