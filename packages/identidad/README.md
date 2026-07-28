# Paquete: @eco/identidad

Implementa `PLT-001` completo (registro sin fricción + consentimiento de términos + confirmación de identidad/WhatsApp post-registro + historial de accesos), `PLT-012` (baja de cuenta) y la parte de `PLT-003` que asigna automáticamente el rol `CLIENTE` al registrarse. Ver [`gobernanza/productos/plataforma/especificacion-funcional.md`](../../gobernanza/productos/plataforma/especificacion-funcional.md).

**Común a los 4 negocios** — no vive dentro de ninguna app. Cada función que depende del negocio (`asegurarMembresiaCliente`, `registrarUsuario`, `obtenerMembresia`, `obtenerWidgetsVisibles`) recibe el slug (`"tranqi" | "fastfix" | "tinkay" | "margaritas"`) como parámetro; el resto (consentimiento de términos, bienvenida, baja de cuenta, historial de accesos) es a nivel de usuario/ecosistema, no por negocio — la identidad es una sola en todo el ecosistema (`comun_seguridad.seg_usuario`).

## Cómo lo consume una app

- `app/registro/page.tsx` → `<FormularioRegistro negocio="tranqi" />`
- `app/ingresar/page.tsx` → `<FormularioIngreso />`
- `app/auth/callback/route.ts` → `export const GET = crearManejadorCallbackOAuth("tranqi");`
- `app/bienvenida/page.tsx` → `<FormularioBienvenida nombresIniciales apellidosIniciales />`
- `app/terminos/page.tsx` → `TERMINOS_VERSION`
- `app/panel/layout.tsx` → `obtenerPerfilActual`, `obtenerWidgetsVisibles(usuarioId, esSuperadmin, negocio)`, `asegurarMembresiaCliente`, `cerrarSesion`
- `app/panel/cuenta/page.tsx` → `<EliminarCuenta />`, `<HistorialAccesos historial={...} />`

Cada app añade `"@eco/identidad"` y `"@eco/supabase"` a `transpilePackages` en su `next.config.mjs` (mismo patrón que `@eco/agentes-ia`) y necesita las mismas dos variables de entorno (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) — un solo proyecto Supabase sirve a los 4 negocios.

**La marca/estilo queda fuera del paquete.** Los componentes usan nombres de clase genéricos (`tarjeta-auth`, `btn-primario`, `zona-peligro`, etc.); cada app define su propio CSS con esas clases. `tranqi-web` tiene su propio diseño en `app/globals.css`, alineado con [`gobernanza/productos/tranqi/sistema-visual.md`](../../gobernanza/productos/tranqi/sistema-visual.md) (2026-07-27) — radios 8/12/16px según control/bloque/tarjeta, píldora solo en landing y etiquetas, acento violeta en las pantallas de identidad (perfil cliente). Las apps sin marca todavía (`fastfix-web`, `tinkay-web`, `margaritas-web`) importan `@eco/identidad/estilos-base.css`, un estilo neutral de referencia — se reemplaza por el diseño real de cada negocio cuando exista.

## Decisiones ya resueltas

- **Confirmación de correo: solo aplica al registro por correo/contraseña.** Google OAuth conecta directo porque Google ya verificó ese correo (comportamiento por defecto de Supabase). El formulario de registro muestra "revisa tu correo" cuando `signUp()` no deja sesión inmediata, en vez de redirigir en falso al panel.
- **Google OAuth es un único cliente OAuth, compartido por los 4 negocios.** El callback de `signInWithOAuth()` siempre pasa por el dominio del proyecto Supabase (`{ref}.supabase.co/auth/v1/callback`), nunca por el dominio de cada app — no hace falta reconfigurar nada en Google Cloud Console por negocio. Lo único que varía por app es el `redirectTo` (su propio `/auth/callback`), que debe estar en la lista de Redirect URLs de Supabase (Authentication → URL Configuration, un solo listado compartido).
- MFA (`PLT-002`) no aplica aquí — registrar/ingresar no son procesos críticos según la especificación de plataforma. Solo el flujo de pago lo exige.

## Pantalla de bienvenida (PLT-001 regla 2)

Post-registro, antes de entrar al panel (`app/panel/layout.tsx` de cada app redirige a `/bienvenida` mientras `usu_onboarding_completo = false`):

1. **Confirmar identidad.** Precarga `usu_nombres`/`usu_apellidos` (poblados por el trigger de aprovisionamiento desde los metadatos del proveedor, con fallback si Google no manda `given_name`/`family_name` — ver migración `20260727000009`) y deja editarlos.
2. **Autorización de WhatsApp, opt-in real.** Checkbox desmarcado por defecto; el campo de número solo aparece si se marca. Selector de país (`paises.ts`, lista curada, Ecuador por defecto) + input formateado con `libphonenumber-js` (`AsYouType`) — la validación de dígitos es la real de cada país (`isValidPhoneNumber`), no un `length >= 7` genérico. Guarda `usu_whatsapp` en E.164 (`+593991234567`) + `usu_autorizacion_whatsapp`.
3. Al completar, marca `usu_onboarding_completo = true` — no se repite en logins siguientes.

## Consentimiento de términos (PLT-001 regla 6)

`usu_terminos_aceptados_en` + `usu_terminos_version` (`comun_seguridad.seg_usuario`, migración `20260727000008`). `TERMINOS_VERSION` vive en `esquema.ts` — subirla ante un cambio sustantivo del texto de `/terminos` permite identificar quién aceptó una versión vieja.

- **Registro por correo:** checkbox obligatorio en `FormularioRegistro` (deshabilita "Crear cuenta" hasta marcarlo). `registrarUsuario()` manda `terminos_version` en `raw_user_meta_data`; el trigger de aprovisionamiento la lee y guarda la aceptación en el mismo `INSERT`.
- **Google OAuth:** no se puede inyectar `raw_user_meta_data` propia vía `signInWithOAuth()`. En su lugar, los formularios muestran un disclaimer bajo el botón de Google, y `asegurarTerminosAceptados()` registra la aceptación en el callback, donde ya existe sesión real. Idempotente.
- `/terminos` de cada app es texto **borrador**, marcado explícitamente como pendiente de revisión legal — no el editor Markdown configurable por negocio de `PLT-008` (ese sigue sin implementar).

## Baja de cuenta (PLT-012)

RPC `comun_seguridad.seg_fn_eliminar_cuenta()` (`SECURITY DEFINER`, migración `20260727000008`), expuesto vía `eliminarCuenta()`. UI (`<EliminarCuenta />`) exige escribir la palabra "ELIMINAR" antes de habilitar el botón.

**Regla de negocio:** si el usuario tiene historial transaccional (compras), no se puede hacer hard delete — hay que anonimizar sus datos y conservar el registro que exige la ley (SRI). Hoy, **ningún esquema transaccional existe todavía** en el ecosistema (`comun_facturacion` sigue sin migrar), así que no puede existir ese historial y el hard delete es siempre seguro: borra `auth.users`, que en cascada elimina `seg_usuario` y `seg_membresia`.

La función usa `to_regclass('comun_facturacion.fac_transaccion_pago')` como válvula de seguridad hacia el futuro: en cuanto exista esa tabla, la función **falla explícitamente** en vez de seguir haciendo hard delete a ciegas. Ver detalle en [`especificacion-tecnica.md` de Plataforma](../../gobernanza/productos/plataforma/especificacion-tecnica.md) §1.3.

## Historial de accesos y saludo personalizado (PLT-018)

`comun_seguridad.seg_acceso` (migración `20260727000011`, `acc_negocio` agregada en `20260727000012`) — una fila por login (IP + User-Agent + negocio de origen), escrita desde `iniciarSesion()`, `registrarUsuario()` (si deja sesión activa) y `crearManejadorCallbackOAuth()`. RLS: cada usuario solo ve/inserta sus propias filas.

- `<HistorialAccesos historial={...} />` — lista de "dispositivos recientes" con una etiqueta legible (`etiquetaDispositivo()`, heurística simple sobre el User-Agent, sin librería de parseo) **y el negocio de origen** (`etiquetaNegocio()`) — el historial es único por usuario en todo el ecosistema (regla 4), no por negocio, así que sin esta etiqueta un usuario que entra a dos negocios ve filas que parecen "duplicadas" sin explicación.
- `obtenerSaludo(usuarioId, nombre)` — compara la fila más reciente (el login que acaba de ocurrir) contra la anterior para elegir el tono del saludo ("Hola de nuevo" / "Cuánto tiempo sin verte" / etc.). No depende de `auth.users.last_sign_in_at` (no expuesto al propio usuario vía PostgREST sin lógica adicional) — usa exclusivamente `seg_acceso`, ya bajo nuestro control de RLS.
- `iniciarSesion(datos, negocio)` y `<FormularioIngreso negocio="..." />` reciben el slug de negocio igual que registro — el login por correo también queda etiquetado.

## Bugs encontrados y corregidos, verificados de punta a punta contra el proyecto real

1. **Membresía CLIENTE no se creaba.** Con confirmación de correo pendiente, `signUp()` no da sesión — el intento de crear `seg_membresia` justo después corría sin `auth.uid()` y RLS lo bloqueaba en silencio. Corregido con auto-reparación en `app/panel/layout.tsx` de cada app (único punto con sesión garantizada).
2. **Nombres de Google atrapados en JSONB.** El trigger de aprovisionamiento solo guardaba `given_name`/`family_name` en `usu_detalle_usuario`, nunca en las columnas `usu_nombres`/`usu_apellidos`. Corregido en el trigger (`20260727000007`).
3. **Escalación de privilegios vía `PATCH` directo.** La política de `UPDATE` de `seg_usuario` no restringía columnas — un usuario podía escribir `usu_superadmin_plataforma` en su propia fila sin pasar por la UI. Corregido con `GRANT UPDATE` por columna (`20260727000006`) — ver [`politicas/seguridad-y-datos.md`](../../gobernanza/politicas/seguridad-y-datos.md) §9.
4. **Google no siempre manda `given_name`/`family_name`.** Confirmado con datos reales — solo trae `name`/`full_name`. Sin fallback, la bienvenida no prellenaba nada. Corregido partiendo `name`/`full_name` por el primer espacio (`20260727000009`).
5. **Historial de accesos sin etiqueta de negocio confundía con "duplicación".** Detectado por el usuario al entrar por primera vez a Margaritas con una cuenta que ya tenía accesos en Tranqi (comportamiento correcto por diseño — PLT-018 regla 4 — pero sin explicación en la UI). Corregido agregando `acc_negocio` y mostrándolo en `<HistorialAccesos />` (`20260727000012`).
6. **Validación de WhatsApp era `length >= 7` genérico, sin selector de país.** No pedía país ni validaba la cantidad real de dígitos por país. Corregido con selector de país + `libphonenumber-js` (`isValidPhoneNumber`/`AsYouType`), guardando el número en E.164.

## Pendiente

- **✅ Hecho (2026-07-27):** `configuracion-negocio` y `gestion-usuarios` también se extrajeron a paquetes compartidos (`@eco/configuracion-negocio`, `@eco/gestion-usuarios`), mismo patrón que este, y ya están montados en las 4 apps.
- **✅ Desplegado (2026-07-27):** `fastfix-web`, `tinkay-web` y `margaritas-web` ya tienen proyecto Vercel propio (`{app}.vercel.app`) con las variables de Supabase configuradas, registro/login verificados en vivo. Falta decidir dominio propio de cada negocio (hoy solo `tranqi-web` tiene `tranqi24.com`).
- **⚠️ Pendiente, bloqueante para Google OAuth en las 3 apps nuevas:** sus URLs `/auth/callback` (`https://{app}.vercel.app/auth/callback`) todavía no están en la lista de Redirect URLs de Supabase (Authentication → URL Configuration) — mientras tanto, `signInWithOAuth()` cae de vuelta al Site URL (`tranqi24.com`), igual que el bug original documentado más arriba con `localhost`. Paso manual del dashboard, sin herramienta MCP para Auth Provider config.
