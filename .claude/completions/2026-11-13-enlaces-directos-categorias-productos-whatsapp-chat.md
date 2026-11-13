# Cierre de Tarea — Enlaces Directos (Deep Links) a Categorías y Productos para WhatsApp y Chat Web

**Fecha:** 2026-11-13  
**Requerimientos:** `PLT-009.28`, `PLT-010.7`, `TNK-002`, `TNK-004`

## Resumen de Cambios
1. **Utilitario Compartido de Deep Links (`packages/comercio/src/utils/enlacesTienda.ts`):**
   - Generación y parseo puro de enlaces limpios (`/categoria/{slug}`, `/producto/{slug}?variante={sku}`) y parámetros compatibles (`/?categoria=...`, `/?producto=...`, `/?variante=...`, `/?q=...`), sin dependencias de `next/*`.
   - Suite de pruebas unitarias en `packages/comercio/src/utils/enlacesTienda.test.ts`.
2. **Servidor MCP y Agente Conversacional ARIA (`packages/agentes-ia/src/mcp-catalogo.ts`, `apps/tinkay-web/app/api/mcp/catalogo/route.ts`, `apps/tinkay-web/app/api/chat/route.ts`):**
   - Inclusión automática de `url_tienda_producto`, `url_tienda_categoria` y `url_tienda_variante` en `consultar_catalogo` y `detalle_producto`.
   - Nueva herramienta MCP `obtener_enlaces_tienda` para consultar enlaces directos de categorías y productos bajo demanda en WhatsApp (YCloud) y Chat Web.
   - Guía contextual inyectada en `/api/chat` con el origen activo de la tienda.
3. **Rutas Canónicas, OpenGraph para WhatsApp y Navegación Reactiva (`apps/tinkay-web`):**
   - Rutas Next.js 15 `/categoria/[slug]` y `/producto/[slug]` con `generateMetadata` dinámico (`metadata-ecommerce.ts`) mostrando foto real y precio en la tarjeta de vista previa de WhatsApp.
   - Resolución inteligente por slug, alias semántico (`eventos`, `condolencias`, `boxes`, etc.), UUID, SKU o nombre en `filtrado-catalogo.ts` y `contexto-carrito.tsx`, con sincronización en vivo del historial del navegador (`replaceState`).
   - Interceptación en `ChatAriaFlotante.tsx` para navegar sin recargar cuando el cliente hace clic en un enlace enviado por Mía en el Chat Web.
   - Corrección de etiqueta visual en productos de `Eventos y Ceremonias` (ej. *Cartel Bienvenida*) para que nunca exhiban el subtítulo de condolencias fuera de la colección fúnebre.
4. **Copiado en 1 Clic para Asesores y Clientes:**
   - Botones `Copiar link` / `Link Tienda` en barra de categorías de vitrina, tarjetas de producto, cabecera del modal de detalle, consola `/panel/catalogo-productos` y gestor de categorías.

