---
name: widget-registration-enforcer
description: Use when creating, modifying, or integrating new widgets, modules, or tools in the ecosystem web applications to ensure end-to-end registration and automated default role/panel pre-configuration across all UI panels, consoles, and navigation catalogs.
---

# Skill: Ecosystem Widget Registration & Pre-Configuration Enforcer
<!-- Skill: Ejecutor Obligatorio de Registro y Pre-configuración de Widgets del Ecosistema -->

This skill provides a strict, exhaustive verification protocol and checklist that MUST be executed whenever a new UI module, tool, or widget is created or refactored in the ecosystem. It prevents "orphan widgets" by ensuring that newly created components are fully wired and **PRE-CONFIGURED BY DEFAULT** for their target roles and panels into all 10 essential UI and database surfaces.
<!-- Esta skill proporciona un protocolo de verificación estricto y una lista de chequeo exhaustiva que DEBE ejecutarse siempre que se cree o refactorice un nuevo módulo, herramienta o widget en el ecosistema. Evita "widgets huérfanos" garantizando su registro y PRE-CONFIGURACIÓN POR DEFECTO para sus roles y paneles objetivo en las 10 superficies esenciales de UI y base de datos. -->

---

## 1. The 10-Point Widget Registration & Pre-Configuration Mandate
<!-- 1. El Mandato de Registro y Pre-configuración en 10 Puntos de Widgets -->

Whenever a new widget or feature is developed, you MUST verify and update all of the following touchpoints:
<!-- Siempre que se desarrolle un nuevo widget o funcionalidad, DEBES verificar y actualizar todos los siguientes puntos de contacto: -->

* **Point 1: Database Migration (`supabase/migrations/`)**
  <!-- Punto 1: Migración de Base de Datos (`supabase/migrations/`) -->
  - Insert or update the widget in `comun_seguridad.seg_widget` for all 4 businesses (`tranqi`, `fastfix`, `tinkay`, `margaritas`) with `wdg_clave`, `wdg_nombre`, `wdg_activo = true`, and `wdg_detalle_widget` (`descripcion`, `categoria`, `ruta`, `panel_defecto`, `icono`).
  - Pre-configure default access in `comun_seguridad.seg_rol_widget` (`rlw_negocio`, `rlw_rol`, `rlw_widget_id`, `rlw_visible = true`) for all authorized roles according to functional specifications.
  <!-- Insertar o actualizar el widget en `comun_seguridad.seg_widget` para los 4 negocios y pre-configurar acceso por defecto en `comun_seguridad.seg_rol_widget` para los roles autorizados. -->

* **Point 2: Master Governance & Profile Pre-Configuration (`AdministracionPerfilesWidget.tsx`)**
  <!-- Punto 2: Gobernanza Maestra y Pre-configuración de Perfiles (`AdministracionPerfilesWidget.tsx`) -->
  - Register in `WIDGETS_INVENTARIO_INICIALES` with `clave`, `nombre`, `descripcion`, `categoria`, `ruta`, `rutaFisica`, and default `panelId`.
  - Add the widget ID to `widgetsAsignadosPorPanel[panelId]` for all target roles in `PERFILES_INICIALES` (`CLIENTE`, `OPERADOR`, `ABOGADO`, `ADMINISTRADOR`, `SUPERADMIN`).
  - Add the interactive card case in `RenderizadorWidgetReal` for live administrator preview.
  <!-- Registrar en `WIDGETS_INVENTARIO_INICIALES`, pre-asignar en `PERFILES_INICIALES` por panel para cada rol y agregar previsualización en `RenderizadorWidgetReal`. -->

* **Point 3: SuperAdmin Console Catalog (`ConsolaSuperAdminModular.tsx`)**
  <!-- Punto 3: Catálogo de Consola SuperAdmin (`ConsolaSuperAdminModular.tsx`) -->
  - Register the module in `CATALOGO_SUPERADMIN_TODOS` with `clave`, `nombre`, `detalle`, `ruta`, `icono`, `iconoKey`, `color`, and `rutaFisica`.
  <!-- Registrar el módulo en `CATALOGO_SUPERADMIN_TODOS` con `clave`, `nombre`, `detalle`, `ruta`, `icono`, `iconoKey`, `color` y `rutaFisica`. -->

* **Point 4: Home Page & Role-Specific Grids (`app/panel/page.tsx`)**
  <!-- Punto 4: Página de Inicio y Rejillas por Rol (`app/panel/page.tsx`) -->
  - Add the widget to the respective role constant (`WIDGETS_ADMIN`, `WIDGETS_OPERADOR`, `ACCESOS_ABOGADO`, or `ACCESOS_CLIENTE`).
  <!-- Agregar el widget a la constante de rol correspondiente (`WIDGETS_ADMIN`, `WIDGETS_OPERADOR`, `ACCESOS_ABOGADO` o `ACCESOS_CLIENTE`). -->

* **Point 5: Dynamic Panel Engine (`app/panel/[slug]/PanelDinamicoModular.tsx`)**
  <!-- Punto 5: Motor de Paneles Dinámicos (`app/panel/[slug]/PanelDinamicoModular.tsx`) -->
  - Add the widget metadata to `INVENTARIO_GLOBAL_WIDGETS`.
  - Add the render `case "<widget_id>":` statement in `renderWidgetComponente()` with its props.
  - Include the widget in the preset lists of `obtenerWidgetsInicialesDinamicos` and `cargarConfiguracion` for target roles.
  <!-- Agregar metadatos en `INVENTARIO_GLOBAL_WIDGETS`, render `case` en `renderWidgetComponente()` y presets en `obtenerWidgetsInicialesDinamicos`. -->

* **Point 6: Physical Component File Mapping (`app/panel/ModalEditarWidget.tsx`)**
  <!-- Punto 6: Mapeo de Archivo Fuente Físico (`app/panel/ModalEditarWidget.tsx`) -->
  - Map the widget ID and aliases to their repository source file path so administrators can inspect and configure MFA/metadata.
  <!-- Mapear el ID y alias del widget a su ruta física en el repositorio para que los administradores puedan inspeccionar y configurar MFA/metadatos. -->

* **Point 7: Star Favorites Catalog (`app/panel/SeccionFavoritosInicio.tsx`)**
  <!-- Punto 7: Catálogo de Favoritos con Estrella (`app/panel/SeccionFavoritosInicio.tsx`) -->
  - Register the item in `CATALOGO_FAVORITOS` with `id`, `titulo`, `subtitulo`, `icono`, `href`, and `origen` (`"Mi cuenta"` | `"Configurar"` | `"Herramientas"`).
  <!-- Registrar el elemento en `CATALOGO_FAVORITOS` con `id`, `titulo`, `subtitulo`, `icono`, `href` y `origen`. -->

* **Point 8: Sidebar Navigation Presets (`app/panel/NavegacionSidebar.tsx`)**
  <!-- Punto 8: Presets de Navegación Lateral (`app/panel/NavegacionSidebar.tsx`) -->
  - Include the widget ID under the appropriate panel (`panel_administrar`, `panel_herramientas`, `panel_configuracion`, `panel_cuenta`) in `widgetsPorPanel` fallback presets for target roles (`ADMINISTRADOR`, `OPERADOR`, `ABOGADO`, `CLIENTE`).
  <!-- Incluir el ID del widget bajo el panel adecuado en `widgetsPorPanel` para los roles objetivo. -->

* **Point 9: Configuration Panel Modular Engine (`app/panel/configuracion/PanelConfiguracionModular.tsx`)**
  <!-- Punto 9: Motor Modular del Panel de Configuración (`app/panel/configuracion/PanelConfiguracionModular.tsx`) -->
  - If the widget is configurable, register it in `TODOS_WIDGETS_CONFIG`, handle aliases in `mapaAlias`, and add its render block in `widgetActivo`.
  <!-- Si el widget es configurable, registrarlo en `TODOS_WIDGETS_CONFIG`, manejar alias en `mapaAlias` y agregar su bloque de renderizado en `widgetActivo`. -->

* **Point 10: Global Universal Search Palette (`app/panel/BuscadorModulosGlobal.tsx`)**
  <!-- Punto 10: Paleta de Búsqueda Global Universal (`app/panel/BuscadorModulosGlobal.tsx`) -->
  - Register the module in `MODULOS_INDEXADOS` with search keywords, hierarchy level requirement, and navigation URL.
  <!-- Registrar el módulo en `MODULOS_INDEXADOS` con palabras clave de búsqueda, nivel jerárquico requerido y URL de navegación. -->

---

## 2. Default Pre-Configuration Matrix (Zero-Config Rule)
<!-- 2. Matriz de Pre-configuración por Defecto (Regla Cero-Configuración) -->

When determining where a widget should appear:
<!-- Al determinar dónde debe aparecer un widget: -->

1. **Self-Service & Client Tools** -> Pre-assign to `panel_herramientas` and `panel_cuenta` for `CLIENTE`, `ABOGADO`, `OPERADOR`, `ADMINISTRADOR`, `SUPERADMIN`.
2. **Operations & Case Management** -> Pre-assign to `panel_administrar` for `OPERADOR`, `ADMINISTRADOR`, `SUPERADMIN` (and `ABOGADO` if legal case CRM).
3. **Platform Settings & Integrations** -> Pre-assign to `panel_configuracion` for `ADMINISTRADOR`, `SUPERADMIN`.
4. **Security & Audit Logs** -> Pre-assign to `panel_administrar` / `panel_seguridad` for `ADMINISTRADOR`, `SUPERADMIN`.

---

## 3. Mandatory Output Summary
<!-- 3. Resumen Obligatorio de Salida -->

After creating or registering any widget, the agent must output a confirmation table:
<!-- Tras crear o registrar cualquier widget, el agente debe reportar una tabla de confirmación: -->

| Touchpoint <!-- Punto de Contacto --> | File Path <!-- Ruta de Archivo --> | Status <!-- Estado --> |
| :--- | :--- | :--- |
| 1. BDD Migration <!-- 1. Migración BDD --> | `supabase/migrations/*_widget.sql` | ✅ Registered & Assigned <!-- ✅ Registrado y Asignado --> |
| 2. Master Governance <!-- 2. Gobernanza Maestra --> | `AdministracionPerfilesWidget.tsx` | ✅ Pre-configured <!-- ✅ Pre-configurado --> |
| 3. SuperAdmin Console <!-- 3. Consola SuperAdmin --> | `ConsolaSuperAdminModular.tsx` | ✅ Registered <!-- ✅ Registrado --> |
| 4. Home Page Grids <!-- 4. Rejillas de Inicio --> | `app/panel/page.tsx` | ✅ Pre-assigned <!-- ✅ Pre-asignado --> |
| 5. Dynamic Panel <!-- 5. Panel Dinámico --> | `PanelDinamicoModular.tsx` | ✅ Registered & Presets <!-- ✅ Registrado y Presets --> |
| 6. Physical Path Map <!-- 6. Mapeo Físico --> | `ModalEditarWidget.tsx` | ✅ Registered <!-- ✅ Registrado --> |
| 7. Favorites Catalog <!-- 7. Catálogo Favoritos --> | `SeccionFavoritosInicio.tsx` | ✅ Registered <!-- ✅ Registrado --> |
| 8. Sidebar Navigation <!-- 8. Navegación Sidebar --> | `NavegacionSidebar.tsx` | ✅ Pre-assigned Presets <!-- ✅ Presets Pre-asignados --> |
| 9. Configuration Panel <!-- 9. Panel Configuración --> | `PanelConfiguracionModular.tsx` | ✅ Registered <!-- ✅ Registrado --> |
| 10. Global Search Palette <!-- 10. Buscador Global --> | `BuscadorModulosGlobal.tsx` | ✅ Registered <!-- ✅ Registrado --> |
