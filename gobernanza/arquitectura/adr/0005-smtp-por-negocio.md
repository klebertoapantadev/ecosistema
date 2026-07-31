# ADR-0005: Servidor SMTP configurable por negocio, con la contraseña en Supabase Vault

**Fecha:** 2026-07-30
**Estado:** aceptada

## Contexto

Hasta ahora el remitente de correo vivía en variables de entorno `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS` y `SMTP_FROM_NOMBRE` de cada proyecto de Vercel, y `@eco/notificaciones` hablaba SMTP directo con
`nodemailer`. El argumento original era razonable: cada app de Vercel es un negocio distinto, así que "el SMTP
de la app" y "el SMTP del negocio" eran lo mismo y no hacía falta parámetro.

En la práctica eso tenía tres costos:

1. **Cambiar de buzón exigía un redeploy.** La configuración de correo es un dato operativo del negocio, no del
   despliegue, y quedaba atada al ciclo de vida del código.
2. **El `ADMINISTRADOR` del negocio no podía tocarla**, siendo quien conoce su propio correo. Tenía que pedirlo
   a quien tuviera acceso al panel de Vercel.
3. **Contradecía a `PLT-008`**, que ya definía el correo del negocio como parte de su configuración. El campo
   `correoNotificaciones` existía en `cfg_detalle_configuracion` pero solo capturaba el dato: no estaba
   conectado a ningún envío real.

## Decisión

**El servidor SMTP se configura por negocio desde la pantalla de Configuración del Negocio, y la contraseña se
guarda en Supabase Vault.**

1. **Tabla nueva `comun_configuracion.cfg_smtp`, no columnas en `cfg_negocio`.** `cfg_negocio` tiene
   `cfg_negocio_lectura_publica ... using (true)` con `grant select` a `anon` — es información de vitrina,
   pública a propósito. Meter ahí credenciales SMTP, incluso dentro del JSONB de detalle, las habría dejado
   legibles desde internet. La tabla nueva no tiene lectura pública: solo la ve el `ADMINISTRADOR` de ese
   negocio, vía `cfg_smtp_admin_lectura`.

2. **La contraseña no está en la tabla: está en Supabase Vault, y en `cfg_smtp` solo queda su `uuid`.**
   Consecuencia deliberada: **ni el propio administrador puede volver a leerla**. La pantalla muestra si existe
   o no, y dejar el campo vacío significa "consérvala". Esto es una mejora, no una limitación: una credencial
   que la UI puede volver a mostrar es una credencial que se puede exfiltrar desde la UI.

   Se eligió Vault y no `pgp_sym_encrypt` porque cifrar a mano exige gestionar una clave maestra que a su vez
   hay que guardar en algún sitio — mueve el problema en vez de resolverlo. Es el mismo razonamiento por el que
   `20260728000002_tranqui_legal_socios.sql` dejó cédula y matrícula en texto plano protegidas por RLS: ahí se
   difirió porque no existía gestión de claves en el proyecto; aquí ya no hace falta diferir, porque
   `supabase_vault` está disponible y es exactamente esa gestión de claves.

3. **`cfg_smtp` no tiene política de escritura.** Guardar la contraseña en Vault y la fila en la tabla tiene que
   ser una sola operación; se hace vía `cfg_fn_guardar_smtp()` (`security definer`, valida
   `seg_fn_es_admin_negocio`). La tabla es de solo lectura para cualquier sesión.

4. **El envío se muda a una Edge Function `enviar-correo`.** Es el segundo lugar del ecosistema con
   `service_role`, tras `restablecer-contrasena`, y por el mismo motivo. La cadena del razonamiento:

   - La contraseña solo la descifra `cfg_fn_obtener_smtp_credenciales()`, con `execute` revocado a `anon` y
     `authenticated` y concedido solo a `service_role`.
   - El correo más crítico es el OTP de registro, y ese flujo es **anónimo**: el usuario todavía no tiene
     sesión cuando se le manda el código.
   - Si esa lectura se abriera a `authenticated`, la vería cualquier usuario con cuenta. Si se abriera a `anon`
     —necesario para servir el registro— la vería internet entera.
   - Por tanto el envío no puede ocurrir en Next.js: tiene que ocurrir donde vive `service_role`, que por regla
     propia (`gestion-credenciales.md` §3) es exclusivamente una Edge Function.

5. **La Edge Function se autentica con un secreto compartido, no con JWT.** `verify_jwt=false` al desplegar,
   porque en el registro no hay JWT que verificar. Lo que autentica la llamada es la cabecera `x-correo-clave`,
   comparada en tiempo constante contra el secreto `CORREO_FUNCION_CLAVE`, que solo conocen la función y
   nuestros Server Actions.

   **Sin ese secreto, la función sería un relay de spam abierto contra el SMTP del negocio.** Se documenta como
   el riesgo residual de este diseño: quien obtenga el secreto puede enviar HTML arbitrario desde el buzón del
   negocio. Se acepta porque el secreto solo vive en variables de servidor (nunca `NEXT_PUBLIC_`) y porque la
   alternativa —mover las plantillas de correo dentro de la función y aceptar solo un `tipo` con parámetros—
   se puede añadir después sin rehacer nada de lo demás. Queda como mejora pendiente, no como omisión.

6. **`smt_activo` separado de "está configurado".** Se pueden cargar los datos y probarlos antes de que empiece
   a salir correo de producción por ahí. `cfg_fn_obtener_smtp_credenciales()` solo devuelve fila si el negocio
   está activo *y* tiene host, usuario y secreto; si no, la función responde `409` y el llamador sabe que falta
   configurar, no que el sistema falló.

7. **`enviarCorreo()` ahora exige `negocio` y devuelve un resultado.** Antes no recibía parámetro (se asumía el
   SMTP de la app que llamaba) y no devolvía nada: un fallo de envío se perdía en silencio. Ahora el registro
   avisa al usuario de que su cuenta se creó pero el código no salió, y le apunta a «Reenviar código».
   `solicitarRecuperacion()` es la excepción deliberada: sigue ignorando el resultado del envío, porque su
   respuesta es idéntica exista o no la cuenta y un error distinto delataría cuáles correos están registrados.

## Alternativas evaluadas

| Alternativa | Por qué no se eligió |
| :--- | :--- |
| Dejar host/puerto/usuario en la base y la contraseña como variable de entorno | La mitad del trabajo y sin Edge Function nueva, pero no resuelve el problema planteado: el secreto seguiría fuera del alcance del administrador y atado al redeploy. |
| Todo en la base, cifrado con `pgp_sym_encrypt`, descifrando desde Next.js | Requiere una clave maestra que hay que guardar en algo — mueve el problema. Y para servir el registro anónimo habría que exponer un RPC a `anon`, que es exactamente lo que este diseño evita. |
| Un proveedor transaccional (Resend, Postmark) por negocio en vez de SMTP | Mejor entregabilidad y sin credenciales de buzón, pero obliga a cada negocio a verificar dominio con un proveedor concreto. SMTP es el mínimo común denominador: cualquier negocio ya tiene un buzón. No se descarta a futuro — `cfg_smtp` y la Edge Function son la costura por donde entraría. |
| Mantener `nodemailer` en Next.js leyendo la config desde la base | El problema nunca fue nodemailer sino dónde puede vivir la credencial. Con la contraseña en Vault, Next.js no puede leerla sin romper la regla de `service_role`. |

## Consecuencias

- **Las variables `SMTP_*` desaparecen de Vercel.** En su lugar aparece una sola, `CORREO_FUNCION_CLAVE`, que
  no es configuración de correo sino autenticación entre nuestros propios servicios. La tabla de variables de
  entorno de [`02-git-y-despliegue.md`](../estandares/02-git-y-despliegue.md) §5.0 queda actualizada.
- **Hay un orden de despliegue obligatorio**, porque el correo deja de funcionar entre el paso 1 y el 4:
  1. Aplicar la migración.
  2. Desplegar la Edge Function con `--no-verify-jwt` y cargarle el secreto `CORREO_FUNCION_CLAVE`.
  3. Cargar la misma `CORREO_FUNCION_CLAVE` en los proyectos de Vercel.
  4. Cargar el SMTP de cada negocio desde su pantalla de Configuración y marcarlo como activo.
- `@eco/notificaciones` deja de depender de `nodemailer` y pasa a depender de `@eco/supabase`. La dependencia
  de correo real (`denomailer`) se mueve a la Edge Function, que corre en Deno.
- Los cuatro negocios arrancan con `smt_activo = false`: **hasta que un administrador configure su SMTP, ese
  negocio no envía correos**. Es intencional —no hay un remitente por defecto compartido que enmascare una
  configuración faltante— pero significa que el registro por correo queda inoperativo en un negocio recién
  creado hasta que se configure. Se refleja en el mensaje de error que ve el usuario.
- `cfg_smtp` lleva trigger de auditoría como cualquier otra tabla. Como la contraseña no está en la tabla, el
  registro de auditoría no puede filtrarla ni siquiera en `reg_datos_nuevos`.
