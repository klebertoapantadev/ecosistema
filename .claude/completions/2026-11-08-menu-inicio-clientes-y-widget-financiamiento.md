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

