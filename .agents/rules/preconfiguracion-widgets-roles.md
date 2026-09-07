# Regla Obligatoria: Pre-configuración por Defecto de Widgets y Paneles por Rol

**Ámbito:** Transversal a todas las aplicaciones web (`tranqi-web`, `fastfix-web`, `tinkay-web`, `margaritas-web`), paquetes compartidos (`@eco/*`) y migraciones de base de datos Supabase.

---

## 1. Principio Fundamental
**Cero Widgets Huérfanos.** Cada nuevo módulo, panel o widget de interfaz DEBE nacer completamente pre-configurado y asignado a los roles correspondientes en el panel más adecuado según su propósito funcional y las especificaciones de negocio.

El usuario o SuperAdmin tiene la potestad de reconfigurar o retirar el widget posteriormente desde la consola de gobernanza, pero **el agente de IA debe dejar la pre-configuración totalmente operativa desde el momento del desarrollo inicial**. Nunca se debe forzar al usuario o SuperAdmin a configurar manualmente un widget recién desarrollado para poder verlo.

---

## 2. Matriz de Criterio Funcional para Pre-Asignación por Defecto

Al crear o registrar cualquier widget, el agente debe asignarlo siguiendo estos criterios estrictos:

| Tipo / Propósito Funcional del Módulo | Panel Idóneo | Roles Asignados por Defecto |
| :--- | :--- | :--- |
| **Herramientas Personales, Billetera, Firma Digital, Compras** | `panel_herramientas` | `CLIENTE`, `ABOGADO`, `OPERADOR`, `ADMINISTRADOR`, `SUPERADMIN` |
| **Directorio de Clientes, CRM, Altas Asistidas, Expedientes** | `panel_administrar` (y `panel_herramientas` para profesionales) | `ABOGADO`, `OPERADOR`, `ADMINISTRADOR`, `SUPERADMIN` |
| **Aprobación de Socios, Solicitudes, Postulaciones** | `panel_administrar` (revisión) / `panel_herramientas` (postular) | `OPERADOR`, `ADMINISTRADOR`, `SUPERADMIN` (y `CLIENTE` para postularse) |
| **Transacciones, Pagos, Conciliación SRI, Facturación** | `panel_administrar` (historial/auditoría) / `panel_cuenta` (datos SRI) | `OPERADOR`, `ADMINISTRADOR`, `SUPERADMIN` (y todos para datos SRI) |
| **Notificaciones Masivas, Monitoreo y Bitácora** | `panel_administrar` | `OPERADOR`, `ADMINISTRADOR`, `SUPERADMIN` |
| **Preferencias de Canales y Alertas de Usuario** | `panel_configuracion` | `CLIENTE`, `ABOGADO`, `OPERADOR`, `ADMINISTRADOR`, `SUPERADMIN` |
| **Configuración del Negocio, SMTP, Pasarela Payphone, Agentes IA** | `panel_configuracion` | `ADMINISTRADOR`, `SUPERADMIN` |
| **Gestión de Miembros, Perfiles y Auditoría PostgreSQL** | `panel_administrar` / `panel_configuracion` | `ADMINISTRADOR`, `SUPERADMIN` |

---

## 3. Puntos de Sincronización Mandatorios al Crear un Widget

1. **Migración SQL BDD:**
   - Insertar en `comun_seguridad.seg_widget` con metadatos JSONB (`descripcion`, `categoria`, `ruta`, `panel_defecto`, `icono`).
   - Insertar en `comun_seguridad.seg_rol_widget` para cada rol objetivo con `rlw_visible = true`.
2. **Inventario y Perfiles Iniciales (`AdministracionPerfilesWidget.tsx`):**
   - Registrar en `WIDGETS_INVENTARIO_INICIALES` con su categoría, ruta y ruta física.
   - Registrar en `PERFILES_INICIALES` dentro de `widgetsAsignadosPorPanel[panelId]` para cada perfil base (`CLIENTE`, `OPERADOR`, `ABOGADO`, `ADMINISTRADOR`, `SUPERADMIN`).
   - Añadir su tarjeta interactiva en `RenderizadorWidgetReal`.
3. **Sidebar y Paneles Dinámicos:**
   - Añadir la clave en `widgetsPorPanel` de `NavegacionSidebar.tsx`.
   - Añadir la clave en `obtenerWidgetsInicialesDinamicos` de `PanelDinamicoModular.tsx`.
4. **Catálogo de SuperAdmin & Búsqueda:**
   - Registrar en `ConsolaSuperAdminModular.tsx` (`CATALOGO_SUPERADMIN_TODOS`).
   - Registrar en `BuscadorModulosGlobal.tsx` (`MODULOS_INDEXADOS`).
5. **Gobernanza:**
   - Actualizar la especificación funcional en `gobernanza/productos/.../especificacion-funcional.md`.
