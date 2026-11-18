# Aislamiento Estricto del Manual de Configuración de Catálogo Comercial (PLT-009)

**Fecha:** 2026-11-18  
**Tarea:** Corrección de fuga de contexto y eliminación de referencias cruzadas entre negocios en el Manual de Configuración de Catálogo Comercial.  
**Estado:** ✅ Completado

---

## 1. Problema Identificado
En la consola de administración de Tinkay (`/panel/catalogo-productos`), al abrir el modal **Manual de Configuración de Catálogo Comercial (PLT-009)**:
- Se mostraba una barra superior de pestañas con accesos a otros negocios (`Tinkay Floristería`, `Tranqi Legal`, `FastFix Home`, `Margaritas Floristería`).
- En el diagrama conceptual de 3 capas (`Capa 1: Categoría`, `Capa 2: Producto Master`, `Capa 3: Variantes / SKUs`), aparecían ejemplos de otros giros como `"Honorarios"` y `"Constitución SAS"` (propios de Tranqi).
- En la sección de recursos digitales se mencionaban *"los chats de Tranqi"*.

## 2. Cambios Implementados
1. **Aislamiento Multi-Tenant en Componentes de Catálogo:**
   - En `packages/comercio/src/componentes/ManualConfiguracionCatalogoModal.tsx` y `apps/tranqi-web/modulos/comercio/componentes/ManualConfiguracionCatalogoModal.tsx`:
     - Normalización canónica del negocio mediante `detectarTipoNegocio(negocio)`.
     - Ocultación total de las pestañas de otros negocios cuando `mostrarSelectorNegocios` no está activado explícitamente (comportamiento por defecto).
     - Sustitución del selector por una insignia/badge dedicada del negocio activo (ej. `Tinkay Floristería - FLORISTERÍA DE EXPORTACIÓN & ARREGLOS ON-DEMAND`).
     - Adaptación 100% específica del diagrama de 3 capas al giro correspondiente (ej. en Tinkay: Bouquets estilo coreano, tallos de rosas, hidratación con Chrysal, IVA 0% para arreglos florales e IVA 15% para complementos).
     - Corrección de copy en recursos digitales a *"vitrina e-commerce y en las conversaciones de Mía (ARIA) en WhatsApp y Web Chat"*.

2. **Verificaciones:**
   - Pruebas unitarias de `@eco/comercio` (85 pruebas pasadas).
   - Typechecks exitosos en `@eco/comercio`, `tinkay-web` y `tranqi-web`.
   - Build de producción completo de `tinkay-web` ejecutado y aprobado (código de salida 0).
