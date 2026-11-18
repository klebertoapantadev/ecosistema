# Cierre: Reparación de Login Google OAuth y Activación de Usuarios Nuevos Invitados en Tinkay

**Fecha:** 2026-11-18
**Requerimientos:** `PLT-001`, `PLT-003`, `PLT-011`, `TNK-005`

## Causas Raíz Identificadas
1. **Fallback de `Redirect URLs` en Supabase Auth a `/?code=...` ("vuelve al inicio"):** `signInWithOAuth` enviaba `redirectTo: ".../auth/callback?next=%2Fpanel"`. Cuando `Redirect URLs` en Supabase no tiene comodín `/**` para query params o cae a `Site URL`, Supabase devuelve al usuario a la raíz (`/?code=...` o `/#access_token=...`), donde la portada ignoraba el código sin ejecutar `/auth/callback` ni crear `seg_membresia`.
2. **Regresión de `usu_correo_verificado_en` + Permiso de columna `42501` en cuentas nuevas de Google OAuth:** La migración `20261115000001` omitió `usu_correo_verificado_en` en `seg_fn_provisionar_usuario()`, dejando `NULL` a todos los usuarios nuevos de Google (mientras que cuentas previas como `familiammtg@gmail.com` ya lo tenían poblado). Además, `/auth/callback` hacía `.update({ usu_correo_verificado_en, ... })` directo como `authenticated`, lo cual PostgreSQL rechazaba (`42501`) por el `GRANT UPDATE` por columnas de `20260727000006`.
3. **Propagación de Cookies en Redirect de Route Handler Móvil + Caché SW:** `crearManejadorCallbackOAuth` ahora inyecta explícitamente `Set-Cookie` sobre el `NextResponse.redirect` y `sw-operaciones.js` (`v5`) deja de cachear respuestas HTML de navegación de `/panel`.
4. **Despliegue pendiente en Vercel:** `tinkay-web.vercel.app` seguía en el commit `21e15e3` (`4:28 a. m.`) sin publicar los cambios en `master`.

## Archivos Modificados / Creados
- `packages/supabase/src/middleware.ts`
- `packages/identidad/src/servidor.ts`
- `packages/identidad/src/componentes/FormularioIngreso.tsx`
- `packages/identidad/src/componentes/FormularioRegistro.tsx`
- `apps/tinkay-web/modulos/ecommerce/componentes/EncabezadoEcommerce.tsx`
- `apps/tinkay-web/public/sw-operaciones.js`
- `supabase/migrations/20261118000003_fix_oauth_callback_correo_verificado_e_invitaciones.sql`
- `gobernanza/productos/plataforma/especificacion-funcional.md`
