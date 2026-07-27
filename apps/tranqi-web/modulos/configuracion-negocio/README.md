# Módulo: Configuración de Negocio

Implementa `PLT-008`/`PLT-011`: identificación legal (NIT, nombre comercial, razón social) del negocio Tranqi y el canal de correo de notificaciones (`PLT-008` regla 2). Ver [ADR](../../../../gobernanza/productos/plataforma/especificacion-tecnica.md) §9.

## Acceso

Solo visible para `ADMINISTRADOR`/`SUPERADMIN` — es el widget `configuracion_negocio` (`20260727000010`), no un link fijo. Un `CLIENTE` (rol por defecto de todo registro nuevo, `PLT-003` regla 1) no lo ve en el panel; RLS (`cfg_negocio_admin_escritura`) también bloquea la escritura como respaldo si alguien navega directo a la URL.

## Correo de notificaciones (`PLT-008` regla 2)

Campo `correoNotificaciones` en `cfg_detalle_configuracion` (JSONB) — **solo captura el dato hoy**. No está conectado a envío real: los correos transaccionales de Supabase Auth (confirmación, reset de contraseña) siguen saliendo del remitente único configurado a nivel de proyecto, compartido por los 4 negocios. Conectar un remitente por negocio requiere un proveedor de correo transaccional con dominio propio verificado (evaluando Resend) y probablemente un Auth Email Hook — pendiente de decisión.

## Pendiente

- Redes sociales, canales de contacto adicionales, términos en Markdown y locales físicos (resto de `PLT-008`) — hoy viven sin UI en `cfg_detalle_configuracion` (JSONB). Se agregan como secciones nuevas de este mismo formulario cuando se prioricen.
- Envío real de correo por negocio (ver arriba).
