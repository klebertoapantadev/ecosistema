# 2026-11-26 — Conexión en Vivo de Tinkay (`www.tinkay.net`) con Meta Business Suite (`PLT-025` / `TNK-007`)

## Resumen de Acciones Completadas

1. **Migración de Dominio Oficial (`tinkay.net` / `www.tinkay.net`) de Google Sites a Vercel:**
   - Desvinculación en Google Sites, eliminación de reenvío GoDaddy y configuración de DNS (`A @ → 216.150.1.1`, `CNAME www → 3829e0261edfd491.vercel-dns-017.com.`) preservando `TXT facebook-domain-verification=3ynfcl2bateivzircwrypi94igbtlf`.
   - Configuración de `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` en Vercel y Redirect URLs en Supabase Auth (`oaybbpdxhlxjbpwnoymy`).

2. **Configuración en Vivo en Meta Business Suite (`Tinkay Quito` — `530109755033626`):**
   - Creación del Dataset/Pixel **`Tinkay Web (tinkay.net)`** (`4679318432213846`) vinculado a la cuenta publicitaria **`Tinkay G&F`** (`977233563050885`).
   - Generación del Token de API de Conversiones (CAPI) y almacenamiento cifrado en **Supabase Vault** (`comun_configuracion.cfg_marketing_meta`).
   - Creación del catálogo **`Catálogo Oficial Tinkay (tinkay.net)`** (`1506168184709464`) con lista programada cada hora a `https://www.tinkay.net/api/catalogo/meta-feed.xml` (`Feed ID 2839753709751902`, **41 productos importados sin errores**), vinculado al Pixel `4679318432213846` y conectado a WhatsApp Business **`+593 99 643 8873`** (`WABA 3151843331674615`).
   - Depuración de los 6 conjuntos de datos vacíos (desconexión de `Tinkay G&F` de `823488364937644` y renombrado con `[NO USAR]`), dejando intactos los 3 conjuntos de datos activos y la campaña personal actual (`319169109695988`).

3. **Verificación End-to-End y Mejoras de Código:**
   - Confirmados en **Meta Events Manager → Probar eventos** los eventos reales `ViewContent` (Servidor CAPI `HTTP 200 · events_received: 1`) y `PageView` + `ViewContent` (Navegador desde `https://www.tinkay.net/producto/box-florales?variante=TIN-VAR-7` con `content_ids: ["TIN-VAR-7"]`, `value: 60`, `currency: "USD"`).
   - Mejoras locales en código: deduplicación de `<g:additional_image_link>` en `packages/comercio/src/marketing-meta.ts` y envío de correo hasheado del admin en `probarEventoMetaCapiAction` (`packages/configuracion-negocio/src/acciones-marketing-meta.ts`) para cumplir el código de validación `2804050` de Meta CAPI en cualquier entorno.
