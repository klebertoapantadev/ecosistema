# Módulo: Identidad

Implementa `PLT-001` (registro sin fricción, Google OAuth + correo/contraseña) y la parte de `PLT-003` que asigna automáticamente el rol `CLIENTE` en Tranqi al registrarse. Ver [`gobernanza/productos/plataforma/especificacion-funcional.md`](../../../../gobernanza/productos/plataforma/especificacion-funcional.md).

## Rutas que lo consumen

- `app/registro/page.tsx`
- `app/ingresar/page.tsx`
- `app/auth/callback/route.ts` (callback de OAuth)

## Pendiente / decisiones

- **Google OAuth requiere configuración manual** en el dashboard de Supabase (Authentication → Providers → Google) con credenciales de Google Cloud Console. El botón existe y funciona en cuanto se configure; hasta entonces falla con error del provider.
- MFA (`PLT-002`) no aplica aquí — registrar/ingresar no son procesos críticos según la especificación de plataforma. Solo el flujo de pago lo exige.
- `usu_cedula`, `usu_whatsapp`, provincia/ciudad quedan para completar después del registro (onboarding posterior), no en este formulario — coherente con "cero fricción" de PLT-001.

## Bug encontrado y corregido (2026-07-27): membresía CLIENTE no se creaba

Con "Confirm email" activo en el proyecto (default de Supabase), `signUp()` no establece sesión hasta que el usuario confirma su correo. El intento de crear `seg_membresia` justo después de `signUp()` corría sin `auth.uid()`, y RLS lo bloqueaba en silencio — el usuario quedaba creado en `seg_usuario` pero sin rol en Tranqi.

**Corregido con auto-reparación en `app/panel/layout.tsx`:** ahí la sesión ya está garantizada (se redirige a `/ingresar` si no), así que es el punto confiable para completar el aprovisionamiento si quedó pendiente. Los intentos en `registrarUsuario` y el callback de OAuth se mantienen como *best effort* (sí funcionan cuando hay sesión inmediata, como en OAuth) — la capa del panel es la que garantiza consistencia siempre.

**Decisión pendiente del usuario:** desactivar "Confirm email" en el dashboard de Supabase (Authentication → Providers → Email) alinearía el comportamiento con PLT-001 ("registro sin fricción" — confirmar correo es exactamente el tipo de fricción que esa regla busca evitar). No lo desactivé yo mismo; es una decisión de producto/seguridad que corresponde confirmar.
