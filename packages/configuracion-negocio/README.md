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

Campo `correoNotificaciones` en `cfg_detalle_configuracion` (JSONB) — **solo captura el dato hoy**. No está conectado a envío real: los correos transaccionales de Supabase Auth (confirmación, reset de contraseña) siguen saliendo del remitente único configurado a nivel de proyecto, compartido por los 4 negocios. Conectar un remitente por negocio requiere un proveedor de correo transaccional con dominio propio verificado (evaluando Resend) y probablemente un Auth Email Hook — pendiente de decisión.

**✅ Montado en las 4 apps** (`app/panel/configuracion/page.tsx` de cada una, 2026-07-27).

## Pendiente

- Redes sociales, canales de contacto adicionales, términos en Markdown y locales físicos (resto de `PLT-008`) — hoy viven sin UI en `cfg_detalle_configuracion` (JSONB).
- Envío real de correo por negocio (ver arriba).
