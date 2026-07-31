# Paquete: @eco/configuracion-negocio

Implementa `PLT-008`/`PLT-011`: identificación legal (NIT, nombre comercial, razón social) de un negocio y el canal de correo de notificaciones (`PLT-008` regla 2). Ver [`especificacion-tecnica.md` de Plataforma](../../gobernanza/productos/plataforma/especificacion-tecnica.md) §9.

**Común a los 4 negocios** (extraído de `tranqi-web` el 2026-07-27, mismo patrón que `@eco/identidad`). `actualizarConfiguracionNegocio()` y `obtenerConfiguracionNegocio()` reciben el slug del negocio como parámetro.

## Cómo lo consume una app

```tsx
// app/panel/configuracion/page.tsx
import { obtenerConfiguracionNegocio, FormularioConfiguracionNegocio } from "@eco/configuracion-negocio";

const NEGOCIO = "tranqi"; // "fastfix" | "tinkay" | "margaritas"

export default async function Pagina() {
  const configuracion = await obtenerConfiguracionNegocio(NEGOCIO);
  return <FormularioConfiguracionNegocio inicial={configuracion} negocio={NEGOCIO} />;
}
```

Solo visible para `ADMINISTRADOR`/`SUPERADMIN` — es el widget `configuracion_negocio` (`20260727000010`), no un link fijo. RLS (`cfg_negocio_admin_escritura`) también bloquea la escritura como respaldo si alguien navega directo a la URL.

## Correo de notificaciones (`PLT-008` regla 2)

Campo `correoNotificaciones` en `cfg_detalle_configuracion` (JSONB) — es el correo de contacto que se publica como canal de atención, no el remitente. El remitente real es lo de abajo.

## Servidor SMTP del negocio (`PLT-008` regla 6)

`FormularioSmtp` + `guardarSmtp()` / `borrarContrasenaSmtp()` + `obtenerSmtpNegocio()`. Guarda en `comun_configuracion.cfg_smtp` (tabla propia, **no** `cfg_negocio`: esa tiene lectura pública para `anon` y dejaría las credenciales expuestas).

Tres cosas que no son obvias al leer el código:

- **La contraseña no pasa por la tabla.** Va a Supabase Vault desde el RPC `cfg_fn_guardar_smtp`, y en `cfg_smtp` solo queda `smt_secreto_id`. Por eso `guardarSmtp()` no es un `update` como `actualizarConfiguracionNegocio()`: guardar el secreto y la fila tiene que ser atómico, y `cfg_smtp` no tiene política de escritura.
- **Nadie puede volver a leer la contraseña, ni el admin.** El campo vacío significa "consérvala"; hay una acción aparte para eliminarla. Es intencional, no una limitación de la UI.
- **El envío no ocurre aquí.** Lo hace la Edge Function `enviar-correo`, que es quien tiene `service_role` para descifrar el secreto. Ver [`ADR-0005`](../../gobernanza/arquitectura/adr/0005-smtp-por-negocio.md).

Mientras `smt_activo` sea `false` o falte host/usuario/contraseña, **ese negocio no envía correo** — no hay remitente compartido de respaldo.

**✅ Montado en las 4 apps** (`app/panel/configuracion/page.tsx` de cada una, 2026-07-27).

## Pendiente

- Redes sociales, canales de contacto adicionales, términos en Markdown y locales físicos (resto de `PLT-008`) — hoy viven sin UI en `cfg_detalle_configuracion` (JSONB).
- Botón de "enviar correo de prueba" en la sección SMTP: hoy la única forma de saber que la configuración es correcta es provocar un registro real.
