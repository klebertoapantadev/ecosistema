# Módulo: Identidad

Implementa `PLT-001` completo (registro sin fricción + consentimiento de términos + confirmación de identidad/WhatsApp post-registro), `PLT-012` (baja de cuenta) y la parte de `PLT-003` que asigna automáticamente el rol `CLIENTE` en Tranqi al registrarse. Ver [`gobernanza/productos/plataforma/especificacion-funcional.md`](../../../../gobernanza/productos/plataforma/especificacion-funcional.md).

## Rutas que lo consumen

- `app/registro/page.tsx`, `app/ingresar/page.tsx`
- `app/auth/callback/route.ts` (callback de OAuth)
- `app/bienvenida/page.tsx` (PLT-001 regla 2 — ver más abajo)
- `app/terminos/page.tsx` (borrador de Términos de Servicio, PLT-001 regla 6)
- `app/panel/cuenta/page.tsx` (baja de cuenta, PLT-012 — ver más abajo)

## Decisiones ya resueltas

- **Confirmación de correo: solo aplica al registro por correo/contraseña.** Decisión del usuario — Google OAuth conecta directo porque Google ya verificó ese correo (es además el comportamiento por defecto de Supabase, no hubo que cambiar nada). El formulario de registro muestra "revisa tu correo" cuando `signUp()` no deja sesión inmediata, en vez de redirigir en falso al panel.
- **Google OAuth configurado (2026-07-27).** Cliente OAuth "Tranqi-WEB" en Google Cloud Console (proyecto `ecosistema`), habilitado en Supabase con el Client ID/Secret reales. Verificado de punta a punta hasta la pantalla de selección de cuenta de Google.
- MFA (`PLT-002`) no aplica aquí — registrar/ingresar no son procesos críticos según la especificación de plataforma. Solo el flujo de pago lo exige.

## Pantalla de bienvenida (PLT-001 regla 2)

Post-registro, antes de entrar al panel (`app/panel/layout.tsx` redirige a `/bienvenida` mientras `usu_onboarding_completo = false`):

1. **Confirmar identidad.** Precarga `usu_nombres`/`usu_apellidos` (poblados por el trigger de aprovisionamiento desde los metadatos del proveedor) y deja editarlos — necesario porque Google no siempre da un nombre claro (ej. `cuenta.ventas@gmail.com` sin nombre de persona real).
2. **Autorización de WhatsApp, opt-in real.** Checkbox desmarcado por defecto; el campo de número solo aparece si se marca. Guarda `usu_whatsapp` + `usu_autorizacion_whatsapp`.
3. Al completar, marca `usu_onboarding_completo = true` — no se repite en logins siguientes (verificado).

Diseño: fondo **menta**, el mismo color que la sección "hola" de la landing — reutiliza el significado de marca ya establecido en vez de introducir uno nuevo.

Una vez confirmado, el panel usa el nombre confirmado (`usu_nombres` + `usu_apellidos`) como identificador visible del usuario activo — no el correo ni el nombre crudo de Google.

## Consentimiento de términos (PLT-001 regla 6)

`usu_terminos_aceptados_en` + `usu_terminos_version` (`comun_seguridad.seg_usuario`, migración `20260727000008`). `TERMINOS_VERSION` vive en `esquema.ts` — subirla ante un cambio sustantivo del texto de `/terminos` permite identificar quién aceptó una versión vieja.

- **Registro por correo:** checkbox obligatorio en `FormularioRegistro.tsx` (deshabilita "Crear cuenta" hasta marcarlo). `registrarUsuario()` manda `terminos_version` en `raw_user_meta_data`; el trigger de aprovisionamiento la lee y guarda la aceptación en el mismo `INSERT`.
- **Google OAuth:** no se puede inyectar `raw_user_meta_data` propia vía `signInWithOAuth()`. En su lugar, ambos formularios muestran un disclaimer bajo el botón de Google ("Al continuar, aceptas los Términos de Servicio"), y `asegurarTerminosAceptados()` registra la aceptación en `app/auth/callback/route.ts`, donde ya existe sesión real. Idempotente: no pisa una aceptación previa en logins siguientes.
- `/terminos` es texto **borrador**, marcado explícitamente como pendiente de revisión legal — no el editor Markdown configurable por negocio de `PLT-008` (ese sigue sin implementar).

## Baja de cuenta (PLT-012)

RPC `comun_seguridad.seg_fn_eliminar_cuenta()` (`SECURITY DEFINER`, migración `20260727000008`), expuesto vía `eliminarCuenta()` en `acciones.ts`. UI en `app/panel/cuenta/page.tsx` (`componentes/EliminarCuenta.tsx`) — exige escribir la palabra "ELIMINAR" antes de habilitar el botón, por ser una acción irreversible.

**Regla de negocio:** si el usuario tiene historial transaccional (compras), no se puede hacer hard delete — hay que anonimizar sus datos y conservar el registro que exige la ley (SRI). Hoy, **ningún esquema transaccional existe todavía** en el ecosistema (`comun_facturacion` sigue sin migrar), así que no puede existir ese historial y el hard delete es siempre seguro: borra `auth.users`, que en cascada elimina `seg_usuario` y `seg_membresia`.

La función usa `to_regclass('comun_facturacion.fac_transaccion_pago')` como válvula de seguridad hacia el futuro: en cuanto exista esa tabla, la función **falla explícitamente** en vez de seguir haciendo hard delete a ciegas — obliga a reescribirla para consultar el historial real antes de volver a habilitar la baja. Ver detalle en [`especificacion-tecnica.md` de Plataforma](../../../../gobernanza/productos/plataforma/especificacion-tecnica.md) §1.3.

## Bugs encontrados y corregidos (2026-07-27), verificados de punta a punta contra el proyecto real

1. **Membresía CLIENTE no se creaba.** Con confirmación de correo pendiente, `signUp()` no da sesión — el intento de crear `seg_membresia` justo después corría sin `auth.uid()` y RLS lo bloqueaba en silencio. Corregido con auto-reparación en `app/panel/layout.tsx` (único punto con sesión garantizada).
2. **Nombres de Google atrapados en JSONB.** El trigger de aprovisionamiento solo guardaba `given_name`/`family_name` en `usu_detalle_usuario`, nunca en las columnas `usu_nombres`/`usu_apellidos` — la bienvenida no tenía qué precargar. Corregido en el trigger (`20260727000007`).
3. **Escalación de privilegios vía `PATCH` directo.** La política de `UPDATE` de `seg_usuario` no restringía columnas — un usuario podía escribir `usu_superadmin_plataforma` en su propia fila sin pasar por la UI. Corregido con `GRANT UPDATE` por columna (`20260727000006`) — ver [`politicas/seguridad-y-datos.md`](../../../../gobernanza/politicas/seguridad-y-datos.md) §9.
