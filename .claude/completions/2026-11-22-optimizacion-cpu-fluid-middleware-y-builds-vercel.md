# Cierre de tarea — Optimización de Fluid Active CPU, Middleware y Builds en Vercel

**Fecha:** 2026-11-22  
**Alcance:** Plataforma / Infraestructura Vercel (`@eco/notificaciones`, `@eco/comercio`, `@eco/supabase`, `tinkay-web`, `tranqi-web`, `fastfix-web`, `margaritas-web`, `.github/dependabot.yml`)

## Contexto e incidente diagnosticado

Las 4 apps del equipo Vercel `klebertoapantach-9772s-projects` (plan Hobby) quedaron pausadas con `402 Payment Required` (`x-vercel-error: DEPLOYMENT_DISABLED` / `resource_creation_blocked: "Your Team exceeded our fair use limits and has been blocked."`).

El reporte de uso de 30 días de `tinkay-web` solo evidenció:
- **Fluid Active CPU:** `2h 11m / 4h` (54.6% del límite compartido de todo el equipo).
- **Vercel Functions Invocations:** `162,395` (7 timeouts en `/panel/conversaciones`).
- **Fast Origin Transfer:** `2.58 GB / 10 GB`.
- **Build Time:** `16 h / 100 h` por app (~64 h entre las 4 apps).

## Cambios aplicados

1. **Reducción de polling agresivo y pausa automática en pestañas ocultas (`document.visibilityState`):**
   - `packages/notificaciones/src/CampanaNotificaciones.tsx`: intervalo de `8s` → `60s`, pausado cuando `document.visibilityState !== "visible"` y recarga al volver al foco (`visibilitychange` con throttle de `10s`).
   - `packages/notificaciones/src/WidgetNotificacionesCliente.tsx`: intervalo de `6s` → `60s`, pausado en segundo plano y escucha de `eco:refrescar-notificaciones` + `visibilitychange`.
   - `apps/tranqi-web/app/panel/administrar/PanelAdministrarModular.tsx`: ambos pollings (`SociosWidget` y `cargarEstadisticas`) de `8s` → `60s`, pausados en pestañas ocultas con recarga al volver al foco.
   - `packages/comercio/src/componentes/ConsolaVentasOmnicanal.tsx`: el respaldo periódico sobre Supabase Realtime pasó de `12s` incondicional a adaptativo (`120s` cuando Realtime está `SUBSCRIBED`, `30s` si se desconecta) y pausado en segundo plano.
   - `packages/comercio/src/componentes/ChatEquipoInterno.tsx`: respaldo sobre Broadcast Realtime de `15s` → adaptativo (`120s` conectado / `30s` desconectado) + pausa en segundo plano.
   - `packages/comercio/src/componentes/ConsolaTallerFloral.tsx`: respaldo sobre Realtime de `20s` → adaptativo (`120s` conectado / `30s` desconectado) + pausa en segundo plano.
   - `packages/comercio/src/componentes/PantallaTvTaller.tsx`: respaldo sobre Realtime de `45s` → adaptativo (`180s` conectado / `45s` desconectado) + pausa en segundo plano.
   - `apps/tinkay-web/modulos/ecommerce/componentes/ChatAriaFlotante.tsx`: respaldo sobre Realtime de `4.5s` → adaptativo (`60s` conectado / `12s` desconectado) + pausa en segundo plano.
   - `apps/tranqi-web/modulos/landing/componentes/BuddieLanding.tsx`: sincronización de asesor humano de `4.5s` → `12s`, ejecutada solo tras iniciar conversación (`conversacionActiva`) y con la pestaña visible.

2. **Middleware liviano y exclusión de rutas públicas/estáticas:**
   - `packages/supabase/src/middleware.ts`: fast-path sin cliente ni llamada de red a `supabase.auth.getUser()` cuando el request no contiene cookies `sb-*` (ahorra CPU en webhooks, feeds públicos, bots y visitantes anónimos).
   - `apps/tinkay-web/middleware.ts`, `apps/margaritas-web/middleware.ts`, `apps/fastfix-web/middleware.ts` y `apps/tranqi-web/middleware.ts`: `matcher` acotado estrictamente a `/panel/:path*`, `/auth/:path*`, `/api/:path*`, `/bienvenida/:path*` (y `/tv-taller/:path*` en floristerías) más el fallback OAuth `{ source: "/", has: [{ type: "query", key: "code" }] }`, dejando fuera portada, catálogo público e imágenes `/public/img/*`.

3. **Deduplicación SSR del catálogo en `tinkay-web`:**
   - `apps/tinkay-web/modulos/ecommerce/servicio-catalogo.ts`: `cargarCatalogoDinamicoTinkay` envuelto con `React.cache()` para evitar doble consulta y mapeo de Supabase entre `generateMetadata` y la página en la misma petición SSR.

4. **Control de Build Time y ráfagas de despliegues:**
   - `apps/{tinkay-web,tranqi-web,fastfix-web,margaritas-web}/vercel.json`: agregado `ignoreCommand` que omite preview builds en ramas `dependabot/*` y usa `npx --yes turbo-ignore` para compilar únicamente las apps afectadas por cada commit.
   - `.github/dependabot.yml`: agrupación de actualizaciones rutinarias (`minor`/`patch` de `devDependencies` y `patch` de `dependencies`) manteniendo PRs individuales para `major`/`minor` de producción y actualizaciones de seguridad inmediatas.

## Verificación

- `pnpm typecheck`: 15/15 paquetes OK.
- `pnpm test`: 5/5 suites OK (222 pruebas pasando).
- `pnpm --filter tinkay-web build`: OK.
- `pnpm --filter tranqi-web build`: OK.
