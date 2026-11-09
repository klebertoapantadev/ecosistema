# Cierre de Tarea — Persistencia Definitiva de Configuración de Perfiles y Retiro de Widgets (`PLT-011`)

- **Fecha:** 2026-11-09
- **Requerimiento:** `PLT-011` (Regla 46)
- **Rama:** `master`

## Causas Raíz Identificadas
1. **Sobrescritura forzada para `CLIENTE` y `ABOGADO` al montar:** `AdministracionPerfilesWidget.tsx` y `PanelDinamicoModular.tsx` tenían un bloque condicional que restablecía `CLIENTE` y `ABOGADO` a `PERFILES_INICIALES` / `wCanonicos` en cada recarga (`F5`).
2. **Condición de carrera en `useEffect` de hidratación:** El `useEffect` de guardado en `localStorage` se ejecutaba en el primer renderizado con `PERFILES_INICIALES` antes de que la lectura de `localStorage` actualizara el estado.
3. **Desfase de nombres de propiedad y claves de negocio en PostgreSQL:** `guardarConfiguracionPanelesPerfilAction` escribía `widgetsAsignadosPorPanel` bajo `negocios["tranqi"]`, mientras que `obtenerConfiguracionNavegacionRolAction` leía `widgetsPorPanel` bajo `negocios["TRANQ"]`. Además, `guardarAsignacionWidget` hacía `DELETE` en vez de conservar `rlw_visible = false`.
4. **Re-inyección por unión con `MATRIZ_FUNCIONAL_ROLES` (`[...wCanonicos, ...listW]`):** Tanto la Server Action como los paneles dinámicos (`PanelDinamicoModular`, `NavegacionSidebar`, `PanelAdministrarModular`, `PanelCuentaModular`) unían los widgets canónicos con la lista guardada, reinsertando cualquier widget eliminado.

## Solución Implementada
- [`packages/gestion-usuarios/src/acciones.ts`](file:///c:/IA/Ecosistema/packages/gestion-usuarios/src/acciones.ts):
  - Normalización de claves de negocio compatibles (`tranqi`, `tranq`, `TRANQ`, `TRANQI`).
  - Guardado unificado de `widgetsAsignadosPorPanel`, `widgetsPorPanel`, `widgetsRetiradosPorPanel`, `configuradoExplicitamente: true` y `actualizadoEn` en `comun_seguridad.seg_perfil.per_detalle_perfil`.
  - Persistencia de `rlw_visible: false` en `comun_seguridad.seg_rol_widget` al retirar un widget.
  - Nueva acción `obtenerConfiguracionTodosPerfilesAction` para hidratar la consola de perfiles desde PostgreSQL comparando timestamps (`actualizadoEn`).
- [`packages/gestion-usuarios/src/componentes/AdministracionPerfilesWidget.tsx`](file:///c:/IA/Ecosistema/packages/gestion-usuarios/src/componentes/AdministracionPerfilesWidget.tsx):
  - Eliminado el reset forzado de `CLIENTE` y `ABOGADO`.
  - Añadido `hidratadoRef` para evitar que el primer render sobrescriba `localStorage`.
  - Registro explícito de `widgetsRetiradosPorPanel` al retirar o mover widgets y sincronización híbrida LocalStorage + PostgreSQL.
- [`apps/tranqi-web/app/panel/[slug]/PanelDinamicoModular.tsx`](file:///c:/IA/Ecosistema/apps/tranqi-web/app/panel/%5Bslug%5D/PanelDinamicoModular.tsx), [`NavegacionSidebar.tsx`](file:///c:/IA/Ecosistema/apps/tranqi-web/app/panel/NavegacionSidebar.tsx), [`PanelAdministrarModular.tsx`](file:///c:/IA/Ecosistema/apps/tranqi-web/app/panel/administrar/PanelAdministrarModular.tsx) y [`PanelCuentaModular.tsx`](file:///c:/IA/Ecosistema/apps/tranqi-web/app/panel/cuenta/PanelCuentaModular.tsx):
  - Respeto estricto a la lista configurada y exclusión de `widgetsRetiradosPorPanel` sin re-inyectar `wCanonicos`.
