# Cierre de Tarea — Configuración ARIA por Negocio en Vault y Administradores del Ecosistema

- **Fecha:** 2026-11-11
- **Requerimientos:** `PLT-003`, `PLT-004`, `PLT-008` (Regla 7), `PLT-011`, `TNK-004` (`ADR-0002` + `ADR-0005`)

## Resumen de Cambios

1. **Administradores / SuperAdmins en todo el ecosistema (`kleber.toapanta.ch@gmail.com` y `jesus251296@gmail.com`):**
   - Migración `supabase/migrations/20261111000001_administradores_kleber_y_jesus_ecosistema.sql` que aprovisiona `usu_superadmin_plataforma = true` y perfiles `SUPERADMIN`, `ADMINISTRADOR` y `CLIENTE` en los 4 negocios, actualizando también `seg_fn_provisionar_usuario()`.
   - Homologación de correos de respaldo en `@eco/gestion-usuarios`, `tranqi-web`, `tinkay-web`, `fastfix-web`, `margaritas-web` y resolución de perfiles en minúsculas/mayúsculas en `@eco/identidad` (`obtenerPerfiles`, `obtenerNivelMaximo`).

2. **Pantalla común de parámetros ARIA por negocio (`/panel/aria`, widget `configuracion_aria`):**
   - Migración `supabase/migrations/20261111000002_cfg_aria_por_negocio_y_widget.sql`: tabla `comun_configuracion.cfg_aria` (RLS + trigger `aud_fn_auditar_tabla()`), RPCs `cfg_fn_guardar_aria`, `cfg_fn_borrar_aria_clave`, `cfg_fn_obtener_aria_credenciales` (exclusivo `service_role` con Supabase Vault), y registro/pre-asignación en `seg_widget` y `seg_rol_widget`.
   - Edge Function `supabase/functions/invocar-aria/index.ts` para descifrar `ARIA_AGENT_KEY` desde Vault e invocar ARIA sin exponer claves a la aplicación.
   - `invocarAgentePorNegocio()` en `packages/agentes-ia/src/index.ts` con respaldo automático a `ARIA_BASE` / `ARIA_AGENT_ID` / `ARIA_AGENT_KEY`, conectada a `/api/chat` en `tinkay-web` y `tranqi-web`.
   - Componente compartido `FormularioAria.tsx` (`@eco/configuracion-negocio`, cero clases Tailwind CSS, prueba en vivo de conexión) montado en `/panel/aria` de las 4 aplicaciones web y cableado en los 10 puntos de registro de widgets.
   - Corrección del respaldo local en `ChatAriaFlotante.tsx` (Tinkay) para no sugerir arreglos de condolencias en consultas generales.

