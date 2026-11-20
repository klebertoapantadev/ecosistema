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

## Actualización posterior — Configuración directa en Tinkay + Supabase Vault (`OpenRouter / Gemini`)
- Migración [`supabase/migrations/20261120000001_cfg_estudio_ia_vault.sql`](file:///c:/IA/Ecosistema/supabase/migrations/20261120000001_cfg_estudio_ia_vault.sql): columna `ari_estudio_ia_secreto_id` en `comun_configuracion.cfg_aria` y 4 RPCs `SECURITY DEFINER` (`cfg_fn_guardar_estudio_ia`, `cfg_fn_borrar_estudio_ia_clave`, `cfg_fn_probar_estudio_ia`, `cfg_fn_invocar_estudio_ia`) para guardar la API Key de OpenRouter/Gemini cifrada en Supabase Vault, verificarla sin costo (`$0`) y generar las imágenes sin exponer la clave fuera de PostgreSQL ni requerir variables en Vercel.
- Tarjeta dedicada **`Estudio IA — Generador de Fotos (OpenRouter / Gemini)`** en [`FormularioAria.tsx`](file:///c:/IA/Ecosistema/packages/configuracion-negocio/src/componentes/FormularioAria.tsx) (`/panel/aria#estudio-ia`) e indicador de estado en [`ConsolaConfiguracionUnificada.tsx`](file:///c:/IA/Ecosistema/packages/configuracion-negocio/src/componentes/ConsolaConfiguracionUnificada.tsx), aislada exclusivamente para `tinkay`.
- [`route.ts`](file:///c:/IA/Ecosistema/apps/tinkay-web/app/api/entrega-inmediata/generar-fotos/route.ts) prioriza la clave en Supabase Vault (`cfg_fn_invocar_estudio_ia`) y conserva respaldo opcional a env vars (`OPENROUTER_API_KEY` / `GEMINI_API_KEY`).

## Verificación
- `pnpm --filter @eco/configuracion-negocio typecheck`
- `pnpm --filter @eco/comercio typecheck`
- `pnpm --filter tinkay-web typecheck`
- `pnpm --filter margaritas-web typecheck`
- `pnpm --filter tranqi-web typecheck`
- `pnpm --filter fastfix-web typecheck`
- `pnpm --filter tinkay-web build`
