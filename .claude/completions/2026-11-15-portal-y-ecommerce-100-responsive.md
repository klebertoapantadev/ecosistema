# Cierre de Tarea — Portal y Ecommerce 100% Responsive

- **Fecha**: 2026-11-15
- **Rama**: `master`
- **Estado**: Completado

## Problema reportado

En dispositivos móviles (`<= 390px`), el portal `/panel` renderizaba la barra lateral `.panel-nav` fija a `260px` junto al contenido principal, comprimiendo la columna de trabajo a menos de `130px`. Adicionalmente, múltiples consolas operativas, modales de administración y vistas del ecommerce tenían rejillas rígidas (`1fr 1fr`, `minmax(320px+, 1fr)`), ausencia de `.sr-only` en cabecera ecommerce y carencia de estilos base de `@eco/datagrid` y `.rejilla-auto` fuera de `tranqi-web`.

## Solución implementada

1. **Shell Responsivo del Portal (`MarcoPanelLateral`)**:
   - Nuevo componente compartido en `packages/configuracion-negocio/src/componentes/MarcoPanelLateral.tsx` integrado en `apps/tinkay-web/app/panel/layout.tsx`, `apps/margaritas-web/app/panel/layout.tsx` y `apps/fastfix-web/app/panel/layout.tsx`.
   - En escritorio (`> 880px`) conserva el sidebar fijo de `260px`; en tablet/móvil (`<= 880px`) conmuta a barra superior sticky `.panel-barra-movil` con botón hamburguesa, insignia de rol, acceso directo a tienda y cajón deslizable (`drawer`) con cierre automático al navegar, tecla `Escape` y bloqueo de scroll de fondo.

2. **Estilos Globales Base y DataGrid**:
   - `apps/tinkay-web/app/globals.css` y `packages/identidad/src/estilos-base.css`: variables `:root`, reglas de `.panel-layout` / `.panel-barra-movil` / `.panel-nav`, `.panel-contenido` fluido con `clamp()` y `min-width: 0`, `.tabla-panel-envoltura`, `.rejilla-auto`, estilos completos de `@eco/datagrid`, tarjetas de acceso apiladas en móvil y `font-size: 16px` en inputs móviles para evitar auto-zoom en iOS Safari.

3. **Consolas Operativas y Administrativas Compartidas**:
   - `@eco/comercio`: `ConsolaVentasOmnicanal.tsx` (modo adaptativo `desktop` 4 cols / `tablet` 2 cols / `movil` 1 col con conmutación entre `lista`, `chat` y `ficha` 360°), `FormularioLogisticaCobertura.tsx`, `BandejaPedidosTienda.tsx`, `SelectorUbicacionEntrega.tsx`, `CatalogoProductosComercio.tsx`, `ConsolaGestionCatalogo.tsx`, `ConsolaTestimoniosClientes.tsx`, `ModalCrearProducto.tsx`, `ModalEditarProducto.tsx`, `ModalCrearCategoria.tsx`, `ModalGestionTiposOferta.tsx`, `ModalEditarVariacionProforma.tsx`, `EditorComboYVolumen.tsx`, `ConfiguracionFacturacionSri.tsx`, `ConfiguracionPasarelaPayphone.tsx`, `WidgetFacturacionElectronica.tsx`, `ConsolaGestionInformativosWidget.tsx`, `GestionConveniosCorporativos.tsx`, `TableroBeneficiosAvisosWidget.tsx`, `TableroDisponibilidadOperativa.tsx`, `VitrinaComercialVisual.tsx`.
   - `@eco/configuracion-negocio`, `@eco/gestion-usuarios`, `@eco/identidad`, `@eco/notificaciones`: `ConsolaConfiguracionUnificada.tsx`, `GestionTokensMcpWidget.tsx`, `estilos-configuracion.ts`, `AdministracionPerfilesWidget.tsx`, `FormularioInvitacionEquipo.tsx`, `GestionTerminosConsentimientosWidget.tsx`, `EmisionNotificacionesWidget.tsx`, `MonitoreoNotificacionesUsuariosWidget.tsx`.
   - `apps/tinkay-web/app/panel/*`: `page.tsx`, `AccionesProformaPanelCliente.tsx`, `usuarios/page.tsx`, `cuenta/page.tsx`.

4. **Ecommerce Tinkay (`apps/tinkay-web/modulos/ecommerce/*`)**:
   - `estilos-ecommerce.css`: clase `.sr-only`, menú móvil deslizable en cabecera, tira horizontal de acceso rápido a colecciones/eventos, `.grid-form-responsive-2col`, `.grid-toggle-entrega`, drawers a `100dvh`, inputs a `16px` en móvil.
   - `EncabezadoEcommerce.tsx`, `DrawerProformaEvento.tsx`, `ModalCheckoutTinkay.tsx`, `ModalDetalleProducto.tsx`, `VistaProformaEventoCliente.tsx`, `ChatAriaFlotante.tsx`.

## Verificación

- Cero clases utilitarias de Tailwind CSS (cumplimiento estricto de Regla 17 de `AGENTS.md`).
- `pnpm typecheck` en verde (`15/15` paquetes).
- `pnpm build` verificado en producción para todas las aplicaciones del monorepo.
