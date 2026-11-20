# Cierre de tarea — Generador IA (Estudio + Taller) en Entrega Inmediata de Tinkay

**Fecha:** 2026-11-20  
**Rama:** `master`  
**Ámbito:** `apps/tinkay-web`, `packages/comercio`, `gobernanza/productos/tinkay`

## Cambios realizados

1. **Assets oficiales de referencia IA y empaquetado Vercel:**
   - Copiados los 5 archivos desde `c:\IA\CASA\Tinkay\ReferenciasConocimiento\` hacia `apps/tinkay-web/public/img/referencias-ia/`:
     - `fondo-taller.jpg`
     - `fondo-taller-alto.jpg`
     - `fondo-taller-pedestal.jpg`
     - `tarjeta-dedicatoria.jpg`
     - `logo-tinkay.jpg`
   - Configurado `outputFileTracingIncludes` en [`apps/tinkay-web/next.config.mjs`](file:///c:/IA/Ecosistema/apps/tinkay-web/next.config.mjs) para incluir `./public/img/referencias-ia/**/*` en la función `/api/entrega-inmediata/generar-fotos`.
   - Documentadas `GEMINI_API_KEY` y `GEMINI_IMAGE_MODEL=gemini-2.5-flash-image` en [`apps/tinkay-web/.env.example`](file:///c:/IA/Ecosistema/apps/tinkay-web/.env.example) y añadidos los placeholders en `.env.local` (ignorado por git).

2. **Prompts oficiales y endpoint seguro de servidor (sin dependencias nuevas):**
   - [`apps/tinkay-web/modulos/estudio-ia/prompts-tinkay.ts`](file:///c:/IA/Ecosistema/apps/tinkay-web/modulos/estudio-ia/prompts-tinkay.ts): módulo puro con las reglas comunes (aislamiento del producto, limpieza, escala, geometría `auto`/`con_frente`/`recto`, base coreano/normal, tarjeta Tinkay) y modos `estudio` y `taller` para soporte `mesa`, `piso` y `pedestal`.
   - [`apps/tinkay-web/app/api/entrega-inmediata/generar-fotos/route.ts`](file:///c:/IA/Ecosistema/apps/tinkay-web/app/api/entrega-inmediata/generar-fotos/route.ts):
     - `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 60`.
     - Autenticación y autorización vía `obtenerContextoAccesoTinkay()` exigiendo permiso `galeria_inmediata`.
     - Validación `zod` y protección anti-SSRF estricta en `fotoUrl` (solo `https://` hacia host de `NEXT_PUBLIC_SUPABASE_URL` o `.supabase.co`, `redirect: "error"`, MIME de imagen permitido, máx. 6 MB).
     - Llamada directa vía `fetch()` a Gemini REST (`x-goog-api-key` solo en servidor), generación en paralelo de `estudio` y `taller` en formato `3:4` con hasta 2 intentos por modo, caché en memoria de referencias base64 y soporte de respuesta parcial si falla un solo modo.

3. **UI aislada por negocio en `ConsolaEntregaInmediata`:**
   - [`packages/comercio/src/componentes/ConsolaEntregaInmediata.tsx`](file:///c:/IA/Ecosistema/packages/comercio/src/componentes/ConsolaEntregaInmediata.tsx): agregada prop opcional `endpointEstudioIa?: string` (sin Tailwind CSS, respetando paleta `#FAF6EE`/`#8F6A2E`/`#2F4737`/`#1F1C19` y microcopia corta con `.btn-responsive-accion`). Cuando está definida y hay foto subida, habilita configuración (`Soporte`, `Geometría`, `Estilo coreano`, `Tarjeta Tinkay`), generación paralela (`Generar IA`), previsualización 3:4 de `Estudio` y `Taller`, `Regenerar` individual, `Incluir`/`Quitar`, `Descargar`, selector de `Portada` y `Usar Fotos` (subiendo a Storage con `subirArchivoOperativoStorage` antes de `Publicar Ahora`).
   - [`apps/tinkay-web/app/panel/entrega-inmediata/page.tsx`](file:///c:/IA/Ecosistema/apps/tinkay-web/app/panel/entrega-inmediata/page.tsx): inyecta `endpointEstudioIa="/api/entrega-inmediata/generar-fotos"` exclusivamente para Tinkay (`margaritas-web` intacto).

4. **Gobernanza:**
   - Actualizado `TNK-005` en [`gobernanza/productos/tinkay/especificacion-funcional.md`](file:///c:/IA/Ecosistema/gobernanza/productos/tinkay/especificacion-funcional.md).

## Verificación
- `pnpm --filter @eco/comercio typecheck`
- `pnpm --filter tinkay-web typecheck`
- `pnpm --filter margaritas-web typecheck`
- `pnpm --filter tinkay-web build`
