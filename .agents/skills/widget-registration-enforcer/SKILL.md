---
name: widget-registration-enforcer
description: Use when creating, modifying, or integrating new widgets, modules, or tools in the ecosystem web applications to ensure end-to-end registration across all UI panels, consoles, and navigation catalogs.
---

# Skill: Ecosystem Widget Registration Enforcer
<!-- Skill: Ejecutor Obligatorio de Registro de Widgets del Ecosistema -->

This skill provides a strict, exhaustive verification protocol and checklist that MUST be executed whenever a new UI module, tool, or widget is created or refactored in the ecosystem. It prevents "orphan widgets" by ensuring that newly created components are fully wired into all 8 essential UI and governance surfaces.
<!-- Esta skill proporciona un protocolo de verificación estricto y una lista de chequeo exhaustiva que DEBE ejecutarse siempre que se cree o refactorice un nuevo módulo, herramienta o widget en el ecosistema. Evita "widgets huérfanos" garantizando su registro en las 8 superficies esenciales de UI y gobernanza. -->

---

## 1. The 8-Point Widget Registration Mandate
<!-- 1. El Mandato de Registro en 8 Puntos de Widgets -->

Whenever a new widget or feature is developed, you MUST verify and update all of the following touchpoints:
<!-- Siempre que se desarrolle un nuevo widget o funcionalidad, DEBES verificar y actualizar todos los siguientes puntos de contacto: -->

* **Point 1: SuperAdmin Console Catalog (`ConsolaSuperAdminModular.tsx`)**
  <!-- Punto 1: Catálogo de Consola SuperAdmin (`ConsolaSuperAdminModular.tsx`) -->
  - Register the module in `CATALOGO_SUPERADMIN_TODOS` with `clave`, `nombre`, `detalle`, `ruta`, `icono`, `iconoKey`, `color`, and `rutaFisica`.
  <!-- Registrar el módulo en `CATALOGO_SUPERADMIN_TODOS` con `clave`, `nombre`, `detalle`, `ruta`, `icono`, `iconoKey`, `color` y `rutaFisica`. -->

* **Point 2: Home Page & Role-Specific Grids (`app/panel/page.tsx`)**
  <!-- Punto 2: Página de Inicio y Rejillas por Rol (`app/panel/page.tsx`) -->
  - Add the widget to the respective role constant (`WIDGETS_ADMIN`, `ACCESOS_ABOGADO`, `ACCESOS_CLIENTE`, or `WIDGETS_OPERADOR`).
  <!-- Agregar el widget a la constante de rol correspondiente (`WIDGETS_ADMIN`, `ACCESOS_ABOGADO`, `ACCESOS_CLIENTE` o `WIDGETS_OPERADOR`). -->

* **Point 3: Dynamic Panel Engine (`app/panel/[slug]/PanelDinamicoModular.tsx`)**
  <!-- Punto 3: Motor de Paneles Dinámicos (`app/panel/[slug]/PanelDinamicoModular.tsx`) -->
  - Add the widget metadata to `INVENTARIO_GLOBAL_WIDGETS`.
  <!-- Agregar los metadatos del widget a `INVENTARIO_GLOBAL_WIDGETS`. -->
  - Add the render `case "<widget_id>":` statement in `renderWidgetComponente()` with its props.
  <!-- Agregar el caso de renderizado `case "<widget_id>":` en `renderWidgetComponente()` con sus props. -->

* **Point 4: Physical Component File Mapping (`app/panel/ModalEditarWidget.tsx`)**
  <!-- Punto 4: Mapeo de Archivo Fuente Físico (`app/panel/ModalEditarWidget.tsx`) -->
  - Map the widget ID and aliases to their repository source file path so administrators can inspect and configure MFA/metadata.
  <!-- Mapear el ID y alias del widget a su ruta física en el repositorio para que los administradores puedan inspeccionar y configurar MFA/metadatos. -->

* **Point 5: Star Favorites Catalog (`app/panel/SeccionFavoritosInicio.tsx`)**
  <!-- Punto 5: Catálogo de Favoritos con Estrella (`app/panel/SeccionFavoritosInicio.tsx`) -->
  - Register the item in `CATALOGO_FAVORITOS` with `id`, `titulo`, `subtitulo`, `icono`, `href`, and `origen` (`"Mi cuenta"` | `"Configurar"`).
  <!-- Registrar el elemento en `CATALOGO_FAVORITOS` con `id`, `titulo`, `subtitulo`, `icono`, `href` y `origen`. -->

* **Point 6: Sidebar Navigation Presets (`app/panel/NavegacionSidebar.tsx`)**
  <!-- Punto 6: Presets de Navegación Lateral (`app/panel/NavegacionSidebar.tsx`) -->
  - Include the widget ID under the appropriate panel (`panel_administrar`, `panel_herramientas`, `panel_configuracion`, `panel_cuenta`) for target roles (`ADMINISTRADOR`, `OPERADOR`, `ABOGADO`, `CLIENTE`).
  <!-- Incluir el ID del widget bajo el panel adecuado (`panel_administrar`, `panel_herramientas`, `panel_configuracion`, `panel_cuenta`) para los roles objetivo. -->

* **Point 7: Configuration Panel Modular Engine (`app/panel/configuracion/PanelConfiguracionModular.tsx`)**
  <!-- Punto 7: Motor Modular del Panel de Configuración (`app/panel/configuracion/PanelConfiguracionModular.tsx`) -->
  - If the widget is configurable, register it in `TODOS_WIDGETS_CONFIG`, handle aliases in `mapaAlias`, and add its render block in `widgetActivo`.
  <!-- Si el widget es configurable, registrarlo en `TODOS_WIDGETS_CONFIG`, manejar alias en `mapaAlias` y agregar su bloque de renderizado en `widgetActivo`. -->

* **Point 8: Global Universal Search Palette (`app/panel/BuscadorModulosGlobal.tsx`)**
  <!-- Punto 8: Paleta de Búsqueda Global Universal (`app/panel/BuscadorModulosGlobal.tsx`) -->
  - Register the module in `MODULOS_INDEXADOS` with search keywords, hierarchy level requirement, and navigation URL.
  <!-- Registrar el módulo en `MODULOS_INDEXADOS` con palabras clave de búsqueda, nivel jerárquico requerido y URL de navegación. -->

---

## 2. Step-by-Step Registration Checklist
<!-- 2. Lista de Chequeo Paso a Paso para Registro -->

When finishing any module implementation:
<!-- Al finalizar la implementación de cualquier módulo: -->

1. **Verify Target Routes:** Ensure the URL query parameters (`?widget=<id>`) and direct routes match exactly without cross-linking to unrelated widgets.
   <!-- Verificar Rutas Objetivo: Asegurar que los parámetros de consulta (`?widget=<id>`) y rutas directas coincidan exactamente sin cruzar enlaces a widgets no relacionados. -->
2. **Verify TypeScript Compatibility:** Run `npx tsc --noEmit` on the app filter before pushing.
   <!-- Verificar Compatibilidad TypeScript: Ejecutar `npx tsc --noEmit` en la app correspondiente antes de hacer push. -->
3. **Verify Governance Requirements:** Update `gobernanza/productos/<app>/especificacion-funcional.md` matrix with completion status.
   <!-- Verificar Requerimientos de Gobernanza: Actualizar la matriz en `especificacion-funcional.md` con el estado completado. -->

---

## 3. Mandatory Output Summary
<!-- 3. Resumen Obligatorio de Salida -->

After creating or registering any widget, the agent must output a confirmation table:
<!-- Tras crear o registrar cualquier widget, el agente debe reportar una tabla de confirmación: -->

| Touchpoint <!-- Punto de Contacto --> | File Path <!-- Ruta de Archivo --> | Status <!-- Estado --> |
| :--- | :--- | :--- |
| 1. SuperAdmin Console <!-- 1. Consola SuperAdmin --> | `ConsolaSuperAdminModular.tsx` <!-- `ConsolaSuperAdminModular.tsx` --> | ✅ Registered <!-- ✅ Registrado --> |
| 2. Home Page Grids <!-- 2. Rejillas de Inicio --> | `app/panel/page.tsx` <!-- `app/panel/page.tsx` --> | ✅ Registered <!-- ✅ Registrado --> |
| 3. Dynamic Panel <!-- 3. Panel Dinámico --> | `PanelDinamicoModular.tsx` <!-- `PanelDinamicoModular.tsx` --> | ✅ Registered <!-- ✅ Registrado --> |
| 4. Physical Path Map <!-- 4. Mapeo Físico --> | `ModalEditarWidget.tsx` <!-- `ModalEditarWidget.tsx` --> | ✅ Registered <!-- ✅ Registrado --> |
| 5. Favorites Catalog <!-- 5. Catálogo Favoritos --> | `SeccionFavoritosInicio.tsx` <!-- `SeccionFavoritosInicio.tsx` --> | ✅ Registered <!-- ✅ Registrado --> |
| 6. Sidebar Navigation <!-- 6. Navegación Sidebar --> | `NavegacionSidebar.tsx` <!-- `NavegacionSidebar.tsx` --> | ✅ Registered <!-- ✅ Registrado --> |
| 7. Configuration Panel <!-- 7. Panel Configuración --> | `PanelConfiguracionModular.tsx` <!-- `PanelConfiguracionModular.tsx` --> | ✅ Registered <!-- ✅ Registrado --> |
| 8. Global Search Palette <!-- 8. Buscador Global --> | `BuscadorModulosGlobal.tsx` <!-- `BuscadorModulosGlobal.tsx` --> | ✅ Registered <!-- ✅ Registrado --> |
