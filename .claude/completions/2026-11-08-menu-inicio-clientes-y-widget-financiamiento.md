# Cierre de Tarea: Menú de Inicio de Clientes y Widget Genérico de Financiamiento (`Próximamente`)

**Fecha:** 2026-11-08

## Cambios Realizados

1. **Eliminación de Opciones en el Menú de Inicio de Clientes (`ACCESOS_CLIENTE` en `apps/tranqi-web/app/panel/page.tsx`)**:
   - Se eliminaron las tarjetas **"Ser abogado socio"** (`Postula a la red`) y **"Subir documento"** (`Contratos, cédulas, actas`) de la rejilla de accesos rápidos del cliente.
   - Se actualizó el enlace de **"Financiamiento"** (`Cuotas para tu caso`) para abrir el widget genérico en `/panel/clientes?widget=financiamiento`.

2. **Creación del Widget Genérico de Funcionalidad en Desarrollo (`apps/tranqi-web/app/panel/WidgetProximamente.tsx`)**:
   - Componente reutilizable con diseño nativo en línea (sin clases de Tailwind CSS) que informa al usuario que *"Estamos trabajando en ello"* y que *"Próximamente estará disponible esta funcionalidad"*, con botones de acción concisos (`Volver al Inicio`, `Ver Planes`, `Agendar Cita`).

3. **Pre-configuración en 10 Puntos (`widget-registration-enforcer`)**:
   - Registrado y pre-asignado en migración SQL (`supabase/migrations/20261108000003_widget_financiamiento_proximamente.sql`), `MATRIZ_FUNCIONAL_ROLES`, `AdministracionPerfilesWidget.tsx`, `ConsolaSuperAdminModular.tsx`, `PanelDinamicoModular.tsx`, `ModalEditarWidget.tsx`, `SeccionFavoritosInicio.tsx` y `BuscadorModulosGlobal.tsx`.

4. **Restauración de Sección `Herramientas` y Sanitización del Perfil `CLIENTE`**:
   - Habilitada la opción **Herramientas** (`/panel/herramientas`) en `NavegacionSidebar.tsx` para el rol `CLIENTE` (detectando también `?modo=cliente` en URL y cookie `tranqi_modo_rol`).
   - Sanitizado el perfil `CLIENTE` en `MATRIZ_FUNCIONAL_ROLES`, `AdministracionPerfilesWidget.tsx` y `packages/gestion-usuarios/src/acciones.ts` para retirar `panel_clientes`, `panel_empresas` y `solicitud_socio`.

5. **Historial de Pagos del Cliente y Descarga de Factura Electrónica (`RIDE`)**:
   - Añadida sección **"Mis pagos y facturas"** en el inicio del cliente (`/panel`) y acceso directo en `Herramientas` (`/panel/herramientas?widget=historial_pagos`) y `Mi cuenta` (`/panel/cuenta?widget=historial_pagos`).
   - Añadido botón directo **`Descargar Factura`** e impresión PDF limpia en `WidgetFacturacionElectronica.tsx`, ocultando controles de operador en vista de cliente y sincronizando pagos de citas agendadas (`trq_cita`).


