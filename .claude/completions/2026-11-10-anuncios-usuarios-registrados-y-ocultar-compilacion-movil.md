# Cierre de Tarea — Anuncios Exclusivos para Usuarios Registrados y Ocultar Fecha de Compilación en Móvil

**Fecha:** 2026-11-10

## Cambios Realizados

1. **Anuncios / Campañas Informativas Exclusivos para Usuarios Registrados (`PLT-024`)**:
   - Se eliminó `<BannerInformativoSuperior negocio="tranqi" />` de la landing pública ([`apps/tranqi-web/app/page.tsx`](../../apps/tranqi-web/app/page.tsx)) para que nunca aparezcan anuncios sin iniciar sesión.
   - Se blindó [`obtenerCampanasInformativasAction`](../../packages/comercio/src/acciones-informativos.ts) verificando que exista una sesión autenticada activa (`crearClienteServidor().auth.getUser()`) antes de retornar campañas informativas.
   - Se ajustó [`BannerInformativoSuperior.tsx`](../../packages/comercio/src/componentes/BannerInformativoSuperior.tsx) para no pre-renderizar caché de `localStorage` antes de validar la sesión y limpiar el estado si no hay campañas activas para el usuario autenticado.
   - Se actualizó [`ConsolaGestionInformativosWidget.tsx`](../../packages/comercio/src/componentes/ConsolaGestionInformativosWidget.tsx) y [`gobernanza/productos/plataforma/especificacion-funcional.md`](../../gobernanza/productos/plataforma/especificacion-funcional.md) para reflejar únicamente las ubicaciones del panel autenticado (`PANEL_INICIO`, `PANEL_BENEFICIOS`).

2. **Ocultar Fecha de Compilación (`SelloCompilacion`) en Versión Móvil (`PLT-011`)**:
   - Se asignó la clase `.panel-sello-compilacion` al contenedor del sello en [`apps/tranqi-web/app/panel/layout.tsx`](../../apps/tranqi-web/app/panel/layout.tsx).
   - Se ocultó `.panel-sello-compilacion` y `.sello-compilacion` en resoluciones móviles (`@media (max-width: 860px)`) y cuando el rail está plegado (`.rail-plegado`) en [`apps/tranqi-web/app/globals.css`](../../apps/tranqi-web/app/globals.css), [`apps/fastfix-web/app/globals.css`](../../apps/fastfix-web/app/globals.css), [`apps/margaritas-web/app/globals.css`](../../apps/margaritas-web/app/globals.css) y [`apps/tinkay-web/app/globals.css`](../../apps/tinkay-web/app/globals.css).
