# Módulo: Identidad

Implementa `PLT-001` completo (registro sin fricción + confirmación de identidad/WhatsApp post-registro) y la parte de `PLT-003` que asigna automáticamente el rol `CLIENTE` en Tranqi al registrarse. Ver [`gobernanza/productos/plataforma/especificacion-funcional.md`](../../../../gobernanza/productos/plataforma/especificacion-funcional.md).

## Rutas que lo consumen

- `app/registro/page.tsx`, `app/ingresar/page.tsx`
- `app/auth/callback/route.ts` (callback de OAuth)
- `app/bienvenida/page.tsx` (PLT-001 regla 2 — ver más abajo)

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

## Bugs encontrados y corregidos (2026-07-27), verificados de punta a punta contra el proyecto real

1. **Membresía CLIENTE no se creaba.** Con confirmación de correo pendiente, `signUp()` no da sesión — el intento de crear `seg_membresia` justo después corría sin `auth.uid()` y RLS lo bloqueaba en silencio. Corregido con auto-reparación en `app/panel/layout.tsx` (único punto con sesión garantizada).
2. **Nombres de Google atrapados en JSONB.** El trigger de aprovisionamiento solo guardaba `given_name`/`family_name` en `usu_detalle_usuario`, nunca en las columnas `usu_nombres`/`usu_apellidos` — la bienvenida no tenía qué precargar. Corregido en el trigger (`20260727000007`).
3. **Escalación de privilegios vía `PATCH` directo.** La política de `UPDATE` de `seg_usuario` no restringía columnas — un usuario podía escribir `usu_superadmin_plataforma` en su propia fila sin pasar por la UI. Corregido con `GRANT UPDATE` por columna (`20260727000006`) — ver [`politicas/seguridad-y-datos.md`](../../../../gobernanza/politicas/seguridad-y-datos.md) §9.
